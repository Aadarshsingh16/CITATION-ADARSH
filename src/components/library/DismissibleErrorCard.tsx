"use client";

import React from "react";
import type { DismissibleError } from "@/lib/types";

interface DismissibleErrorCardProps {
  error: DismissibleError;
  onDismiss: (id: string) => void;
}

export const DismissibleErrorCard: React.FC<DismissibleErrorCardProps> = ({ error, onDismiss }) => {
  return (
    <div
      role="alert"
      className="p-3.5 mb-3 bg-red-50 border border-red-200 rounded-lg shadow-xs text-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <svg
            className="w-5 h-5 text-red-600 mt-0.5 shrink-0"
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
          <div>
            <div className="font-semibold text-red-900 truncate max-w-[200px]" title={error.filename}>
              {error.filename}
            </div>
            <p className="text-red-800 mt-0.5 leading-snug">{error.message}</p>
            {error.nextStep && (
              <p className="text-xs text-red-700 mt-1 font-medium bg-red-100/60 p-1.5 rounded-sm">
                Next step: {error.nextStep}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={() => onDismiss(error.id)}
          className="text-red-400 hover:text-red-700 p-1 rounded-sm hover:bg-red-100/80 transition-colors"
          title="Dismiss notice"
          aria-label="Dismiss notice"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};
