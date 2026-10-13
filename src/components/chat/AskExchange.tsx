"use client";

import React from "react";
import type { StoredMessage, StoredQuote } from "@/server/chat";
import { parseMessageContent } from "@/lib/llm/stream-parser";
import { QuoteFlag } from "../ui/QuoteFlag";
import { Spine, type SpineTick } from "../ui/Spine";
import { CoverageBanner } from "./CoverageBanner";
import { AgentTraceUI } from "./AgentTraceUI";
import { EvidenceCard } from "../quotes/EvidenceCard";
import type { AgentTraceStep } from "@/lib/agent/loop";

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

          {/* "Where this came from" Spine (Section 6.2) */}
          {(answerMessage.quotes || []).length > 0 && (
            <div className="mt-6 pt-4 border-t border-[#F1F0F8]">
              <div className="flex items-center justify-between text-[12px] text-[#6E6B87] font-medium mb-1.5 font-sans">
                <span>Where this came from in the document</span>
                <span>{(answerMessage.quotes || []).length} citations checked</span>
              </div>
              <Spine
                cells={32}
                ticks={spineTicks}
                thickness={12}
                onSelect={(_, tick) => {
                  if (tick && onOpenQuoteInViewer) {
                    const matchingQuote = answerMessage.quotes?.find(
                      (q) => (q.id || q.localId) === tick.id
                    );
                    if (matchingQuote) onOpenQuoteInViewer(matchingQuote);
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* Right Margin Evidence Column (360px, Section 6.2) */}
        {showMargin && (answerMessage.quotes || []).length > 0 && (
          <aside
            aria-label="Citations in this exchange"
            className="w-[340px] shrink-0 space-y-3 font-sans"
          >
            <div className="text-[12px] font-semibold text-[#6E6B87] uppercase tracking-wider mb-2">
              Evidence in this exchange
            </div>
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
          </aside>
        )}
      </div>
    </article>
  );
}
