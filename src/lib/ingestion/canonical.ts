import type { PageItemMap } from "../types";
import type { PageExtraction } from "./extract-pdf";
import type { DocxSection } from "./extract-docx";

export interface CanonicalPage {
  pageNumber: number;
  startOffset: number;
  endOffset: number;
  items?: PageItemMap | null;
}

export interface CanonicalDocument {
  text: string;
  charCount: number;
  pageCount: number;
  pages: CanonicalPage[];
}

/**
 * Assembles canonical text and exact page offset ranges from PDF extractions.
 * Adjusts item offsets so starts[i] is the exact offset in canonical text (D-035).
 */
export function buildCanonicalFromPdf(pages: PageExtraction[]): CanonicalDocument {
  let canonicalText = "";
  const canonicalPages: CanonicalPage[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    if (i > 0) {
      canonicalText += "\n";
    }

    const pageStart = canonicalText.length;
    const pageText = page.text;
    canonicalText += pageText;
    const pageEnd = canonicalText.length;

    // Shift item offsets so starts[j] points to offset in canonicalText
    const adjustedStarts = page.items.starts.map((s) => s + pageStart);

    canonicalPages.push({
      pageNumber: page.pageNumber,
      startOffset: pageStart,
      endOffset: pageEnd,
      items: {
        starts: adjustedStarts,
        lens: page.items.lens,
      },
    });
  }

  return {
    text: canonicalText,
    charCount: canonicalText.match(/\S/gu)?.length || 0,
    pageCount: pages.length,
    pages: canonicalPages,
  };
}

/**
 * Assembles canonical text and exact virtual section ranges from DOCX sections.
 */
export function buildCanonicalFromDocx(sections: DocxSection[]): CanonicalDocument {
  let canonicalText = "";
  const canonicalPages: CanonicalPage[] = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (i > 0) {
      canonicalText += "\n\n";
    }

    const pageStart = canonicalText.length;
    const sectionText = section.text;
    canonicalText += sectionText;
    const pageEnd = canonicalText.length;

    canonicalPages.push({
      pageNumber: section.sectionNumber,
      startOffset: pageStart,
      endOffset: pageEnd,
      items: null,
    });
  }

  return {
    text: canonicalText,
    charCount: canonicalText.match(/\S/gu)?.length || 0,
    pageCount: sections.length,
    pages: canonicalPages,
  };
}
