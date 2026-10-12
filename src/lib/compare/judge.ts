/**
 * Significance Classifier & Anti-Fabrication Summary Judge (Phase 6, D-028, D-029, D-041)
 * Evaluates legal significance of differences and generates verifiable summaries.
 */

import { extractSignals, compareSignals } from "./signals";
import type { AlignedPair } from "./aligner";
import type { Clause, ClauseComparison, SignificanceLevel, SignalDiff } from "./types";

const CORE_LEGAL_KEYWORDS = [
  "liability",
  "indemnity",
  "indemnif",
  "termination",
  "terminate",
  "governing law",
  "jurisdiction",
  "warranty",
  "payment",
  "price",
  "fee",
  "confidential",
  "dispute",
  "arbitration",
];

/**
 * Classifies the significance of a clause difference (D-029).
 */
export function classifySignificance(
  pair: AlignedPair,
  signals: SignalDiff[]
): SignificanceLevel {
  if (pair.type === "identical") {
    return "cosmetic";
  }

  // Renumbered clause with identical text is cosmetic
  if (pair.type === "renumbered" && signals.length === 0) {
    return "cosmetic";
  }

  // Any change in financial amounts is HIGH significance (e.g. AED 100,000 to AED 1,000,000)
  const hasAmountChange = signals.some((s) => s.type === "amount" && (s.direction === "increased" || s.direction === "decreased" || s.direction === "changed"));
  if (hasAmountChange) {
    return "high";
  }

  // Shift in legal modality (e.g. may -> shall, shall -> may not) is HIGH significance
  const hasModalShift = signals.some((s) => s.type === "modal");
  if (hasModalShift) {
    return "high";
  }

  // Added or removed core legal clause is HIGH significance
  if (pair.type === "added" || pair.type === "removed") {
    const text = (pair.clauseB?.text || pair.clauseA?.text || "").toLowerCase();
    const title = (pair.clauseB?.title || pair.clauseA?.title || "").toLowerCase();
    const isCore = CORE_LEGAL_KEYWORDS.some((kw) => text.includes(kw) || title.includes(kw));
    if (isCore) return "high";
    return "medium";
  }

  // Changes in duration or dates is MEDIUM significance
  const hasDurationOrDate = signals.some((s) => s.type === "duration" || s.type === "date");
  if (hasDurationOrDate) {
    return "medium";
  }

  // If text is modified but NO signals changed and token similarity is high, it's pure rewording -> COSMETIC
  if (pair.type === "modified" && signals.length === 0) {
    if (pair.similarity >= 0.75) {
      return "cosmetic";
    }
    return "low";
  }

  return "medium";
}

/**
 * Validates that every number, amount, and date in a summary appears in the source clauses (D-041).
 * Returns true if the summary is completely truthful, or false if any number/amount was fabricated.
 */
export function validateSummaryValues(
  summary: string,
  clauseA?: Clause,
  clauseB?: Clause,
  signals: SignalDiff[] = []
): boolean {
  if (!summary) return true;

  // Extract all numbers and dates from summary
  const summaryNumbers = summary.match(/\b[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?\b/g) || [];

  const sourceA = clauseA?.text || "";
  const sourceB = clauseB?.text || "";
  const signalTexts = signals.map((s) => `${s.from || ""} ${s.to || ""} ${s.description}`).join(" ");
  const combinedSources = `${sourceA} ${sourceB} ${signalTexts}`;

  for (const num of summaryNumbers) {
    // Single-digit numbers (like "2 versions", "1 clause") are common prose; check larger numbers
    const cleanNum = num.replace(/,/g, "");
    if (cleanNum.length === 1 && parseInt(cleanNum, 10) <= 5) continue;

    // Check if the exact number or formatted number exists in source
    if (!combinedSources.includes(num) && !combinedSources.includes(cleanNum)) {
      return false; // Fabricated number!
    }
  }

  return true;
}

/**
 * Generates a deterministic templated summary from signals (D-041 fallback).
 */
export function buildTemplatedSummary(
  type: AlignedPair["type"],
  clauseA?: Clause,
  clauseB?: Clause,
  signals: SignalDiff[] = []
): string {
  const labelA = clauseA?.number ? `Clause ${clauseA.number}` : "Clause";
  const labelB = clauseB?.number ? `Clause ${clauseB.number}` : "Clause";

  if (type === "identical") {
    return "Clause is unchanged between versions.";
  }

  if (type === "renumbered") {
    return `Clause renumbered from ${labelA} to ${labelB} with identical text.`;
  }

  if (type === "added") {
    return `New ${labelB} added${clauseB?.title ? ` (${clauseB.title})` : ""}.`;
  }

  if (type === "removed") {
    return `${labelA} was removed from the contract.`;
  }

  // Modified clause
  if (signals.length > 0) {
    const signalDescriptions = signals.map((s) => s.description).join("; ");
    return `Substantive changes in ${labelB}: ${signalDescriptions}.`;
  }

  return `Stylistic or wording adjustment in ${labelB} without changes to financial, duration, or obligation terms.`;
}

/**
 * Produces a full ClauseComparison object with D-041 anti-fabrication enforcement.
 */
export function evaluateClauseComparison(
  pair: AlignedPair,
  id: string,
  candidateSummary?: string
): ClauseComparison {
  const signalsA = pair.clauseA ? extractSignals(pair.clauseA.text) : [];
  const signalsB = pair.clauseB ? extractSignals(pair.clauseB.text) : [];
  const signals = compareSignals(signalsA, signalsB);

  const significance = classifySignificance(pair, signals);

  let summary: string;
  let isSummaryTemplated = false;

  if (candidateSummary) {
    // Validate candidate summary against D-041 anti-fabrication gate
    const isValid = validateSummaryValues(candidateSummary, pair.clauseA, pair.clauseB, signals);
    if (isValid) {
      summary = candidateSummary;
    } else {
      // Replaced by deterministic template (D-041)
      summary = buildTemplatedSummary(pair.type, pair.clauseA, pair.clauseB, signals);
      isSummaryTemplated = true;
    }
  } else {
    summary = buildTemplatedSummary(pair.type, pair.clauseA, pair.clauseB, signals);
    isSummaryTemplated = true;
  }

  return {
    id,
    type: pair.type,
    clauseA: pair.clauseA,
    clauseB: pair.clauseB,
    significance,
    signals,
    summary,
    isSummaryTemplated,
  };
}
