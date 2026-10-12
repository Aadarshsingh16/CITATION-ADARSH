import assert from "node:assert";
import { validateUploadedFile } from "../src/lib/ingestion/validate";
import { extractPdf } from "../src/lib/ingestion/extract-pdf";
import { extractDocx } from "../src/lib/ingestion/extract-docx";
import { buildCanonicalFromPdf, buildCanonicalFromDocx } from "../src/lib/ingestion/canonical";
import { chunkCanonicalText } from "../src/lib/chunking/chunker";
import { BM25Index } from "../src/lib/chunking/bm25";
import { createSyntheticPdf, createScannedPdf } from "../src/lib/test-fixtures/pdf-generator";

async function runTests() {
  console.log("=== Running Phase 1 Acceptance & Ingestion Test Suite ===");
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    return Promise.resolve()
      .then(fn)
      .then(() => {
        console.log(`PASS: ${name}`);
        passed++;
      })
      .catch((err) => {
        console.error(`FAIL: ${name}`);
        console.error("  ", err instanceof Error ? err.message : err);
        failed++;
      });
  }

  // --- A1: Validation & Magic Bytes ---
  await test("A1.1: Rejects .txt file with clear message", () => {
    const buf = Buffer.from("Plain text contract content", "utf-8");
    const res = validateUploadedFile("contract.txt", buf);
    assert.strictEqual(res.valid, false);
    if (!res.valid) {
      assert.strictEqual(res.reason, "wrong_extension");
      assert(res.message.includes(".txt"));
      assert(res.nextStep.length > 0);
    }
  });

  await test("A1.2: Rejects .png image file with clear message", () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const res = validateUploadedFile("scan.png", buf);
    assert.strictEqual(res.valid, false);
    if (!res.valid) {
      assert.strictEqual(res.reason, "wrong_extension");
      assert(res.message.includes(".png"));
    }
  });

  await test("A1.3: Rejects renamed .exe by magic bytes check", () => {
    // MZ header for Windows executable renamed as .pdf
    const exeBuffer = Buffer.from("MZ\x90\x00\x03\x00\x00\x00\x04\x00", "binary");
    const res = validateUploadedFile("malicious.pdf", exeBuffer);
    assert.strictEqual(res.valid, false);
    if (!res.valid) {
      assert.strictEqual(res.reason, "magic_byte_mismatch");
      assert(res.message.toLowerCase().includes("not match pdf format"));
    }
  });

  await test("A1.4: Accepts genuine PDF with %PDF- header", () => {
    const validPdf = createSyntheticPdf(["Contract Agreement Page 1"]);
    const res = validateUploadedFile("agreement.pdf", validPdf);
    assert.strictEqual(res.valid, true);
    if (res.valid) {
      assert.strictEqual(res.mime, "application/pdf");
      assert.strictEqual(typeof res.sha256, "string");
      assert.strictEqual(res.sha256.length, 64);
    }
  });

  // --- A2: Extraction, Canonical Text & Page Offsets ---
  await test("A2.1: PDF extraction preserves text and page offsets slice back to source", async () => {
    const page1Text = "1. Definitions\nAffiliate means any entity controlling or controlled by a Party.";
    const page2Text = "2. Term and Termination\nThis Agreement shall continue in full force for 2 years.";
    const pdfBuf = createSyntheticPdf([page1Text, page2Text]);

    const res = await extractPdf(pdfBuf);
    assert.strictEqual(res.success, true);
    if (res.success) {
      assert.strictEqual(res.pageCount, 2);

      const canonical = buildCanonicalFromPdf(res.pages);
      assert.strictEqual(canonical.pageCount, 2);

      // Verify that page offsets slice back to the exact page text
      const slice1 = canonical.text.slice(canonical.pages[0].startOffset, canonical.pages[0].endOffset);
      const slice2 = canonical.text.slice(canonical.pages[1].startOffset, canonical.pages[1].endOffset);
      assert.strictEqual(slice1, res.pages[0].text);
      assert.strictEqual(slice2, res.pages[1].text);
    }
  });

  await test("A2.2: PDF Text-item offset map invariant (D-035) holds for every item", async () => {
    const p1 = "1. Confidentiality\nThe receiving party agrees to safeguard all proprietary materials.";
    const p2 = "2. Governing Law\nThis agreement shall be governed by the laws of Dubai.";
    const pdfBuf = createSyntheticPdf([p1, p2]);

    const res = await extractPdf(pdfBuf);
    assert.strictEqual(res.success, true);
    if (res.success) {
      const canonical = buildCanonicalFromPdf(res.pages);

      for (const page of canonical.pages) {
        assert(page.items !== null && page.items !== undefined);
        const { starts, lens } = page.items!;
        assert.strictEqual(starts.length, lens.length);

        for (let i = 0; i < starts.length; i++) {
          const itemText = canonical.text.slice(starts[i], starts[i] + lens[i]);
          assert(itemText.length > 0, `Item ${i} must not be empty`);
        }
      }
    }
  });

  // --- A4: Scanned PDF Quality Gate (D-021) ---
  await test("A4.1: Scanned image-only PDF is rejected with no_text_layer", async () => {
    const scannedBuf = createScannedPdf(3);
    const res = await extractPdf(scannedBuf);
    assert.strictEqual(res.success, false);
    if (!res.success) {
      assert.strictEqual(res.reason, "no_text_layer");
      assert(res.message.toLowerCase().includes("scanned document"));
      assert(res.nextStep.toLowerCase().includes("ocr"));
    }
  });

  await test("A4.2: Mixed PDF with a blank page records unreadable_pages", async () => {
    const longPage = "Clause 1. Definitions\n" + "Detailed definitions for the commercial transaction between the parties.\n".repeat(6);
    const emptyPage = ""; // blank page
    const normalPage = "Clause 2. Scope of Work\n" + "The provider will perform the deliverables according to Schedule A.\n".repeat(4);

    const pdfBuf = createSyntheticPdf([longPage, emptyPage, normalPage]);
    const res = await extractPdf(pdfBuf);
    assert.strictEqual(res.success, true);
    if (res.success) {
      assert.strictEqual(res.pageCount, 3);
      assert.deepStrictEqual(res.unreadablePages, [2]);
    }
  });

  // --- DOCX Virtual Sections (D-023) ---
  await test("A2.3: DOCX virtual sections break cleanly with exact canonical mapping", () => {
    const sections = [
      { sectionNumber: 1, title: "Section 1", text: "Paragraph 1\n\nParagraph 2" },
      { sectionNumber: 2, title: "Section 2", text: "Paragraph 3\n\nParagraph 4" },
    ];
    const canonical = buildCanonicalFromDocx(sections);
    assert.strictEqual(canonical.pageCount, 2);

    const s1 = canonical.text.slice(canonical.pages[0].startOffset, canonical.pages[0].endOffset);
    const s2 = canonical.text.slice(canonical.pages[1].startOffset, canonical.pages[1].endOffset);
    assert.strictEqual(s1, sections[0].text);
    assert.strictEqual(s2, sections[1].text);
  });

  // --- Chunking & BM25 Indexing ---
  await test("Chunking: Splits at numbered clauses and respects token estimate", () => {
    const contractText = `
1. DEFINITIONS AND INTERPRETATION
1.1 In this Agreement, unless the context otherwise requires, the following terms shall have the meanings given:
"Affiliate" means any entity that directly or indirectly controls, is controlled by, or is under common control with a Party.
"Applicable Law" means all applicable statutes, laws, ordinances, regulations, and binding orders of any governmental authority having jurisdiction over either party or the services rendered.

2. TERM AND TERMINATION
2.1 This Agreement shall commence on the Effective Date and remain in effect for two years unless earlier terminated in accordance with the provisions herein.
2.2 Either Party may terminate for convenience upon thirty (30) days prior written notice to the other party without incurring any early cancellation penalties or fees.

3. FEES AND PAYMENT
Customer shall pay all undisputed invoices within thirty (30) days of receipt. Late payments shall accrue interest at 1.5% per month.
    `.trim();

    const chunks = chunkCanonicalText(contractText);
    assert(chunks.length >= 2, "Should produce at least 2 clause-aware chunks");

    for (const chunk of chunks) {
      // Invariant: startOffset and endOffset slice to chunk text
      const sliced = contractText.slice(chunk.startOffset, chunk.endOffset);
      assert.strictEqual(sliced, chunk.text);
      assert(chunk.tokenEst > 0);
    }
  });

  await test("BM25: Accurately ranks clauses for targeted contract queries", () => {
    const docs = [
      { id: "c1", text: "1. Definitions. Affiliate means entity controlling another party." },
      { id: "c2", text: "2. Termination for Convenience. Either party may terminate with 30 days written notice." },
      { id: "c3", text: "3. Governing Law. The contract is governed by English law." },
    ];

    const bm25 = new BM25Index(docs);
    const results = bm25.search("terminate notice period 30 days", 3);

    assert(results.length > 0);
    assert.strictEqual(results[0].id, "c2", "Clause 2 must be ranked first for termination query");
    assert(results[0].score > 0);
  });

  // --- 150-page Exit Gate Test ---
  await test("P1 Exit Gate: 150-page PDF ingests with progress and completes", async () => {
    const pages150 = Array.from({ length: 150 }, (_, i) => {
      const pageNum = i + 1;
      return `Clause ${pageNum}. Commercial Term ${pageNum}\n` +
        `This section establishes contract obligations and compliance standards for commercial milestone ${pageNum}.\n` +
        `All deliverable milestones shall be accepted pursuant to the requirements in Schedule ${pageNum}.`;
    });
    const pdfBuf = createSyntheticPdf(pages150);
    assert(pdfBuf.length > 0);

    let progressReports = 0;
    const res = await extractPdf(pdfBuf, (cur, total) => {
      progressReports++;
      assert(cur <= total);
    });

    assert.strictEqual(res.success, true);
    if (res.success) {
      assert.strictEqual(res.pageCount, 150);
      assert.strictEqual(res.unreadablePages.length, 0);

      const canonical = buildCanonicalFromPdf(res.pages);
      assert.strictEqual(canonical.pageCount, 150);

      const chunks = chunkCanonicalText(canonical.text);
      assert(chunks.length >= 5, "150-page contract produces chunk sequence");
    }
  });

  console.log(`\n========================================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
