import React from "react";
import type { Match, VerifyReason } from "@/lib/quotes";
import { StatusBar } from "../ui/StatusBar";
import { DocBadge } from "../ui/DocBadge";
import { getQuoteState } from "./useQuoteState";

interface QuoteHoverCardProps {
  quoteText: string;
  status?: "verified" | "unverified" | "dropped" | "pending" | null;
  reason?: VerifyReason | string | null;
  matches?: Match[] | null;
  withGaps?: boolean;
  repaired?: boolean;
  docName?: string;
  docIndex?: number;
  onOpenDocument?: () => void;
  onViewAllSources?: () => void;
  className?: string;
}

export const QuoteHoverCard: React.FC<QuoteHoverCardProps> = ({
  quoteText,
  status,
  reason,
  matches,
  withGaps,
  repaired,
  docName,
  docIndex,
  onOpenDocument,
  onViewAllSources,
  className = "",
}) => {
  const { statusBarState, locationText, isClickable, docTitle, docNumber } =
    getQuoteState(status, reason, matches, docName, docIndex, withGaps, repaired);

  return (
    <div
      className={`w-[420px] bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_8px_24px_rgba(17,24,39,0.12)] p-4 text-left font-sans z-50 animate-in fade-in zoom-in-95 duration-150 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Title Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 min-w-0">
          {docNumber && (
            <span className="px-1.5 py-0.5 rounded-[4px] bg-[#EFF6FF] text-[#2563EB] text-[11px] font-semibold shrink-0">
              {docNumber}
            </span>
          )}
          <span className="font-semibold text-[15px] text-[#111827] truncate" title={docTitle}>
            {docTitle}
          </span>
        </div>
        <DocBadge filename={docTitle} />
      </div>

      {/* Signature Status Bar */}
      <div className="rounded-[8px] overflow-hidden border border-[#E5E7EB] mb-3">
        <StatusBar state={statusBarState} reason={reason} />

        {/* Excerpt Body */}
        {statusBarState === "unverified" ? (
          <div className="p-3 bg-[#F9FAFB] border-t border-dashed border-[#FCD34D]">
            <div className="text-[11.5px] font-medium text-[#B45309] uppercase tracking-wider mb-1">
              Claim wording (not located)
            </div>
            <div className="font-contract text-[14px] text-[#4B5563] italic line-clamp-3" dir="auto">
              "{quoteText}"
            </div>
          </div>
        ) : (
          <div className="relative p-3 bg-[#F9FAFB] border-t border-[#E5E7EB]">
            <div
              className="font-contract text-[14px] text-[#111827] leading-relaxed line-clamp-3"
              dir="auto"
            >
              <mark className="bg-[#FEF3C7] text-inherit px-0.5 rounded-[2px]">
                {quoteText}
              </mark>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-[#F9FAFB] to-transparent pointer-events-none" />
          </div>
        )}

        {/* Footer Strip */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#F3F4F6] border-t border-[#E5E7EB] text-[12.5px] text-[#6B7280]">
          <span className="truncate">{locationText}</span>
          {isClickable && onOpenDocument && (
            <button
              type="button"
              onClick={onOpenDocument}
              className="text-[#2563EB] hover:text-[#1D4ED8] underline font-medium ml-2 shrink-0 cursor-pointer"
            >
              Show full passage
            </button>
          )}
        </div>
      </div>

      {/* Action Row */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#F3F4F6]">
        {onViewAllSources ? (
          <button
            type="button"
            onClick={onViewAllSources}
            className="text-[13px] font-medium text-[#4B5563] hover:text-[#111827] px-2 py-1 rounded-[6px] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
          >
            All sources
          </button>
        ) : (
          <div />
        )}

        {isClickable && onOpenDocument && (
          <button
            type="button"
            onClick={onOpenDocument}
            className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-[8px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[13px] font-medium shadow-sm transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-1"
          >
            Open in document
          </button>
        )}
      </div>
    </div>
  );
};
