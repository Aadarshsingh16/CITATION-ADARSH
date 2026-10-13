/**
 * Agent Research Loop (Phase 7, Part C, C1-C7, D-026, D-027, D-038)
 * Implements capped multi-round autonomous tool research with real-time SSE progress.
 */

import { AGENT_TOOLS_SPEC } from "./schemas";
import { executeAgentTool, type AgentToolContext } from "./tools";
import { completeChat, getLLMConfig, type ChatMessage, type ToolCall } from "../llm/client";
import { parseMessageContent } from "../llm/stream-parser";
import { verifyQuote, type Match } from "../quotes";
import type { DocumentWithChunks } from "../chunking/retrieval";
import type { Coverage } from "../types";

export interface AgentVerifiedQuote {
  id: string;
  documentId: string;
  documentTitle: string;
  text: string;
  verified: boolean;
  page?: number;
  unverifiedReason?: string;
  canonicalStart?: number;
  canonicalEnd?: number;
  isEllipsis?: boolean;
}

export interface AgentTraceStep {
  id: string;
  round: number;
  tool: string;
  args: unknown;
  status: "pending" | "success" | "error";
  message: string;
  durationMs?: number;
  timestamp: number;
}

export interface AgentLoopOptions {
  maxRounds?: number;
  maxToolCalls?: number;
  signal?: AbortSignal;
  onProgress?: (step: AgentTraceStep) => void;
  completeChatFn?: typeof completeChat;
}

export interface AgentResearchResult {
  answer: string;
  trace: AgentTraceStep[];
  quotes: AgentVerifiedQuote[];
  coverage: Coverage;
  roundsExecuted: number;
  toolCallsExecuted: number;
  interruptedByCap: boolean;
}

/**
 * Builds the system instructions for the autonomous document research agent.
 */
function buildAgentSystemPrompt(documents: DocumentWithChunks[]): string {
  const docList = documents
    .map((d) => `- [ID: ${d.id}] "${(d as any).title || d.filename || d.label || d.id}" (${d.chunks.length} chunks)`)
    .join("\n");

  return `You are an expert legal contract analyst in Agent Research mode.
You have access to tools to autonomously inspect, search, and read the contract documents before formulating an answer.

Target Documents:
${docList}

Available Tools:
1. search_document({ query, top_k, doc_id }): Finds matching chunks using BM25 keyword search.
2. get_section({ ref, chunk_id, doc_id }): Retrieves the full text of a specific clause or chunk.
3. list_clauses({ doc_id }): Retrieves the structural outline of headings and clauses.

Rules:
1. Conduct targeted lookups to gather sufficient evidence before answering.
2. NEVER guess or invent clause numbers, percentages, financial amounts, or terms.
3. Every factual claim in your final answer MUST quote the document using exact tags: <q doc="docId" p="page">exact verbatim text</q>.
4. If a clause or provision does not exist after thorough searching, state honestly that it was not found. Do not invent an answer.
5. When you have sufficient evidence, provide your comprehensive final answer. Do NOT make unnecessary tool calls.`;
}

/**
 * Parses plain text fallback JSON tool actions (D-038).
 */
function extractTextActionFallback(text: string): { tool: string; args: unknown } | null {
  const actionRegex = /\{[\s\r\n]*"action"[\s\r\n]*:[\s\r\n]*"([^"]+)"[\s\r\n]*,[\s\r\n]*"arguments"[\s\r\n]*:[\s\r\n]*(\{[\s\S]*?\})[\s\r\n]*\}/;
  const match = text.match(actionRegex);
  if (match) {
    try {
      return {
        tool: match[1],
        args: JSON.parse(match[2]),
      };
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Executes the agent research loop.
 */
export async function runAgentResearchLoop(
  question: string,
  documents: DocumentWithChunks[],
  selectedDocIds: string[],
  options: AgentLoopOptions = {}
): Promise<AgentResearchResult> {
  const config = getLLMConfig();
  const chatFn = options.completeChatFn ?? completeChat;
  const maxRounds = options.maxRounds ?? parseInt(process.env.MAX_AGENT_ROUNDS || "6", 10);
  const maxToolCalls = options.maxToolCalls ?? parseInt(process.env.MAX_AGENT_TOOL_CALLS || "12", 10);

  const context: AgentToolContext = {
    documents,
    selectedDocIds,
    readChunkIds: new Set<string>(),
  };

  const trace: AgentTraceStep[] = [];
  let rounds = 0;
  let toolCalls = 0;
  let consecutiveInvalid = 0;
  let interruptedByCap = false;

  const messages: ChatMessage[] = [
    { role: "system", content: buildAgentSystemPrompt(documents) },
    { role: "user", content: question },
  ];

  let finalAnswerContent = "";

  while (rounds < maxRounds && toolCalls < maxToolCalls) {
    if (options.signal?.aborted) break;

    rounds++;

    // Call the model with tool definitions
    const response = await chatFn({
      messages,
      tools: AGENT_TOOLS_SPEC,
      tool_choice: "auto",
      signal: options.signal,
      temperature: 0,
      maxTokens: 2048,
    });

    const assistantContent = response.content || "";
    let callsToExecute: Array<{ id: string; name: string; args: unknown }> = [];

    if (response.tool_calls && response.tool_calls.length > 0) {
      callsToExecute = response.tool_calls.map((c) => ({
        id: c.id,
        name: c.function.name,
        args: c.function.arguments,
      }));
    } else {
      // Check plain-text JSON fallback (D-038)
      const textAction = extractTextActionFallback(assistantContent);
      if (textAction) {
        callsToExecute.push({
          id: `call-fallback-${rounds}`,
          name: textAction.tool,
          args: textAction.args,
        });
      }
    }

    // If no tool calls produced, model delivered the final answer
    if (callsToExecute.length === 0) {
      finalAnswerContent = assistantContent;
      break;
    }

    // Append assistant's decision to messages
    messages.push({
      role: "assistant",
      content: assistantContent || null,
      tool_calls: response.tool_calls,
    });

    // Execute each tool call
    for (const call of callsToExecute) {
      if (toolCalls >= maxToolCalls) {
        interruptedByCap = true;
        break;
      }

      toolCalls++;
      const startTime = Date.now();
      const stepId = `trace-${rounds}-${toolCalls}`;

      // Emit pending progress
      const pendingStep: AgentTraceStep = {
        id: stepId,
        round: rounds,
        tool: call.name,
        args: call.args,
        status: "pending",
        message: `Executing ${call.name}...`,
        timestamp: startTime,
      };
      trace.push(pendingStep);
      options.onProgress?.(pendingStep);

      const result = await executeAgentTool(call.name, call.args, context);
      const durationMs = Date.now() - startTime;

      if (!result.ok) {
        consecutiveInvalid++;
      } else {
        consecutiveInvalid = 0;
      }

      const completedStep: AgentTraceStep = {
        id: stepId,
        round: rounds,
        tool: call.name,
        args: call.args,
        status: result.ok ? "success" : "error",
        message: result.progressMessage,
        durationMs,
        timestamp: Date.now(),
      };

      // Replace pending step in trace
      const idx = trace.findIndex((t) => t.id === stepId);
      if (idx >= 0) trace[idx] = completedStep;
      options.onProgress?.(completedStep);

      // Append tool result to messages
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name: call.name,
        content: JSON.stringify(result.data || { error: result.error, details: result.details }),
      });
    }

    if (consecutiveInvalid >= 3) {
      // Abort gracefully if model repeatedly fails
      const abortStep: AgentTraceStep = {
        id: `abort-${rounds}`,
        round: rounds,
        tool: "abort",
        args: {},
        status: "error",
        message: "Aborting loop after 3 consecutive invalid lookups",
        timestamp: Date.now(),
      };
      trace.push(abortStep);
      options.onProgress?.(abortStep);
      break;
    }
  }

  // If no final answer arrived yet (hit round cap or tool call cap), force one final synthesis call
  if (!finalAnswerContent) {
    interruptedByCap = true;
    const limitStep: AgentTraceStep = {
      id: "limit-notice",
      round: rounds,
      tool: "synthesize",
      args: {},
      status: "pending",
      message: "Reached research limit, synthesizing answer with retrieved evidence...",
      timestamp: Date.now(),
    };
    trace.push(limitStep);
    options.onProgress?.(limitStep);

    messages.push({
      role: "user",
      content: "Research limit reached. Formulate your final answer using only the evidence gathered above. Explicitly state that coverage is partial.",
    });

    const finalRes = await chatFn({
      messages,
      signal: options.signal,
      temperature: 0,
      maxTokens: 2048,
    });
    finalAnswerContent = finalRes.content;
  }

  // --------------------------------------------------------------------
  // Final Answer Quote Verification (C6, D-006)
  // --------------------------------------------------------------------
  const verifiedQuotes: AgentVerifiedQuote[] = [];
  const { quotes: parsedQuotes, cleanText } = parseMessageContent(
    finalAnswerContent,
    selectedDocIds,
    selectedDocIds[0] || "D1"
  );

  for (const q of parsedQuotes) {
    const parentDoc = documents.find((d) => d.id === q.docId);
    if (!parentDoc) continue;

    const docText = (parentDoc as any).canonicalText || parentDoc.text;
    const res = verifyQuote(q.text, docText);
    const verified = res.status === "verified";
    const match = res.status === "verified" ? res.matches[0] : undefined;

    const page = (parentDoc as any).pages?.find(
      (p: any) => match && match.start >= p.startOffset && match.start < p.endOffset
    )?.pageNumber || 1;

    verifiedQuotes.push({
      id: q.localId,
      documentId: q.docId,
      documentTitle: (parentDoc as any).title || parentDoc.filename || parentDoc.label || parentDoc.id,
      text: q.text,
      verified,
      page,
      unverifiedReason: res.status === "unverified" ? res.reason : undefined,
      canonicalStart: match?.start,
      canonicalEnd: match?.end,
      isEllipsis: res.status === "verified" && Boolean(res.withGaps),
    });
  }

  // Calculate coverage
  const totalChunks = documents.reduce((acc, d) => acc + d.chunks.length, 0);
  const chunksRead = context.readChunkIds.size;
  const coveragePercent = totalChunks > 0 ? Math.round((chunksRead / totalChunks) * 100) : 100;
  const isComplete = !interruptedByCap && (chunksRead === totalChunks || totalChunks <= 5);

  const coverage: Coverage = {
    complete: isComplete,
    chunksRead,
    chunksTotal: totalChunks,
    mode: "agent",
    unreadablePages: [],
  };

  return {
    answer: finalAnswerContent,
    trace,
    quotes: verifiedQuotes,
    coverage,
    roundsExecuted: rounds,
    toolCallsExecuted: toolCalls,
    interruptedByCap,
  };
}
