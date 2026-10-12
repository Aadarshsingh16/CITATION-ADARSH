/**
 * Single source of truth for quote matching, verification and highlighting coordinates.
 * Strictly strictly adheres to docs/DECISIONS.md (D-006, D-007, D-008, D-009, D-010, D-011, D-016).
 */

export type Match = {
  start: number; // offset in canonical text (inclusive)
  end: number;   // offset in canonical text (exclusive)
};

export type QuoteMatch = Match;

export type QuotePageBoundary = {
  pageNumber: number;
  startOffset: number;
  endOffset: number;
};

export type VerifyReason =
  | "not_found"
  | "too_short"
  | "wrong_document"
  | "verifier_error"
  | "malformed";

export type VerifyResult =
  | { status: "verified"; matches: Match[]; withGaps?: boolean }
  | { status: "unverified"; reason: VerifyReason };

export const MIN_QUOTE_CHARS = 15;
export const ELLIPSIS_WINDOW = 1500;

interface NormaliseResult {
  norm: string;
  map: number[]; // map[i] is index in originalText
}

const ZERO_WIDTH_CHARS = new Set([
  0x00ad, // soft hyphen
  0x200b, // zero-width space
  0x200c, // zero-width non-joiner
  0x200d, // zero-width joiner
  0xfeff, // byte order mark / zero-width no-break space
]);

function isWhitespaceChar(code: number): boolean {
  return (
    code <= 32 ||
    code === 0x00a0 || // non-breaking space
    code === 0x1680 ||
    (code >= 0x2000 && code <= 0x200a) ||
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0x202f ||
    code === 0x205f ||
    code === 0x3000
  );
}

function cleanChar(c: string): string {
  // Curly quotes to straight
  if (c === "\u2018" || c === "\u2019" || c === "\u201a" || c === "\u201b") return "'";
  if (c === "\u201c" || c === "\u201d" || c === "\u201e" || c === "\u201f") return '"';
  // Dashes to standard hyphen
  if (c === "\u2010" || c === "\u2011" || c === "\u2012" || c === "\u2013" || c === "\u2014" || c === "\u2015" || c === "\u2212") return "-";
  return c;
}

/**
 * Character-by-character normalisation with exact index mapping (D-008).
 * Drops all whitespace, maps curly quotes and dashes, NFKC expands ligatures.
 */
export function normalise(text: string): NormaliseResult {
  if (!text) {
    return { norm: "", map: [] };
  }

  let norm = "";
  const map: number[] = [];

  for (let i = 0; i < text.length; i++) {
    const rawChar = text[i];
    const code = rawChar.charCodeAt(0);

    // Skip zero-width chars and soft hyphens
    if (ZERO_WIDTH_CHARS.has(code)) continue;

    // Skip whitespace
    if (isWhitespaceChar(code)) continue;

    // NFKC normalize (expands ligatures like fi -> f + i)
    const expanded = cleanChar(rawChar).normalize("NFKC").toLowerCase();

    for (let j = 0; j < expanded.length; j++) {
      const ch = expanded[j];
      const chCode = ch.charCodeAt(0);
      if (!isWhitespaceChar(chCode) && !ZERO_WIDTH_CHARS.has(chCode)) {
        norm += ch;
        map.push(i);
      }
    }
  }

  return { norm, map };
}

/**
 * Builds hyphen-joined variant of text (e.g. "termi-\nnation" -> "termination").
 */
function buildHyphenJoinedVariant(text: string): { text: string; map: number[] } {
  let joined = "";
  const map: number[] = [];
  const regex = /([\p{L}\p{N}])-[\r\n\s]+([\p{L}\p{N}])/gu;
  let lastIdx = 0;

  for (let i = 0; i < text.length; i++) {
    // Check if current position is hyphen followed by whitespace and letter
    if (
      text[i] === "-" &&
      i > 0 &&
      /[\p{L}\p{N}]/u.test(text[i - 1]) &&
      i + 1 < text.length &&
      /[\r\n\s]/.test(text[i + 1])
    ) {
      // Find where whitespace ends
      let k = i + 1;
      while (k < text.length && /[\r\n\s]/.test(text[k])) {
        k++;
      }
      if (k < text.length && /[\p{L}\p{N}]/u.test(text[k])) {
        // Skip the hyphen and whitespace in joined text
        i = k - 1;
        continue;
      }
    }
    joined += text[i];
    map.push(i);
  }

  return { text: joined, map };
}

function isWordChar(char: string | undefined): boolean {
  if (!char) return false;
  return /[\p{L}\p{N}]/u.test(char);
}

/**
 * Locates all occurrences of a quote within document text using index maps.
 */
export function locateAll(
  quote: string,
  docText: string,
  opts?: { checkWordBoundary?: boolean }
): Match[] {
  if (!quote || !docText) return [];

  const normQuote = normalise(quote);
  if (normQuote.norm.length === 0) return [];

  const shouldCheckWordBoundary = opts?.checkWordBoundary !== false;
  const matches: Match[] = [];

  // Helper to search a specific normalized variant
  const searchVariant = (
    normText: { norm: string; map: number[] },
    sourceText: string,
    coordMap?: number[]
  ) => {
    let pos = 0;
    while (pos <= normText.norm.length - normQuote.norm.length) {
      const idx = normText.norm.indexOf(normQuote.norm, pos);
      if (idx === -1) break;

      const normStart = idx;
      const normEnd = idx + normQuote.norm.length - 1;

      let start = normText.map[normStart];
      let end = normText.map[normEnd] + 1;

      // Map back to original document text coordinates if coordMap provided
      if (coordMap) {
        start = coordMap[start];
        end = coordMap[end - 1] + 1;
      }

      // Word-boundary check on the original document text (D-009)
      let wordBoundaryOk = true;
      if (shouldCheckWordBoundary) {
        const firstQuoteChar = normQuote.norm[0];
        const lastQuoteChar = normQuote.norm[normQuote.norm.length - 1];

        if (isWordChar(firstQuoteChar)) {
          const charBefore = docText[start - 1];
          if (isWordChar(charBefore)) {
            wordBoundaryOk = false;
          }
        }

        if (isWordChar(lastQuoteChar)) {
          const charAfter = docText[end];
          if (isWordChar(charAfter)) {
            wordBoundaryOk = false;
          }
        }
      }

      if (wordBoundaryOk) {
        matches.push({ start, end });
      }

      pos = idx + 1;
    }
  };

  // Search Variant A (standard text)
  const normDoc = normalise(docText);
  searchVariant(normDoc, docText);

  // Search Variant B (hyphen-joined variant for line breaks like "termi-\nnation")
  if (docText.includes("-") && (docText.includes("\n") || docText.includes("\r"))) {
    const joined = buildHyphenJoinedVariant(docText);
    const normJoined = normalise(joined.text);
    searchVariant(normJoined, joined.text, joined.map);
  }

  // De-duplicate overlapping/identical matches
  const uniqueMatches: Match[] = [];
  for (const m of matches) {
    const exists = uniqueMatches.some(
      (u) => Math.abs(u.start - m.start) <= 1 && Math.abs(u.end - m.end) <= 1
    );
    if (!exists) {
      uniqueMatches.push(m);
    }
  }

  uniqueMatches.sort((a, b) => a.start - b.start);
  return uniqueMatches;
}

export interface VerifyOptions {
  otherDocTexts?: Record<string, string>; // for detecting misattribution (D-016)
  preferRange?: { start: number; end: number };
}

/**
 * Strict verification of a quote against document canonical text.
 * Never throws, checks min length (15 chars), word boundaries, and ellipsis.
 */
export function verifyQuote(
  quote: string,
  docText: string,
  opts?: VerifyOptions
): VerifyResult {
  try {
    if (typeof quote !== "string" || typeof docText !== "string") {
      return { status: "unverified", reason: "malformed" };
    }

    const trimmed = quote.trim();
    if (!trimmed) {
      return { status: "unverified", reason: "too_short" };
    }

    // Ellipsis verification (D-011)
    const hasEllipsis = /\.{3,}|\u2026/.test(trimmed);
    if (hasEllipsis) {
      const segments = trimmed
        .split(/\.{3,}|\u2026/g)
        .map((s) => s.trim())
        .filter(Boolean);

      if (segments.length < 2) {
        return { status: "unverified", reason: "malformed" };
      }

      // Check min length for each segment
      for (const seg of segments) {
        const normSeg = normalise(seg);
        if (normSeg.norm.length < MIN_QUOTE_CHARS) {
          return { status: "unverified", reason: "too_short" };
        }
      }

      // Locate first segment
      const firstMatches = locateAll(segments[0], docText);
      if (firstMatches.length === 0) {
        return { status: "unverified", reason: "not_found" };
      }

      // Find consecutive segments within ELLIPSIS_WINDOW in order
      for (const firstMatch of firstMatches) {
        let currentEnd = firstMatch.end;
        let chainMatched = true;

        for (let i = 1; i < segments.length; i++) {
          const segMatches = locateAll(segments[i], docText);
          const nextMatch = segMatches.find(
            (m) => m.start >= currentEnd && m.start - currentEnd <= ELLIPSIS_WINDOW
          );

          if (!nextMatch) {
            chainMatched = false;
            break;
          }
          currentEnd = nextMatch.end;
        }

        if (chainMatched) {
          return {
            status: "verified",
            matches: [{ start: firstMatch.start, end: currentEnd }],
            withGaps: true,
          };
        }
      }

      return { status: "unverified", reason: "not_found" };
    }

    // Standard non-ellipsis quote
    const normQuote = normalise(trimmed);
    if (normQuote.norm.length < MIN_QUOTE_CHARS) {
      return { status: "unverified", reason: "too_short" };
    }

    const matches = locateAll(trimmed, docText);
    if (matches.length > 0) {
      return { status: "verified", matches };
    }

    // Check if quote exists in another selected document (D-016: wrong_document)
    if (opts?.otherDocTexts) {
      for (const [_docId, otherText] of Object.entries(opts.otherDocTexts)) {
        const otherMatches = locateAll(trimmed, otherText);
        if (otherMatches.length > 0) {
          return { status: "unverified", reason: "wrong_document" };
        }
      }
    }

    return { status: "unverified", reason: "not_found" };
  } catch {
    return { status: "unverified", reason: "verifier_error" };
  }
}

/**
 * Selects the best match, preferring one within the cited chunk range.
 */
export function pickMatch(
  matches: Match[],
  preferRange?: { start: number; end: number }
): Match | undefined {
  if (!matches || matches.length === 0) return undefined;
  if (!preferRange) return matches[0];

  const overlapping = matches.find(
    (m) => m.start < preferRange.end && m.end > preferRange.start
  );

  return overlapping || matches[0];
}

/**
 * Clips a quote match against page boundaries to support cross-page highlighting (D-034).
 */
export function splitByPages(
  match: Match,
  pages: { pageNumber: number; startOffset: number; endOffset: number }[]
): { pageNumber: number; start: number; end: number }[] {
  const result: { pageNumber: number; start: number; end: number }[] = [];

  for (const page of pages) {
    const start = Math.max(match.start, page.startOffset);
    const end = Math.min(match.end, page.endOffset);

    if (start < end) {
      result.push({
        pageNumber: page.pageNumber,
        start,
        end,
      });
    }
  }

  return result;
}
