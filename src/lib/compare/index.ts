/**
 * Document Comparison Orchestrator (Phase 6, D-028, D-029, D-041)
 */

import { parseContractClauses } from "./clause-parser";
import { alignClauses } from "./aligner";
import { evaluateClauseComparison } from "./judge";
import type { ComparisonResult, ComparisonStats, ClauseComparison } from "./types";

export interface CompareInputDoc {
  id: string;
  title: string;
  filename: string;
  canonicalText: string;
  pages?: Array<{ pageNumber: number; startOffset: number; endOffset: number }>;
}

export function compareDocuments(
  docA: CompareInputDoc,
  docB: CompareInputDoc
): ComparisonResult {
  const clausesA = parseContractClauses(docA.canonicalText, docA.pages);
  const clausesB = parseContractClauses(docB.canonicalText, docB.pages);

  const aligned = alignClauses(clausesA, clausesB);

  const comparisons: ClauseComparison[] = [];
  const stats: ComparisonStats = {
    totalA: clausesA.length,
    totalB: clausesB.length,
    identical: 0,
    modified: 0,
    renumbered: 0,
    added: 0,
    removed: 0,
    high: 0,
    medium: 0,
    low: 0,
    cosmetic: 0,
  };

  for (let i = 0; i < aligned.length; i++) {
    const pair = aligned[i];
    const comparison = evaluateClauseComparison(pair, `comp-${i + 1}`);
    comparisons.push(comparison);

    // Update counts
    stats[comparison.type]++;
    stats[comparison.significance]++;
  }

  return {
    docA: { id: docA.id, title: docA.title, filename: docA.filename },
    docB: { id: docB.id, title: docB.title, filename: docB.filename },
    stats,
    comparisons,
  };
}

export * from "./types";
export * from "./clause-parser";
export * from "./signals";
export * from "./aligner";
export * from "./judge";
