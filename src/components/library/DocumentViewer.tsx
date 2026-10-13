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
import { DocBadge } from "../ui/DocBadge";
import { X, ChevronLeft, ChevronRight, Copy, Check } from "lucide-react";

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
  const [copied, setCopied] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Load document text and pages
  useEffect(() => {
    if (!documentId) {
      setData(null);
      setPdfDoc(null);
      return;
    }

    let isCancelled = false;
    setLoading(true);
    setError(null);

    async function loadDoc() {
      try {
        const res = await fetch(`/api/documents/${documentId}/text`);
        if (!res.ok) throw new Error("Failed to load document text");
        const docData = await res.json();
        if (!isCancelled) {
          setData(docData.document);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    void loadDoc();

    return () => {
      isCancelled = true;
    };
  }, [documentId]);

  const isPdf =
    data?.mime === "application/pdf" ||
    (data?.filename && data.filename.toLowerCase().endsWith(".pdf"));

  // Load PDF.js document representation
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

        const doc = await loadingTask.promise;
        if (!isCancelled) {
          setPdfDoc(doc);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setPdfError(err instanceof Error ? err.message : "Failed to load PDF file");
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

  const handleCopyQuote = async () => {
    if (!activeQuote?.text) return;
    try {
      await navigator.clipboard.writeText(activeQuote.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  if (!documentId) return null;

  const totalPages = data?.pageCount || data?.pages?.length || 1;
  const activePageDisplay =
    activePageRanges.length > 0 ? activePageRanges[0].pageNumber : 1;

  // Footer location string (Section 6.7)
  let footerLocation = isPdf ? `Page ${activePageDisplay}` : `Section ${activePageDisplay}`;
  if (currentMatch) {
    footerLocation += ` · Offset ${currentMatch.start}`;
  }

  return (
    <div
      className="flex flex-col h-full bg-white font-sans select-none overflow-hidden"
      aria-label="Document citation viewer"
    >
      {/* 1. Header Toolbar (Section 6.7) */}
      <div className="px-4 py-3 border-b border-[#E5E7EB] bg-white flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <DocBadge filename={data?.filename} mime={data?.mime} />
          <div className="min-w-0">
            <h3
              className="text-[13.5px] font-semibold text-[#111827] truncate leading-tight"
              title={data?.filename}
            >
              {data?.filename || "Loading document..."}
            </h3>
            <p className="text-[11px] text-[#6B7280]">
              Page {activePageDisplay} of {totalPages}
            </p>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Zoom controls (PDF only) */}
          {isPdf && !forceFallback && (
            <div className="flex items-center bg-[#F3F4F6] rounded-[6px] p-0.5 border border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(0.75, s - 0.15))}
                className="px-1.5 py-0.5 text-[11px] text-[#4B5563] hover:text-[#111827] font-semibold cursor-pointer"
                title="Zoom out"
              >
                -
              </button>
              <span className="text-[10px] font-mono text-[#6B7280] px-1">
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setScale((s) => Math.min(2.0, s + 0.15))}
                className="px-1.5 py-0.5 text-[11px] text-[#4B5563] hover:text-[#111827] font-semibold cursor-pointer"
                title="Zoom in"
              >
                +
              </button>
            </div>
          )}

          {/* Force Text Fallback Toggle (D-034 Exit Gate) */}
          {isPdf && (
            <button
              type="button"
              onClick={() => setForceFallback((f) => !f)}
              className={`px-2 py-1 rounded-[6px] text-[11px] font-medium border transition-colors cursor-pointer ${
                forceFallback
                  ? "bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]"
                  : "bg-white text-[#4B5563] border-[#E5E7EB] hover:bg-[#F9FAFB]"
              }`}
              title="Force text fallback view"
            >
              {forceFallback ? "PDF View" : "Fallback"}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] rounded-[6px] transition-colors cursor-pointer"
            title="Close viewer (Esc)"
            aria-label="Close viewer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Active Citation Occurrence Bar (Section 6.7) */}
      {activeQuote && occurrenceInfo.totalOccurrences > 0 && (
        <div className="bg-[#FEF3C7] border-b border-[#FCD34D] px-3.5 py-2 flex items-center justify-between text-[12px] text-[#B45309] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#B45309] shrink-0" />
            <div className="truncate font-semibold">
              Occurrence {activeOccurrenceIndex + 1} of {occurrenceInfo.totalOccurrences}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {occurrenceInfo.totalOccurrences > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setActiveOccurrenceIndex((idx) =>
                      idx > 0 ? idx - 1 : occurrenceInfo.totalOccurrences - 1
                    )
                  }
                  className="p-1 rounded-[4px] bg-white border border-[#FCD34D] text-[#B45309] hover:bg-[#FEF3C7] cursor-pointer"
                  title="Previous occurrence"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveOccurrenceIndex((idx) =>
                      idx < occurrenceInfo.totalOccurrences - 1 ? idx + 1 : 0
                    )
                  }
                  className="p-1 rounded-[4px] bg-white border border-[#FCD34D] text-[#B45309] hover:bg-[#FEF3C7] cursor-pointer"
                  title="Next occurrence"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {onClearActiveQuote && (
              <button
                type="button"
                onClick={onClearActiveQuote}
                className="text-[11.5px] text-[#B45309] hover:underline ml-1 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Fallback notification notice */}
      {forceFallback && (
        <div className="px-3.5 py-1.5 bg-[#EFF6FF] border-b border-[#BFDBFE] text-[11.5px] text-[#1D4ED8]">
          Showing extracted text for this page.
        </div>
      )}

      {/* 3. Main Viewer Scroll Canvas */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 bg-[#F9FAFB] select-text"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-[#6B7280] text-[13px]">
            <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mb-2" />
            <p>Loading document text...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-[8px] bg-[#FEE2E2] border border-[#FECACA] text-[13px] text-[#B91C1C]">
            <p className="font-semibold mb-1">Failed to display document</p>
            <p className="text-[12px]">{error}</p>
          </div>
        ) : isPdf && !forceFallback ? (
          <div className="flex flex-col items-center gap-4">
            {pdfLoading && (
              <div className="py-6 text-center text-[#6B7280] text-[12px]">
                <div className="w-5 h-5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <span>Rendering PDF pages...</span>
              </div>
            )}

            {pdfError && (
              <div className="w-full p-3 rounded-[8px] bg-[#FEF3C7] border border-[#FCD34D] text-[12px] text-[#B45309] mb-3">
                <p className="font-semibold">PDF renderer notice</p>
                <p>{pdfError}. Displaying canonical text view.</p>
              </div>
            )}

            {/* Render PDF pages */}
            {data?.pages && data.pages.length > 0 ? (
              data.pages.map((p) => {
                const quoteRangeForPage = activePageRanges.find(
                  (r) => r.pageNumber === p.pageNumber
                );
                return (
                  <PdfPageView
                    key={p.id || p.pageNumber}
                    pdfDoc={pdfDoc}
                    pageNumber={p.pageNumber}
                    pageRecord={p}
                    pageQuoteRange={quoteRangeForPage}
                    isActivePage={activePageRanges.some((r) => r.pageNumber === p.pageNumber)}
                    forceFallback={forceFallback || !!pdfError}
                    scale={scale}
                  />
                );
              })
            ) : (
              <div className="text-[13px] text-[#6B7280] py-8">
                No rendered pages available.
              </div>
            )}
          </div>
        ) : (
          /* DOCX and Fallback Canonical Text View */
          <div className="space-y-4 max-w-2xl mx-auto">
            {data?.pages && data.pages.length > 0 ? (
              data.pages.map((p) => {
                const quoteRangeForPage = activePageRanges.find(
                  (r) => r.pageNumber === p.pageNumber
                );
                const pageText = (p as any).pageText || "";
                const sliced = quoteRangeForPage
                  ? sliceTextWithHighlight(pageText, quoteRangeForPage, p.startOffset)
                  : { before: pageText, highlighted: "", after: "" };

                return (
                  <div
                    key={p.id || p.pageNumber}
                    data-page-number={p.pageNumber}
                    className={`rounded-[12px] border bg-white p-4 shadow-xs transition-all ${
                      quoteRangeForPage
                        ? "border-[#FCD34D] ring-2 ring-[#FEF3C7]"
                        : "border-[#E5E7EB]"
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-[#F3F4F6] text-[11.5px] font-semibold text-[#6B7280]">
                      <span>{isPdf ? `Page ${p.pageNumber}` : `Section ${p.pageNumber}`}</span>
                      <span className="text-[#9CA3AF] font-mono text-[10px]">
                        [{p.startOffset}..{p.endOffset}]
                      </span>
                    </div>

                    <div className="font-contract whitespace-pre-wrap leading-relaxed text-[14px] text-[#111827]">
                      {sliced.highlighted ? (
                        <>
                          {sliced.before}
                          <mark className="bg-[#FEF3C7] text-[#111827] font-semibold px-0.5 rounded-[2px]">
                            {sliced.highlighted}
                          </mark>
                          {sliced.after}
                        </>
                      ) : (
                        sliced.before || <span className="italic text-[#9CA3AF]">Empty</span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="font-contract whitespace-pre-wrap text-[#111827] leading-relaxed text-[14px] p-4 bg-white rounded-[12px] border border-[#E5E7EB]">
                {data?.text || "No text available."}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Footer Strip (Section 6.7) */}
      {activeQuote && (
        <div className="px-4 py-2 bg-[#F3F4F6] border-t border-[#E5E7EB] flex items-center justify-between text-[12.5px] shrink-0">
          <span className="text-[#6B7280] font-medium truncate">{footerLocation}</span>

          <button
            type="button"
            onClick={handleCopyQuote}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium text-[#4B5563] hover:text-[#111827] hover:bg-white rounded-[6px] border border-transparent hover:border-[#D1D5DB] transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#15803D]" />
                <span className="text-[#15803D]">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#6B7280]" />
                <span>Copy quote</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
