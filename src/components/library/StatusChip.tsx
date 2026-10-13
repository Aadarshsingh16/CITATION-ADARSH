"use client";

import React from "react";
import type { DocumentStatus, RejectionReason } from "@/lib/types";
import { Check, AlertTriangle, XCircle, Loader2 } from "lucide-react";

interface StatusChipProps {
  status: DocumentStatus;
  rejectReason?: RejectionReason | string | null;
  detail?: string | null;
}

export const StatusChip: React.FC<StatusChipProps> = ({ status, detail }) => {
  switch (status) {
    case "ready":
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[11px] font-semibold text-[#15803D] bg-[#DCFCE7] border border-[#86EFAC]"
          title="Document extracted, chunked, and ready for queries"
        >
          <Check className="w-3 h-3 text-[#15803D]" />
          <span>Ready</span>
        </span>
      );

    case "extracting":
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] text-[11px] font-medium text-[#2563EB] bg-[#EFF6FF] border border-[#BFDBFE] animate-pulse"
          title={detail || "Extracting text layer and page offsets"}
        >
          <Loader2 className="w-3 h-3 animate-spin text-[#2563EB]" />
          <span>Extracting</span>
        </span>
      );

    case "indexing":
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] text-[11px] font-medium text-[#2563EB] bg-[#EFF6FF] border border-[#BFDBFE] animate-pulse"
          title={detail || "Building clause chunks and BM25 index"}
        >
          <Loader2 className="w-3 h-3 animate-spin text-[#2563EB]" />
          <span>Indexing</span>
        </span>
      );

    case "uploading":
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] text-[11px] font-medium text-[#4B5563] bg-[#E5E7EB] border border-[#D1D5DB]"
          title="Saving file to database"
        >
          <Loader2 className="w-3 h-3 animate-spin text-[#6B7280]" />
          <span>Uploading</span>
        </span>
      );

    case "rejected":
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[11px] font-semibold text-[#B45309] bg-[#FEF3C7] border border-dashed border-[#FCD34D]"
          title={detail || "Rejected by quality gate"}
        >
          <AlertTriangle className="w-3 h-3 text-[#B45309]" />
          <span>Rejected</span>
        </span>
      );

    case "failed":
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[11px] font-semibold text-[#B91C1C] bg-[#FEE2E2] border border-[#FECACA]"
          title={detail || "Extraction failed"}
        >
          <XCircle className="w-3 h-3 text-[#B91C1C]" />
          <span>Failed</span>
        </span>
      );

    default:
      return null;
  }
};
