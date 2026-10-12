"use client";

import React from "react";
import type { StoredQuote } from "@/server/chat";

export interface QuoteCardProps {
  quote: StoredQuote;
  onOpenInViewer?: (quote: StoredQuote) => void;
}

export function QuoteCard({ quote, onOpenInViewer }: QuoteCardProps) {
  const isVerified = quote.status === "verified";
  const isUnverified = quote.status === "unverified";
  const isPending = quote.status === "dropped"; // or intermediate

  // Plain-language reason explanation (docs/DESIGN.md & D-013)
  let reasonText = "";
  if (quote.reason === "not_found") {
    reasonText = "This quote was not found verbatim in the document text.";
  } else if (quote.reason === "too_short") {
    reasonText = "Quote is under 15 characters (too short to verify uniquely).";
  } else if (quote.reason === "wrong_document") {
    reasonText = "This quote appears in another selected document, not this one.";
  } else if (quote.reason === "verifier_error") {
    reasonText = "Unable to verify quote against the canonical text.";
  } else if (quote.reason) {
    reasonText = quote.reason;
  }

  const pageNum = quote.matches?.[0]?.start !== undefined
    ? (quote as any).pageNumber || 1
    : undefined;

  return (
    <div
      className={`rounded-xl border p-3.5 transition-all shadow-2xs ${
        isVerified
          ? "bg-emerald-50/40 border-emerald-200/80 hover:border-emerald-300"
          : isUnverified
          ? "bg-amber-50/40 border-amber-200/80 hover:border-amber-300"
          : "bg-stone-50 border-stone-200"
      }`}
    >
      {/* Header bar: ID, Document Name, Page, Status */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-[11px] font-bold text-stone-700 bg-white px-1.5 py-0.5 rounded border border-stone-200">
            [{quote.localId}]
          </span>

          {quote.documentName && (
            <span
              className="text-[11px] font-medium text-stone-600 bg-white px-2 py-0.5 rounded border border-stone-200 truncate max-w-[180px]"
              title={quote.documentName}
            >
              {quote.documentName}
            </span>
          )}

          {pageNum !== undefined && (
            <span className="text-[11px] text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">
              Page {pageNum}
            </span>
          )}
        </div>

        <div>
          {isVerified ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full border border-emerald-300">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Verified in document
            </span>
          ) : isUnverified ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-full border border-amber-300">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Unverified
            </span>
          ) : (
            <span className="text-[11px] font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
              Dropped
            </span>
          )}
        </div>
      </div>

      {/* Quote text in serif font */}
      <blockquote className="font-serif italic text-xs leading-relaxed text-stone-800 dark:text-stone-200 border-l-2 border-stone-300 pl-2.5 my-2">
        “{quote.text}”
      </blockquote>

      {/* Reason (for unverified quotes) or Open Action (for verified quotes) */}
      <div className="flex items-center justify-between pt-1 mt-1 border-t border-stone-200/60">
        {isUnverified ? (
          <p className="text-[11px] text-amber-900 font-medium leading-tight">
            {reasonText}
          </p>
        ) : (
          <div className="flex-1" />
        )}

        {isVerified && onOpenInViewer && (
          <button
            type="button"
            onClick={() => onOpenInViewer(quote)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200 hover:border-indigo-300 transition-colors shadow-2xs ml-auto cursor-pointer"
          >
            <span>Open in document</span>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
