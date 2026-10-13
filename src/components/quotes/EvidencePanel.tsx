import React, { useState } from "react";
import type { Match, VerifyReason } from "@/lib/quotes";
import { X, ChevronDown, ChevronRight, AlertTriangle, ExternalLink } from "lucide-react";
import { NumberChip } from "../ui/NumberChip";
import { DocBadge } from "../ui/DocBadge";
import { EvidenceCard } from "./EvidenceCard";
import { getQuoteState } from "./useQuoteState";

export interface EvidenceSourceItem {
  id: string;
  quoteIndex: number;
  quoteText: string;
  claimSentence?: string;
  status?: "verified" | "unverified" | "dropped" | "pending" | null;
  reason?: VerifyReason | string | null;
  matches?: Match[] | null;
  withGaps?: boolean;
  repaired?: boolean;
  documentId?: string;
  docName?: string;
  docIndex?: number;
}

interface EvidencePanelProps {
  isOpen: boolean;
  onClose: () => void;
  sources: EvidenceSourceItem[];
  selectedIndex?: number;
  onSelectIndex?: (index: number) => void;
  onOpenDocument?: (docId: string, pageNumber: number, offsets?: { startOffset: number; endOffset: number }) => void;
}

export const EvidencePanel: React.FC<EvidencePanelProps> = ({
  isOpen,
  onClose,
  sources,
  selectedIndex = 0,
  onSelectIndex,
  onOpenDocument,
}) => {
  const [activeIdx, setActiveIdx] = useState<number>(selectedIndex);
  const [showUnverified, setShowUnverified] = useState(false);

  if (!isOpen || sources.length === 0) return null;

  // Separate verified vs unverified items
  const verifiedItems: { item: EvidenceSourceItem; originalIndex: number }[] = [];
  const unverifiedItems: { item: EvidenceSourceItem; originalIndex: number }[] = [];

  sources.forEach((item, index) => {
    const isUnv = item.status === "unverified";
    if (isUnv) {
      unverifiedItems.push({ item, originalIndex: index });
    } else {
      verifiedItems.push({ item, originalIndex: index });
    }
  });

  const currentItem = sources[activeIdx] || sources[0];
  const { docTitle, isClickable } = getQuoteState(
    currentItem.status,
    currentItem.reason,
    currentItem.matches,
    currentItem.docName,
    currentItem.docIndex,
    currentItem.withGaps,
    currentItem.repaired
  );

  const handleOpenDoc = (item: EvidenceSourceItem) => {
    if (!onOpenDocument || !item.matches || item.matches.length === 0) return;
    const docId = item.documentId || "";
    onOpenDocument(docId, 1, {
      startOffset: item.matches[0].start,
      endOffset: item.matches[0].end,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-[880px] h-[580px] bg-white rounded-[16px] shadow-[0_8px_24px_rgba(17,24,39,0.14)] border border-[#E5E7EB] flex flex-col overflow-hidden font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E5E7EB] bg-white">
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-semibold text-[#111827]">Sources</h2>
            <span className="text-[13px] text-[#6B7280]">
              ({sources.length} {sources.length === 1 ? "citation" : "citations"})
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-[6px] text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
            aria-label="Close sources panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Master / Detail Body */}
        <div className="flex flex-1 min-h-0">
          {/* Left List (Master) - 280px */}
          <div className="w-[280px] border-r border-[#E5E7EB] bg-[#F9FAFB] flex flex-col overflow-y-auto p-2 gap-1">
            {/* Verified items list */}
            {verifiedItems.map(({ item, originalIndex }) => {
              const isSelected = activeIdx === originalIndex;
              const { chipState } = getQuoteState(
                item.status,
                item.reason,
                item.matches,
                item.docName,
                item.docIndex,
                item.withGaps,
                item.repaired
              );

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveIdx(originalIndex);
                    onSelectIndex?.(originalIndex);
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-[8px] text-left text-[13px] transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-[#EFF6FF] border border-[#BFDBFE] text-[#1D4ED8]"
                      : "hover:bg-white text-[#374151] border border-transparent"
                  }`}
                >
                  <NumberChip number={item.quoteIndex + 1} state={chipState} />
                  <span className="font-medium truncate flex-1">{item.docName || "Document"}</span>
                </button>
              );
            })}

            {/* Collapsible Unverified Group */}
            {unverifiedItems.length > 0 && (
              <div className="mt-2 pt-2 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setShowUnverified(!showUnverified)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 text-[12px] font-medium text-[#B45309] hover:bg-[#FEF3C7]/40 rounded-[6px] cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    {showUnverified ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    Not verified ({unverifiedItems.length})
                  </span>
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                </button>

                {showUnverified && (
                  <div className="mt-1 flex flex-col gap-1 pl-2">
                    {unverifiedItems.map(({ item, originalIndex }) => {
                      const isSelected = activeIdx === originalIndex;
                      const { chipState } = getQuoteState(
                        item.status,
                        item.reason,
                        item.matches,
                        item.docName,
                        item.docIndex,
                        item.withGaps,
                        item.repaired
                      );

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setActiveIdx(originalIndex);
                            onSelectIndex?.(originalIndex);
                          }}
                          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-[8px] text-left text-[13px] transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-[#FEF3C7] border border-[#FCD34D] text-[#B45309]"
                              : "hover:bg-white text-[#6B7280] border border-transparent"
                          }`}
                        >
                          <NumberChip number={item.quoteIndex + 1} state={chipState} />
                          <span className="font-medium truncate flex-1">
                            {item.docName || "Document"}
                          </span>
                          <AlertTriangle className="w-3.5 h-3.5 text-[#B45309] shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Pane (Detail) */}
          <div className="flex-1 flex flex-col min-w-0 bg-white overflow-y-auto p-5">
            {/* Document Header */}
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-[#E5E7EB]">
              <div className="flex items-center gap-2 min-w-0">
                <DocBadge filename={docTitle} />
                <h3 className="text-[15px] font-semibold text-[#111827] truncate" title={docTitle}>
                  {docTitle}
                </h3>
              </div>

              {isClickable && (
                <button
                  type="button"
                  onClick={() => handleOpenDoc(currentItem)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-white hover:bg-[#F9FAFB] text-[13px] font-medium text-[#111827] border border-[#D1D5DB] transition-colors cursor-pointer shadow-xs focus:ring-2 focus:ring-[#2563EB]"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Open document</span>
                </button>
              )}
            </div>

            {/* Evidence Card */}
            <div className="flex-1">
              <EvidenceCard
                quoteText={currentItem.quoteText}
                claimSentence={currentItem.claimSentence}
                status={currentItem.status}
                reason={currentItem.reason}
                matches={currentItem.matches}
                withGaps={currentItem.withGaps}
                repaired={currentItem.repaired}
                docName={currentItem.docName}
                docIndex={currentItem.docIndex}
                onOpenDocument={isClickable ? () => handleOpenDoc(currentItem) : undefined}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
