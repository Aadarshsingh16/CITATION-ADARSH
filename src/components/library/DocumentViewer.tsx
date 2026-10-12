"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import type { PageRecord } from "@/lib/types";
import {
  getQuoteOccurrences,
  splitQuoteAcrossDocumentPages,
  sliceTextWithHighlight,
  type QuoteOccurrenceInfo,
} from "@/lib/citation-mapping";
import { PdfPageView } from "./PdfPageView";

export interface ActiveQuoteCitation {
  text: string;
  documentId?: string;
  chunkRange?: { start: number; end: number };
  quoteId?: string;
}

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
  activeQuote?: ActiveQuoteCitation | null;
  onClose: () => void;
  onClearActiveQuote?: () => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  documentId,
  activeQuote,
  onClose,
  onClearActiveQuote,
}) => {
  const [data, setData] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PDF.js document state
  const [pdfDoc, setPdfDoc] = useState<any | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Viewer options
  const [scale, setScale] = useState(1.15);
  const [forceFallback, setForceFallback] = useState(false);
  const [activeOccurrenceIndex, setActiveOccurrenceIndex] = useState(0);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Keyboard shortcut: Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Fetch document text and metadata
  useEffect(() => {
    if (!documentId) {
      setData(null);
      setPdfDoc(null);
      return;
    }

    setLoading(true);
    setError(null);
    setPdfDoc(null);

    fetch(`/api/documents/${documentId}/text`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load document text");
        return res.json();
      })
      .then((d) => {
        // Attach pageText slices to each page for fallback views
        if (d.text && d.pages) {
          d.pages = d.pages.map((p: PageRecord) => ({
            ...p,
            pageText: d.text.slice(p.startOffset, p.endOffset),
          }));
        }
        setData(d);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [documentId]);

  // Load PDF file via pdfjs-dist if mime is PDF
  const isPdf = Boolean(data?.mime?.includes("pdf"));

  useEffect(() => {
    if (!documentId || !isPdf) {
      setPdfDoc(null);
      return;
    }

    let isCancelled = false;
    setPdfLoading(true);
    setPdfError(null);

    async function loadPdf() {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";

        const loadingTask = pdfjs.getDocument({
          url: `/api/documents/${documentId}/file`,
          isEvalSupported: false,
        });

        const loadedDoc = await loadingTask.promise;
        if (!isCancelled) {
          setPdfDoc(loadedDoc);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          setPdfError(msg);
        }
      } finally {
        if (!isCancelled) {
          setPdfLoading(false);
        }
      }
    }

    void loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [documentId, isPdf]);

  // Calculate occurrences and active match
  const occurrenceInfo: QuoteOccurrenceInfo = useMemo(() => {
    if (!activeQuote?.text || !data?.text) {
      return { matches: [], activeMatchIndex: 0, activeMatch: null, totalOccurrences: 0 };
    }
    return getQuoteOccurrences(activeQuote.text, data.text, activeQuote.chunkRange);
  }, [activeQuote?.text, data?.text, activeQuote?.chunkRange]);

  // Sync active occurrence index when quote changes
  useEffect(() => {
    setActiveOccurrenceIndex(occurrenceInfo.activeMatchIndex);
  }, [occurrenceInfo.activeMatchIndex]);

  // Active match
  const currentMatch = occurrenceInfo.matches[activeOccurrenceIndex] ?? null;

  // Split match across pages
  const activePageRanges = useMemo(() => {
    if (!currentMatch || !data?.pages || data.pages.length === 0) return [];
    return splitQuoteAcrossDocumentPages(currentMatch, data.pages);
  }, [currentMatch, data?.pages]);

  // Jump to active page when active citation changes
  useEffect(() => {
    if (activePageRanges.length > 0 && scrollContainerRef.current) {
      const targetPageNum = activePageRanges[0].pageNumber;
      const targetEl = scrollContainerRef.current.querySelector(
        `[data-page-number="${targetPageNum}"]`
      );
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [activeOccurrenceIndex, activePageRanges]);

  if (!documentId) return null;

  const totalPages = data?.pageCount || data?.pages?.length || 1;

  return (
    <aside
      className="w-[520px] max-w-[85vw] border-l border-stone-200 bg-stone-50/50 flex flex-col h-full shrink-0 shadow-2xl z-30 transition-all"
      aria-label="Document citation viewer"
    >
      {/* 1. Header Toolbar */}
      <div className="p-3 border-b border-stone-200 bg-white flex items-center justify-between gap-3 shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-stone-900 truncate" title={data?.filename}>
              {data?.filename || "Loading document..."}
            </h3>
            {isPdf && !forceFallback && (
              <span className="text-[10px] font-medium bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-sm border border-emerald-200">
                Rendered PDF
              </span>
            )}
            {(!isPdf || forceFallback) && (
              <span className="text-[10px] font-medium bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-sm border border-amber-200">
                {isPdf ? "Text Fallback" : "Section Text"}
              </span>
            )}
          </div>
          <p className="text-[11px] text-stone-500 mt-0.5">
            {totalPages} {isPdf ? "pages" : "virtual sections"}
          </p>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Zoom controls (PDF only) */}
          {isPdf && !forceFallback && (
            <div className="flex items-center bg-stone-100 rounded-lg p-0.5 border border-stone-200 mr-1">
              <button
                onClick={() => setScale((s) => Math.max(0.75, s - 0.15))}
                className="px-2 py-0.5 text-xs text-stone-600 hover:text-stone-900 font-bold"
                title="Zoom out"
              >
                -
              </button>
              <span className="text-[10px] font-mono text-stone-600 px-1">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale((s) => Math.min(2.0, s + 0.15))}
                className="px-2 py-0.5 text-xs text-stone-600 hover:text-stone-900 font-bold"
                title="Zoom in"
              >
                +
              </button>
            </div>
          )}

          {/* Force Text Fallback Toggle (D-034 Exit Gate) */}
          {isPdf && (
            <button
              onClick={() => setForceFallback((f) => !f)}
              className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                forceFallback
                  ? "bg-amber-100 text-amber-900 border-amber-300 shadow-2xs"
                  : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
              }`}
              title="Force text fallback view (D-034 verification)"
            >
              {forceFallback ? "PDF View" : "Fallback"}
            </button>
          )}

          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors"
            title="Close viewer (Esc)"
            aria-label="Close viewer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* 2. Active Citation Occurrence Toolbar (B4, B1) */}
      {activeQuote && occurrenceInfo.totalOccurrences > 0 && (
        <div className="bg-amber-50/90 border-b border-amber-200 px-3.5 py-2 flex items-center justify-between text-xs text-amber-900 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <div className="truncate">
              <span className="font-semibold text-amber-950">
                Occurrence {activeOccurrenceIndex + 1} of {occurrenceInfo.totalOccurrences}
              </span>
              {activePageRanges.length > 0 && (
                <span className="ml-2 text-[11px] text-amber-800">
                  {activePageRanges.length === 1
                    ? `(Page ${activePageRanges[0].pageNumber})`
                    : `(Pages ${activePageRanges[0].pageNumber}–${activePageRanges[activePageRanges.length - 1].pageNumber})`}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-2">
            {occurrenceInfo.totalOccurrences > 1 && (
              <div className="flex items-center gap-1 mr-1">
                <button
                  onClick={() =>
                    setActiveOccurrenceIndex((idx) =>
                      idx > 0 ? idx - 1 : occurrenceInfo.totalOccurrences - 1
                    )
                  }
                  className="px-2 py-0.5 rounded-sm bg-white border border-amber-200 text-amber-900 text-xs font-semibold hover:bg-amber-100/80 transition-colors"
                  title="Previous occurrence"
                >
                  &larr; Prev
                </button>
                <button
                  onClick={() =>
                    setActiveOccurrenceIndex((idx) =>
                      idx < occurrenceInfo.totalOccurrences - 1 ? idx + 1 : 0
                    )
                  }
                  className="px-2 py-0.5 rounded-sm bg-white border border-amber-200 text-amber-900 text-xs font-semibold hover:bg-amber-100/80 transition-colors"
                  title="Next occurrence"
                >
                  Next &rarr;
                </button>
              </div>
            )}

            {onClearActiveQuote && (
              <button
                onClick={onClearActiveQuote}
                className="text-[11px] text-amber-700 hover:text-amber-950 underline ml-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quote not found notification */}
      {activeQuote && occurrenceInfo.totalOccurrences === 0 && (
        <div className="bg-stone-100 border-b border-stone-200 px-3.5 py-2 text-xs text-stone-600 flex items-center justify-between">
          <span>Quote wording could not be located in this document.</span>
          {onClearActiveQuote && (
            <button onClick={onClearActiveQuote} className="underline text-[11px] text-stone-500">
              Dismiss
            </button>
          )}
        </div>
      )}

      {/* Unreadable pages warning */}
      {data?.unreadablePages && data.unreadablePages.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-1.5 text-xs text-amber-800 flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-[11px]">
            Pages {data.unreadablePages.join(", ")} contain sparse or unreadable text.
          </span>
        </div>
      )}

      {/* 3. Main Viewer Scroll Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-6"
      >
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 text-stone-400 gap-2">
            <svg className="animate-spin h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-xs">Loading document...</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 text-red-800 text-xs rounded-lg border border-red-200">
            {error}
          </div>
        )}

        {/* PDF Render Mode */}
        {isPdf && !forceFallback && !loading && (
          <div className="space-y-6">
            {pdfLoading && (
              <div className="py-12 text-center text-xs text-stone-400 flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4 text-stone-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Initializing PDF engine...
              </div>
            )}

            {pdfError && (
              <div className="p-3 bg-red-50 text-red-800 text-xs rounded-lg border border-red-200">
                PDF engine error: {pdfError}. Falling back to text view.
              </div>
            )}

            {pdfDoc &&
              data?.pages?.map((pageRecord) => {
                const quoteRangeForPage = activePageRanges.find(
                  (r) => r.pageNumber === pageRecord.pageNumber
                );

                return (
                  <PdfPageView
                    key={pageRecord.id || pageRecord.pageNumber}
                    pdfDoc={pdfDoc}
                    pageNumber={pageRecord.pageNumber}
                    pageRecord={pageRecord}
                    pageQuoteRange={quoteRangeForPage}
                    isActivePage={Boolean(quoteRangeForPage)}
                    forceFallback={forceFallback}
                    scale={scale}
                  />
                );
              })}
          </div>
        )}

        {/* DOCX or Forced Text Fallback Mode */}
        {(!isPdf || forceFallback) && !loading && data && (
          <div className="space-y-5">
            {data.pages && data.pages.length > 0 ? (
              data.pages.map((p) => {
                const quoteRangeForPage = activePageRanges.find(
                  (r) => r.pageNumber === p.pageNumber
                );
                const pageText = (p as any).pageText || data.text?.slice(p.startOffset, p.endOffset) || "";

                const sliced = quoteRangeForPage
                  ? sliceTextWithHighlight(pageText, quoteRangeForPage, p.startOffset)
                  : { before: pageText, highlighted: "", after: "" };

                return (
                  <div
                    key={p.id || p.pageNumber}
                    data-page-number={p.pageNumber}
                    className={`rounded-xl border bg-white p-4 shadow-2xs transition-all ${
                      quoteRangeForPage ? "border-amber-400 ring-2 ring-amber-300" : "border-stone-200"
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-stone-100 text-[11px] font-semibold text-stone-600">
                      <span>{isPdf ? `Page ${p.pageNumber}` : `Section ${p.pageNumber}`}</span>
                      <span className="text-stone-400 font-mono text-[9px]">
                        [{p.startOffset}..{p.endOffset}]
                      </span>
                    </div>

                    <div className="font-contract whitespace-pre-wrap leading-relaxed text-[13px] text-stone-800">
                      {sliced.highlighted ? (
                        <>
                          {sliced.before}
                          <mark className="bg-amber-200/90 text-stone-950 font-semibold px-0.5 rounded-xs shadow-2xs">
                            {sliced.highlighted}
                          </mark>
                          {sliced.after}
                        </>
                      ) : (
                        sliced.before || <span className="italic text-stone-400">Empty</span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="font-contract whitespace-pre-wrap text-stone-800 leading-relaxed text-[13px] p-4 bg-white rounded-xl border border-stone-200">
                {data.text || "No text available."}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
