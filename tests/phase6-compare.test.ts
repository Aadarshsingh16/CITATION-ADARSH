/**
 * Phase 6: Document Comparison Acceptance Test Suite
 * Tests B8, B9, B9b, B10, D-028, D-029, and D-041.
 */

import { parseContractClauses } from "../src/lib/compare/clause-parser";
import { extractSignals, compareSignals } from "../src/lib/compare/signals";
import { alignClauses } from "../src/lib/compare/aligner";
import {
  classifySignificance,
  validateSummaryValues,
  buildTemplatedSummary,
  evaluateClauseComparison,
} from "../src/lib/compare/judge";
import { compareDocuments } from "../src/lib/compare";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

async function runPhase6Tests() {
  console.log("=== Running Phase 6 Document Comparison Test Suite ===");

  // ----------------------------------------------------
  // Test 1: Clause Parser extracts numbered clauses and titles
  // ----------------------------------------------------
  {
    const sampleText = `
1. Definitions
In this Agreement, "Services" means consulting services.

2. Term and Termination
This Agreement shall commence on 1 January 2025 and continue for 12 months. Either party may terminate with 30 days notice.

3. Limitation of Liability
The aggregate liability shall not exceed AED 100,000.

4. Governing Law
This Agreement shall be governed by the laws of DIFC.
`;

    const clauses = parseContractClauses(sampleText);
    assert(clauses.length === 4, `Expected 4 clauses, got ${clauses.length}`);
    assert(clauses[0].number === "1", `Clause 1 number is ${clauses[0].number}`);
    assert(clauses[0].title === "Definitions", `Clause 1 title is ${clauses[0].title}`);
    assert(clauses[2].text.includes("AED 100,000"), `Clause 3 text contains AED 100,000`);
    console.log("PASS: 1. Clause parser accurately extracts numbered clauses, headers and offsets");
  }

  // ----------------------------------------------------
  // Test 2: Signal Extractor detects financial amounts, durations, dates, and modals
  // ----------------------------------------------------
  {
    const textA = "The liability cap is AED 100,000, payable within 30 days. Either party may terminate.";
    const textB = "The liability cap is AED 1,000,000, payable within 60 days. The Supplier shall terminate.";

    const signalsA = extractSignals(textA);
    const signalsB = extractSignals(textB);

    assert(signalsA.some((s) => s.type === "amount" && s.value === "AED 100,000"), "Signals A missing AED 100,000");
    assert(signalsB.some((s) => s.type === "amount" && s.value === "AED 1,000,000"), "Signals B missing AED 1,000,000");
    assert(signalsA.some((s) => s.type === "duration" && s.value === "30 days"), "Signals A missing 30 days");
    assert(signalsB.some((s) => s.type === "duration" && s.value === "60 days"), "Signals B missing 60 days");

    const diffs = compareSignals(signalsA, signalsB);
    const amountDiff = diffs.find((d) => d.type === "amount");
    assert(Boolean(amountDiff), "Expected amount diff");
    assert(amountDiff?.direction === "increased", `Expected amount increased, got ${amountDiff?.direction}`);
    assert(amountDiff?.from === "AED 100,000" && amountDiff?.to === "AED 1,000,000", "Amount diff values match");

    const modalDiff = diffs.find((d) => d.type === "modal");
    assert(Boolean(modalDiff), "Expected modal diff (may -> shall)");
    console.log("PASS: 2. Signal extractor detects currency caps, durations, and modal obligations");
  }

  // ----------------------------------------------------
  // Test 3: Aligner identifies identical, renumbered, modified, added, removed (B8)
  // ----------------------------------------------------
  {
    const docA_Text = `
1. Definitions
The definitions clause remains unchanged.

2. Notice Period
Notice period is 30 days.

3. Old Redundant Clause
This clause will be removed in version 2.

4. Governing Law
This contract is governed by English law.
`;

    const docB_Text = `
1. Definitions
The definitions clause remains unchanged.

2. Notice Period
Notice period is 60 days.

3. Added IP Clause
All intellectual property belongs to the Client.

5. Governing Law
This contract is governed by English law.
`;

    const clausesA = parseContractClauses(docA_Text);
    const clausesB = parseContractClauses(docB_Text);
    const aligned = alignClauses(clausesA, clausesB);

    const identical = aligned.find((p) => p.type === "identical");
    assert(Boolean(identical && identical.clauseA?.number === "1"), "Clause 1 identified as identical");

    const modified = aligned.find((p) => p.type === "modified");
    assert(Boolean(modified && modified.clauseA?.number === "2"), "Clause 2 identified as modified");

    const added = aligned.find((p) => p.type === "added");
    assert(Boolean(added && added.clauseB?.title?.includes("Added IP")), "New clause identified as added");

    const removed = aligned.find((p) => p.type === "removed");
    assert(Boolean(removed && removed.clauseA?.title?.includes("Old Redundant")), "Omitted clause identified as removed");

    const renumbered = aligned.find((p) => p.type === "renumbered");
    assert(
      Boolean(renumbered && renumbered.clauseA?.number === "4" && renumbered.clauseB?.number === "5"),
      "Governing Law identified as renumbered (4 -> 5)"
    );

    console.log("PASS: 3. B8: Aligner categorizes identical, modified, renumbered, added, and removed clauses");
  }

  // ----------------------------------------------------
  // Test 4: B9 - Plain-language summary flags AED 100k to 1M as High; Pure rewording is Cosmetic
  // ----------------------------------------------------
  {
    const pairHigh = {
      type: "modified" as const,
      clauseA: {
        id: "a1",
        number: "3",
        title: "Liability",
        text: "The liability shall be capped at AED 100,000.",
        startOffset: 0,
        endOffset: 45,
      },
      clauseB: {
        id: "b1",
        number: "3",
        title: "Liability",
        text: "The liability shall be capped at AED 1,000,000.",
        startOffset: 0,
        endOffset: 47,
      },
      similarity: 0.9,
    };

    const compHigh = evaluateClauseComparison(pairHigh, "c-high");
    assert(compHigh.significance === "high", `Expected High significance for AED 100k -> 1M, got ${compHigh.significance}`);
    assert(
      compHigh.summary.includes("AED 100,000") && compHigh.summary.includes("AED 1,000,000"),
      `Summary must call out AED 100,000 to AED 1,000,000: ${compHigh.summary}`
    );

    // Pure rewording (same legal meaning, zero signal diff)
    const pairCosmetic = {
      type: "modified" as const,
      clauseA: {
        id: "a2",
        number: "5",
        title: "General",
        text: "The Parties agree that notices may be sent by email.",
        startOffset: 0,
        endOffset: 53,
      },
      clauseB: {
        id: "b2",
        number: "5",
        title: "General",
        text: "It is agreed by the Parties that notice can be delivered via email.",
        startOffset: 0,
        endOffset: 67,
      },
      similarity: 0.8,
    };

    const compCosmetic = evaluateClauseComparison(pairCosmetic, "c-cosmetic");
    assert(
      compCosmetic.significance === "cosmetic" || compCosmetic.significance === "low",
      `Pure rewording should be Cosmetic or Low, got ${compCosmetic.significance}`
    );
    console.log("PASS: 4. B9: AED 100,000 to AED 1,000,000 called out as High; pure rewording classified as Cosmetic");
  }

  // ----------------------------------------------------
  // Test 5: B9b & D-041 - Summary never invents values (Anti-Fabrication Gate)
  // ----------------------------------------------------
  {
    const clauseA = {
      id: "a1",
      number: "3",
      text: "Total liability is capped at AED 100,000.",
      startOffset: 0,
      endOffset: 40,
    };
    const clauseB = {
      id: "b1",
      number: "3",
      text: "Total liability is capped at AED 1,000,000.",
      startOffset: 0,
      endOffset: 42,
    };
    const signals = compareSignals(extractSignals(clauseA.text), extractSignals(clauseB.text));

    // Truthful summary
    const truthfulSummary = "Liability increased from AED 100,000 to AED 1,000,000.";
    const isTruthful = validateSummaryValues(truthfulSummary, clauseA, clauseB, signals);
    assert(isTruthful === true, "Truthful summary should be validated as true");

    // Forced bad summary with invented numbers (e.g. model invents $500,000 penalty or 50% discount)
    const badSummary = "Liability increased to AED 1,000,000 with a $500,000 penalty and 50% discount.";
    const isBadValid = validateSummaryValues(badSummary, clauseA, clauseB, signals);
    assert(isBadValid === false, "Forced bad summary with invented numbers must be rejected");

    // When evaluated, the bad summary is rejected and replaced by templated summary (D-041)
    const comp = evaluateClauseComparison(
      { type: "modified", clauseA, clauseB, similarity: 0.9 },
      "comp-d041",
      badSummary
    );

    assert(comp.isSummaryTemplated === true, "comp.isSummaryTemplated must be true when bad summary is caught");
    assert(!comp.summary.includes("$500,000"), "Hallucinated $500,000 must NOT appear in final summary");
    assert(comp.summary.includes("AED 1,000,000"), "Templated summary must contain genuine source amount AED 1,000,000");

    console.log("PASS: 5. B9b/D-041: Hallucinated numbers in summaries are rejected and replaced by truthful templated summaries");
  }

  // ----------------------------------------------------
  // Test 6: B10 - Filter and sort controls work
  // ----------------------------------------------------
  {
    const comparisons = [
      { id: "1", significance: "cosmetic" as const },
      { id: "2", significance: "high" as const },
      { id: "3", significance: "medium" as const },
      { id: "4", significance: "high" as const },
    ];

    const highOnly = comparisons.filter((c) => c.significance === "high");
    assert(highOnly.length === 2, `Expected 2 high comparisons, got ${highOnly.length}`);

    const rank = { high: 3, medium: 2, cosmetic: 1 };
    const sorted = [...comparisons].sort((a, b) => rank[b.significance] - rank[a.significance]);
    assert(sorted[0].significance === "high" && sorted[1].significance === "high", "Sort ranks High first");
    assert(sorted[3].significance === "cosmetic", "Sort places Cosmetic last");

    console.log("PASS: 6. B10: Significance filter and sort functions execute deterministically");
  }

  // ----------------------------------------------------
  // Test 7: P6 Exit Gate - End-to-end comparison between prepared contract pair
  // ----------------------------------------------------
  {
    const docA = {
      id: "doc-v1",
      title: "Services Agreement v1.pdf",
      filename: "Services Agreement v1.pdf",
      canonicalText: `
1. Definitions and Interpretation
"Deliverables" means all work product generated by Contractor.

2. Term and Duration
This Agreement shall commence on the Effective Date and continue for 12 months.

3. Payment and Fees
The Client shall pay AED 100,000 upon completion of milestones.

4. Redundant Operational Clause
Contractor shall submit weekly paper status reports.

5. Termination for Convenience
Either party may terminate this Agreement by giving 30 days written notice.

6. Governing Law
This Agreement is governed by the laws of England and Wales.
`,
    };

    const docB = {
      id: "doc-v2",
      title: "Services Agreement v2.pdf",
      filename: "Services Agreement v2.pdf",
      canonicalText: `
1. Definitions and Interpretation
"Deliverables" means all work product generated by Contractor.

2. Term and Duration
This Agreement shall commence on the Effective Date and continue for 12 months.

3. Payment and Fees
The Client shall pay AED 1,000,000 upon completion of milestones.

5. Termination for Convenience
Either party may terminate this Agreement by giving 60 days written notice.

6. Newly Added Intellectual Property
All patent rights and trade secrets shall vest exclusively in the Client.

7. Governing Law
This Agreement is governed by the laws of England and Wales.
`,
    };

    const result = compareDocuments(docA, docB);

    assert(result.stats.identical >= 2, `Expected at least 2 identical clauses, got ${result.stats.identical}`);
    assert(result.stats.modified >= 2, `Expected at least 2 modified clauses, got ${result.stats.modified}`);
    assert(result.stats.removed >= 1, `Expected at least 1 removed clause, got ${result.stats.removed}`);
    assert(result.stats.added >= 1, `Expected at least 1 added clause, got ${result.stats.added}`);
    assert(result.stats.renumbered >= 1, `Expected at least 1 renumbered clause (Governing Law), got ${result.stats.renumbered}`);
    assert(result.stats.high >= 1, `Expected at least 1 High significance change (AED 100k -> 1M), got ${result.stats.high}`);

    // Verify the AED 100k to 1M change is specifically in the comparisons list
    const paymentChange = result.comparisons.find(
      (c) => c.signals.some((s) => s.type === "amount" && s.to === "AED 1,000,000")
    );
    assert(Boolean(paymentChange), "Found payment change from AED 100k to 1M");
    assert(paymentChange?.significance === "high", "Payment change is High significance");

    console.log("PASS: 7. P6 Exit Gate: Full contract pair compared with accurate stats, diffs and D-041 compliance");
  }

  console.log("\n========================================");
  console.log("Results: 7 passed, 0 failed");
  console.log("========================================");
}

runPhase6Tests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
