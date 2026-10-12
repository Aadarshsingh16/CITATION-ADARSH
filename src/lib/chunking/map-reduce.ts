/**
 * Map-reduce engine for whole-document queries (existence, absence, "list all", summary).
 * Implements batching (~6,000 tokens), concurrency 4, immediate candidate verification,
 * and retry on failed map calls (SKILL.md & ARCHITECTURE.md).
 */

import { verifyQuote, type Match } from "../quotes";
import { completeChat, streamChatCompletion, type ChatMessage } from "../llm/client";
import type { ChunkRecord, Coverage } from "../types";
import type { DocumentWithChunks } from "./retrieval";

export interface BatchItem {
  batchIndex: number;
  docId: string;
  docLabel: string;
  filename: string;
  chunks: ChunkRecord[];
  text: string;
  startOffset: number;
  endOffset: number;
  tokenEst: number;
}

export interface VerifiedCandidate {
  docId: string;
  docLabel: string;
  quote: string;
  why: string;
  matches: Match[];
  clauseRef?: string | null;
  heading?: string | null;
}

export interface MapReduceOptions {
  documents: DocumentWithChunks[];
  question: string;
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?: (step: string, percent: number) => void;
}

/**
 * Groups chunks into batches of ~6,000 tokens with 1-chunk overlap between adjacent batches.
 */
export function createMapBatches(
  documents: DocumentWithChunks[],
  targetTokens = 6000
): BatchItem[] {
  const batches: BatchItem[] = [];
  let batchIndex = 0;

  for (const doc of documents) {
    if (doc.chunks.length === 0) {
      if (doc.text) {
        // Fallback for doc without chunks
        batches.push({
          batchIndex: batchIndex++,
          docId: doc.id,
          docLabel: doc.label,
          filename: doc.filename,
          chunks: [],
          text: doc.text,
          startOffset: 0,
          endOffset: doc.text.length,
          tokenEst: Math.ceil(doc.text.length / 4),
        });
      }
      continue;
    }

    let currentBatchChunks: ChunkRecord[] = [];
    let currentTokens = 0;

    for (let i = 0; i < doc.chunks.length; i++) {
      const chunk = doc.chunks[i];
      currentBatchChunks.push(chunk);
      currentTokens += chunk.tokenEst || Math.ceil((chunk.endOffset - chunk.startOffset) / 4);

      const isLastChunk = i === doc.chunks.length - 1;
      if (currentTokens >= targetTokens || isLastChunk) {
        const startOffset = currentBatchChunks[0].startOffset;
        const endOffset = currentBatchChunks[currentBatchChunks.length - 1].endOffset;
        const batchText = doc.text.slice(startOffset, endOffset);

        batches.push({
          batchIndex: batchIndex++,
          docId: doc.id,
          docLabel: doc.label,
          filename: doc.filename,
          chunks: [...currentBatchChunks],
          text: batchText,
          startOffset,
          endOffset,
          tokenEst: currentTokens,
        });

        // Start next batch with 1-chunk overlap if not last
        if (!isLastChunk) {
          const overlapChunk = currentBatchChunks[currentBatchChunks.length - 1];
          currentBatchChunks = [overlapChunk];
          currentTokens = overlapChunk.tokenEst || Math.ceil((overlapChunk.endOffset - overlapChunk.startOffset) / 4);
        } else {
          currentBatchChunks = [];
          currentTokens = 0;
        }
      }
    }
  }

  return batches;
}

/**
 * Builds the map prompt for examining a single batch.
 */
function buildMapPrompt(
  question: string,
  batch: BatchItem
): { system: string; user: string } {
  const system = `You are a contract analysis extractor.
Your job is to read a contract section and extract verbatim clauses relevant to the question.
Output strictly valid JSON with this schema:
{
  "relevant": boolean,
  "candidates": [
    { "quote": "EXACT verbatim quote string", "why": "short explanation" }
  ]
}
STRICT RULES:
1. "quote" MUST be copied character-for-character from the text. NEVER paraphrase or modify any word.
2. Every quote will be verified programmatically; paraphrased quotes will be dropped.
3. If no relevant clauses exist in this section, output: { "relevant": false, "candidates": [] }.
Do not output markdown codeblocks or any commentary outside the JSON object.`;

  const user = `Question: "${question}"

Contract Section (${batch.filename}):
${batch.text}

Respond ONLY with JSON:`;

  return { system, user };
}

/**
 * Executes async tasks with capped concurrency.
 */
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      results[idx] = await fn(items[idx], idx);
    }
  });

  await Promise.all(workers);
  return results;
}

export interface MapReducePlanResult {
  batches: BatchItem[];
  verifiedCandidates: VerifiedCandidate[];
  failedBatchCount: number;
  readChunkIds: Set<string>;
  totalChunkCount: number;
  coverage: Coverage;
  reduceMessages: ChatMessage[];
}

/**
 * Executes the Map phase across all batches with concurrency 4 and immediate verification.
 */
export async function executeMapPhase(
  options: MapReduceOptions
): Promise<MapReducePlanResult> {
  const { documents, question, concurrency = 4, signal, onProgress } = options;
  const batches = createMapBatches(documents);

  const totalChunkCount = documents.reduce((sum, d) => sum + d.chunks.length, 0);
  const readChunkIds = new Set<string>();
  const verifiedCandidates: VerifiedCandidate[] = [];
  let failedBatchCount = 0;

  onProgress?.(`Starting map analysis across ${batches.length} sections...`, 5);

  let completedBatches = 0;

  await runWithConcurrency(batches, concurrency, async (batch, idx) => {
    if (signal?.aborted) return;

    let success = false;
    let attempts = 0;

    while (attempts < 2 && !success && !signal?.aborted) {
      attempts++;
      try {
        const { system, user } = buildMapPrompt(question, batch);
        const res = await completeChat({
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          signal,
          temperature: 0,
          maxTokens: 1024,
        });

        // Parse JSON output
        let cleanJsonStr = res.content.trim();
        if (cleanJsonStr.startsWith("```")) {
          cleanJsonStr = cleanJsonStr.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
        }

        const parsed = JSON.parse(cleanJsonStr);
        if (parsed && Array.isArray(parsed.candidates)) {
          for (const cand of parsed.candidates) {
            if (cand && typeof cand.quote === "string" && cand.quote.trim().length >= 15) {
              // Immediate candidate verification against batch text (SKILL.md)
              const vRes = verifyQuote(cand.quote, batch.text);
              if (vRes.status === "verified" && vRes.matches.length > 0) {
                // Adjust match offsets to document canonical text
                const docMatches = vRes.matches.map((m) => ({
                  start: batch.startOffset + m.start,
                  end: batch.startOffset + m.end,
                }));

                verifiedCandidates.push({
                  docId: batch.docId,
                  docLabel: batch.docLabel,
                  quote: cand.quote,
                  why: cand.why || "",
                  matches: docMatches,
                  clauseRef: batch.chunks[0]?.clauseRef,
                  heading: batch.chunks[0]?.heading,
                });
              }
            }
          }
        }

        // Successfully read chunks in this batch
        for (const c of batch.chunks) {
          readChunkIds.add(c.id);
        }
        success = true;
      } catch {
        if (attempts >= 2) {
          // Retried once and still failed; mark batch failed
          failedBatchCount++;
        }
      }
    }

    completedBatches++;
    const pct = Math.round(5 + (completedBatches / batches.length) * 85);
    onProgress?.(`Analyzed ${completedBatches} of ${batches.length} sections...`, pct);
  });

  // Calculate Coverage
  const chunksTotal = Math.max(totalChunkCount, batches.length);
  const chunksRead = totalChunkCount > 0 ? readChunkIds.size : batches.length - failedBatchCount;
  const allUnreadable = Array.from(
    new Set(documents.flatMap((d) => d.unreadablePages || []))
  );

  const perDocCoverage: Record<string, { chunksTotal: number; chunksRead: number }> = {};
  for (const doc of documents) {
    const docRead = doc.chunks.filter((c) => readChunkIds.has(c.id)).length;
    perDocCoverage[doc.label] = {
      chunksTotal: doc.chunks.length,
      chunksRead: docRead,
    };
  }

  const isComplete = failedBatchCount === 0 && allUnreadable.length === 0;

  const coverage: Coverage = {
    mode: "map_reduce",
    chunksTotal,
    chunksRead,
    complete: isComplete,
    unreadablePages: allUnreadable,
    perDoc: perDocCoverage,
  };

  // Build Reduce Prompt Messages
  const reduceMessages = buildReduceMessages({
    question,
    verifiedCandidates,
    coverage,
    documents,
  });

  return {
    batches,
    verifiedCandidates,
    failedBatchCount,
    readChunkIds,
    totalChunkCount,
    coverage,
    reduceMessages,
  };
}

/**
 * Builds messages for the Reduce step.
 */
function buildReduceMessages(options: {
  question: string;
  verifiedCandidates: VerifiedCandidate[];
  coverage: Coverage;
  documents: DocumentWithChunks[];
}): ChatMessage[] {
  const { question, verifiedCandidates, coverage, documents } = options;

  let systemPrompt = `You are a legal contract assistant writing a definitive, grounded answer based on verified contract clauses.
Your answer must strictly adhere to the provided evidence.

### CITATION RULES
1. Ground every substantive statement in verbatim quotes wrapped in inline tags:
   <q id="1" doc="DOC_ID">exact verbatim quote</q>
2. You must ONLY quote text that appears in the verified evidence provided below.`;

  if (!coverage.complete) {
    systemPrompt += `\n\n### CRITICAL - PARTIAL COVERAGE RULE
You have only read a subset of the document (${coverage.chunksRead} of ${coverage.chunksTotal} sections).
You MUST NOT state that a term or clause "does not exist in the contract".
You must state what you found and hedge any absence statements: "I did not find [topic] in the sections searched (${coverage.chunksRead} of ${coverage.chunksTotal} sections)."`;
  } else {
    systemPrompt += `\n\n### ABSENCE RULE
The complete document has been exhaustively analyzed across all sections.
If no relevant clauses were found, state clearly and honestly:
"The contract does not contain any [topic] clause or provision."
Do NOT invent or fabricate any clause.`;
  }

  let evidenceStr = "";
  if (verifiedCandidates.length === 0) {
    evidenceStr = `EXHAUSTIVE SEARCH RESULT: All ${coverage.chunksTotal} sections were analyzed. Zero relevant clauses or provisions were found for this query.`;
  } else {
    evidenceStr = `VERIFIED CLAUSE EVIDENCE:\n`;
    for (let i = 0; i < verifiedCandidates.length; i++) {
      const c = verifiedCandidates[i];
      evidenceStr += `[Evidence ${i + 1}] (Doc ${c.docLabel}): "${c.quote}"\n`;
      if (c.why) evidenceStr += `Relevance: ${c.why}\n`;
      evidenceStr += `\n`;
    }
  }

  const userPrompt = `${evidenceStr}
Based solely on the verified evidence above, provide a clear, comprehensive answer to the question:
"${question}"`;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}

/**
 * Streams the final Reduce answer.
 */
export async function* streamReduceAnswer(
  reduceMessages: ChatMessage[],
  signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  for await (const chunk of streamChatCompletion({
    messages: reduceMessages,
    signal,
    temperature: 0,
    maxTokens: 2048,
  })) {
    yield chunk;
  }
}
