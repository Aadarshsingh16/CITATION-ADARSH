"use client";

import React from "react";
import { MessageSquareText, ArrowRightLeft, Trash2, X, Eye } from "lucide-react";

interface FloatingBarProps {
  selectedCount: number;
  onAsk: () => void;
  onCompare: () => void;
  onPreview?: () => void;
  onDelete: () => void;
  onClear: () => void;
  isDeleting?: boolean;
}

export function FloatingBar({
  selectedCount,
  onAsk,
  onCompare,
  onPreview,
  onDelete,
  onClear,
  isDeleting = false,
}: FloatingBarProps) {
  if (selectedCount === 0) return null;

  const canCompare = selectedCount === 2;

  return (
    <aside
      aria-label="Selection actions bar"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#17142B] text-white rounded-[14px] px-4 py-2.5 shadow-[0_1px_2px_rgba(23,20,43,0.06),0_10px_28px_-6px_rgba(23,20,43,0.16)] flex items-center gap-4 select-none animate-in fade-in slide-in-from-bottom-3 duration-150 border border-[#3B3855]"
    >
      <div className="flex items-center gap-2 pr-2 border-r border-[#3B3855] text-[13px] font-medium">
        <span className="w-5 h-5 rounded-full bg-[#3B3855] text-white flex items-center justify-center text-[11px] font-semibold font-mono">
          {selectedCount}
        </span>
        <span>selected</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onAsk}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-white text-[#17142B] hover:bg-[#F1F0F8] text-[13px] font-semibold transition-colors cursor-pointer shadow-xs"
        >
          <MessageSquareText className="w-4 h-4 text-[#4B3FD6]" />
          <span>{selectedCount === 1 ? "Ask about document" : `Ask across ${selectedCount} docs`}</span>
        </button>

        {selectedCount === 1 && onPreview && (
          <button
            type="button"
            onClick={onPreview}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-[#262244] text-white hover:bg-[#3B3855] text-[13px] font-medium border border-[#3B3855] transition-colors cursor-pointer shadow-2xs"
            title="Read / inspect this document in reading desk"
          >
            <Eye className="w-4 h-4 text-[#0B7A5F]" />
            <span>Preview</span>
          </button>
        )}

        <button
          type="button"
          onClick={onCompare}
          disabled={!canCompare}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[13px] font-medium border transition-colors cursor-pointer ${
            canCompare
              ? "bg-[#262244] text-white border-[#3B3855] hover:bg-[#3B3855]"
              : "opacity-40 border-transparent text-[#6E6B87] cursor-not-allowed"
          }`}
          title={canCompare ? "Compare the 2 selected versions" : "Select exactly 2 documents to compare"}
        >
          <ArrowRightLeft className="w-4 h-4 text-[#FFD84D]" />
          <span>Compare</span>
        </button>

        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] text-[#FEE4E2] hover:bg-[#B42318]/20 hover:text-white text-[13px] font-medium transition-colors cursor-pointer"
          title="Delete selected documents"
        >
          <Trash2 className="w-4 h-4 text-[#FEE4E2]" />
          <span>Delete</span>
        </button>
      </div>

      <button
        type="button"
        onClick={onClear}
        className="p-1 rounded-[6px] text-[#6E6B87] hover:text-white hover:bg-[#3B3855] transition-colors ml-1 cursor-pointer"
        title="Deselect all"
        aria-label="Deselect all"
      >
        <X className="w-4 h-4" />
      </button>
    </aside>
  );
}
