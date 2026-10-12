import { createHash } from "node:crypto";
import type { RejectionReason } from "../types";

export interface ValidationSuccess {
  valid: true;
  mime: string;
  sha256: string;
}

export interface ValidationFailure {
  valid: false;
  reason: RejectionReason;
  message: string;
  nextStep: string;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB (D-032)
export const MAX_PAGE_COUNT = 400; // 400 pages (D-032)

export function computeSha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function validateUploadedFile(
  filename: string,
  buffer: Buffer
): ValidationResult {
  const lowerName = filename.toLowerCase();

  // 1. Extension check
  const isPdfExt = lowerName.endsWith(".pdf");
  const isDocxExt = lowerName.endsWith(".docx");

  if (!isPdfExt && !isDocxExt) {
    const ext = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")) : "unknown";
    return {
      valid: false,
      reason: "wrong_extension",
      message: `Unsupported file type (${ext}). Only PDF (.pdf) and Word (.docx) files are supported.`,
      nextStep: "Convert your document to PDF or DOCX format and try uploading again.",
    };
  }

  // 2. Size check
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (buffer.length / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      reason: "file_too_large",
      message: `File is too large (${sizeMb}MB). The maximum allowed file size is 25MB.`,
      nextStep: "Compress the document or split it into smaller sections under 25MB.",
    };
  }

  // 3. Magic bytes check
  const sha256 = computeSha256(buffer);

  if (isPdfExt) {
    // PDF magic bytes: '%PDF-' (0x25, 0x50, 0x44, 0x46, 0x2D)
    const pdfMagic = Buffer.from("%PDF-", "utf-8");
    if (buffer.length < 5 || !buffer.subarray(0, 5).equals(pdfMagic)) {
      return {
        valid: false,
        reason: "magic_byte_mismatch",
        message: "File content does not match PDF format. The file may be renamed or corrupted.",
        nextStep: "Ensure the file is a genuine PDF and not an executable or other file type renamed to .pdf.",
      };
    }

    return {
      valid: true,
      mime: "application/pdf",
      sha256,
    };
  }

  if (isDocxExt) {
    // DOCX is a zip archive starting with 'PK' (0x50, 0x4B)
    const isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
    // Fast check for 'word/document.xml' signature in zip central directory or entries
    const hasWordDoc = buffer.includes(Buffer.from("word/document.xml"));

    if (!isZip || !hasWordDoc) {
      return {
        valid: false,
        reason: "magic_byte_mismatch",
        message: "File content does not match DOCX format. The file may be an older .doc file or corrupted.",
        nextStep: "Save the document as modern Word (.docx) format and try uploading again.",
      };
    }

    return {
      valid: true,
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sha256,
    };
  }

  return {
    valid: false,
    reason: "wrong_extension",
    message: "Unsupported file type.",
    nextStep: "Upload a PDF or DOCX file.",
  };
}
