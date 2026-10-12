"use client";

import React, { useEffect, useRef, useState } from "react";
import type { PageRecord } from "@/lib/types";
import { mapQuoteToPageSpans, sliceTextWithHighlight } from "@/lib/citation-mapping";

interface PdfPageViewProps {
  pdfDoc: any; // pdfjs-dist PDFDocumentProxy
  pageNumber: number;
  pageRecord?: PageRecord;
  pageQuoteRange?: { pageNumber: number; start: number; end: number };
  isActivePage?: boolean;
  forceFallback?: boolean;
  scale?: number;
  onFirstHighlightRendered?: () => void;
}

export const PdfPageView: React.FC<PdfPageViewProps> = ({
  pdfDoc,
  pageNumber,
  pageRecord,
  pageQuoteRange,
  isActivePage,
  forceFallback = false,
  scale = 1.15,
  onFirstHighlightRendered,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(forceFallback);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function renderPage() {
      if (forceFallback) {
        setIsFallback(true);
        setFallbackReason("Forced fallback mode (D-034)");
        setLoading(false);
        return;
      }

      if (!pdfDoc) return;

      setLoading(true);
      setError(null);

      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale });
        const textContent = await page.getTextContent();
        if (isCancelled) return;

        // Fallback check: item count mismatch (D-034, D-035)
        const storedItemsCount = pageRecord?.items?.starts?.length ?? 0;
        const renderedItemsCount = textContent.items.length;

        if (storedItemsCount > 0 && renderedItemsCount !== storedItemsCount) {
          setIsFallback(true);
          setFallbackReason(
            `Item count mismatch: rendered ${renderedItemsCount} vs stored ${storedItemsCount}`
          );
          setLoading(false);
          return;
        }

        setIsFallback(false);
        setFallbackReason(null);

        // Render Canvas
        const canvas = canvasRef.current;
        if (canvas) {
          const outputScale = window.devicePixelRatio || 1;
          canvas.width = Math.floor(viewport.width * outputScale);
          canvas.height = Math.floor(viewport.height * outputScale);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;

          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.scale(outputScale, outputScale);
            await page.render({
              canvasContext: ctx,
              viewport,
            }).promise;
          }
        }

        if (isCancelled) return;

        // Render Text Layer
        const textLayerDiv = textLayerRef.current;
        if (textLayerDiv) {
          textLayerDiv.innerHTML = "";
          textLayerDiv.style.width = `${Math.floor(viewport.width)}px`;
          textLayerDiv.style.height = `${Math.floor(viewport.height)}px`;
          textLayerDiv.style.setProperty("--scale-factor", `${scale}`);

          const pdfjs = await import("pdfjs-dist");
          const textLayer = new pdfjs.TextLayer({
            textContentSource: textContent,
            container: textLayerDiv,
            viewport,
          });

          await textLayer.render();

          if (isCancelled) return;

          // Apply citation highlights (D-034, D-035)
          if (pageQuoteRange && pageRecord) {
            const highlightResult = mapQuoteToPageSpans({
              pageRange: pageQuoteRange,
              pageRecord,
              renderedItemsCount: textContent.items.length,
            });

            if (!highlightResult.fallbackToText && highlightResult.spans.length > 0) {
              let firstSpanElement: HTMLElement | null = null;

              for (const highlight of highlightResult.spans) {
                const span = textLayerDiv.children[highlight.spanIndex] as HTMLElement | undefined;
                if (!span) continue;

                if (!firstSpanElement) {
                  firstSpanElement = span;
                }

                if (highlight.isFullSpan) {
                  span.classList.add("citation-highlight-full");
                  span.style.backgroundColor = "rgba(254, 240, 138, 0.65)";
                  span.style.borderRadius = "2px";
                  span.style.boxShadow = "0 0 0 1px rgba(245, 158, 11, 0.4)";
                } else {
                  const original = span.textContent || "";
                  const before = original.slice(0, highlight.startOffsetInSpan);
                  const mid = original.slice(
                    highlight.startOffsetInSpan,
                    highlight.endOffsetInSpan
                  );
                  const after = original.slice(highlight.endOffsetInSpan);

                  span.innerHTML = `${escapeHtml(before)}<mark style="background-color: rgba(254, 240, 138, 0.65); box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.4); border-radius: 2px;">${escapeHtml(mid)}</mark>${escapeHtml(after)}`;
                }
              }

              if (isActivePage && firstSpanElement) {
                firstSpanElement.scrollIntoView({ behavior: "smooth", block: "center" });
                onFirstHighlightRendered?.();
              }
            }
          }
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg);
          setIsFallback(true);
          setFallbackReason(`PDF render failed: ${msg}`);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    void renderPage();

    return () => {
      isCancelled = true;
    };
  }, [pdfDoc, pageNumber, pageRecord, pageQuoteRange, isActivePage, forceFallback, scale]);

  // Fallback Canonical Text View (D-034 / DOCX / Forced)
  if (isFallback) {
    const pageText = pageRecord
      ? (pageRecord as any).pageText || "No text available for this page."
      : "No text available.";

    const sliced =
      pageQuoteRange && pageRecord
        ? sliceTextWithHighlight(pageText, pageQuoteRange, pageRecord.startOffset)
        : { before: pageText, highlighted: "", after: "" };

    return (
      <div
        ref={containerRef}
        className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50/30 text-stone-900 shadow-xs"
        data-page-number={pageNumber}
      >
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-amber-200/80 text-[11px] font-semibold text-amber-900">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Page {pageNumber} (Extracted Text View)</span>
          </div>
          <span className="text-[10px] font-mono text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md">
            {fallbackReason || "Canonical text fallback"}
          </span>
        </div>

        <div className="font-contract whitespace-pre-wrap leading-relaxed text-[13px] text-stone-800 bg-white p-4 rounded-lg border border-amber-100 shadow-2xs">
          {sliced.highlighted ? (
            <>
              {sliced.before}
              <mark className="bg-amber-200/80 text-stone-950 font-semibold px-0.5 rounded-xs shadow-2xs">
                {sliced.highlighted}
              </mark>
              {sliced.after}
            </>
          ) : (
            sliced.before
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative mb-6 rounded-xl border bg-white shadow-sm overflow-hidden transition-all ${
        isActivePage ? "ring-2 ring-indigo-500 border-indigo-400" : "border-stone-200"
      }`}
      data-page-number={pageNumber}
    >
      {/* Header chip */}
      <div className="bg-stone-50 border-b border-stone-200 px-3 py-1.5 flex items-center justify-between text-xs text-stone-600">
        <span className="font-medium">Page {pageNumber}</span>
        {pageQuoteRange && (
          <span className="text-[10px] font-medium bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-sm">
            Active citation
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24 text-stone-400 text-xs gap-2">
          <svg className="animate-spin h-4 w-4 text-stone-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Rendering page {pageNumber}...
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-800 text-xs">
          Failed to render page image: {error}
        </div>
      )}

      {/* PDF Canvas and Text Layer Container */}
      <div className="relative mx-auto flex justify-center bg-stone-100/50 p-2 overflow-x-auto">
        <div className="relative shadow-md">
          <canvas ref={canvasRef} className="block bg-white" />
          <div
            ref={textLayerRef}
            className="textLayer absolute inset-0 select-text pointer-events-auto leading-none overflow-hidden"
          />
        </div>
      </div>
    </div>
  );
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
