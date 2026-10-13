"use client";

import React, { useState } from "react";
import type { StoredMessage, StoredQuote } from "@/server/chat";
import { parseMessageContent } from "@/lib/llm/stream-parser";
import { QuotePill } from "../quotes/QuotePill";
import { EvidencePanel, type EvidenceSourceItem } from "../quotes/EvidencePanel";
import { NumberChip } from "../ui/NumberChip";
import { CoverageBanner } from "./CoverageBanner";
import { AgentTraceUI } from "./AgentTraceUI";
import type { AgentTraceStep } from "@/lib/agent/loop";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";

export interface MessageBubbleProps {
  message: StoredMessage;
  isStreaming?: boolean;
  onOpenQuoteInViewer?: (quote: StoredQuote) => void;
  documentNames?: Record<string, string>;
}

export function MessageBubble({
  message,
  isStreaming = false,
  onOpenQuoteInViewer,
  documentNames = {},
}: MessageBubbleProps) {
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [selectedEvidenceIndex, setSelectedEvidenceIndex] = useState(0);
  const [showTelemetry, setShowTelemetry] = useState(false);

  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end mb-4 font-sans">
        <div className="max-w-[80%] bg-[#EFF6FF] border border-[#BFDBFE] text-[#111827] px-4 py-3 rounded-[16px] rounded-br-[4px] text-[14px] leading-relaxed shadow-xs">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  // Assistant message
  const isStopped = message.status === "stopped";
  const isError = message.status === "error";

  // Parse message content into text and quote segments
  const { segments } = parseMessageContent(message.content);

  // Map of quotes by localId
  const quoteMap = new Map<string, StoredQuote>();
  for (const q of message.quotes || []) {
    quoteMap.set(q.localId, q);
  }

  // Construct source items for EvidencePanel and compact sources strip
  const sources: EvidenceSourceItem[] = (message.quotes || []).map((q, idx) => {
    const docTitle = documentNames[q.documentId || ""] || q.documentName || q.documentId || "Document";
    return {
      id: q.id || q.localId,
      quoteIndex: idx,
      quoteText: q.text,
      status: q.status,
      reason: q.reason,
      matches: q.matches,
      documentId: q.documentId,
      docName: docTitle,
      docIndex: idx,
    };
  });

  const handleOpenSourceInViewer = (sourceIndex: number) => {
    setSelectedEvidenceIndex(sourceIndex);
    setEvidenceModalOpen(true);
  };

  const handleViewerNavigate = (
    docId: string
  ) => {
    if (!onOpenQuoteInViewer) return;
    const matchingQuote = message.quotes?.find(
      (q) => q.documentId === docId
    );
    if (matchingQuote) {
      onOpenQuoteInViewer(matchingQuote);
    }
  };

  return (
    <div className="flex flex-col items-start mb-6 w-full font-sans">
      <div className="max-w-[720px] w-full bg-white border border-[#E5E7EB] rounded-[16px] p-5 shadow-[0_1px_2px_rgba(17,24,39,0.06)] transition-all">
        {/* Header Chips (Mode & Coverage) */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#F3F4F6]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[14px] text-[#111827]">
              Contract Analyser
            </span>

            {message.mode && (
              <span className="text-[11px] font-medium text-[#4B5563] bg-[#F3F4F6] px-2 py-0.5 rounded-[6px] border border-[#E5E7EB]">
                {message.mode === "map_reduce"
                  ? "Read in sections"
                  : message.mode === "retrieval"
                  ? "Searched sections"
                  : message.mode === "agent"
                  ? "Deep research"
                  : "Full document"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isStreaming && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#2563EB] bg-[#EFF6FF] px-2.5 py-0.5 rounded-full border border-[#BFDBFE] animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] animate-ping" />
                Streaming answer...
              </span>
            )}

            {isStopped && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded-[6px] border border-[#E5E7EB]">
                Stopped
              </span>
            )}

            {isError && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#B91C1C] bg-[#FEE2E2] px-2 py-0.5 rounded-[6px] border border-[#FECACA]">
                Error
              </span>
            )}
          </div>
        </div>

        {/* Coverage Banner (when incomplete) */}
        {message.coverage && <CoverageBanner coverage={message.coverage} />}

        {/* Agent Research Trace */}
        {Array.isArray((message.stats as any)?.trace) && (
          <AgentTraceUI
            trace={(message.stats as any).trace as AgentTraceStep[]}
            isStreaming={isStreaming}
          />
        )}

        {/* Message Text with inline QuotePills */}
        <div className="text-[15px] leading-[1.65] text-[#111827] space-y-3 mt-1">
          {segments.length > 0 ? (
            <p className="whitespace-pre-wrap">
              {segments.map((seg, idx) => {
                if (seg.type === "text") {
                  return <span key={idx}>{seg.text}</span>;
                } else if (seg.type === "quote") {
                  const qRecord = quoteMap.get(seg.localId);
                  const docTitle = documentNames[seg.docId || ""] || seg.docId || "Document";
                  const qIndex = message.quotes?.findIndex((q) => q.localId === seg.localId) ?? 0;

                  return (
                    <span key={idx} className="inline">
                      <span className="font-contract italic bg-[#FEF3C7]/40 px-1 py-0.5 rounded-[2px] text-[#111827]">
                        “{seg.text}”
                      </span>
                      <QuotePill
                        quoteId={seg.localId}
                        quoteIndex={qIndex >= 0 ? qIndex : idx}
                        quoteText={seg.text}
                        status={qRecord?.status}
                        reason={qRecord?.reason}
                        matches={qRecord?.matches}
                        docName={docTitle}
                        docIndex={qIndex >= 0 ? qIndex : idx}
                        onOpenDocument={() => {
                          if (qRecord && onOpenQuoteInViewer) {
                            onOpenQuoteInViewer(qRecord);
                          }
                        }}
                        onViewAllSources={() => {
                          setSelectedEvidenceIndex(qIndex >= 0 ? qIndex : 0);
                          setEvidenceModalOpen(true);
                        }}
                      />
                    </span>
                  );
                }
                return null;
              })}
              {isStreaming && (
                <span className="inline-block w-1.5 h-4 bg-[#2563EB] ml-1 translate-y-0.5 animate-pulse" />
              )}
            </p>
          ) : (
            <p className="whitespace-pre-wrap text-[#111827]">
              {message.content}
              {isStreaming && (
                <span className="inline-block w-1.5 h-4 bg-[#2563EB] ml-1 translate-y-0.5 animate-pulse" />
              )}
            </p>
          )}
        </div>

        {/* Compact Sources Strip (Section 6.5) */}
        {sources.length > 0 && (
          <div className="mt-4 pt-3 border-t border-[#F3F4F6] flex flex-wrap items-center gap-2 text-[12.5px]">
            <span className="text-[#6B7280] font-medium mr-1">Sources:</span>
            {sources.map((s, idx) => {
              const isUnv = s.status === "unverified";
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleOpenSourceInViewer(idx)}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] bg-[#F9FAFB] hover:bg-[#F3F4F6] border border-[#E5E7EB] text-[#374151] hover:text-[#111827] transition-colors cursor-pointer"
                >
                  <NumberChip
                    number={s.quoteIndex + 1}
                    state={isUnv ? "unverified" : "verified"}
                  />
                  <span className="max-w-[140px] truncate">{s.docName}</span>
                  {isUnv && <AlertTriangle className="w-3.5 h-3.5 text-[#B45309]" />}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => {
                setSelectedEvidenceIndex(0);
                setEvidenceModalOpen(true);
              }}
              className="text-[#2563EB] hover:text-[#1D4ED8] font-medium hover:underline ml-1 cursor-pointer"
            >
              View all sources ({sources.length})
            </button>
          </div>
        )}

        {/* Telemetry disclosure toggle */}
        {message.stats && (
          <div className="mt-3 pt-2 text-[11px] text-[#6B7280]">
            <button
              type="button"
              onClick={() => setShowTelemetry(!showTelemetry)}
              className="flex items-center gap-1 hover:text-[#111827] cursor-pointer"
            >
              {showTelemetry ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              <span>Telemetry</span>
            </button>
            {showTelemetry && (
              <pre className="mt-1.5 p-2 bg-[#F9FAFB] rounded-[6px] border border-[#E5E7EB] text-[10.5px] font-mono overflow-x-auto text-[#4B5563]">
                {JSON.stringify(message.stats, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Two-Pane Evidence Modal */}
      <EvidencePanel
        isOpen={evidenceModalOpen}
        onClose={() => setEvidenceModalOpen(false)}
        sources={sources}
        selectedIndex={selectedEvidenceIndex}
        onSelectIndex={setSelectedEvidenceIndex}
        onOpenDocument={handleViewerNavigate}
      />
    </div>
  );
}
