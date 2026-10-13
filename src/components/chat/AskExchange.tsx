"use client";

import React, { useState } from "react";
import type { StoredMessage, StoredQuote } from "@/server/chat";
import { parseMessageContent } from "@/lib/llm/stream-parser";
import { QuoteFlag } from "../ui/QuoteFlag";
import { Spine, type SpineTick } from "../ui/Spine";
import { CoverageBanner } from "./CoverageBanner";
import { AgentTraceUI } from "./AgentTraceUI";
import { EvidenceCard } from "../quotes/EvidenceCard";
import type { AgentTraceStep } from "@/lib/agent/loop";
import { Compass, ChevronDown, ChevronUp } from "lucide-react";

interface AskExchangeProps {
  question: string;
  answerMessage: StoredMessage;
  isStreaming?: boolean;
  documentNames?: Record<string, string>;
  onOpenQuoteInViewer?: (quote: StoredQuote) => void;
  showMargin?: boolean;
}

export function AskExchange({
  question,
  answerMessage,
  isStreaming = false,
  documentNames = {},
  onOpenQuoteInViewer,
  showMargin = true,
}: AskExchangeProps) {
  const [isEvidenceCollapsed, setIsEvidenceCollapsed] = useState(false);
  const { segments } = parseMessageContent(answerMessage.content);

  // Quote map
  const quoteMap = new Map<string, StoredQuote>();
  for (const q of answerMessage.quotes || []) {
    quoteMap.set(q.localId, q);
  }

  // Build Spine ticks for "Where this came from"
  const spineTicks: SpineTick[] = (answerMessage.quotes || []).map((q, idx) => {
    const num = idx + 1;
    const matchStart = q.matches?.[0]?.start ?? 0;
    // Normalized position estimate or fallback
    const pos = Math.min(1, Math.max(0, (idx + 1) / ((answerMessage.quotes?.length || 1) + 1)));
    return {
      id: q.id || q.localId,
      position: pos,
      color: q.status === "verified" ? "#0B7A5F" : q.status === "dropped" ? "#B5224E" : "#A8480A",
      label: `Quote [${num}]`,
      tooltip: `[${num}] ${q.text.slice(0, 50)}...`,
    };
  });

  return (
    <article className="py-8 border-b border-[#E3E1EF] font-sans">
      <div className="flex items-start gap-8">
        {/* Main Reading Column */}
        <div className="flex-1 min-w-0 max-w-[66ch]">
          {/* Question as Heading (20px, ink, Bricolage) */}
          <h2 className="text-[20px] font-semibold text-[#17142B] tracking-tight mb-4 leading-snug">
            {question}
          </h2>

          {/* Mode label if special */}
          {answerMessage.mode && answerMessage.mode !== "full" && (
            <div className="mb-3">
              <span className="text-[11.5px] font-medium text-[#5A5775] bg-[#F7F7FC] px-2.5 py-1 rounded-[6px] border border-[#E3E1EF]">
                {answerMessage.mode === "map_reduce"
                  ? "Read in sections"
                  : answerMessage.mode === "retrieval"
                  ? "Searched sections"
                  : answerMessage.mode === "agent"
                  ? "Deep research"
                  : "Full document"}
              </span>
            </div>
          )}

          {/* Coverage Banner (when partial) */}
          {answerMessage.coverage && <CoverageBanner coverage={answerMessage.coverage} />}

          {/* Agent Research Trace */}
          {Array.isArray((answerMessage.stats as any)?.trace) && (
            <AgentTraceUI
              trace={(answerMessage.stats as any).trace as AgentTraceStep[]}
              isStreaming={isStreaming}
            />
          )}

          {/* Answer in Reading Typography (Newsreader 17px, line-height 1.7) */}
          <div className="font-reading text-[17px] leading-[1.7] text-[#17142B] space-y-4">
            {isStreaming && !answerMessage.content ? (
              <div className="flex items-center gap-2.5 text-[14px] text-[#5A5775] font-sans py-3">
                <div className="w-4 h-4 border-2 border-[#17142B] border-t-transparent rounded-full animate-spin shrink-0" />
                <span>Reading clauses and verifying citations...</span>
              </div>
            ) : segments.length > 0 ? (
              <p className="whitespace-pre-wrap">
                {segments.map((seg, idx) => {
                  if (seg.type === "text") {
                    return <span key={idx}>{seg.text}</span>;
                  } else if (seg.type === "quote") {
                    const qRecord = quoteMap.get(seg.localId);
                    const docTitle =
                      documentNames[seg.docId || ""] || seg.docId || "Contract";
                    const qIndex =
                      answerMessage.quotes?.findIndex((q) => q.localId === seg.localId) ?? 0;

                    return (
                      <span key={idx} className="inline">
                        <span className="bg-[#FFF0A8] px-0.5 rounded-[2px] text-[#17142B] hl-sweep">
                          “{seg.text}”
                        </span>
                        <QuoteFlag
                          quoteId={seg.localId}
                          quoteIndex={qIndex >= 0 ? qIndex : idx}
                          quoteText={seg.text}
                          status={qRecord?.status}
                          reason={qRecord?.reason}
                          matches={qRecord?.matches ?? undefined}
                          docName={docTitle}
                          docIndex={qIndex >= 0 ? qIndex : idx}
                          onOpenDocument={() => {
                            if (qRecord && onOpenQuoteInViewer) {
                              onOpenQuoteInViewer(qRecord);
                            }
                          }}
                        />
                      </span>
                    );
                  }
                  return null;
                })}
                {isStreaming && (
                  <span className="inline-block w-1.5 h-4 bg-[#17142B] ml-1 translate-y-0.5 animate-pulse" />
                )}
              </p>
            ) : (
              <p className="whitespace-pre-wrap text-[#17142B]">
                {answerMessage.content}
                {isStreaming && (
                  <span className="inline-block w-1.5 h-4 bg-[#17142B] ml-1 translate-y-0.5 animate-pulse" />
                )}
              </p>
            )}
          </div>

          {/* "Where this came from" Spine with plain-English labels & legend */}
          {(answerMessage.quotes || []).length > 0 && (
            <div className="mt-6 pt-4 border-t border-[#E3E1EF] bg-[#F7F7FC] rounded-[14px] p-4 border border-[#E3E1EF]">
              <div className="flex items-center justify-between text-[13px] font-semibold text-[#17142B] mb-1 font-sans">
                <div className="flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-[#4B3FD6]" />
                  <span>Contract Citation Map</span>
                </div>
                <span className="text-[12px] text-[#5A5775] font-normal">
                  {(answerMessage.quotes || []).length} citations checked
                </span>
              </div>
              <p className="text-[11.5px] text-[#6E6B87] mb-2 font-sans">
                Timeline distribution of cited clauses. Click any marker on the bar to jump directly to that line in the contract:
              </p>
              <div className="relative">
                <Spine
                  cells={32}
                  ticks={spineTicks}
                  thickness={14}
                  onSelect={(_, tick) => {
                    if (tick && onOpenQuoteInViewer) {
                      const matchingQuote = answerMessage.quotes?.find(
                        (q) => (q.id || q.localId) === tick.id
                      );
                      if (matchingQuote) onOpenQuoteInViewer(matchingQuote);
                    }
                  }}
                />
                <div className="flex justify-between items-center text-[10.5px] font-mono text-[#6E6B87] mt-1 select-none">
                  <span>Page 1 (Beginning)</span>
                  <span>End of Document</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-2.5 pt-2 border-t border-[#E3E1EF]/80 text-[11px] text-[#5A5775] font-sans">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0B7A5F]" /> Verified Quote
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#A8480A]" /> Unverified / Too Short
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#B5224E]" /> Dropped
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Margin Evidence Column with contained scroll & collapse toggle */}
        {showMargin && (answerMessage.quotes || []).length > 0 && (
          <aside
            aria-label="Citations in this exchange"
            className="w-[340px] shrink-0 font-sans sticky top-4 self-start"
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E3E1EF]">
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#17142B] uppercase tracking-wider">
                <span>Evidence In Exchange</span>
                <span className="w-5 h-5 rounded-full bg-[#E8E6FB] text-[#4B3FD6] text-[11px] font-mono flex items-center justify-center">
                  {answerMessage.quotes?.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsEvidenceCollapsed(!isEvidenceCollapsed)}
                className="text-[11.5px] font-medium text-[#6E6B87] hover:text-[#17142B] flex items-center gap-0.5 cursor-pointer"
              >
                <span>{isEvidenceCollapsed ? "Expand" : "Collapse"}</span>
                {isEvidenceCollapsed ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {!isEvidenceCollapsed && (
              <div className="max-h-[500px] overflow-y-auto pr-1 space-y-2.5">
                {answerMessage.quotes?.map((q, idx) => {
                  const docTitle =
                    documentNames[q.documentId || ""] || q.documentName || "Contract";
                  return (
                    <EvidenceCard
                      key={q.id || q.localId || idx}
                      quoteText={q.text}
                      status={q.status}
                      reason={q.reason}
                      matches={q.matches}
                      docName={docTitle}
                      docIndex={idx}
                      onOpenDocument={() => {
                        if (onOpenQuoteInViewer) onOpenQuoteInViewer(q);
                      }}
                    />
                  );
                })}
              </div>
            )}
          </aside>
        )}
      </div>
    </article>

  );
}
