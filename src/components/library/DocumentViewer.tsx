"use client";

import React, { useState, useEffect } from "react";
import type { PageRecord } from "@/lib/types";

interface DocumentDetail {
  id: string;
  filename: string;
  mime: string;
  status: string;
  pageCount?: number;
  charCount?: number;
  text?: string;
  unreadablePages?: number[];
  pages?: PageRecord[];
}

interface DocumentViewerProps {
  documentId: string | null;
  onClose: () => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({ documentId, onClose }) => {
  const [data, setData] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`/api/documents/${documentId}/text`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load document text");
        return res.json();
      })
      .then((d) => setData(d))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [documentId]);

  if (!documentId) {
    return null;
  }

  return (
    <aside
      className="w-[440px] border-l border-stone-200 bg-white flex flex-col h-full shrink-0 shadow-lg z-20"
      aria-label="Document viewer"
    >
      {/* Viewer Header */}
      <div className="p-3.5 border-b border-stone-200 flex items-center justify-between bg-stone-50/80">
        <div className="min-w-0 pr-2">
          <h3 className="text-xs font-semibold text-stone-900 truncate" title={data?.filename}>
            {data?.filename || "Loading document..."}
          </h3>
          <p className="text-[11px] text-stone-500 mt-0.5">
            {data?.pageCount ? `${data.pageCount} ${data.mime.includes("pdf") ? "pages" : "virtual sections"}` : ""}
          </p>
        </div>

        <button
          onClick={onClose}
          className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-200/70 rounded-md transition-colors"
          title="Close viewer (Esc)"
          aria-label="Close viewer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Warning banner for unreadable pages */}
      {data?.unreadablePages && data.unreadablePages.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Note: Pages {data.unreadablePages.join(", ")} contain sparse or unreadable text.</span>
        </div>
      )}

      {/* Viewer Content */}
      <div className="flex-1 overflow-y-auto p-5 text-sm">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-stone-400">
            <svg className="animate-spin h-6 w-6 text-indigo-600 mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-xs">Loading canonical text...</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 text-red-800 text-xs rounded-lg border border-red-200">
            {error}
          </div>
        )}

        {data && !loading && (
          <div className="space-y-6">
            {data.pages && data.pages.length > 0 ? (
              data.pages.map((p) => {
                const pageText = data.text?.slice(p.startOffset, p.endOffset) || "";
                return (
                  <div key={p.id || p.pageNumber} className="relative group">
                    <div className="sticky top-0 bg-stone-100/90 backdrop-blur-xs py-1 px-2 mb-2 rounded-sm text-[10px] font-semibold text-stone-500 uppercase tracking-wider flex items-center justify-between border-b border-stone-200">
                      <span>{data.mime.includes("pdf") ? `Page ${p.pageNumber}` : `Section ${p.pageNumber}`}</span>
                      <span className="text-stone-400 font-mono text-[9px]">
                        offsets [{p.startOffset}..{p.endOffset}]
                      </span>
                    </div>

                    <div className="font-contract whitespace-pre-wrap text-stone-800 leading-relaxed text-[14px] bg-stone-50/40 p-3 rounded-lg border border-stone-200/50">
                      {pageText || <span className="italic text-stone-400">Empty page</span>}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="font-contract whitespace-pre-wrap text-stone-800 leading-relaxed text-[14px]">
                {data.text || "No text available."}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
