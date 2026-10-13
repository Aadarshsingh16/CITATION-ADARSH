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
      <div className="p-2.5 bg-[#F9FAFB]">
        <div
          className="font-contract text-[13.5px] text-[#111827] leading-relaxed bg-white p-2.5 rounded-[8px] border border-[#E5E7EB] max-h-32 overflow-y-auto"
          dir="auto"
        >
          {statusBarState === "unverified" ? (
            <div className="text-[#B45309] italic">
              "{quoteText}"
              <span className="block mt-0.5 text-[11.5px] text-[#6B7280] not-italic">
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
      <div className="flex items-center justify-between px-3 py-2 bg-[#F3F4F6] border-t border-[#E5E7EB] text-[12px]">
        <span className="text-[#5A5775] font-medium truncate max-w-[120px]">{locationText}</span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11.5px] font-medium text-[#4B5563] hover:text-[#111827] hover:bg-white rounded-[6px] border border-transparent hover:border-[#D1D5DB] transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-[#15803D]" />
                <span className="text-[#15803D]">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-[#6B7280]" />
                <span>Copy</span>
              </>
            )}
          </button>

          {isClickable && onOpenDocument && (
            <button
              type="button"
              onClick={onOpenDocument}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] font-semibold text-white bg-[#17142B] hover:bg-[#3B3855] rounded-[6px] shadow-xs transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#4B3FD6]"
              title="Jump directly to this exact line in contract desk"
            >
              <ExternalLink className="w-3 h-3 text-white" />
              <span>Show in doc</span>
            </button>
          )}
        </div>
      </div>
    </div>

  );
};
