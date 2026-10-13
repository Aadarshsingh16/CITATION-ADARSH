"use client";

import React from "react";
import { FileText } from "lucide-react";

interface FileGlyphProps {
  filename?: string;
  mime?: string;
  className?: string;
}

export function FileGlyph({ filename, mime, className = "" }: FileGlyphProps) {
  const isPdf =
    mime === "application/pdf" ||
    (filename && filename.toLowerCase().endsWith(".pdf"));

  if (isPdf) {
    return (
      <span
        className={`inline-flex items-center justify-center w-5 h-5 rounded-[4px] bg-[#FCE3EA] text-[#B5224E] shrink-0 ${className}`}
        title="PDF Document"
      >
        <FileText className="w-3.5 h-3.5" strokeWidth={2} />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded-[4px] bg-[#E1ECF9] text-[#2A5C9A] shrink-0 ${className}`}
      title="Word Document (DOCX)"
    >
      <FileText className="w-3.5 h-3.5" strokeWidth={2} />
    </span>
  );
}
