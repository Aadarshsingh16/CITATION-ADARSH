"use client";

import React, { useState, useRef, useEffect } from "react";
import { QuoteHoverCard } from "../quotes/QuoteHoverCard";
import type { Match, VerifyReason } from "@/lib/quotes";

export type QuoteVerificationStatus = "verified" | "repaired" | "pending" | "unverified" | "dropped";

export interface QuoteFlagProps {
  quoteId: string;
  quoteIndex: number;
  quoteText: string;
  status?: QuoteVerificationStatus | string;
  reason?: VerifyReason | string | null;
  matches?: Match[];
  docName?: string;
  docIndex?: number;
  hasGaps?: boolean;
  onOpenDocument?: () => void;
  onViewAllSources?: () => void;
}

export function QuoteFlag({
  quoteId,
  quoteIndex,
  quoteText,
  status = "verified",
  reason,
  matches,
  docName = "Contract",
  docIndex = 0,
  hasGaps = false,
  onOpenDocument,
  onViewAllSources,
}: QuoteFlagProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsOpen(true);
    }, 200); // 200ms debounce per DESIGN.md
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsOpen(false);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const num = quoteIndex + 1;
  const isVerified = status === "verified";
  const isRepaired = status === "repaired";
  const isPending = status === "pending";
  const isUnverified = !isVerified && !isRepaired && !isPending;

  // Sign-here ribbon notch: clip-path with notched right edge
  const flagClipPath = "polygon(0% 0%, 100% 0%, 88% 50%, 100% 100%, 0% 100%)";

  return (
    <span
      className="relative inline-block align-baseline mx-0.5 select-none"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        onClick={onOpenDocument}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        className={`inline-flex items-center justify-center h-[22px] pl-1.5 pr-2.5 text-[11.5px] font-semibold tabular-nums cursor-pointer transition-all hover:scale-105 active:scale-95 ${
          isVerified
            ? "bg-[#DDF3EA] text-[#0B7A5F] border border-[#0B7A5F]/30"
            : isRepaired
            ? "bg-[#E8E6FB] text-[#4B3FD6] border border-[#4B3FD6]/30"
            : isPending
            ? "bg-[#ECEBF5] text-[#6E6B87] animate-pulse border border-[#CFCCE0]"
            : "bg-[#FCE9D2] text-[#A8480A] border border-dashed border-[#A8480A]"
        }`}
        style={{
          clipPath: flagClipPath,
          borderRadius: "4px 0 0 4px",
        }}
        title={`Quote [${num}]: ${status}`}
        aria-label={`Citation ${num}, ${status}`}
      >
        <span>{num}</span>
        {hasGaps && <span className="text-[9px] ml-0.5">…</span>}
      </button>

      {/* Floating HoverCard after 200ms debounce */}
      {isOpen && (
        <div
          className="absolute left-0 bottom-full mb-2 z-50 pointer-events-auto"
          onMouseEnter={() => {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            setIsOpen(true);
          }}
          onMouseLeave={() => setIsOpen(false)}
        >
          <QuoteHoverCard
            quoteText={quoteText}
            status={status as any}
            reason={reason}
            matches={matches}
            withGaps={hasGaps}
            repaired={isRepaired}
            docName={docName}
            docIndex={docIndex}
            onOpenDocument={() => {
              setIsOpen(false);
              onOpenDocument?.();
            }}
            onViewAllSources={() => {
              setIsOpen(false);
              onViewAllSources?.();
            }}
          />
        </div>
      )}
    </span>
  );
}

