"use client";

import React, { useState } from "react";
import { LibrarySidebar } from "@/components/library/LibrarySidebar";
import { DocumentViewer } from "@/components/library/DocumentViewer";

export default function Home() {
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [activeViewerDocId, setActiveViewerDocId] = useState<string | null>(null);

  const handleToggleSelect = (id: string, selected: boolean) => {
    setSelectedDocIds((prev) =>
      selected ? [...prev, id] : prev.filter((item) => item !== id)
    );
  };

  const handleOpenViewer = (id: string) => {
    setActiveViewerDocId(id || null);
  };

  const handleCompare = (idA: string, idB: string) => {
    alert(`Comparison view between ${idA} and ${idB} will be available in Phase 6.`);
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
        {/* Workspace Header */}
        <header className="h-14 border-b border-stone-200 px-6 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">
              Analysis Scope:
            </span>
            {selectedDocIds.length > 0 ? (
              <span className="text-xs font-semibold text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200">
                {selectedDocIds.length} document{selectedDocIds.length > 1 ? "s" : ""} active
              </span>
            ) : activeViewerDocId ? (
              <span className="text-xs font-semibold text-stone-700 bg-stone-100 px-2.5 py-1 rounded-md border border-stone-200">
                1 document focused
              </span>
            ) : (
              <span className="text-xs text-stone-400 italic">
                Select or upload a contract to begin
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-stone-500 font-medium bg-stone-50 px-2 py-0.5 rounded-sm border border-stone-200">
              Strict Quote Verification
            </span>
          </div>
        </header>

        {/* Chat / Content Body */}
        <div className="flex-1 overflow-y-auto p-8 flex flex-col justify-center items-center text-center">
          <div className="max-w-md w-full">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 border border-indigo-100 shadow-xs">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>

            <h2 className="text-base font-bold text-stone-900 mb-1.5">
              Legal Contract Assistant
            </h2>
            <p className="text-xs text-stone-500 mb-6 leading-relaxed">
              Every answer is verified against exact wording in the contract text. No unverified claims or hallucinations.
            </p>

            {/* Suggested Starter Questions */}
            <div className="space-y-2 text-left">
              <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">
                Sample Legal Queries:
              </p>
              {[
                "Is there a termination for convenience clause?",
                "What are the payment terms and late interest rates?",
                "What is the governing law and dispute jurisdiction?",
                "Are there any confidentiality duration exclusions?",
              ].map((query, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => alert(`Phase 2 streaming chat will execute query: "${query}"`)}
                  className="w-full text-left p-2.5 rounded-lg border border-stone-200 hover:border-indigo-300 hover:bg-indigo-50/30 text-xs text-stone-700 font-medium transition-all flex items-center justify-between group"
                >
                  <span className="truncate">{query}</span>
                  <svg className="w-3.5 h-3.5 text-stone-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Composer Bar */}
        <div className="p-4 border-t border-stone-200 bg-stone-50/50 shrink-0">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Ask a question about the contract clauses..."
                disabled
                className="w-full bg-white border border-stone-300 rounded-xl px-4 py-2.5 text-xs text-stone-700 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs disabled:bg-stone-100 disabled:cursor-not-allowed"
              />
              <span className="absolute right-3 top-2.5 text-[10px] font-medium text-stone-400">
                P2 Chat
              </span>
            </div>

            <button
              disabled
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Send
            </button>
          </div>
        </div>
      </main>

      {/* 3. Right: Collapsible Canonical Document Viewer */}
      <DocumentViewer
        documentId={activeViewerDocId}
        onClose={() => setActiveViewerDocId(null)}
      />
    </div>
  );
}
