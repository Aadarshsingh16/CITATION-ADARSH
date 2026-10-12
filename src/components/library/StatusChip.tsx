"use client";

import React from "react";
import type { DocumentStatus } from "@/lib/types";

interface StatusChipProps {
  status: DocumentStatus;
  detail?: string | null;
}

export const StatusChip: React.FC<StatusChipProps> = ({ status, detail }) => {
  switch (status) {
    case "ready":
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200"
          title="Document extracted, chunked, and ready for queries"
        >
          <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          Ready
        </span>
      );

    case "extracting":
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-indigo-800 bg-indigo-50 border border-indigo-200 animate-pulse"
          title={detail || "Extracting text layer and page offsets"}
        >
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
          Extracting
        </span>
      );

    case "indexing":
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-blue-800 bg-blue-50 border border-blue-200 animate-pulse"
          title={detail || "Building clause chunks and BM25 index"}
        >
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
          Indexing
        </span>
      );

    case "uploading":
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-stone-700 bg-stone-100 border border-stone-200"
          title="Saving file to database"
        >
          <svg className="w-3.5 h-3.5 animate-spin text-stone-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Uploading
        </span>
      );

    case "rejected":
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200"
          title={detail || "Rejected by quality gate"}
        >
          <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Rejected
        </span>
      );

    case "failed":
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-red-800 bg-red-50 border border-red-200"
          title={detail || "Extraction failed"}
        >
          <svg className="w-3.5 h-3.5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Failed
        </span>
      );

    default:
      return null;
  }
};
