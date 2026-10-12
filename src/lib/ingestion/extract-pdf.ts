import type { PageItemMap, RejectionReason } from "../types";
import { MAX_PAGE_COUNT } from "./validate";

export interface PageExtraction {
  pageNumber: number;
  text: string;
  items: PageItemMap;
  isUnreadable: boolean;
}

export interface PdfExtractionSuccess {
  success: true;
  pageCount: number;
  charCount: number;
  pages: PageExtraction[];
  unreadablePages: number[];
}

export interface PdfExtractionFailure {
  success: false;
  reason: RejectionReason;
  message: string;
  nextStep: string;
}

export type PdfExtractionResult = PdfExtractionSuccess | PdfExtractionFailure;

interface TextItemObj {
  str: string;
  dir: string;
  width: number;
  height: number;
  transform: number[]; // [scaleX, skewY, skewX, scaleY, tx, ty]
}

/**
 * Extracts canonical text, page layout offsets, and rendered text item maps from a PDF buffer.
 */
export async function extractPdf(
  buffer: Buffer,
  onProgress?: (page: number, total: number, message: string) => Promise<void> | void
): Promise<PdfExtractionResult> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  let doc;
  try {
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      useSystemFonts: true,
    });

    loadingTask.onPassword = () => {
      throw new Error("PASSWORD_REQUIRED");
    };

    doc = await loadingTask.promise;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("PASSWORD_REQUIRED") || msg.toLowerCase().includes("password") || msg.toLowerCase().includes("encrypted")) {
      return {
        success: false,
        reason: "encrypted",
        message: "This PDF is password-protected or encrypted.",
        nextStep: "Remove the password protection from the document and try uploading again.",
      };
    }
    return {
      success: false,
      reason: "corrupt",
      message: "The PDF file is corrupted or could not be parsed.",
      nextStep: "Try opening and re-saving the file in a PDF reader before uploading.",
    };
  }

  const numPages = doc.numPages;

  if (numPages > MAX_PAGE_COUNT) {
    return {
      success: false,
      reason: "page_limit_exceeded",
      message: `Document has ${numPages} pages, which exceeds the limit of ${MAX_PAGE_COUNT} pages.`,
      nextStep: "Split the contract into smaller parts under 400 pages and upload each part.",
    };
  }

  const pages: PageExtraction[] = [];
  const unreadablePages: number[] = [];
  let totalNonWsChars = 0;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    if (onProgress) {
      await onProgress(pageNum, numPages, `Extracting page ${pageNum} of ${numPages}`);
    }

    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items as TextItemObj[];

    // Reconstruct page text and record item offset map (D-035)
    let pageText = "";
    const starts: number[] = [];
    const lens: number[] = [];

    // Group items into lines by y-coordinate (transform[5])
    interface PositionedItem {
      item: TextItemObj;
      x: number;
      y: number;
    }

    const positionedItems: PositionedItem[] = [];
    for (const item of items) {
      if (typeof item.str !== "string") continue;
      const x = item.transform ? item.transform[4] : 0;
      const y = item.transform ? item.transform[5] : 0;
      positionedItems.push({ item, x, y });
    }

    // Sort items vertically top-to-bottom (PDF y is from bottom up, so descending y), then horizontally left-to-right (ascending x)
    // Cluster lines where delta-y < 3
    positionedItems.sort((a, b) => {
      const dy = Math.abs(a.y - b.y);
      if (dy > 3) {
        return b.y - a.y; // higher y first (top of page)
      }
      return a.x - b.x; // left to right
    });

    let lastY: number | null = null;
    let lastRightX: number | null = null;

    for (let i = 0; i < positionedItems.length; i++) {
      const { item, x, y } = positionedItems[i];
      if (!item.str) continue;

      if (lastY !== null) {
        const dy = Math.abs(lastY - y);
        if (dy > 3) {
          // New line
          pageText += "\n";
          lastRightX = null;
        } else if (lastRightX !== null) {
          const gap = x - lastRightX;
          // Meaningful gap between words on same line
          if (gap > 2 && !pageText.endsWith(" ") && !item.str.startsWith(" ")) {
            pageText += " ";
          }
        }
      }

      // Record item start offset and length into page text
      const itemStart = pageText.length;
      starts.push(itemStart);
      lens.push(item.str.length);
      pageText += item.str;

      lastY = y;
      lastRightX = x + (item.width || 0);
    }

    // Unicode-aware character count (including Arabic and Latin)
    const nonWsMatch = pageText.match(/\S/gu);
    const pageNonWsChars = nonWsMatch ? nonWsMatch.length : 0;
    totalNonWsChars += pageNonWsChars;

    const isUnreadable = pageNonWsChars < 20;
    if (isUnreadable) {
      unreadablePages.push(pageNum);
    }

    pages.push({
      pageNumber: pageNum,
      text: pageText,
      items: { starts, lens },
      isUnreadable,
    });
  }

  // Quality gate (D-021)
  const isImageScan = totalNonWsChars < 100 || (unreadablePages.length / numPages >= 0.8);
  if (isImageScan) {
    return {
      success: false,
      reason: "no_text_layer",
      message: "This PDF contains no readable text layer and appears to be a scanned document.",
      nextStep: "Please upload a searchable text-based PDF or run OCR before uploading.",
    };
  }

  return {
    success: true,
    pageCount: numPages,
    charCount: totalNonWsChars,
    pages,
    unreadablePages,
  };
}
