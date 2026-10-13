"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import type { PageRecord } from "@/lib/types";
import {
  getQuoteOccurrences,
  splitQuoteAcrossDocumentPages,
  sliceTextWithHighlight,
  type QuoteOccurrenceInfo,
} from "@/lib/citation-mapping";
import { PdfPageView } from "../library/PdfPageView";
import { FileGlyph } from "../ui/FileGlyph";
import { Spine, type SpineTick } from "../ui/Spine";
import { X, ChevronLeft, ChevronRight, Copy, Check, ZoomIn, ZoomOut } from "lucide-react";

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

interface ReadingDeskProps {
  documentId: string;
  activeQuote?: ActiveQuoteCitation | null;
  onClose: () => void;
  onClearActiveQuote?: () => void;
}

export function ReadingDesk({
  documentId,
  activeQuote,
  onClose,
  onClearActiveQuote,
}: ReadingDeskProps) {
  const [data, setData] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // PDF.js state
  const [pdfDoc, setPdfDoc] = useState<any | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const [scale, setScale] = useState(1.15);
  const [forceFallback, setForceFallback] = useState(false);
  const [activeOccurrenceIndex, setActiveOccurrenceIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [scrollRatio, setScrollRatio] = useState(0);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Load document text and pages
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError(null);

    async function loadDoc() {
      try {
        const res = await fetch(`/api/documents/${documentId}/text`);
        if (!res.ok) throw new Error("Failed to load document text");
        const docData = await res.json();
        if (!isCancelled) {
          setData(docData.document || docData);
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

  // Load PDF.js document
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

  // Occurrences
  const occurrenceInfo: QuoteOccurrenceInfo = useMemo(() => {
    if (!activeQuote?.text || !data?.text) {
      return { matches: [], activeMatchIndex: 0, activeMatch: null, totalOccurrences: 0 };
    }
    return getQuoteOccurrences(activeQuote.text, data.text, activeQuote.chunkRange);
  }, [activeQuote?.text, data?.text, activeQuote?.chunkRange]);

  useEffect(() => {
    setActiveOccurrenceIndex(occurrenceInfo.activeMatchIndex);
  }, [occurrenceInfo.activeMatchIndex]);

  const currentMatch = occurrenceInfo.matches[activeOccurrenceIndex] ?? null;

  const activePageRanges = useMemo(() => {
    if (!currentMatch || !data?.pages || data.pages.length === 0) return [];
    return splitQuoteAcrossDocumentPages(currentMatch, data.pages);
  }, [currentMatch, data?.pages]);

  // Scroll tracking for vertical spine
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll > 0) {
      setScrollRatio(el.scrollTop / maxScroll);
    }
  };

  // Jump to active page on quote change
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

  const totalPages = data?.pageCount || data?.pages?.length || 1;
  const activePageDisplay =
    activePageRanges.length > 0 ? activePageRanges[0].pageNumber : 1;

  // Build spine ticks for vertical desk spine
  const spineTicks: SpineTick[] = useMemo(() => {
    if (!data?.pages || data.pages.length === 0 || occurrenceInfo.matches.length === 0) return [];
    return occurrenceInfo.matches.map((m, idx) => {
      const pageIdx = data.pages!.findIndex(
        (p) => m.start >= p.startOffset && m.start <= p.endOffset
      );
      const pos = pageIdx >= 0 ? pageIdx / data.pages!.length : 0.5;
      return {
        id: idx,
        position: pos,
        color: idx === activeOccurrenceIndex ? "#FFD84D" : "#FFF0A8",
        label: `Occurrence ${idx + 1}`,
        tooltip: `Quote occurrence ${idx + 1} of ${occurrenceInfo.totalOccurrences}`,
      };
    });
  }, [data?.pages, occurrenceInfo.matches, activeOccurrenceIndex]);

  return (
    <aside
      aria-label="Reading desk"
      className="flex-1 h-full bg-[#E4E2EF] border-l border-[#CFCCE0] flex flex-col font-sans select-none overflow-hidden relative"
    >
      {/* 1. Header Toolbar (Section 6.3) */}
      <div className="h-14 px-4 bg-white border-b border-[#E3E1EF] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <FileGlyph filename={data?.filename} mime={data?.mime} />
          <div className="min-w-0">
            <h3
              className="text-[14px] font-semibold text-[#17142B] truncate leading-tight"
              title={data?.filename}
            >
              {data?.filename || "Loading document..."}
            </h3>
            <p className="text-[12px] text-[#6E6B87]">
              Page {activePageDisplay} of {totalPages}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Occurrence Stepper */}
          {occurrenceInfo.totalOccurrences > 1 && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-[8px] bg-[#F7F7FC] border border-[#E3E1EF] text-[12px] text-[#3B3855] tabular-nums">
              <span>
                {activeOccurrenceIndex + 1} of {occurrenceInfo.totalOccurrences}
              </span>
              <div className="flex items-center ml-1">
                <button
                  type="button"
                  onClick={() =>
                    setActiveOccurrenceIndex((i) =>
                      i > 0 ? i - 1 : occurrenceInfo.totalOccurrences - 1
                    )
                  }
                  className="p-0.5 hover:bg-[#E3E1EF] rounded-[4px] cursor-pointer"
                  title="Previous occurrence"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveOccurrenceIndex((i) =>
                      i < occurrenceInfo.totalOccurrences - 1 ? i + 1 : 0
                    )
                  }
                  className="p-0.5 hover:bg-[#E3E1EF] rounded-[4px] cursor-pointer"
                  title="Next occurrence"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Zoom controls (PDF only) */}
          {isPdf && !forceFallback && (
            <div className="flex items-center bg-[#F7F7FC] rounded-[8px] p-0.5 border border-[#E3E1EF]">
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(0.75, s - 0.15))}
                className="p-1 text-[#5A5775] hover:text-[#17142B] cursor-pointer"
                title="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono text-[#5A5775] px-1.5 tabular-nums">
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setScale((s) => Math.min(2.0, s + 0.15))}
                className="p-1 text-[#5A5775] hover:text-[#17142B] cursor-pointer"
                title="Zoom in"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Text Fallback Toggle (D-034) */}
          {isPdf && (
            <button
              type="button"
              onClick={() => setForceFallback((f) => !f)}
              className={`px-2.5 py-1 rounded-[8px] text-[12px] font-medium border transition-colors cursor-pointer ${
                forceFallback
                  ? "bg-[#FCE9D2] text-[#A8480A] border-[#A8480A]"
                  : "bg-white text-[#5A5775] border-[#E3E1EF] hover:bg-[#F7F7FC]"
              }`}
            >
              {forceFallback ? "PDF View" : "Fallback"}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-[8px] text-[#6E6B87] hover:text-[#17142B] hover:bg-[#F7F7FC] border border-transparent hover:border-[#E3E1EF] transition-colors cursor-pointer"
            title="Close reading desk (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Main Desk Canvas + Vertical Spine on right edge */}
      <div className="flex-1 flex overflow-hidden relative">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-6 bg-[#E4E2EF] select-text flex justify-center"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-[#6E6B87] text-[13px]">
              <div className="w-6 h-6 border-2 border-[#17142B] border-t-transparent rounded-full animate-spin mb-2" />
              <p>Loading document text...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-[12px] bg-[#FEE4E2] border border-[#B42318]/20 text-[13px] text-[#B42318] max-w-md my-auto">
              <p className="font-semibold mb-1">Failed to display document</p>
              <p className="text-[12px]">{error}</p>
            </div>
          ) : isPdf && !forceFallback ? (
            <div className="flex flex-col items-center gap-6">
              {pdfLoading && (
                <div className="py-6 text-center text-[#6E6B87] text-[12px]">
                  <div className="w-5 h-5 border-2 border-[#17142B] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <span>Rendering PDF pages...</span>
                </div>
              )}

              {pdfError && (
                <div className="w-full p-3 rounded-[10px] bg-[#FCE9D2] border border-[#A8480A]/20 text-[12px] text-[#A8480A] mb-3">
                  <p className="font-semibold">PDF renderer notice</p>
                  <p>{pdfError}. Displaying canonical text view.</p>
                </div>
              )}

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
                <div className="text-[13px] text-[#6E6B87] py-8">
                  No rendered pages available.
                </div>
              )}
            </div>
          ) : (
            /* Canonical Text View (DOCX or Fallback) */
            <div className="space-y-6 max-w-2xl w-full mx-auto">
              {data?.pages && data.pages.length > 0 ? (
                data.pages.map((p) => {
                  const quoteRangeForPage = activePageRanges.find(
                    (r) => r.pageNumber === p.pageNumber
                  );
                  const pageText =
                    (p as any).pageText ||
                    (data?.text ? data.text.slice(p.startOffset, p.endOffset) : "");
                  const sliced = quoteRangeForPage
                    ? sliceTextWithHighlight(pageText, quoteRangeForPage, p.startOffset)
                    : { before: pageText, highlighted: "", after: "" };

                  return (
                    <div
                      key={p.id || p.pageNumber}
                      data-page-number={p.pageNumber}
                      className={`rounded-[14px] border bg-white p-6 shadow-sm transition-all ${
                        quoteRangeForPage
                          ? "border-[#FFD84D] ring-2 ring-[#FFF0A8]"
                          : "border-[#CFCCE0]"
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#F1F0F8] text-[11.5px] font-semibold text-[#6E6B87]">
                        <span>{isPdf ? `Page ${p.pageNumber}` : `Section ${p.pageNumber}`}</span>
                        <span className="font-mono text-[10px] text-[#5A5775]">
                          [{p.startOffset}..{p.endOffset}]
                        </span>
                      </div>

                      <div className="font-reading whitespace-pre-wrap leading-relaxed text-[15px] text-[#17142B]">
                        {sliced.highlighted ? (
                          <>
                            {sliced.before}
                            <mark className="bg-[#FFD84D] text-[#17142B] font-semibold px-0.5 rounded-[2px]">
                              {sliced.highlighted}
                            </mark>
                            {sliced.after}
                          </>
                        ) : (
                          sliced.before || <span className="italic text-[#6E6B87]">Empty section</span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="font-reading whitespace-pre-wrap text-[#17142B] leading-relaxed text-[15px] p-6 bg-white rounded-[14px] border border-[#CFCCE0] shadow-sm">
                  {data?.text || "No text available."}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. Signature Vertical Spine on Right Edge (Section 6.3) */}
        <div className="w-[14px] shrink-0 bg-[#E4E2EF] border-l border-[#CFCCE0] py-2 flex flex-col justify-center items-center">
          <Spine
            cells={totalPages}
            ticks={spineTicks}
            activePosition={scrollRatio}
            orientation="vertical"
            thickness={12}
            onSelect={(pageIdx) => {
              const targetPage = pageIdx + 1;
              const targetEl = scrollContainerRef.current?.querySelector(
                `[data-page-number="${targetPage}"]`
              );
              targetEl?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
        </div>
      </div>

      {/* 4. Footer Strip (Section 6.3 & 6.7) */}
      <footer className="h-10 px-4 bg-white border-t border-[#E3E1EF] flex items-center justify-between text-[12.5px] text-[#5A5775] shrink-0">
        <span className="truncate font-medium">
          {activeQuote ? `Page ${activePageDisplay} · Citation active` : "Reading desk"}
        </span>

        {activeQuote && (
          <button
            type="button"
            onClick={handleCopyQuote}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium text-[#3B3855] hover:text-[#17142B] hover:bg-[#F7F7FC] rounded-[6px] border border-transparent hover:border-[#E3E1EF] transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#0B7A5F]" />
                <span className="text-[#0B7A5F]">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#6E6B87]" />
                <span>Copy quote</span>
              </>
            )}
          </button>
        )}
      </footer>
    </aside>
  );
}
