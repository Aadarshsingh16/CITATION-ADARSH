import type { PageItemMap } from "./types";
import { verifyQuote, pickMatch, splitByPages, type Match } from "./quotes";

export interface SpanHighlight {
  spanIndex: number;
  itemIndex: number;
  startOffsetInSpan: number;
  endOffsetInSpan: number;
  isFullSpan: boolean;
}

export interface PageHighlightResult {
  pageNumber: number;
  fallbackToText: boolean;
  fallbackReason?: "item_count_mismatch" | "no_items_stored" | "forced";
  spans: SpanHighlight[];
  pageTextRange: { start: number; end: number };
  quotePageRange: { start: number; end: number };
}

export interface QuoteOccurrenceInfo {
  matches: Match[];
  activeMatchIndex: number;
  activeMatch: Match | null;
  totalOccurrences: number;
}

/**
 * Finds all occurrences of a quote in the document text and selects the active match
 * (preferring the occurrence inside the cited chunk if provided, fulfilling B4).
 */
export function getQuoteOccurrences(
  quoteText: string,
  canonicalText: string,
  preferredRange?: { start: number; end: number }
): QuoteOccurrenceInfo {
  const result = verifyQuote(quoteText, canonicalText);
  if (result.status !== "verified" || result.matches.length === 0) {
    return {
      matches: [],
      activeMatchIndex: -1,
      activeMatch: null,
      totalOccurrences: 0,
    };
  }

  const matches = result.matches;
  let activeIndex = 0;

  if (preferredRange && matches.length > 1) {
    const picked = pickMatch(matches, preferredRange);
    if (picked) {
      const foundIdx = matches.findIndex((m) => m.start === picked.start && m.end === picked.end);
      if (foundIdx >= 0) {
        activeIndex = foundIdx;
      }
    }
  }

  return {
    matches,
    activeMatchIndex: activeIndex,
    activeMatch: matches[activeIndex],
    totalOccurrences: matches.length,
  };
}

/**
 * Splits a match across document page boundaries (fulfilling B3 for cross-page quotes).
 */
export function splitQuoteAcrossDocumentPages(
  match: Match,
  pages: Array<{ pageNumber: number; startOffset: number; endOffset: number }>
): Array<{ pageNumber: number; start: number; end: number }> {
  return splitByPages(match, pages);
}

/**
 * Maps a quote segment on a specific page to the exact text-layer spans (D-034, D-035).
 * Detects item count mismatches to gracefully trigger text fallback.
 */
export function mapQuoteToPageSpans(params: {
  pageRange: { pageNumber: number; start: number; end: number };
  pageRecord: {
    pageNumber: number;
    startOffset: number;
    endOffset: number;
    items?: PageItemMap | null;
  };
  renderedItemsCount?: number;
  forceFallback?: boolean;
}): PageHighlightResult {
  const { pageRange, pageRecord, renderedItemsCount, forceFallback } = params;

  // 1. Force fallback check (D-034 / test exit gate requirement)
  if (forceFallback) {
    return {
      pageNumber: pageRecord.pageNumber,
      fallbackToText: true,
      fallbackReason: "forced",
      spans: [],
      pageTextRange: { start: pageRecord.startOffset, end: pageRecord.endOffset },
      quotePageRange: { start: pageRange.start, end: pageRange.end },
    };
  }

  // 2. Check stored items
  if (!pageRecord.items || !pageRecord.items.starts || pageRecord.items.starts.length === 0) {
    return {
      pageNumber: pageRecord.pageNumber,
      fallbackToText: true,
      fallbackReason: "no_items_stored",
      spans: [],
      pageTextRange: { start: pageRecord.startOffset, end: pageRecord.endOffset },
      quotePageRange: { start: pageRange.start, end: pageRange.end },
    };
  }

  const { starts, lens, itemIndices } = pageRecord.items;

  // 3. Item count mismatch check (D-034, D-035)
  if (renderedItemsCount !== undefined && renderedItemsCount !== starts.length) {
    return {
      pageNumber: pageRecord.pageNumber,
      fallbackToText: true,
      fallbackReason: "item_count_mismatch",
      spans: [],
      pageTextRange: { start: pageRecord.startOffset, end: pageRecord.endOffset },
      quotePageRange: { start: pageRange.start, end: pageRange.end },
    };
  }

  // 4. Intersect item intervals with quote interval
  const spans: SpanHighlight[] = [];
  const qStart = pageRange.start;
  const qEnd = pageRange.end;

  for (let k = 0; k < starts.length; k++) {
    const itemStart = starts[k];
    const itemLen = lens[k];
    const itemEnd = itemStart + itemLen;

    // Check intersection
    const overlapStart = Math.max(itemStart, qStart);
    const overlapEnd = Math.min(itemEnd, qEnd);

    if (overlapStart < overlapEnd) {
      const startOffsetInSpan = overlapStart - itemStart;
      const endOffsetInSpan = overlapEnd - itemStart;
      const spanIndex = (itemIndices && itemIndices[k] !== undefined) ? itemIndices[k] : k;

      spans.push({
        spanIndex,
        itemIndex: k,
        startOffsetInSpan,
        endOffsetInSpan,
        isFullSpan: startOffsetInSpan === 0 && endOffsetInSpan === itemLen,
      });
    }
  }

  return {
    pageNumber: pageRecord.pageNumber,
    fallbackToText: false,
    spans,
    pageTextRange: { start: pageRecord.startOffset, end: pageRecord.endOffset },
    quotePageRange: { start: qStart, end: qEnd },
  };
}

/**
 * Splits page or canonical text into before, highlighted, and after segments
 * for canonical-text fallback rendering (DOCX and fallback mode).
 */
export function sliceTextWithHighlight(
  text: string,
  highlightRange: { start: number; end: number },
  textBaseOffset: number = 0
): { before: string; highlighted: string; after: string } {
  const localStart = Math.max(0, highlightRange.start - textBaseOffset);
  const localEnd = Math.min(text.length, highlightRange.end - textBaseOffset);

  if (localStart >= localEnd || localStart >= text.length || localEnd <= 0) {
    return { before: text, highlighted: "", after: "" };
  }

  return {
    before: text.slice(0, localStart),
    highlighted: text.slice(localStart, localEnd),
    after: text.slice(localEnd),
  };
}
