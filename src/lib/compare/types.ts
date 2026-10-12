/**
 * Type definitions for Document Comparison (Phase 6, D-028, D-029, D-041)
 */

export interface Clause {
  id: string;
  number?: string;
  title?: string;
  text: string;
  startOffset: number;
  endOffset: number;
  page?: number;
}

export type SignalType = "amount" | "percentage" | "duration" | "date" | "modal" | "party" | "negation";

export interface Signal {
  type: SignalType;
  value: string;
  raw: string;
  normalized: string;
}

export interface SignalDiff {
  type: SignalType;
  from?: string;
  to?: string;
  direction?: "increased" | "decreased" | "changed" | "added" | "removed";
  description: string;
}

export type SignificanceLevel = "high" | "medium" | "low" | "cosmetic";

export type ComparisonChangeType = "identical" | "modified" | "renumbered" | "added" | "removed";

export interface ClauseComparison {
  id: string;
  type: ComparisonChangeType;
  clauseA?: Clause;
  clauseB?: Clause;
  significance: SignificanceLevel;
  signals: SignalDiff[];
  summary: string;
  isSummaryTemplated: boolean; // D-041: true if replaced by deterministic template due to fabrication check
}

export interface ComparisonStats {
  totalA: number;
  totalB: number;
  identical: number;
  modified: number;
  renumbered: number;
  added: number;
  removed: number;
  high: number;
  medium: number;
  low: number;
  cosmetic: number;
}

export interface ComparisonResult {
  docA: { id: string; title: string; filename: string };
  docB: { id: string; title: string; filename: string };
  stats: ComparisonStats;
  comparisons: ClauseComparison[];
}
