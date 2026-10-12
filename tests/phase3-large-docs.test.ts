import assert from "node:assert";
import { chunkCanonicalText } from "../src/lib/chunking/chunker";
import { routeQuestionMode } from "../src/lib/chunking/router";
import { retrieveChunksForQuery, type DocumentWithChunks } from "../src/lib/chunking/retrieval";
import { createMapBatches, type BatchItem } from "../src/lib/chunking/map-reduce";
import { buildChatSystemPrompt } from "../src/lib/llm/prompts";
import { verifyQuote } from "../src/lib/quotes";
import { createSyntheticPdf } from "../src/lib/test-fixtures/pdf-generator";
import { extractPdf } from "../src/lib/ingestion/extract-pdf";
import { buildCanonicalFromPdf } from "../src/lib/ingestion/canonical";

console.log("=== Running Phase 3 Large Documents & Coverage Test Suite ===");

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res
        .then(() => {
          console.log(`PASS: ${name}`);
          passed++;
        })
        .catch((err) => {
          console.error(`FAIL: ${name}`);
          console.error(err);
          failed++;
        });
    } else {
      console.log(`PASS: ${name}`);
      passed++;
    }
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(err);
    failed++;
  }
}

async function run() {
  // Test 1: Router picking mode based on budget and query intent
  test("1. Router picks full when within budget, map_reduce for existence, retrieval for targeted", () => {
    // Fits budget
    const modeSmall = routeQuestionMode({
      question: "Is there a termination clause?",
      totalTokens: 5000,
      contextBudget: 60000,
    });
    assert.strictEqual(modeSmall, "full");

    // Over budget + existence query -> map_reduce
    const modeExistence = routeQuestionMode({
      question: "Is there a termination for convenience clause?",
      totalTokens: 80000,
      contextBudget: 60000,
    });
    assert.strictEqual(modeExistence, "map_reduce");

    // Over budget + absence query -> map_reduce
    const modeAbsence = routeQuestionMode({
      question: "Does the agreement contain any liquidated damages provision?",
      totalTokens: 100000,
      contextBudget: 60000,
    });
    assert.strictEqual(modeAbsence, "map_reduce");

    // Over budget + list all query -> map_reduce
    const modeListAll = routeQuestionMode({
      question: "List all warranties provided by the supplier",
      totalTokens: 90000,
      contextBudget: 60000,
    });
    assert.strictEqual(modeListAll, "map_reduce");

    // Over budget + summary query -> map_reduce
    const modeSummary = routeQuestionMode({
      question: "Provide an overview summary of the agreement terms",
      totalTokens: 75000,
      contextBudget: 60000,
    });
    assert.strictEqual(modeSummary, "map_reduce");

    // Over budget + targeted clause lookup -> retrieval
    const modeTargeted = routeQuestionMode({
      question: "What is the notice period in section 14.2?",
      totalTokens: 90000,
      contextBudget: 60000,
    });
    assert.strictEqual(modeTargeted, "retrieval");
  });

  // Test 2: BM25 Retrieval produces partial coverage and neighbors
  test("2. BM25 Retrieval returns relevant chunks and always marks coverage partial", () => {
    // Long contract text with multiple substantial clauses
    const clauses = [
      "Clause 1. Definitions and Interpretation\n" +
        "1.1 In this Agreement, Confidential Information means all proprietary technical information. ".repeat(60),
      "Clause 2. Scope of Services\n" +
        "2.1 The Contractor shall perform the integration deliverables set forth in Exhibit A. ".repeat(60),
      "Clause 3. Payment and Fees\n" +
        "3.1 Invoices shall be payable within thirty (30) days from receipt of a valid VAT invoice. ".repeat(60),
      "Clause 4. Term and Termination\n" +
        "4.1 Either party may terminate this Agreement without cause upon 60 days prior written notice. ".repeat(60),
      "Clause 5. Governing Law and Jurisdiction\n" +
        "5.1 This Agreement is governed by the laws of the Dubai International Financial Centre. ".repeat(60),
    ];

    const docText = clauses.join("\n\n");
    const chunks = chunkCanonicalText(docText);
    assert.ok(chunks.length >= 3, `Expected at least 3 chunks, got ${chunks.length}`);

    const docWithChunks: DocumentWithChunks = {
      id: "doc-1",
      label: "D1",
      filename: "Master_Agreement.pdf",
      text: docText,
      chunks: chunks.map((c, i) => ({
        id: `chunk-${i}`,
        documentId: "doc-1",
        ordinal: c.ordinal,
        startOffset: c.startOffset,
        endOffset: c.endOffset,
        heading: c.heading,
        clauseRef: c.clauseRef,
        tokenEst: c.tokenEst,
      })),
    };

    const res = retrieveChunksForQuery([docWithChunks], "What are the payment and VAT invoice terms?", {
      topK: 1,
      includeNeighbors: true,
    });

    // Retrieval must ALWAYS mark complete = false
    assert.strictEqual(res.coverage.complete, false);
    assert.strictEqual(res.coverage.mode, "retrieval");
    assert.ok(res.coverage.chunksRead > 0);
    assert.ok(res.coverage.chunksRead < res.coverage.chunksTotal);
    assert.ok(res.contextText.includes("Clause 3") || res.contextText.includes("VAT invoice"));
  });

  // Test 3: Prompt rules forbidding absence claims on partial coverage (A15)
  test("3. Prompt rules strictly forbid stating absence when complete is false", () => {
    const completePrompt = buildChatSystemPrompt({
      isCoveragePartial: false,
    });
    assert.ok(!completePrompt.includes("CRITICAL - PARTIAL COVERAGE"));
    assert.ok(completePrompt.toLowerCase().includes("the provided text does not contain or mention"));

    const partialPrompt = buildChatSystemPrompt({
      isCoveragePartial: true,
      chunksRead: 14,
      chunksTotal: 50,
    });

    assert.ok(partialPrompt.includes("CRITICAL - PARTIAL COVERAGE"));
    assert.ok(partialPrompt.includes("MUST NEVER state that a term or clause \"does not exist in the contract\""));
    assert.ok(partialPrompt.includes("I did not find [topic] in the sections searched (14 of 50 sections)"));
  });

  // Test 4: Map-reduce batching groups chunks up to ~6,000 tokens with overlap
  test("4. Map-reduce batches group chunks up to ~6,000 tokens with overlap", () => {
    // Synthetic large document with 20 chunks
    const chunks: DocumentWithChunks["chunks"] = [];
    let text = "";
    let offset = 0;

    for (let i = 1; i <= 20; i++) {
      const sectionText = `Clause ${i}. Section Heading ${i}\n` +
        `This section establishes contract obligations for term ${i}. ` +
        "Standard commercial conditions apply throughout the performance period. ".repeat(40) + "\n\n";

      const start = offset;
      const end = offset + sectionText.length;
      text += sectionText;
      offset = end;

      chunks.push({
        id: `chunk-${i}`,
        documentId: "doc-large",
        ordinal: i,
        startOffset: start,
        endOffset: end,
        heading: `Section Heading ${i}`,
        clauseRef: `Clause ${i}`,
        tokenEst: Math.ceil(sectionText.length / 4),
      });
    }

    const doc: DocumentWithChunks = {
      id: "doc-large",
      label: "D1",
      filename: "Large_Contract.pdf",
      text,
      chunks,
    };

    const batches = createMapBatches([doc], 3000);
    assert.ok(batches.length > 1, "Batches are created for large document");

    // Verify batch coverage spans all chunks
    const allChunkIdsInBatches = new Set<string>();
    for (const b of batches) {
      for (const c of b.chunks) {
        allChunkIdsInBatches.add(c.id);
      }
    }
    assert.strictEqual(allChunkIdsInBatches.size, chunks.length);

    // Verify overlap between adjacent batches
    if (batches.length >= 2) {
      const lastChunkBatch1 = batches[0].chunks[batches[0].chunks.length - 1];
      const firstChunkBatch2 = batches[1].chunks[0];
      assert.strictEqual(lastChunkBatch1.id, firstChunkBatch2.id, "1-chunk overlap between adjacent batches");
    }
  });

  // Test 5: Immediate candidate verification in map phase discards hallucinated quotes
  test("5. Map phase immediately verifies candidate quotes and discards paraphrases", () => {
    const batchText = "Clause 14. Termination for Convenience. Either party may terminate this Agreement at any time without penalty upon thirty (30) days prior written notice to the other party.";

    const genuineCandidate = "Either party may terminate this Agreement at any time without penalty upon thirty (30) days prior written notice";
    const vGenuine = verifyQuote(genuineCandidate, batchText);
    assert.strictEqual(vGenuine.status, "verified");

    // Paraphrased quote from an imaginative LLM
    const paraphrasedCandidate = "Either party may cancel the contract anytime with 30 days notice";
    const vParaphrase = verifyQuote(paraphrasedCandidate, batchText);
    assert.strictEqual(vParaphrase.status, "unverified");
    assert.strictEqual((vParaphrase as any).reason, "not_found");
  });

  // Test 6: A14 & Exit Gate - 150-page contract chunking and map-reduce coverage
  await test("6. P3 Exit Gate: 150-page PDF generates comprehensive chunk batches with 100% coverage", async () => {
    const pages150 = Array.from({ length: 150 }, (_, i) => {
      const num = i + 1;
      return `Clause ${num}. Commercial Provision ${num}\n` +
        `This section establishes binding operational rules and SLA requirements for tier ${num}.\n` +
        `All deliveries shall adhere strictly to technical specification Schedule ${num}.`;
    });

    const pdfBuf = createSyntheticPdf(pages150);
    const extRes = await extractPdf(pdfBuf);
    assert.strictEqual(extRes.success, true);
    if (!extRes.success) return;

    const canonical = buildCanonicalFromPdf(extRes.pages);
    assert.strictEqual(canonical.pageCount, 150);

    const chunkDrafts = chunkCanonicalText(canonical.text);
    assert.ok(chunkDrafts.length >= 5, "150-page contract splits into chunk drafts");

    const doc: DocumentWithChunks = {
      id: "doc-150p",
      label: "D1",
      filename: "150_Page_Agreement.pdf",
      text: canonical.text,
      chunks: chunkDrafts.map((c, i) => ({
        id: `c-${i}`,
        documentId: "doc-150p",
        ordinal: c.ordinal,
        startOffset: c.startOffset,
        endOffset: c.endOffset,
        heading: c.heading,
        clauseRef: c.clauseRef,
        tokenEst: c.tokenEst,
      })),
    };

    const batches = createMapBatches([doc], 6000);
    assert.ok(batches.length >= 2, "Generates map batches for 150 pages");

    // Check all chunks covered
    const coveredChunkIds = new Set<string>();
    for (const b of batches) {
      for (const c of b.chunks) {
        coveredChunkIds.add(c.id);
      }
    }
    assert.strictEqual(coveredChunkIds.size, doc.chunks.length);

    // Verify 5 varied queries route accurately (A14)
    const q1 = "Is there a termination for convenience clause?";
    const q2 = "What are the payment milestones in Schedule 12?";
    const q3 = "List all confidentiality obligations across all tiers";
    const q4 = "What is the dispute resolution venue?";
    const q5 = "Is there any liquidated damages penalty?";

    assert.strictEqual(routeQuestionMode({ question: q1, totalTokens: 80000 }), "map_reduce");
    assert.strictEqual(routeQuestionMode({ question: q2, totalTokens: 80000 }), "retrieval");
    assert.strictEqual(routeQuestionMode({ question: q3, totalTokens: 80000 }), "map_reduce");
    assert.strictEqual(routeQuestionMode({ question: q4, totalTokens: 80000 }), "map_reduce");
    assert.strictEqual(routeQuestionMode({ question: q5, totalTokens: 80000 }), "map_reduce");
  });

  console.log("\n========================================");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("========================================");

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
