"use client";

import React from "react";
import type { Coverage } from "@/lib/types";
import { StatusBar } from "../ui/StatusBar";

export interface CoverageBannerProps {
  coverage: Coverage;
}

export function CoverageBanner({ coverage }: CoverageBannerProps) {
  if (coverage.complete) {
    return null;
  }

  const { chunksRead, chunksTotal, unreadablePages } = coverage;

  return (
    <div className="my-3 rounded-[8px] border border-[#BFDBFE] overflow-hidden bg-[#EFF6FF] text-[13px] text-[#1E3A8A] font-sans">
      <StatusBar
        state="info"
        customExplanation={`Read ${chunksRead} of ${chunksTotal} sections`}
      />
      <div className="p-3 text-[12.5px] leading-relaxed text-[#1D4ED8]">
        <p>
          Statements that something is missing only apply to the parts read.
        </p>

        {coverage.perDoc && Object.keys(coverage.perDoc).length > 1 && (
          <div className="mt-2 pt-2 border-t border-[#DBEAFE] flex flex-wrap gap-2 text-[11.5px]">
            {Object.entries(coverage.perDoc).map(([docKey, stats]) => (
              <span
                key={docKey}
                className="bg-white/80 px-2 py-0.5 rounded-[4px] border border-[#BFDBFE] font-medium"
              >
                {docKey}: {stats.chunksRead}/{stats.chunksTotal} sections
              </span>
            ))}
          </div>
        )}

        {unreadablePages && unreadablePages.length > 0 && (
          <p className="mt-1 text-[11.5px] text-[#6B7280]">
            Note: Pages {unreadablePages.join(", ")} contained no readable text layer during ingestion.
          </p>
        )}
      </div>
    </div>
  );
}
