"use client";

import React from "react";
import type { Coverage } from "@/lib/types";

export interface CoverageBannerProps {
  coverage: Coverage;
}

export function CoverageBanner({ coverage }: CoverageBannerProps) {
  if (coverage.complete) {
    return null;
  }

  const { chunksRead, chunksTotal, unreadablePages } = coverage;

  return (
    <div className="my-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-300/80 text-amber-950 dark:text-amber-200 text-xs flex items-start gap-2.5 shadow-2xs">
      <svg
        className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>

      <div className="space-y-1">
        <p className="font-semibold text-amber-900 dark:text-amber-100">
          Partial Document Coverage Notice
        </p>
        <p className="leading-relaxed">
          Read {chunksRead} of {chunksTotal} sections. Statements that a term or clause is absent
          only apply to the sections searched, not the entire agreement.
        </p>

        {unreadablePages && unreadablePages.length > 0 && (
          <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
            Note: Pages {unreadablePages.join(", ")} contained no readable text layer during ingestion.
          </p>
        )}
      </div>
    </div>
  );
}
