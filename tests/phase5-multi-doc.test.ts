import { strict as assert } from "node:assert";
import {
  buildChatSystemPrompt,
  buildChatUserMessage,
  type DocumentContextItem,
} from "../src/lib/llm/prompts";
import { verifyQuote, locateAll } from "../src/lib/quotes";
import { parseMessageContent, StreamTagParser } from "../src/lib/llm/stream-parser";
import { retrieveChunksForQuery, type DocumentWithChunks } from "../src/lib/chunking/retrieval";
import { createChat, insertMessage, insertQuote } from "../src/server/chat";
import { db } from "../src/server/db";
import { documents } from "../src/server/db/schema";
import { eq, inArray } from "drizzle-orm";

async function runPhase5Tests() {
  console.log("=== Running Phase 5 Multi-Document Acceptance Test Suite ===");
  let passed = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`PASS: ${name}`);
      passed++;
    } catch (err: unknown) {
      console.error(`FAIL: ${name}`);
      console.error(err);
      process.exitCode = 1;
    }
  }

  // --- Test 1: B5 Multi-Document Chat Session Persistence ---
  await test("1. B5: Create multi-doc chat session with 3 documents and verify scope=multi", async () => {
    // Insert 3 documents to satisfy foreign key constraints
    const insertedDocs = await db
      .insert(documents)
      .values([
        { filename: "Contract_A.pdf", mime: "application/pdf", sizeBytes: 100, status: "ready" },
        { filename: "Contract_B.pdf", mime: "application/pdf", sizeBytes: 100, status: "ready" },
        { filename: "Contract_C.pdf", mime: "application/pdf", sizeBytes: 100, status: "ready" },
      ])
      .returning();

    const docIds = insertedDocs.map((d) => d.id);

    try {
      const chat = await createChat(
        "multi",
        "Compare termination provisions across 3 contracts",
        docIds
      );

      assert.strictEqual(chat.scope, "multi");
      assert.strictEqual(chat.documentIds.length, 3);
      assert.deepStrictEqual(chat.documentIds, docIds);
    } finally {
      await db.delete(documents).where(inArray(documents.id, docIds));
    }
  });

  // --- Test 2: B5b Comparative Topical Prompt Structure ---
  await test("2. B5b: Prompt enforces side-by-side comparative topical structure and document blocks", () => {
    const prompt = buildChatSystemPrompt({ isMultiDoc: true });

    // Must enforce comparative structure
    assert(prompt.includes("MULTI-DOCUMENT COMPARATIVE RULES"));
    assert(prompt.includes("side-by-side"));
    assert(prompt.includes("Organise your response strictly by topic/theme"));
    assert(prompt.includes("Do NOT output separate document-by-document lists"));
    assert(prompt.includes("At least two document positions"));

    // User message must format all 3 document blocks with labels
    const docs: DocumentContextItem[] = [
      { docId: "D1", filename: "Master_Agreement.pdf", content: "Clause 1. Notice 60 days." },
      { docId: "D2", filename: "Vendor_Contract.pdf", content: "Clause 2. Notice 30 days." },
      { docId: "D3", filename: "Services_Addendum.pdf", content: "Clause 3. Immediate termination." },
    ];

    const userMessage = buildChatUserMessage("How do notice periods differ?", docs);
    assert(userMessage.includes('<document id="D1" filename="Master_Agreement.pdf">'));
    assert(userMessage.includes('<document id="D2" filename="Vendor_Contract.pdf">'));
    assert(userMessage.includes('<document id="D3" filename="Services_Addendum.pdf">'));
  });

  // --- Test 3: B6 Per-Quote Source Doc Label & Attribution ---
  await test("3. B6: Quotes in streamed content preserve and emit source docId", () => {
    const rawStream =
      "Regarding termination:\n" +
      "Under Contract A, <q id=\"1\" doc=\"D1\">Supplier may terminate upon 60 days written notice</q>.\n" +
      "Conversely, under Contract B, <q id=\"2\" doc=\"D2\">Customer may terminate for convenience with 30 days notice</q>.\n" +
      "Finally, Contract C specifies <q id=\"3\" doc=\"D3\">immediate termination for uncured material breach</q>.";

    const parsed = parseMessageContent(rawStream, ["D1", "D2", "D3"]);

    assert.strictEqual(parsed.quotes.length, 3);
    assert.strictEqual(parsed.quotes[0].docId, "D1");
    assert.strictEqual(parsed.quotes[1].docId, "D2");
    assert.strictEqual(parsed.quotes[2].docId, "D3");

    // Message segments retain docId for pill badging
    const quoteSegs = parsed.segments.filter((s) => s.type === "quote");
    assert.strictEqual(quoteSegs.length, 3);
    assert.strictEqual(quoteSegs[0].docId, "D1");
    assert.strictEqual(quoteSegs[1].docId, "D2");
    assert.strictEqual(quoteSegs[2].docId, "D3");
  });

  // --- Test 4: B7 Verification Against Own Doc Only & wrong_document Reason ---
  await test("4. B7: Quotes verify strictly against their own document; misattributions flag wrong_document", () => {
    const doc1Text =
      "1. Term and Notice\nSupplier may terminate this agreement upon 60 days written notice.";
    const doc2Text =
      "2. Default and Insolvency\nEither party may terminate immediately for insolvency or bankruptcy.";
    const doc3Text =
      "3. Convenience Termination\nCustomer may terminate for convenience with 30 days prior notice.";

    const otherTextsForD1 = { D2: doc2Text, D3: doc3Text };
    const otherTextsForD3 = { D1: doc1Text, D2: doc2Text };

    // 4.1 Legitimate quote for D1 verifies
    const resD1 = verifyQuote(
      "Supplier may terminate this agreement upon 60 days written notice",
      doc1Text,
      { otherDocTexts: otherTextsForD1 }
    );
    assert.strictEqual(resD1.status, "verified");

    // 4.2 Legitimate quote for D3 verifies
    const resD3 = verifyQuote(
      "Customer may terminate for convenience with 30 days prior notice",
      doc3Text,
      { otherDocTexts: otherTextsForD3 }
    );
    assert.strictEqual(resD3.status, "verified");

    // 4.3 Forced misattribution: Quote from D3 falsely claimed to be in D1
    const resMisattributed = verifyQuote(
      "Customer may terminate for convenience with 30 days prior notice",
      doc1Text, // Searching in D1 text
      { otherDocTexts: otherTextsForD1 } // D2 and D3 texts provided
    );

    assert.strictEqual(resMisattributed.status, "unverified");
    // Strictly flags wrong_document (D-016), never silently re-attributes
    assert.strictEqual(resMisattributed.reason, "wrong_document");
  });

  // --- Test 5: Identical Text in Multiple Docs Verified Against Tagged Doc Only ---
  await test("5. Edge Case: Identical text across multiple documents matches tagged document offsets only", () => {
    const docAText =
      "General Terms: This agreement shall be governed by the laws of England and Wales. (Offset A)";
    const docBText =
      "Header 100: Some preamble text here.\n" +
      "Governing Law: This agreement shall be governed by the laws of England and Wales. (Offset B)";

    const quoteStr = "This agreement shall be governed by the laws of England and Wales";

    const matchesA = locateAll(quoteStr, docAText);
    const matchesB = locateAll(quoteStr, docBText);

    assert.strictEqual(matchesA.length, 1);
    assert.strictEqual(matchesB.length, 1);

    // Offsets must reflect each document's distinct coordinate space
    assert.strictEqual(matchesA[0].start, 15);
    assert.strictEqual(matchesB[0].start, 52);
    assert.notStrictEqual(matchesA[0].start, matchesB[0].start);
  });

  // --- Test 6: Per-Document Coverage Object Tracking ---
  await test("6. Coverage: perDoc breakdown accurately tracks chunks read vs total across 3 documents", () => {
    const docsWithChunks: DocumentWithChunks[] = [
      {
        id: "d1",
        label: "D1",
        filename: "Agreement_Alpha.pdf",
        text: "Section 1: Alpha provisions. Section 2: Alpha liabilities.",
        chunks: [
          { id: "c1", documentId: "d1", ordinal: 1, startOffset: 0, endOffset: 28, tokenEst: 10 },
          { id: "c2", documentId: "d1", ordinal: 2, startOffset: 29, endOffset: 58, tokenEst: 10 },
        ],
      },
      {
        id: "d2",
        label: "D2",
        filename: "Agreement_Beta.pdf",
        text: "Section 1: Beta provisions. Section 2: Beta liabilities. Section 3: Beta termination.",
        chunks: [
          { id: "c3", documentId: "d2", ordinal: 1, startOffset: 0, endOffset: 27, tokenEst: 10 },
          { id: "c4", documentId: "d2", ordinal: 2, startOffset: 28, endOffset: 55, tokenEst: 10 },
          { id: "c5", documentId: "d2", ordinal: 3, startOffset: 56, endOffset: 85, tokenEst: 10 },
        ],
      },
      {
        id: "d3",
        label: "D3",
        filename: "Agreement_Gamma.pdf",
        text: "Section 1: Gamma terms. Section 2: Gamma warranties.",
        chunks: [
          { id: "c6", documentId: "d3", ordinal: 1, startOffset: 0, endOffset: 23, tokenEst: 10 },
          { id: "c7", documentId: "d3", ordinal: 2, startOffset: 24, endOffset: 52, tokenEst: 10 },
        ],
      },
    ];

    const result = retrieveChunksForQuery(docsWithChunks, "Alpha liabilities", { topK: 1 });
    const cov = result.coverage;

    assert.strictEqual(cov.complete, false);
    assert(cov.perDoc !== undefined);

    // Verify perDoc coverage exists for all 3 documents
    assert.strictEqual(cov.perDoc!["D1"].chunksTotal, 2);
    assert.strictEqual(cov.perDoc!["D2"].chunksTotal, 3);
    assert.strictEqual(cov.perDoc!["D3"].chunksTotal, 2);

    // D1 was targeted, so D1 has read chunks
    assert(cov.perDoc!["D1"].chunksRead >= 1);
  });

  // --- Test 7: P5 Exit Gate Comparative Question Structure ---
  await test("7. P5 Exit Gate: Multi-doc answer contains side-by-side topics with at least 2 doc labels per topic", () => {
    // Simulated model response following B5b guidelines:
    const mockAnswer =
      "### Termination Notice Periods\n" +
      "Under Agreement 1, <q id=\"1\" doc=\"D1\">Supplier may terminate upon 60 days written notice</q>.\n" +
      "In contrast, Agreement 2 provides that <q id=\"2\" doc=\"D2\">Customer may terminate with 30 days notice</q>.\n\n" +
      "### Immediate Termination for Cause\n" +
      "Agreement 2 allows <q id=\"3\" doc=\"D2\">immediate termination for insolvency or bankruptcy</q>.\n" +
      "Similarly, Agreement 3 permits <q id=\"4\" doc=\"D3\">immediate termination for uncured material breach</q>.";

    // Split answer by topic headings (###)
    const topics = mockAnswer
      .split(/###\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    assert.strictEqual(topics.length, 2, "Must contain at least 2 comparative topic sections");

    for (const topic of topics) {
      const parsedTopic = parseMessageContent(topic, ["D1", "D2", "D3"]);
      const distinctDocsInTopic = new Set(parsedTopic.quotes.map((q) => q.docId));

      // B5b requirement: At least 2 doc labels appear per topic
      assert(
        distinctDocsInTopic.size >= 2,
        `Topic must compare at least 2 documents side-by-side. Found ${distinctDocsInTopic.size}`
      );
    }
  });

  console.log("\n========================================");
  console.log(`Results: ${passed} passed, ${process.exitCode ? 1 : 0} failed`);
  console.log("========================================\n");
}

void runPhase5Tests();
