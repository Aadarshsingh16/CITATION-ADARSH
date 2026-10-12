"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { DocumentRecord, DismissibleError } from "@/lib/types";
import { Dropzone } from "./Dropzone";
import { DocumentCard } from "./DocumentCard";
import { DismissibleErrorCard } from "./DismissibleErrorCard";

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

  // Fetch documents from server
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
        if (activeViewerDocId === id) {
          onOpenViewer("");
        }
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
      console.error("Failed to seed samples:", err);
    } finally {
      setIsSeeding(false);
    }
  };

  const canCompare = selectedDocIds.length === 2;

  return (
    <aside
      className="w-[320px] bg-stone-50/70 border-r border-stone-200 flex flex-col h-full shrink-0 select-none"
      aria-label="Document library"
    >
      {/* Header */}
      <div className="p-4 border-b border-stone-200 bg-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-stone-900 leading-tight">Contract Analyser</h1>
              <span className="text-[10px] text-stone-500 font-mono">Verified Citations</span>
            </div>
          </div>

          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
            {documents.length} {documents.length === 1 ? "doc" : "docs"}
          </span>
        </div>

        {/* Dropzone & sample seeder */}
        <Dropzone
          onUploadSuccess={handleUploadSuccess}
          onUploadError={handleUploadError}
          onSeedSamples={handleSeedSamples}
          isSeeding={isSeeding}
        />
      </div>

      {/* Dismissible Error Cards (D-045) */}
      {errors.length > 0 && (
        <div className="p-3 bg-red-50/30 border-b border-red-100 overflow-y-auto max-h-48">
          {errors.map((err) => (
            <DismissibleErrorCard key={err.id} error={err} onDismiss={handleDismissError} />
          ))}
        </div>
      )}

      {/* Multi-selection & Compare bar */}
      {selectedDocIds.length > 0 && (
        <div className="px-3.5 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between text-xs">
          <span className="font-medium text-indigo-950">
            {selectedDocIds.length} selected
          </span>

          <button
            onClick={() => {
              if (canCompare) {
                onCompare(selectedDocIds[0], selectedDocIds[1]);
              }
            }}
            disabled={!canCompare}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
              canCompare
                ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer"
                : "bg-indigo-200 text-indigo-400 cursor-not-allowed"
            }`}
            title={canCompare ? "Compare selected contracts" : "Select exactly 2 documents to compare"}
          >
            Compare (2)
          </button>
        </div>
      )}

      {/* Document List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="space-y-2.5 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-3 bg-white rounded-xl border border-stone-200 animate-pulse">
                <div className="h-3 bg-stone-200 rounded-sm w-3/4 mb-2" />
                <div className="h-2 bg-stone-100 rounded-sm w-1/2" />
              </div>
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <div className="w-10 h-10 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto mb-2.5">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-xs font-semibold text-stone-700">No documents yet</p>
            <p className="text-[11px] text-stone-500 mt-1">
              Upload a contract above or try with our sample agreements.
            </p>
          </div>
        ) : (
          documents.map((doc) => (
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
    </aside>
  );
};
