import mammoth from "mammoth";
import type { RejectionReason } from "../types";

export interface DocxSection {
  sectionNumber: number;
  title: string;
  text: string;
}

export interface DocxExtractionSuccess {
  success: true;
  pageCount: number;
  charCount: number;
  sections: DocxSection[];
}

export interface DocxExtractionFailure {
  success: false;
  reason: RejectionReason;
  message: string;
  nextStep: string;
}

export type DocxExtractionResult = DocxExtractionSuccess | DocxExtractionFailure;

const TARGET_SECTION_CHARS = 3000;

export async function extractDocx(buffer: Buffer): Promise<DocxExtractionResult> {
  let rawText = "";

  try {
    const result = await mammoth.extractRawText({ buffer });
    rawText = result.value || "";
  } catch {
    return {
      success: false,
      reason: "corrupt",
      message: "Could not read this Word document. The file may be damaged or password-protected.",
      nextStep: "Open the file in Microsoft Word, save as a new .docx, and try uploading again.",
    };
  }

  const cleanText = rawText.trim();
  const nonWsChars = cleanText.match(/\S/gu)?.length || 0;

  if (nonWsChars < 50) {
    return {
      success: false,
      reason: "no_text_layer",
      message: "This Word document appears empty or has insufficient text content.",
      nextStep: "Verify the document contains readable text and try uploading again.",
    };
  }

  // Split into paragraphs and group into virtual sections of ~3000 chars (D-023)
  const paragraphs = cleanText.split(/\n+/);
  const sections: DocxSection[] = [];
  let currentSectionText = "";
  let sectionIndex = 1;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (currentSectionText.length + trimmed.length > TARGET_SECTION_CHARS && currentSectionText.length > 500) {
      sections.push({
        sectionNumber: sectionIndex,
        title: `Section ${sectionIndex}`,
        text: currentSectionText.trim(),
      });
      sectionIndex++;
      currentSectionText = trimmed;
    } else {
      if (currentSectionText.length > 0) {
        currentSectionText += "\n\n" + trimmed;
      } else {
        currentSectionText = trimmed;
      }
    }
  }

  if (currentSectionText.trim().length > 0) {
    sections.push({
      sectionNumber: sectionIndex,
      title: `Section ${sectionIndex}`,
      text: currentSectionText.trim(),
    });
  }

  return {
    success: true,
    pageCount: sections.length,
    charCount: nonWsChars,
    sections,
  };
}
