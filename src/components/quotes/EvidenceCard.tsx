import React, { useState } from "react";
import type { Match, VerifyReason } from "@/lib/quotes";
import { StatusBar } from "../ui/StatusBar";
import { getQuoteState } from "./useQuoteState";
import { Copy, Check, ExternalLink } from "lucide-react";

interface EvidenceCardProps {
  quoteText: string;
  claimSentence?: string;
  status?: "verified" | "unverified" | "dropped" | "pending" | null;
  reason?: VerifyReason | string | null;
  matches?: Match[] | null;
  withGaps?: boolean;
  repaired?: boolean;
  docName?: string;
  docIndex?: number;
  onOpenDocument?: () => void;
  className?: string;
}

export const EvidenceCard: React.FC<EvidenceCardProps> = ({
  quoteText,
  claimSentence,
  status,
  reason,
  matches,
  withGaps,
  repaired,
  docName,
  docIndex,
  onOpenDocument,
  className = "",
}) => {
  const [copied, setCopied] = useState(false);
  const { statusBarState, locationText, isClickable } = getQuoteState(
    status,
    reason,
    matches,
    docName,
    docIndex,
    withGaps,
    repaired
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(quoteText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className={`rounded-[12px] bg-white border border-[#E5E7EB] overflow-hidden shadow-[0_1px_2px_rgba(17,24,39,0.06)] font-sans ${className}`}
    >
      {/* Claim context */}
      {claimSentence && (
        <div className="px-3.5 py-2 text-[12.5px] text-[#4B5563] bg-[#F9FAFB] border-b border-[#E5E7EB]">
          <span className="font-medium text-[#111827]">Supports: </span>
          <span className="italic">"{claimSentence}"</span>
        </div>
      )}

      {/* Signature Status Bar */}
      <StatusBar state={statusBarState} reason={reason} />

      {/* Passage block */}
      <div className="p-3.5 bg-[#F9FAFB]">
        <div
          className="font-contract text-[14.5px] text-[#111827] leading-relaxed bg-white p-3 rounded-[8px] border border-[#E5E7EB]"
          dir="auto"
        >
          {statusBarState === "unverified" ? (
            <div className="text-[#B45309] italic">
              "{quoteText}"
              <span className="block mt-1 text-[12px] text-[#6B7280] not-italic">
                (This wording could not be located in the specified document)
              </span>
            </div>
          ) : (
            <mark className="bg-[#FEF3C7] text-inherit px-1 py-0.5 rounded-[3px]">
              {quoteText}
            </mark>
          )}
        </div>
      </div>

      {/* Footer strip with location and actions */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#F3F4F6] border-t border-[#E5E7EB] text-[13px]">
        <span className="text-[#6B7280] font-medium">{locationText}</span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12.5px] font-medium text-[#4B5563] hover:text-[#111827] hover:bg-white rounded-[6px] border border-transparent hover:border-[#D1D5DB] transition-colors cursor-pointer"
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

          {isClickable && onOpenDocument && (
            <button
              type="button"
              onClick={onOpenDocument}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-[12.5px] font-medium text-[#111827] bg-white hover:bg-[#F9FAFB] rounded-[6px] border border-[#D1D5DB] shadow-xs transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Show in document</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
