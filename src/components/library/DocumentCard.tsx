"use client";

import React, { useState } from "react";
import type { DocumentRecord } from "@/lib/types";
import { StatusChip } from "./StatusChip";

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

  const isProcessing = doc.status === "uploading" || doc.status === "extracting" || doc.status === "indexing";

  return (
    <div
      onClick={() => onOpen(doc.id)}
      className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${
        isActive
          ? "border-indigo-600 bg-indigo-50/40 shadow-xs ring-1 ring-indigo-500/20"
          : "border-stone-200 bg-white hover:border-stone-300 hover:shadow-xs"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect(doc.id, e.target.checked);
          }}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 h-4 w-4 rounded-sm border-stone-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          title="Select for multi-document question or comparison"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1.5 mb-1">
            <h4
              className="text-xs font-semibold text-stone-900 truncate tracking-tight"
              title={doc.filename}
            >
              {doc.filename}
            </h4>

            <div className="flex items-center gap-1">
              <StatusChip status={doc.status} detail={doc.statusDetail} />

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConfirmDelete(true);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-red-600 rounded-sm hover:bg-stone-100 transition-all"
                title="Delete document"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Metadata row */}
          <div className="flex items-center gap-2 text-[11px] text-stone-500">
            <span>{formatBytes(doc.sizeBytes)}</span>
            {doc.pageCount && (
              <>
                <span>•</span>
                <span>{doc.pageCount} {doc.mime.includes("pdf") ? "pages" : "sections"}</span>
              </>
            )}
            {doc.isDuplicate && (
              <>
                <span>•</span>
                <span className="text-amber-700 bg-amber-50 px-1 rounded-sm border border-amber-200/60" title="Duplicate copy of existing file">
                  Duplicate
                </span>
              </>
            )}
          </div>

          {/* Progress or status detail */}
          {doc.statusDetail && isProcessing && (
            <div className="mt-2 text-[11px] text-indigo-700 font-medium">
              <div className="flex items-center justify-between mb-1">
                <span className="truncate">{doc.statusDetail}</span>
              </div>
              <div className="h-1 w-full bg-indigo-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 rounded-full animate-pulse w-3/4" />
              </div>
            </div>
          )}

          {/* Failure & Retry button (D-040) */}
          {doc.status === "failed" && (
            <div className="mt-2 p-1.5 bg-red-50/70 border border-red-200/60 rounded-md flex items-center justify-between gap-1.5">
              <span className="text-[11px] text-red-800 truncate" title={doc.statusDetail || "Failed"}>
                {doc.statusDetail || "Interrupted"}
              </span>
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="shrink-0 text-[10px] font-semibold text-red-700 bg-white hover:bg-red-50 border border-red-300 px-2 py-0.5 rounded-sm transition-colors"
              >
                {isRetrying ? "Retrying..." : "Retry"}
              </button>
            </div>
          )}

          {/* Unreadable pages warning */}
          {doc.unreadablePages && doc.unreadablePages.length > 0 && (
            <p className="mt-1.5 text-[10px] text-amber-700 bg-amber-50/60 p-1 rounded-sm border border-amber-200/60">
              Unreadable pages: {doc.unreadablePages.join(", ")}
            </p>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showConfirmDelete && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 bg-white/95 backdrop-blur-xs rounded-xl p-3 flex flex-col justify-center items-center text-center z-10 border border-red-200"
        >
          <p className="text-xs font-semibold text-stone-900 mb-2">
            Delete "{doc.filename}"?
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfirmDelete(false)}
              className="text-[11px] px-2.5 py-1 text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-[11px] px-2.5 py-1 text-white bg-red-600 hover:bg-red-700 rounded-md font-medium transition-colors"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
