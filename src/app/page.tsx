"use client";

import React, { useState } from "react";
import { LibrarySidebar } from "@/components/library/LibrarySidebar";
import { DocumentViewer } from "@/components/library/DocumentViewer";
import { ChatWorkspace } from "@/components/chat/ChatWorkspace";
import { ComparisonView } from "@/components/compare/ComparisonView";
import type { StoredQuote } from "@/server/chat";

export default function Home() {
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [activeViewerDocId, setActiveViewerDocId] = useState<string | null>(null);
  const [activeQuoteCitation, setActiveQuoteCitation] = useState<{
    text: string;
    documentId?: string;
    quoteId?: string;
  } | null>(null);
  const [activeComparisonPair, setActiveComparisonPair] = useState<{
    docAId: string;
    docBId: string;
  } | null>(null);

  const handleToggleSelect = (id: string, selected: boolean) => {
    setSelectedDocIds((prev) =>
      selected ? [...prev, id] : prev.filter((item) => item !== id)
    );
  };

  const handleOpenViewer = (id: string) => {
    setActiveViewerDocId(id || null);
    setActiveQuoteCitation(null);
  };

  const handleOpenQuoteInViewer = (quote: StoredQuote) => {
    setActiveViewerDocId(quote.documentId);
    setActiveQuoteCitation({
      text: quote.text,
      documentId: quote.documentId,
      quoteId: quote.id,
    });
  };

  const handleCompare = (idA: string, idB: string) => {
    setActiveComparisonPair({ docAId: idA, docBId: idB });
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-stone-100 font-sans">
      {/* 1. Left Sidebar: Document Library */}
      <LibrarySidebar
        selectedDocIds={selectedDocIds}
        activeViewerDocId={activeViewerDocId}
        onToggleSelect={handleToggleSelect}
        onOpenViewer={handleOpenViewer}
        onCompare={handleCompare}
      />

      {/* 2. Center: Chat & Analysis Workspace */}
      <main className="flex-1 flex flex-col h-full bg-white relative overflow-hidden">
        <ChatWorkspace
          selectedDocIds={
            selectedDocIds.length > 0
              ? selectedDocIds
              : activeViewerDocId
              ? [activeViewerDocId]
              : []
          }
          onOpenQuoteInViewer={handleOpenQuoteInViewer}
        />
      </main>

      {/* 3. Right: Collapsible Canonical Document Viewer */}
      <DocumentViewer
        documentId={activeViewerDocId}
        activeQuote={activeQuoteCitation}
        onClose={() => {
          setActiveViewerDocId(null);
          setActiveQuoteCitation(null);
        }}
        onClearActiveQuote={() => setActiveQuoteCitation(null)}
      />

      {/* 4. Document Comparison Modal View (Phase 6, B8, B10) */}
      {activeComparisonPair && (
        <ComparisonView
          docAId={activeComparisonPair.docAId}
          docBId={activeComparisonPair.docBId}
          onClose={() => setActiveComparisonPair(null)}
        />
      )}
    </div>
  );
}
