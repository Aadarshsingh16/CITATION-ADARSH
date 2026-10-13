"use client";

import React from "react";
import { RotateCcw } from "lucide-react";

interface StatusDotProps {
  status: string;
  statusDetail?: string | null;
  rejectReason?: string | null;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function StatusDot({
  status,
  statusDetail,
  rejectReason,
  onRetry,
  isRetrying = false,
}: StatusDotProps) {
  if (status === "ready") {
    return (
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#0B7A5F] shrink-0" />
        <span className="text-[13px] font-medium text-[#0B7A5F]">Ready</span>
      </div>
    );
  }

  if (status === "uploading" || status === "extracting" || status === "indexing") {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#A8480A] animate-pulse shrink-0" />
          <span className="text-[13px] text-[#A8480A] font-medium truncate">
            {statusDetail || (status === "indexing" ? "Indexing clauses..." : "Reading document...")}
          </span>
        </div>
        <div className="w-32 bg-[#E3E1EF] rounded-full h-1 overflow-hidden">
          <div className="bg-[#A8480A] h-1 rounded-full animate-pulse w-2/3" />
        </div>
      </div>
    );
  }

  if (status === "failed" || status === "rejected") {
    return (
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#B42318] shrink-0" />
        <span className="text-[13px] text-[#B42318] font-medium truncate">
          {rejectReason || "Not readable"}
        </span>
        {onRetry && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRetry();
            }}
            disabled={isRetrying}
            className="p-1 text-[#4B3FD6] hover:bg-[#E8E6FB] rounded-[4px] transition-colors cursor-pointer"
            title="Retry ingestion"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isRetrying ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-[#6E6B87] shrink-0" />
      <span className="text-[13px] text-[#6E6B87] capitalize">{status}</span>
    </div>
  );
}
