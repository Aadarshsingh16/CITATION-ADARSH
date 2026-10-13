"use client";

import React, { useState } from "react";
import type { DocumentRecord } from "@/lib/types";
import { DocBadge } from "../ui/DocBadge";
import { StatusChip } from "./StatusChip";
import { Trash2, RotateCcw, AlertTriangle } from "lucide-react";

interface DocumentCardProps {
  document: DocumentRecord;
  isSelected: boolean;
  isActive: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onRetry: (id: string) => Promise<void>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr?: string | Date | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  document: doc,
  isSelected,
  isActive,
  onSelect,
  onOpen,
  onDelete,
  onRetry,
}) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
    try {
      await onDelete(doc.id);
    } finally {
      setIsDeleting(false);
      setShowConfirmDelete(false);
    }
  };

  const handleRetry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRetrying(true);
    try {
      await onRetry(doc.id);
    } finally {
      setIsRetrying(false);
    }
  };

  const isProcessing =
    doc.status === "uploading" || doc.status === "extracting" || doc.status === "indexing";

  // Build meta line: "128 pages · 2.1 MB · 13 Oct"
  const metaParts: string[] = [];
  if (doc.pageCount) {
    metaParts.push(`${doc.pageCount} ${doc.pageCount === 1 ? "page" : "pages"}`);
  }
  metaParts.push(formatBytes(doc.sizeBytes));
  if (doc.createdAt) {
    metaParts.push(formatDate(doc.createdAt));
  }
  const metaLine = metaParts.join(" · ");

  return (
    <div
      onClick={() => onOpen(doc.id)}
      className={`group relative p-3 rounded-[12px] border transition-all cursor-pointer font-sans ${
        isActive
          ? "border-[#2563EB] bg-[#EFF6FF] shadow-xs ring-1 ring-[#2563EB]/20"
          : isSelected
          ? "border-[#BFDBFE] bg-[#F6F8FF]"
          : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB] hover:shadow-xs"
      }`}
    >
      <div className="flex items-start gap-2.5">
        {/* Selection Checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect(doc.id, e.target.checked);
          }}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 rounded-[4px] border-[#D1D5DB] text-[#2563EB] focus:ring-[#2563EB] cursor-pointer"
          aria-label={`Select ${doc.filename}`}
        />

        <div className="flex-1 min-w-0">
          {/* Header Row: Badge & Filename */}
          <div className="flex items-center gap-1.5 mb-1">
            <DocBadge filename={doc.filename} mime={doc.mime} />
            <h4
              className="text-[13px] font-semibold text-[#111827] truncate leading-snug flex-1"
              title={doc.filename}
            >
              {doc.filename}
            </h4>
          </div>

          {/* Meta line */}
          <div className="text-[11.5px] text-[#6B7280] mb-2 truncate">
            {metaLine}
          </div>

          {/* Duplicate soft alert notice (D-046) */}
          {doc.isDuplicate && (
            <div className="mb-2 px-2 py-0.5 rounded-[4px] bg-[#FEF3C7] text-[#B45309] text-[10.5px] font-medium flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>Duplicate content detected</span>
            </div>
          )}

          {/* Status or Progress Row */}
          {isProcessing ? (
            <div className="space-y-1.5 mt-2">
              <div className="flex items-center justify-between text-[11px] text-[#2563EB] font-medium">
                <span className="truncate">{doc.statusDetail || "Processing..."}</span>
                <span className="capitalize text-[10px] bg-[#EFF6FF] px-1.5 py-0.5 rounded-[4px]">
                  {doc.status}
                </span>
              </div>
              {/* Determinate / Indeterminate progress line */}
              <div className="w-full bg-[#E5E7EB] rounded-full h-1.5 overflow-hidden">
                <div className="bg-[#2563EB] h-1.5 rounded-full animate-pulse w-3/4" />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between mt-1">
              <StatusChip status={doc.status} rejectReason={doc.rejectReason} />

              {/* Action icons */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {doc.status === "failed" || doc.status === "rejected" ? (
                  <button
                    type="button"
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className="p-1 text-[#2563EB] hover:bg-[#EFF6FF] rounded-[4px] transition-colors cursor-pointer"
                    title="Retry processing"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isRetrying ? "animate-spin" : ""}`} />
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowConfirmDelete(true);
                  }}
                  className="p-1 text-[#6B7280] hover:text-[#B91C1C] hover:bg-[#FEE2E2] rounded-[4px] transition-colors cursor-pointer"
                  title="Delete document"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showConfirmDelete && (
        <div
          className="mt-2.5 p-2.5 rounded-[8px] bg-[#FEE2E2] border border-[#FECACA] text-[12px] text-[#B91C1C]"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="font-semibold mb-1">Delete "{doc.filename}"?</p>
          <p className="text-[11px] text-[#991B1B] mb-2">This cannot be undone.</p>
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowConfirmDelete(false);
              }}
              className="px-2 py-0.5 rounded-[4px] bg-white text-[#4B5563] border border-[#D1D5DB] text-[11px] font-medium hover:bg-[#F9FAFB] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-2 py-0.5 rounded-[4px] bg-[#B91C1C] text-white text-[11px] font-semibold hover:bg-[#991B1B] cursor-pointer"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
