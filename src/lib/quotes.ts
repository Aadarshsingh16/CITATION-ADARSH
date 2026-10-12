/**
 * Quote matching and verification (shared client + server).
 * Full implementation in Phase 2.
 */

export type Match = {
  start: number;
  end: number;
};

export type VerifyResult =
  | { status: "verified"; matches: Match[]; withGaps?: boolean }
  | {
      status: "unverified";
      reason:
        | "not_found"
        | "too_short"
        | "wrong_document"
        | "verifier_error"
        | "malformed";
    };

export function normalise(text: string): { norm: string; map: number[] } {
  // Phase 0 stub - implementation in Phase 2
  return { norm: text.toLowerCase(), map: [] };
}

export function locateAll(
  _quote: string,
  _docText: string,
  _opts?: Record<string, unknown>
): Match[] {
  // Phase 0 stub - implementation in Phase 2
  return [];
}

export function verifyQuote(
  _quote: string,
  _docText: string,
  _opts?: Record<string, unknown>
): VerifyResult {
  // Phase 0 stub - implementation in Phase 2
  return { status: "unverified", reason: "not_found" };
}

export function pickMatch(
  matches: Match[],
  _preferRange?: { start: number; end: number }
): Match | undefined {
  // Phase 0 stub - implementation in Phase 2
  return matches[0];
}

export function splitByPages(
  _match: Match,
  _pages: { start: number; end: number }[]
): { page: number; start: number; end: number }[] {
  // Phase 0 stub - implementation in Phase 2
  return [];
}
