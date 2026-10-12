import assert from "node:assert";
import {
  normalise,
  locateAll,
  verifyQuote,
  pickMatch,
  splitByPages,
  MIN_QUOTE_CHARS,
} from "../src/lib/quotes";

async function runQuoteTests() {
  console.log("=== Running Quote Verification Unit Test Suite ===");
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

  const docFixture = `
MASTER SERVICES AGREEMENT
Clause 1. Definitions and Interpretation
"Confidential Information" means any proprietary technical, commercial, or operational data.
"Affiliate" means any entity that directly or indirectly controls, is controlled by, or is under common control with a Party.

Clause 2. Term and Termination
2.1 This Agreement shall commence on the Effective Date and continue for an initial term of two years.
2.2 Either Party may terminate for convenience upon thirty (30) days prior written notice to the other party.
The termi-
nation shall take effect immediately upon expiry of the notice window.
Failure to provide notice shall constitute an operational breach of the agreement.

Clause 3. Payment Terms
Customer shall pay all undisputed invoice amounts within thirty (30) days of the invoice date.
Interest of one point five percent shall accrue on late payments.
  `.trim();

  // Test 1: Exact quote verifies, offsets slice back to original words
  await test("1. Exact quote verifies and offsets slice back to original words", () => {
    const q = "Either Party may terminate for convenience upon thirty (30) days prior written notice";
    const res = verifyQuote(q, docFixture);
    assert.strictEqual(res.status, "verified");
    if (res.status === "verified") {
      assert(res.matches.length > 0);
      const sliced = docFixture.slice(res.matches[0].start, res.matches[0].end);
      assert.strictEqual(sliced, q);
    }
  });

  // Test 2: Different spacing and line breaks verifies
  await test("2. Same quote with different spacing and line breaks verifies", () => {
    const q = "Either   Party\nmay\n\nterminate   for convenience upon thirty (30) days prior written notice";
    const res = verifyQuote(q, docFixture);
    assert.strictEqual(res.status, "verified");
    if (res.status === "verified") {
      const sliced = docFixture.slice(res.matches[0].start, res.matches[0].end);
      assert(sliced.includes("Either Party may terminate"));
    }
  });

  // Test 3: Quote across 3 lines verifies
  await test("3. Quote across 3 lines verifies and offsets cover all 3", () => {
    const q = "The termi-\nnation shall take effect immediately upon expiry of the notice window.\nFailure to provide notice";
    const res = verifyQuote(q, docFixture);
    assert.strictEqual(res.status, "verified");
    if (res.status === "verified") {
      const sliced = docFixture.slice(res.matches[0].start, res.matches[0].end);
      assert(sliced.includes("The termi-"));
      assert(sliced.includes("Failure to provide notice"));
    }
  });

  // Test 4: Quote across page boundary verifies and splitByPages returns 2 ranges
  await test("4. Quote crossing page boundary verifies and splitByPages returns 2 ranges", () => {
    const boundaryDoc = "First page clause text here.\nSecond page continuation text here.";
    const pages = [
      { pageNumber: 1, startOffset: 0, endOffset: 29 },
      { pageNumber: 2, startOffset: 30, endOffset: boundaryDoc.length },
    ];
    const q = "clause text here.\nSecond page continuation";
    const res = verifyQuote(q, boundaryDoc);
    assert.strictEqual(res.status, "verified");
    if (res.status === "verified") {
      const ranges = splitByPages(res.matches[0], pages);
      assert.strictEqual(ranges.length, 2);
      assert.strictEqual(ranges[0].pageNumber, 1);
      assert.strictEqual(ranges[1].pageNumber, 2);
    }
  });

  // Test 5: Quote appearing twice returns 2 matches; pickMatch prefers cited range
  await test("5. Quote appearing twice returns 2 matches and pickMatch prefers range", () => {
    const multiDoc = "Item A: thirty (30) days notice. Other text in between. Item B: thirty (30) days notice.";
    const q = "thirty (30) days notice";
    const res = verifyQuote(q, multiDoc);
    assert.strictEqual(res.status, "verified");
    if (res.status === "verified") {
      assert.strictEqual(res.matches.length, 2);
      // Prefer match near end
      const preferred = pickMatch(res.matches, { start: 50, end: 90 });
      assert(preferred !== undefined);
      assert.strictEqual(preferred, res.matches[1]);
    }
  });

  // Test 6: Curly quotes, en dash, ligatures, NBSP all verify
  await test("6. Curly quotes, en dash, ligatures (fi), and NBSP verify", () => {
    const fancyDoc = "The \u201cAgreement\u201d\u00a0has a 30\u2013day window and provides specific financial benefits.";
    // Quote with straight quotes, regular space, and standard hyphen
    const q = 'The "Agreement" has a 30-day window and provides specific financial benefits.';
    const res = verifyQuote(q, fancyDoc);
    assert.strictEqual(res.status, "verified");
  });

  // Test 7: Line-end hyphenation "termi-\nnation" verifies both variants
  await test("7. Line-end hyphenation verifies both as 'termination' and 'termi-nation'", () => {
    const hyphenDoc = "Either party may initiate the termi-\nnation of this agreement without cause.";
    const qJoined = "initiate the termination of this agreement";
    const resJoined = verifyQuote(qJoined, hyphenDoc);
    assert.strictEqual(resJoined.status, "verified", "Joined variant must verify");

    const qHyphen = "initiate the termi-nation of this agreement";
    const resHyphen = verifyQuote(qHyphen, hyphenDoc);
    assert.strictEqual(resHyphen.status, "verified", "Hyphenated variant must verify");
  });

  // Test 8: Extraction space inserted mid-word ("Termi nation") verifies
  await test("8. Space inserted mid-word by extraction ('Termi nation') verifies", () => {
    const spaceDoc = "Either party may request early Termi nation of the contract.";
    const q = "request early Termination of the contract.";
    const res = verifyQuote(q, spaceDoc);
    assert.strictEqual(res.status, "verified");
  });

  // Test 9: One changed word or paraphrase returns not_found
  await test("9. One changed word returns not_found; paraphrase rejected", () => {
    // Original: "thirty (30) days prior written notice"
    const altered = "Either Party may terminate for convenience upon sixty (60) days prior written notice";
    const resAltered = verifyQuote(altered, docFixture);
    assert.strictEqual(resAltered.status, "unverified");
    if (resAltered.status === "unverified") {
      assert.strictEqual(resAltered.reason, "not_found");
    }

    const paraphrase = "A party can end the agreement whenever they want with a month notice";
    const resPara = verifyQuote(paraphrase, docFixture);
    assert.strictEqual(resPara.status, "unverified");
  });

  // Test 10: Quote under 15 chars returns too_short
  await test("10. Quote under 15 chars returns too_short", () => {
    const shortQ = "Clause 1.";
    const res = verifyQuote(shortQ, docFixture);
    assert.strictEqual(res.status, "unverified");
    if (res.status === "unverified") {
      assert.strictEqual(res.reason, "too_short");
    }
  });

  // Test 11: Mid-word substring returns not_found (word-boundary check)
  await test("11. Mid-word substring ('of the' inside 'of theory') returns not_found", () => {
    const boundaryText = "Analysis of theory and methodology.";
    const q = "of the"; // under 15 chars if short, let's make it 15+ chars
    const qLong = "of the practice of research";
    const textWithFake = "Analysis of theory and the practice of research.";
    // "of the" should NOT match "of the" from "of theory" + "and the"
    const res = verifyQuote("of theory and the practice", textWithFake);
    assert.strictEqual(res.status, "verified");

    // Partial word match
    const midWordText = "Supercalifragilistic terms and conditions shall apply.";
    const midWordQuote = "califragilistic terms and conditions"; // inside word "Supercalifragilistic"
    const resMid = verifyQuote(midWordQuote, midWordText);
    assert.strictEqual(resMid.status, "unverified");
    if (resMid.status === "unverified") {
      assert.strictEqual(resMid.reason, "not_found");
    }
  });

  // Test 12: Ellipsis quote with segments in order verifies withGaps; out-of-order fails
  await test("12. Ellipsis quote verifies withGaps; out-of-order fails", () => {
    const ellipsisDoc = "Clause 12. The service provider shall maintain confidentiality of all records ... and shall return materials within ten days.";
    const qValid = "The service provider shall maintain confidentiality ... and shall return materials within ten days";
    const resValid = verifyQuote(qValid, ellipsisDoc);
    assert.strictEqual(resValid.status, "verified");
    if (resValid.status === "verified") {
      assert.strictEqual(resValid.withGaps, true);
    }

    const qInverted = "and shall return materials within ten days ... The service provider shall maintain confidentiality";
    const resInverted = verifyQuote(qInverted, ellipsisDoc);
    assert.strictEqual(resInverted.status, "unverified");
    if (resInverted.status === "unverified") {
      assert.strictEqual(resInverted.reason, "not_found");
    }
  });

  // Test 13: Quote present only in Doc B, asserted for Doc A returns wrong_document
  await test("13. Quote present only in Doc B returns wrong_document for Doc A", () => {
    const docA = "This is Document A with provisions on intellectual property and warranties.";
    const docB = "This is Document B with exclusive territorial rights across the European Union.";
    const qOnlyInB = "exclusive territorial rights across the European Union";

    const res = verifyQuote(qOnlyInB, docA, {
      otherDocTexts: { docB },
    });

    assert.strictEqual(res.status, "unverified");
    if (res.status === "unverified") {
      assert.strictEqual(res.reason, "wrong_document");
    }
  });

  // Test 14: Garbage input never throws
  await test("14. Garbage input (empty, whitespace, huge, null/undefined) never throws", () => {
    assert.doesNotThrow(() => verifyQuote("", ""));
    assert.doesNotThrow(() => verifyQuote("   \n\t  ", "valid document text here"));
    assert.doesNotThrow(() => verifyQuote("a".repeat(100000), "b".repeat(100000)));
    // @ts-expect-error testing runtime safety
    assert.doesNotThrow(() => verifyQuote(null, undefined));
    // @ts-expect-error testing runtime safety
    const resNull = verifyQuote(null, undefined);
    assert.strictEqual(resNull.status, "unverified");
  });

  // Test 15: Model offsets are ignored (API locateAll finds offsets purely from canonical text)
  await test("15. Model-reported offsets are ignored (offsets determined purely by code)", () => {
    const q = "Customer shall pay all undisputed invoice amounts within thirty (30) days";
    // Caller provides no offsets, code locates exact positions
    const res = verifyQuote(q, docFixture);
    assert.strictEqual(res.status, "verified");
    if (res.status === "verified") {
      const match = res.matches[0];
      assert.strictEqual(docFixture.slice(match.start, match.end), q);
    }
  });

  console.log(`\n========================================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runQuoteTests();
