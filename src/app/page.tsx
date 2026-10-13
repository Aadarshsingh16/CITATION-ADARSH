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
    <div className="flex h-screen w-screen overflow-hidden bg-[#F6F8FF] p-3 gap-3 font-sans antialiased text-[#111827]">
      {/* 1. Left Panel: Document Library (280px floating panel) */}
      <aside className="w-[280px] shrink-0 h-full rounded-[16px] bg-white border border-[#E5E7EB] shadow-[0_1px_2px_rgba(17,24,39,0.06)] flex flex-col overflow-hidden">
        <LibrarySidebar
          selectedDocIds={selectedDocIds}
          activeViewerDocId={activeViewerDocId}
          onToggleSelect={handleToggleSelect}
          onOpenViewer={handleOpenViewer}
          onCompare={handleCompare}
        />
      </aside>

      {/* 2. Center Panel: Chat & Analysis Workspace (flexible, min 480px floating panel) */}
      <main className="flex-1 min-w-[480px] h-full rounded-[16px] bg-white border border-[#E5E7EB] shadow-[0_1px_2px_rgba(17,24,39,0.06)] flex flex-col overflow-hidden relative">
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

      {/* 3. Right Panel: Collapsible Canonical Document Viewer (480px floating panel) */}
      {activeViewerDocId && (
        <aside className="w-[500px] shrink-0 h-full rounded-[16px] bg-white border border-[#E5E7EB] shadow-[0_1px_2px_rgba(17,24,39,0.06)] flex flex-col overflow-hidden">
          <DocumentViewer
            documentId={activeViewerDocId}
            activeQuote={activeQuoteCitation}
            onClose={() => {
              setActiveViewerDocId(null);
              setActiveQuoteCitation(null);
            }}
            onClearActiveQuote={() => setActiveQuoteCitation(null)}
          />
        </aside>
      )}

      {/* 4. Full-width Document Comparison Modal View */}
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
