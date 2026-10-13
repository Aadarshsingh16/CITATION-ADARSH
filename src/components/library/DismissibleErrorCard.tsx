"use client";

import React from "react";
import type { DismissibleError } from "@/lib/types";
import { AlertTriangle, X } from "lucide-react";

interface DismissibleErrorCardProps {
  error: DismissibleError;
  onDismiss: (id: string) => void;
}

export const DismissibleErrorCard: React.FC<DismissibleErrorCardProps> = ({ error, onDismiss }) => {
  return (
    <div
      role="alert"
      className="p-3 mb-2.5 bg-[#FEF3C7]/60 border border-[#FCD34D] rounded-[10px] shadow-xs text-[12px] font-sans transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-[#B45309] mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="font-semibold text-[#92400E] truncate max-w-[190px]" title={error.filename}>
              {error.filename}
            </div>
            <p className="text-[#B45309] mt-0.5 leading-snug">{error.message}</p>
            {error.nextStep && (
              <p className="text-[11px] text-[#78350F] mt-1 font-medium bg-white/70 p-1.5 rounded-[6px] border border-[#FCD34D]/50">
                Next step: {error.nextStep}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onDismiss(error.id)}
          className="text-[#92400E] hover:text-[#78350F] p-1 rounded-[4px] hover:bg-white/60 transition-colors cursor-pointer shrink-0"
          title="Dismiss notice"
          aria-label="Dismiss notice"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
