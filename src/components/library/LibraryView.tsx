"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import type { DocumentRecord, DismissibleError } from "@/lib/types";
import { FileGlyph } from "../ui/FileGlyph";
import { StatusDot } from "../ui/StatusDot";
import { FloatingBar } from "../ui/FloatingBar";
import {
  UploadCloud,
  Search,
  Sparkles,
  Trash2,
  AlertTriangle,
  X,
  MessageSquare,
  FilePlus,
  Loader2,
  Eye,
} from "lucide-react";

interface LibraryViewProps {
  documents: DocumentRecord[];
  onUploadSuccess: (doc: DocumentRecord) => void;
  onDeleteDocument: (id: string) => Promise<void>;
  onRetryDocument: (id: string) => Promise<void>;
  onSeedSamples: () => Promise<void>;
  onAskDocument: (docIds: string[]) => void;
  onCompareDocuments: (docAId: string, docBId: string) => void;
  onPreviewDocument?: (docId: string) => void;
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

export function LibraryView({
  documents,
  onUploadSuccess,
  onDeleteDocument,
  onRetryDocument,
  onSeedSamples,
  onAskDocument,
  onCompareDocuments,
  onPreviewDocument,
}: LibraryViewProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "pdf" | "docx">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "ready" | "processing" | "failed">("all");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [errors, setErrors] = useState<DismissibleError[]>([]);
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);
  const [deleteConfirmDoc, setDeleteConfirmDoc] = useState<DocumentRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setIsUploading(true);
    setDuplicateNotice(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors((prev) => [
          {
            id: Math.random().toString(36).substring(2, 9),
            filename: file.name,
            reason: data.error?.reason || "wrong_extension",
            message: data.error?.message || "File upload failed.",
            nextStep: data.error?.nextStep || "Check the file format and try again.",
            timestamp: Date.now(),
          },
          ...prev,
        ]);
      } else if (data.document) {
        if (data.document.isDuplicate) {
          setDuplicateNotice(`You already have "${file.name}". Both versions are stored.`);
        }
        onUploadSuccess(data.document);
      }
    } catch {
      setErrors((prev) => [
        {
          id: Math.random().toString(36).substring(2, 9),
          filename: file.name,
          reason: "corrupt",
          message: "Network or server connection failed during upload.",
          nextStep: "Check server connection and retry.",
          timestamp: Date.now(),
        },
        ...prev,
      ]);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Drag overlay handling
  useEffect(() => {
    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(true);
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) {
        setIsDragOver(false);
      }
    };

    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer?.files) {
        void handleFiles(e.dataTransfer.files);
      }
    };

    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("dragleave", handleWindowDragLeave);
    window.addEventListener("drop", handleWindowDrop);

    return () => {
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("dragleave", handleWindowDragLeave);
      window.removeEventListener("drop", handleWindowDrop);
    };
  }, []);

  const handleSelectRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((item) => item !== id)
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? filteredDocs.map((d) => d.id) : []);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    setIsDeleting(true);
    try {
      for (const id of selectedIds) {
        await onDeleteDocument(id);
      }
      setSelectedIds([]);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmSingleDelete = async () => {
    if (!deleteConfirmDoc) return;
    setIsDeleting(true);
    try {
      await onDeleteDocument(deleteConfirmDoc.id);
      setSelectedIds((prev) => prev.filter((id) => id !== deleteConfirmDoc.id));
      setDeleteConfirmDoc(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered documents
  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      if (typeFilter === "pdf" && !doc.filename.toLowerCase().endsWith(".pdf")) return false;
      if (typeFilter === "docx" && !doc.filename.toLowerCase().endsWith(".docx")) return false;

      if (statusFilter === "ready" && doc.status !== "ready") return false;
      if (
        statusFilter === "processing" &&
        doc.status !== "uploading" &&
        doc.status !== "extracting" &&
        doc.status !== "indexing"
      )
        return false;
      if (statusFilter === "failed" && doc.status !== "failed" && doc.status !== "rejected")
        return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        return doc.filename.toLowerCase().includes(q);
      }
      return true;
    });
  }, [documents, typeFilter, statusFilter, search]);

  const allSelected =
    filteredDocs.length > 0 && selectedIds.length === filteredDocs.length;

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-6xl w-full mx-auto font-sans relative">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {/* Full-width drag overlay */}
      {isDragOver && (
        <div className="fixed inset-0 z-50 bg-[#17142B]/75 backdrop-blur-xs flex items-center justify-center p-8 select-none">
          <div className="border-2 border-dashed border-[#FFD84D] bg-[#17142B] rounded-[24px] p-12 text-center max-w-lg w-full text-white shadow-2xl">
            <UploadCloud className="w-12 h-12 text-[#FFD84D] mx-auto mb-4 animate-bounce" />
            <h3 className="text-[20px] font-semibold mb-2">Drop contract to upload</h3>
            <p className="text-[14px] text-[#CFCCE0]">
              Supports PDF and Word (DOCX) files up to 25MB and 400 pages
            </p>
          </div>
        </div>
      )}

      {/* Section 6.5: First Run Empty State */}
      {documents.length === 0 ? (
        <div className="py-16 max-w-2xl mx-auto">
          <h1 className="text-[38px] font-semibold text-[#17142B] tracking-tight leading-tight mb-4">
            Ask a question. See the clause it came from.
          </h1>
          <p className="text-[17px] text-[#5A5775] leading-relaxed mb-8">
            We read your contract and check every quote against the page before we show it as verified.
          </p>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#CFCCE0] hover:border-[#17142B] bg-white rounded-[18px] p-10 text-center cursor-pointer transition-all hover:shadow-xs group mb-6"
          >
            <div className="w-12 h-12 rounded-full bg-[#F1F0F8] text-[#17142B] group-hover:scale-105 flex items-center justify-center mx-auto mb-3 transition-transform">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div className="flex items-center justify-center gap-3 mb-2">
              <button
                type="button"
                className="px-5 py-2 rounded-[10px] bg-[#17142B] text-white text-[14px] font-medium hover:bg-[#3B3855] transition-colors cursor-pointer"
              >
                Upload contract
              </button>
              <span className="text-[14px] text-[#6E6B87]">or</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSeeding(true);
                  void onSeedSamples().finally(() => setIsSeeding(false));
                }}
                disabled={isSeeding}
                className="px-4 py-2 rounded-[10px] bg-white border border-[#E3E1EF] text-[#3B3855] hover:text-[#17142B] hover:bg-[#F7F7FC] text-[14px] font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {isSeeding ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#0B7A5F]" />
                ) : (
                  <Sparkles className="w-4 h-4 text-[#0B7A5F]" />
                )}
                <span>Try sample contracts</span>
              </button>
            </div>
            <p className="text-[12.5px] text-[#6E6B87] mt-3">
              Drop a PDF or Word file anywhere on this page. Up to 25 MB and 400 pages.
            </p>
          </div>
        </div>
      ) : (
        /* Section 6.1: Populated Library Table */
        <div className="space-y-6">
          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E3E1EF]">
            <div>
              <h1 className="text-[26px] font-semibold text-[#17142B] tracking-tight">
                Library
              </h1>
              <p className="text-[13px] text-[#6E6B87] mt-0.5">
                {documents.length} {documents.length === 1 ? "document" : "documents"} stored
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#6E6B87]" />
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-[10px] bg-white border border-[#E3E1EF] text-[13px] text-[#17142B] focus:outline-none focus:ring-2 focus:ring-[#4B3FD6] w-48 shadow-2xs"
                />
              </div>

              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-[10px] bg-white border border-[#E3E1EF] text-[12.5px] text-[#3B3855] focus:outline-none focus:ring-2 focus:ring-[#4B3FD6] shadow-2xs"
              >
                <option value="all">All Types</option>
                <option value="pdf">PDF only</option>
                <option value="docx">Word (DOCX)</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-[10px] bg-white border border-[#E3E1EF] text-[12.5px] text-[#3B3855] focus:outline-none focus:ring-2 focus:ring-[#4B3FD6] shadow-2xs"
              >
                <option value="all">All Statuses</option>
                <option value="ready">Ready</option>
                <option value="processing">Processing</option>
                <option value="failed">Failed / Unreadable</option>
              </select>

              {/* Upload Contract */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[10px] bg-[#17142B] hover:bg-[#3B3855] text-white text-[13px] font-medium transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isUploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FilePlus className="w-3.5 h-3.5 text-white" />
                )}
                <span>Upload contract</span>
              </button>
            </div>
          </div>

          {/* Dismissible upload errors banner (Section 6.1) */}
          {errors.length > 0 && (
            <div className="space-y-2">
              {errors.map((err) => (
                <div
                  key={err.id}
                  className="p-3.5 rounded-[12px] bg-[#FCE9D2] border border-[#A8480A]/20 text-[#A8480A] flex items-center justify-between text-[13px]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <div>
                      <span className="font-semibold">{err.filename}:</span> {err.message}{" "}
                      <span className="text-[#3B3855] italic ml-1">({err.nextStep})</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setErrors((prev) => prev.filter((e) => e.id !== err.id))}
                    className="p-1 rounded-[6px] hover:bg-[#A8480A]/10 text-[#A8480A] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Duplicate soft notice (D-046) */}
          {duplicateNotice && (
            <div className="p-3 rounded-[10px] bg-[#E1ECF9] border border-[#2A5C9A]/20 text-[#2A5C9A] text-[12.5px] flex items-center justify-between">
              <span>{duplicateNotice}</span>
              <button
                type="button"
                onClick={() => setDuplicateNotice(null)}
                className="text-xs hover:underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Table Container */}
          <div className="bg-white rounded-[18px] border border-[#E3E1EF] shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F7F7FC] border-b border-[#E3E1EF] text-[12px] font-semibold text-[#6E6B87] select-none">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded-[4px] border-[#CFCCE0] text-[#4B3FD6] focus:ring-[#4B3FD6] cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4 w-32">Added</th>
                  <th className="py-3 px-4 w-28">Size</th>
                  <th className="py-3 px-4 w-48">Status</th>
                  <th className="py-3 px-4 w-24 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E1EF] text-[13.5px]">
                {filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#6E6B87] text-[13px]">
                      No documents match your filter.
                    </td>
                  </tr>
                ) : (
                  filteredDocs.map((doc) => {
                    const isSelected = selectedIds.includes(doc.id);
                    return (
                      <tr
                        key={doc.id}
                        className={`h-14 transition-colors group ${
                          isSelected ? "bg-[#E8E6FB]/40" : "hover:bg-[#F7F7FC]"
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleSelectRow(doc.id, e.target.checked)}
                            className="rounded-[4px] border-[#CFCCE0] text-[#4B3FD6] focus:ring-[#4B3FD6] cursor-pointer"
                          />
                        </td>

                        {/* Name + Pages */}
                        <td className="py-3 px-4 min-w-[260px]">
                          <div className="flex items-center gap-2.5">
                            <FileGlyph filename={doc.filename} mime={doc.mime} />
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => onPreviewDocument ? onPreviewDocument(doc.id) : onAskDocument([doc.id])}
                                className="font-semibold text-[#17142B] hover:text-[#0B7A5F] hover:underline truncate block text-left text-[13.5px] cursor-pointer"
                                title={`Click to preview ${doc.filename}`}
                              >
                                {doc.filename}
                              </button>
                              {doc.pageCount && (
                                <span className="text-[11.5px] text-[#6E6B87] block">
                                  {doc.pageCount} {doc.pageCount === 1 ? "page" : "pages"}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Added */}
                        <td className="py-3 px-4 text-[12.5px] text-[#5A5775] tabular-nums">
                          {formatDate(doc.createdAt)}
                        </td>

                        {/* Size */}
                        <td className="py-3 px-4 text-[12.5px] text-[#5A5775] tabular-nums">
                          {formatBytes(doc.sizeBytes)}
                        </td>

                        {/* Status with dot */}
                        <td className="py-3 px-4">
                          <StatusDot
                            status={doc.status}
                            statusDetail={doc.statusDetail}
                            rejectReason={doc.rejectReason}
                            onRetry={() => void onRetryDocument(doc.id)}
                          />
                        </td>

                        {/* Row Hover Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => onPreviewDocument ? onPreviewDocument(doc.id) : onAskDocument([doc.id])}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] bg-white border border-[#E3E1EF] hover:border-[#0B7A5F] text-[12px] font-medium text-[#0B7A5F] hover:bg-[#DDF3EA]/30 transition-colors cursor-pointer shadow-2xs"
                              title="Preview document in reading desk"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#0B7A5F]" />
                              <span>Preview</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onAskDocument([doc.id])}
                              className="px-2.5 py-1 rounded-[6px] bg-white border border-[#E3E1EF] hover:border-[#17142B] text-[12px] font-medium text-[#17142B] transition-colors cursor-pointer shadow-2xs"
                              title="Ask questions about this document"
                            >
                              Ask
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeleteConfirmDoc(doc)}
                              className="p-1 rounded-[6px] text-[#6E6B87] hover:text-[#B42318] hover:bg-[#FEE4E2] transition-colors cursor-pointer"
                              title="Delete contract"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Floating Bar for Multi-select */}
      <FloatingBar
        selectedCount={selectedIds.length}
        onAsk={() => onAskDocument(selectedIds)}
        onCompare={() => {
          if (selectedIds.length === 2) {
            onCompareDocuments(selectedIds[0], selectedIds[1]);
          }
        }}
        onPreview={
          selectedIds.length === 1 && onPreviewDocument
            ? () => onPreviewDocument(selectedIds[0])
            : undefined
        }
        onDelete={() => void handleDeleteSelected()}
        onClear={() => setSelectedIds([])}
        isDeleting={isDeleting}
      />

      {/* Delete Confirmation Dialog */}
      {deleteConfirmDoc && (
        <div className="fixed inset-0 z-50 bg-[#17142B]/40 backdrop-blur-xs flex items-center justify-center p-4 select-none">
          <div className="bg-white rounded-[18px] border border-[#E3E1EF] shadow-[0_10px_28px_-6px_rgba(23,20,43,0.16)] max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-semibold text-[15px] text-[#17142B]">
              Delete "{deleteConfirmDoc.filename}"?
            </h3>
            <p className="text-[13px] text-[#5A5775] leading-relaxed">
              This contract and all associated citations and chats will be permanently removed. This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmDoc(null)}
                className="px-3 py-1.5 rounded-[10px] text-[13px] font-medium text-[#5A5775] hover:bg-[#F1F0F8] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSingleDelete}
                disabled={isDeleting}
                className="px-4 py-1.5 rounded-[10px] bg-[#B42318] hover:bg-[#991B1B] text-white text-[13px] font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
