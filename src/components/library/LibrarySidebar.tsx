"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { DocumentRecord, DismissibleError } from "@/lib/types";
import { Dropzone } from "./Dropzone";
import { DocumentCard } from "./DocumentCard";
import { DismissibleErrorCard } from "./DismissibleErrorCard";
import { Search, Files, Columns } from "lucide-react";

interface LibrarySidebarProps {
  selectedDocIds: string[];
  activeViewerDocId: string | null;
  onToggleSelect: (id: string, selected: boolean) => void;
  onOpenViewer: (id: string) => void;
  onCompare: (idA: string, idB: string) => void;
}

export const LibrarySidebar: React.FC<LibrarySidebarProps> = ({
  selectedDocIds,
  activeViewerDocId,
  onToggleSelect,
  onOpenViewer,
  onCompare,
}) => {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [errors, setErrors] = useState<DismissibleError[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Polling when any document is processing (D-030)
  useEffect(() => {
    const hasProcessing = documents.some(
      (d) => d.status === "uploading" || d.status === "extracting" || d.status === "indexing"
    );

    if (!hasProcessing) return;

    const interval = setInterval(() => {
      fetchDocuments();
    }, 1500);

    return () => clearInterval(interval);
  }, [documents, fetchDocuments]);

  const handleUploadSuccess = (newDoc: DocumentRecord) => {
    setDocuments((prev) => [newDoc, ...prev]);
    onOpenViewer(newDoc.id);
  };

  const handleUploadError = (err: DismissibleError) => {
    setErrors((prev) => [err, ...prev]);
  };

  const handleDismissError = (id: string) => {
    setErrors((prev) => prev.filter((e) => e.id !== id));
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  };

  const handleRetryDocument = async (id: string) => {
    try {
      const res = await fetch(`/api/documents/${id}/retry`, { method: "POST" });
      if (res.ok) {
        fetchDocuments();
      }
    } catch (err) {
      console.error("Failed to retry document:", err);
    }
  };

  const handleSeedSamples = async () => {
    setIsSeeding(true);
    try {
      const res = await fetch("/api/documents/seed-samples", { method: "POST" });
      if (res.ok) {
        await fetchDocuments();
      }
    } catch (err) {
      console.error("Failed to seed sample contracts:", err);
    } finally {
      setIsSeeding(false);
    }
  };

  // Filtered documents by search
  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return documents;
    const q = searchQuery.toLowerCase();
    return documents.filter((d) => d.filename.toLowerCase().includes(q));
  }, [documents, searchQuery]);

  const canCompare = selectedDocIds.length === 2;

  return (
    <div className="flex flex-col h-full bg-white select-none font-sans">
      {/* 1. Header & Title */}
      <div className="p-3.5 border-b border-[#E5E7EB]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-[6px] bg-[#2563EB] text-white flex items-center justify-center font-bold text-[11px]">
              CA
            </div>
            <h1 className="text-[14.5px] font-semibold text-[#111827] tracking-tight">
              Contract Analyser
            </h1>
          </div>
          <span className="text-[11.5px] font-medium text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded-[6px]">
            {documents.length} {documents.length === 1 ? "doc" : "docs"}
          </span>
        </div>

        {/* Upload Dropzone */}
        <Dropzone
          onUploadSuccess={handleUploadSuccess}
          onUploadError={handleUploadError}
          onSeedSamples={handleSeedSamples}
          isSeeding={isSeeding}
        />
      </div>

      {/* 2. Search Field (Section 6.8) */}
      <div className="px-3.5 py-2.5 border-b border-[#F3F4F6]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contracts..."
            className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-[8px] pl-8 pr-3 py-1.5 text-[12.5px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* 3. Dismissible Error Cards (D-045) */}
      {errors.length > 0 && (
        <div className="p-3 bg-[#FEE2E2]/30 border-b border-[#FECACA] overflow-y-auto max-h-48">
          {errors.map((err) => (
            <DismissibleErrorCard key={err.id} error={err} onDismiss={handleDismissError} />
          ))}
        </div>
      )}

      {/* 4. Multi-selection & Compare bar */}
      {selectedDocIds.length > 0 && (
        <div className="px-3.5 py-2 bg-[#EFF6FF] border-b border-[#BFDBFE] flex items-center justify-between text-[12px]">
          <span className="font-semibold text-[#1E3A8A]">
            {selectedDocIds.length} selected
          </span>

          <button
            type="button"
            onClick={() => {
              if (canCompare) {
                onCompare(selectedDocIds[0], selectedDocIds[1]);
              }
            }}
            disabled={!canCompare}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-[11.5px] font-semibold transition-all ${
              canCompare
                ? "bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-xs cursor-pointer"
                : "bg-[#BFDBFE] text-white/80 cursor-not-allowed"
            }`}
            title={canCompare ? "Compare selected contracts" : "Select exactly 2 documents to compare"}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Compare (2)</span>
          </button>
        </div>
      )}

      {/* 5. Document List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="space-y-2.5 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-3 bg-white rounded-[12px] border border-[#E5E7EB] animate-pulse">
                <div className="h-3 bg-[#E5E7EB] rounded-[4px] w-3/4 mb-2" />
                <div className="h-2 bg-[#F3F4F6] rounded-[4px] w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <div className="w-9 h-9 rounded-full bg-[#F3F4F6] text-[#9CA3AF] flex items-center justify-center mx-auto mb-2">
              <Files className="w-4 h-4" />
            </div>
            <p className="text-[12.5px] font-semibold text-[#374151]">
              {searchQuery ? "No matching contracts" : "No documents yet"}
            </p>
            <p className="text-[11.5px] text-[#6B7280] mt-1">
              {searchQuery
                ? "Try searching for a different contract title."
                : "Upload a contract above or try sample agreements."}
            </p>
          </div>
        ) : (
          filteredDocuments.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              isSelected={selectedDocIds.includes(doc.id)}
              isActive={activeViewerDocId === doc.id}
              onSelect={onToggleSelect}
              onOpen={onOpenViewer}
              onDelete={handleDeleteDocument}
              onRetry={handleRetryDocument}
            />
          ))
        )}
      </div>
    </div>
  );
};
