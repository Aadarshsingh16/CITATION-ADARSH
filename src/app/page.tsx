"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { DocumentRecord } from "@/lib/types";
import { TopBar, type NavMode } from "@/components/navigation/TopBar";
import { HelpModal } from "@/components/navigation/HelpModal";
import { SampleContractsModal } from "@/components/navigation/SampleContractsModal";
import { LibraryView } from "@/components/library/LibraryView";
import { AskView } from "@/components/chat/AskView";
import { CompareScreen } from "@/components/compare/CompareScreen";
import { ReadingDesk } from "@/components/reading/ReadingDesk";

export default function Home() {
  const [activeMode, setActiveMode] = useState<NavMode>("library");
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [comparePair, setComparePair] = useState<{ docAId?: string; docBId?: string }>({});
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const [showSamplesModal, setShowSamplesModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // 1. Fetch documents
  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // 2. Polling for processing documents
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

  // 3. Global keyboard shortcut '?' for Help modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (e.key === "?") {
        setShowHelpModal((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 4. Document actions
  const handleUploadSuccess = (newDoc: DocumentRecord) => {
    setDocuments((prev) => [newDoc, ...prev]);
    setSelectedDocIds([newDoc.id]);
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== id));
        setSelectedDocIds((prev) => prev.filter((dId) => dId !== id));
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
    try {
      const res = await fetch("/api/documents/seed-samples", { method: "POST" });
      if (res.ok) {
        await fetchDocuments();
      }
    } catch (err) {
      console.error("Failed to seed sample contracts:", err);
    }
  };

  const handleAskDocument = (docIds: string[]) => {
    setSelectedDocIds(docIds);
    setActiveMode("ask");
  };

  const handleCompareDocuments = (docAId: string, docBId: string) => {
    setComparePair({ docAId, docBId });
    setActiveMode("compare");
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#F1F0F8] flex flex-col font-ui antialiased text-[#17142B]">
      {/* 56px Top Bar */}
      <TopBar
        activeMode={activeMode}
        onSelectMode={setActiveMode}
        onOpenSamples={() => setShowSamplesModal(true)}
        onOpenHelp={() => setShowHelpModal(true)}
        documentCount={documents.length}
      />

      {/* Main Mode View */}
      <main className="flex-1 overflow-hidden relative flex flex-col bg-[#F1F0F8]">
        {activeMode === "library" && (
          <LibraryView
            documents={documents}
            onUploadSuccess={handleUploadSuccess}
            onDeleteDocument={handleDeleteDocument}
            onRetryDocument={handleRetryDocument}
            onSeedSamples={handleSeedSamples}
            onAskDocument={handleAskDocument}
            onCompareDocuments={handleCompareDocuments}
            onPreviewDocument={(id) => setPreviewDocId(id)}
          />
        )}

        {activeMode === "ask" && (
          <AskView
            selectedDocIds={selectedDocIds}
            documents={documents}
            onOpenLibrary={() => setActiveMode("library")}
            onUpdateSelectedDocs={setSelectedDocIds}
          />
        )}

        {activeMode === "compare" && (
          <CompareScreen
            documents={documents}
            initialDocAId={comparePair.docAId}
            initialDocBId={comparePair.docBId}
          />
        )}
      </main>

      {/* Modals */}
      {previewDocId && (
        <div className="fixed inset-0 z-50 bg-[#17142B]/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
          <div className="bg-white rounded-[20px] shadow-2xl border border-[#CFCCE0] w-full max-w-5xl h-[88vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <ReadingDesk
              documentId={previewDocId}
              onClose={() => setPreviewDocId(null)}
            />
          </div>
        </div>
      )}

      {showSamplesModal && (
        <SampleContractsModal
          onClose={() => setShowSamplesModal(false)}
          onRefreshDocs={fetchDocuments}
        />
      )}

      {showHelpModal && (
        <HelpModal onClose={() => setShowHelpModal(false)} />
      )}
    </div>
  );
}


