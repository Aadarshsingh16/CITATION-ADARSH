import React, { useState, useRef, useEffect } from "react";
import type { Match, VerifyReason } from "@/lib/quotes";
import { NumberChip } from "../ui/NumberChip";
import { QuoteHoverCard } from "./QuoteHoverCard";
import { getQuoteState } from "./useQuoteState";

interface QuotePillProps {
  quoteId: string;
  quoteIndex: number;
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
}

export const QuotePill: React.FC<QuotePillProps> = ({
  quoteIndex,
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
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const hoverTimer = useRef<NodeJS.Timeout | null>(null);
  const pillRef = useRef<HTMLDivElement>(null);

  const { chipState, isClickable } = getQuoteState(
    status,
    reason,
    matches,
    docName,
    docIndex,
    withGaps,
    repaired
  );

  const handleMouseEnter = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      setIsOpen(true);
    }, 200);
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      setIsOpen(false);
    }, 250);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleOpenDoc = () => {
    setIsOpen(false);
    if (!isClickable || !onOpenDocument) return;
    onOpenDocument();
  };

  return (
    <div
      ref={pillRef}
      className="relative inline-block ml-1 align-super select-none z-10"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <NumberChip
        number={quoteIndex + 1}
        state={chipState}
        onClick={handleOpenDoc}
      />

      {isOpen && (
        <div
          className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-50"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <QuoteHoverCard
            quoteText={quoteText}
            status={status}
            reason={reason}
            matches={matches}
            withGaps={withGaps}
            repaired={repaired}
            docName={docName}
            docIndex={docIndex}
            onOpenDocument={isClickable ? handleOpenDoc : undefined}
            onViewAllSources={onViewAllSources}
          />
        </div>
      )}
    </div>
  );
};
