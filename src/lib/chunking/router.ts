/**
 * Mode router for contract analysis.
 * Chooses between full, map_reduce, or retrieval based on token budget and query intent.
 * Rule: When in doubt for a large document, prefer map_reduce (SKILL.md).
 */

export type AnalysisMode = "full" | "map_reduce" | "retrieval" | "agent";

export interface RouteOptions {
  question: string;
  totalTokens: number;
  contextBudget?: number;
  forceMode?: string;
}

// Regex matching questions about existence, absence, enumeration, or broad summary
const EXISTENCE_OR_SUMMARY_REGEX = /\b(is\s+there|are\s+there|does\s+it\s+(?:contain|have|include|mention)|any\s+(?:clause|provision|term|section|stipulation)|list\s+all|find\s+all|what\s+are\s+all|every\s+(?:clause|term)|summar(?:y|ise|ize)|overview|absent|missing|not\s+(?:present|found|in)|mention|exist|forbidden|prohibited|permitted|does\s+the\s+agreement\s+allow)\b/i;

// Regex matching targeted clause lookups
const TARGETED_CLAUSE_REGEX = /\b(?:in\s+)?(?:clause|section|article|paragraph|schedule)\s+[0-9]+(?:\.[0-9]+)*\b/i;

/**
 * Route query to appropriate analysis mode.
 */
export function routeQuestionMode(options: RouteOptions): AnalysisMode {
  const { question, totalTokens, forceMode } = options;
  const contextBudget = options.contextBudget || 60000;

  if (forceMode === "full" || forceMode === "map_reduce" || forceMode === "retrieval" || forceMode === "agent") {
    return forceMode as AnalysisMode;
  }

  // 1. Fits in context budget -> full mode
  if (totalTokens <= contextBudget) {
    return "full";
  }

  // 2. Over budget: analyze question intent
  const trimmedQ = question.trim();

  // If question is targeted to a specific clause/section number and not asking for a full list/summary
  if (TARGETED_CLAUSE_REGEX.test(trimmedQ) && !EXISTENCE_OR_SUMMARY_REGEX.test(trimmedQ)) {
    return "retrieval";
  }

  // If question is asking about existence, absence, "list all", or summary
  if (EXISTENCE_OR_SUMMARY_REGEX.test(trimmedQ)) {
    return "map_reduce";
  }

  // Default for large contracts: prefer map_reduce for completeness
  return "map_reduce";
}
