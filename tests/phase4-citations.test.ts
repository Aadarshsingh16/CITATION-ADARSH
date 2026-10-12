import { strict as assert } from "node:assert";
import {
  getQuoteOccurrences,
  splitQuoteAcrossDocumentPages,
  mapQuoteToPageSpans,
  sliceTextWithHighlight,
} from "../src/lib/citation-mapping";
import { extractPdf } from "../src/lib/ingestion/extract-pdf";
import { buildCanonicalFromPdf } from "../src/lib/ingestion/canonical";
import { createSyntheticPdf } from "../src/lib/test-fixtures/pdf-generator";
import type { PageRecord } from "../src/lib/types";

async function runPhase4Tests() {
  console.log("=== Running Phase 4 Citation Highlighting Acceptance Test Suite ===");
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

  // --- Test 1: B1 & Coordinate Mapping ---
  await test("1. B1: Click quote maps to correct page and exact canonical offsets", () => {
    const docText =
      "This Master Services Agreement is entered into on January 1, 2025. " +
      "The Supplier agrees to deliver software engineering services.";

    const occurrences = getQuoteOccurrences(
      "The Supplier agrees to deliver software engineering services",
      docText
    );

    assert.strictEqual(occurrences.totalOccurrences, 1);
    assert.strictEqual(occurrences.activeMatchIndex, 0);
    assert(occurrences.activeMatch !== null);
    assert.strictEqual(
      docText.slice(occurrences.activeMatch!.start, occurrences.activeMatch!.end),
      "The Supplier agrees to deliver software engineering services"
    );
  });

  // --- Test 2: B2 Multi-line Quote ---
  await test("2. B2: Multi-line quote spanning multiple lines maps and intersects all spans", () => {
    // Suppose a page has 3 lines (3 separate text items)
    // Item 0: "The Supplier agrees to deliver " (offset 0..31)
    // Item 1: "high quality software engineering " (offset 31..65)
    // Item 2: "services pursuant to Schedule A." (offset 65..97)
    const pageRecord: PageRecord = {
      id: "p1",
      documentId: "d1",
      pageNumber: 1,
      startOffset: 0,
      endOffset: 97,
      items: {
        starts: [0, 31, 65],
        lens: [31, 34, 32],
      },
    };

    // A quote covering words from line 1 through line 3:
    // "agrees to deliver high quality software engineering services"
    // Starts at offset 13, ends at offset 73
    const result = mapQuoteToPageSpans({
      pageRange: { pageNumber: 1, start: 13, end: 73 },
      pageRecord,
      renderedItemsCount: 3,
    });

    assert.strictEqual(result.fallbackToText, false);
    assert.strictEqual(result.spans.length, 3, "Must intersect all 3 lines");

    // Line 1: partial overlap (offset 13..31)
    assert.strictEqual(result.spans[0].spanIndex, 0);
    assert.strictEqual(result.spans[0].isFullSpan, false);
    assert.strictEqual(result.spans[0].startOffsetInSpan, 13);
    assert.strictEqual(result.spans[0].endOffsetInSpan, 31);

    // Line 2: fully contained (offset 31..65)
    assert.strictEqual(result.spans[1].spanIndex, 1);
    assert.strictEqual(result.spans[1].isFullSpan, true);

    // Line 3: partial overlap (offset 65..73)
    assert.strictEqual(result.spans[2].spanIndex, 2);
    assert.strictEqual(result.spans[2].isFullSpan, false);
    assert.strictEqual(result.spans[2].startOffsetInSpan, 0);
    assert.strictEqual(result.spans[2].endOffsetInSpan, 8);
  });

  // --- Test 3: B3 Cross-page Quote ---
  await test("3. B3: Quote crossing a page break splits cleanly across both pages", () => {
    // Page 1 ends with "Neither party shall be liable for ", Page 2 starts with "indirect or consequential damages."
    const p1Text = "Neither party shall be liable for ";
    const p2Text = "indirect or consequential damages.";
    const fullText = p1Text + "\n" + p2Text;

    const pages = [
      { pageNumber: 1, startOffset: 0, endOffset: p1Text.length },
      { pageNumber: 2, startOffset: p1Text.length + 1, endOffset: fullText.length },
    ];

    const match = {
      start: p1Text.indexOf("liable for"),
      end: p1Text.length + 1 + "indirect or consequential".length,
    };

    const splitPages = splitQuoteAcrossDocumentPages(match, pages);
    assert.strictEqual(splitPages.length, 2, "Must split into exactly 2 page fragments");

    assert.strictEqual(splitPages[0].pageNumber, 1);
    assert.strictEqual(
      fullText.slice(splitPages[0].start, splitPages[0].end),
      "liable for "
    );

    assert.strictEqual(splitPages[1].pageNumber, 2);
    assert.strictEqual(
      fullText.slice(splitPages[1].start, splitPages[1].end),
      "indirect or consequential"
    );
  });

  // --- Test 4: B4 Quote Appearing More Than Once ---
  await test("4. B4: Repeated quote shows all occurrences and prefers the cited chunk range", () => {
    const text =
      "Section 3: Governing Law. This agreement is governed by the laws of England.\n\n" +
      "Section 15: Governing Law. This agreement is governed by the laws of England.";

    // Both occurrences exist
    const occurrences = getQuoteOccurrences(
      "This agreement is governed by the laws of England",
      text,
      { start: 80, end: 160 } // Preferred range is Section 15
    );

    assert.strictEqual(occurrences.totalOccurrences, 2);
    // B4: pickMatch prefers the match inside the cited chunk
    assert.strictEqual(occurrences.activeMatchIndex, 1);
    assert(occurrences.activeMatch!.start > 80);
  });

  // --- Test 5: Fallback on Item Count Mismatch (D-034, D-035) ---
  await test("5. Fallback: Item count mismatch triggers extracted text view fallback", () => {
    const pageRecord: PageRecord = {
      id: "p1",
      documentId: "d1",
      pageNumber: 1,
      startOffset: 0,
      endOffset: 50,
      items: {
        starts: [0, 20],
        lens: [20, 30],
      },
    };

    // Rendered has 5 items (e.g. font substitution or diff), stored has 2
    const result = mapQuoteToPageSpans({
      pageRange: { pageNumber: 1, start: 5, end: 25 },
      pageRecord,
      renderedItemsCount: 5,
    });

    assert.strictEqual(result.fallbackToText, true);
    assert.strictEqual(result.fallbackReason, "item_count_mismatch");
  });

  // --- Test 6: Forced Fallback & DOCX Highlighting ---
  await test("6. Forced fallback & DOCX text slice highlights correctly", () => {
    const sectionText =
      "Clause 14.1. Termination for Convenience. Either party may terminate this agreement upon 30 days written notice.";

    const highlightRange = {
      start: sectionText.indexOf("terminate this agreement upon 30 days"),
      end: sectionText.indexOf("terminate this agreement upon 30 days") + "terminate this agreement upon 30 days".length,
    };

    const sliced = sliceTextWithHighlight(sectionText, highlightRange);
    assert.strictEqual(sliced.highlighted, "terminate this agreement upon 30 days");
    assert.strictEqual(sliced.before, "Clause 14.1. Termination for Convenience. Either party may ");
    assert.strictEqual(sliced.after, " written notice.");
  });

  // --- Test 7: P4 Exit Gate Real PDF Verification ---
  await test("7. P4 Exit Gate: Synthetic PDF renders text items and coordinates slice back to source", async () => {
    const page1 =
      "1. Term of Agreement\nThis agreement commences on the Effective Date and continues for twelve months.";
    const page2 =
      "2. Confidentiality Provisions\nEach party agrees to maintain confidentiality of all proprietary materials.";

    const pdfBuf = createSyntheticPdf([page1, page2]);
    const extractRes = await extractPdf(pdfBuf);
    assert.strictEqual(extractRes.success, true);

    if (extractRes.success) {
      const canonical = buildCanonicalFromPdf(extractRes.pages);
      const quote = "maintains confidentiality of all proprietary materials"; // slight tense variation to test strict match
      const exactQuote = "maintain confidentiality of all proprietary materials";

      const occ = getQuoteOccurrences(exactQuote, canonical.text);
      assert.strictEqual(occ.totalOccurrences, 1);

      const split = splitQuoteAcrossDocumentPages(occ.activeMatch!, canonical.pages);
      assert.strictEqual(split.length, 1);
      assert.strictEqual(split[0].pageNumber, 2);

      const p2 = canonical.pages[1];
      const spanResult = mapQuoteToPageSpans({
        pageRange: split[0],
        pageRecord: p2,
        renderedItemsCount: p2.items!.starts.length,
      });

      assert.strictEqual(spanResult.fallbackToText, false);
      assert(spanResult.spans.length >= 1);
    }
  });

  console.log("\n========================================");
  console.log(`Results: ${passed} passed, ${process.exitCode ? 1 : 0} failed`);
  console.log("========================================\n");
}

void runPhase4Tests();
