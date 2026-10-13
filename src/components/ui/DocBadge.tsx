import React from "react";

interface DocBadgeProps {
  filename?: string;
  mime?: string;
  className?: string;
}

export const DocBadge: React.FC<DocBadgeProps> = ({ filename = "", mime = "", className = "" }) => {
  const isPdf =
    mime === "application/pdf" ||
    filename.toLowerCase().endsWith(".pdf");

  if (isPdf) {
    return (
      <span
        className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-[4px] bg-[#FFE4E6] text-[#E11D48] text-[10.5px] font-bold tracking-wider uppercase shrink-0 ${className}`}
        title="PDF Document"
      >
        PDF
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-[4px] bg-[#DBEAFE] text-[#2563EB] text-[10.5px] font-bold tracking-wider uppercase shrink-0 ${className}`}
      title="Word Document"
    >
      DOCX
    </span>
  );
};
