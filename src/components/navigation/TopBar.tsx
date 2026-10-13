"use client";

import React, { useState } from "react";
import { Sparkles, HelpCircle, FileCheck, Layers, ArrowRightLeft } from "lucide-react";

export type NavMode = "library" | "ask" | "compare";

interface TopBarProps {
  activeMode: NavMode;
  onSelectMode: (mode: NavMode) => void;
  onOpenSamples: () => void;
  onOpenHelp: () => void;
  documentCount?: number;
}

export function TopBar({
  activeMode,
  onSelectMode,
  onOpenSamples,
  onOpenHelp,
  documentCount = 0,
}: TopBarProps) {
  return (
    <header className="h-14 bg-white border-b border-[#E3E1EF] px-6 flex items-center justify-between shrink-0 select-none z-30">
      {/* 1. Brand Mark */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-[6px] bg-[#17142B] text-white flex items-center justify-center font-bold text-[13px] tracking-tight shadow-xs">
          CA
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-[16px] text-[#17142B] tracking-tight">
            Contract Analyser
          </span>
          {documentCount > 0 && (
            <span className="text-[12px] text-[#6E6B87] font-normal">
              {documentCount} {documentCount === 1 ? "document" : "documents"}
            </span>
          )}
        </div>
      </div>

      {/* 2. Center Sliding Underline Navigation (Section 5) */}
      <nav className="flex items-center gap-8 h-full" aria-label="Main Navigation">
        <button
          type="button"
          onClick={() => onSelectMode("library")}
          className={`h-full flex items-center gap-2 px-1 text-[14px] font-medium transition-colors relative cursor-pointer ${
            activeMode === "library"
              ? "text-[#17142B] font-semibold"
              : "text-[#6E6B87] hover:text-[#17142B]"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Library</span>
          {activeMode === "library" && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#17142B] rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelectMode("ask")}
          className={`h-full flex items-center gap-2 px-1 text-[14px] font-medium transition-colors relative cursor-pointer ${
            activeMode === "ask"
              ? "text-[#17142B] font-semibold"
              : "text-[#6E6B87] hover:text-[#17142B]"
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Ask</span>
          {activeMode === "ask" && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#17142B] rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelectMode("compare")}
          className={`h-full flex items-center gap-2 px-1 text-[14px] font-medium transition-colors relative cursor-pointer ${
            activeMode === "compare"
              ? "text-[#17142B] font-semibold"
              : "text-[#6E6B87] hover:text-[#17142B]"
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" />
          <span>Compare</span>
          {activeMode === "compare" && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#17142B] rounded-full" />
          )}
        </button>
      </nav>

      {/* 3. Right Utility Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenSamples}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[13px] font-medium text-[#3B3855] hover:text-[#17142B] hover:bg-[#F7F7FC] border border-[#E3E1EF] transition-colors cursor-pointer"
          title="Try with sample contracts"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#0B7A5F]" />
          <span>Samples</span>
        </button>

        <button
          type="button"
          onClick={onOpenHelp}
          className="p-1.5 rounded-[10px] text-[#6E6B87] hover:text-[#17142B] hover:bg-[#F7F7FC] border border-transparent hover:border-[#E3E1EF] transition-colors cursor-pointer"
          title="Help & verification guide"
          aria-label="Help"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
