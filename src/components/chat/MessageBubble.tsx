"use client";

import React from "react";
import type { StoredMessage, StoredQuote } from "@/server/chat";
import { parseMessageContent } from "@/lib/llm/stream-parser";
import { QuotePill } from "./QuotePill";
import { QuoteCard } from "./QuoteCard";
import { CoverageBanner } from "./CoverageBanner";

export interface MessageBubbleProps {
  message: StoredMessage;
  isStreaming?: boolean;
  onOpenQuoteInViewer?: (quote: StoredQuote) => void;
}

export function MessageBubble({
  message,
  isStreaming = false,
  onOpenQuoteInViewer,
}: MessageBubbleProps) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[85%] bg-stone-900 text-white px-4 py-2.5 rounded-2xl rounded-tr-xs text-xs leading-relaxed shadow-xs">
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

  return (
    <div className="flex flex-col items-start mb-6 w-full">
      <div className="max-w-3xl w-full bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs transition-all">
        {/* Assistant Header & Status Chips */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
              CA
            </div>
            <span className="text-xs font-semibold text-stone-800">
              Contract Analyser
            </span>

            {message.mode && (
              <span className="text-[10px] font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200">
                {message.mode === "map_reduce"
                  ? "Map-Reduce"
                  : message.mode === "retrieval"
                  ? "Retrieval"
                  : message.mode === "agent"
                  ? "Agent"
                  : "Full Document"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isStreaming && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping" />
                Streaming answer...
              </span>
            )}

            {isStopped && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200">
                <svg className="w-2.5 h-2.5 text-stone-500" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
                Stopped
              </span>
            )}

            {isError && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                Error
              </span>
            )}
          </div>
        </div>

        {/* Coverage Banner (when incomplete) */}
        {message.coverage && <CoverageBanner coverage={message.coverage} />}

        {/* Message Prose with inline QuotePills */}
        <div className="text-xs leading-relaxed text-stone-800 dark:text-stone-200 space-y-2">
          {segments.length > 0 ? (
            <p className="whitespace-pre-wrap">
              {segments.map((seg, idx) => {
                if (seg.type === "text") {
                  return <span key={idx}>{seg.text}</span>;
                } else if (seg.type === "quote") {
                  const qRecord = quoteMap.get(seg.localId);
                  const qStatus = qRecord ? qRecord.status : "pending";

                  return (
                    <span key={idx} className="inline">
                      <span className="font-serif italic bg-amber-500/10 px-1 py-0.5 rounded text-amber-950 dark:text-amber-100">
                        “{seg.text}”
                      </span>
                      <QuotePill
                        id={seg.localId}
                        status={qStatus}
                        onClick={() => {
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
                <span className="inline-block w-1.5 h-3.5 bg-indigo-600 ml-1 translate-y-0.5 animate-pulse" />
              )}
            </p>
          ) : (
            <p className="whitespace-pre-wrap text-stone-700">
              {message.content}
              {isStreaming && (
                <span className="inline-block w-1.5 h-3.5 bg-indigo-600 ml-1 translate-y-0.5 animate-pulse" />
              )}
            </p>
          )}
        </div>

        {/* Edge Case 22: Model returned zero quotes */}
        {!isStreaming && message.quotes && message.quotes.length === 0 && (
          <div className="mt-3 pt-2 text-[11px] text-stone-400 italic">
            Note: No supporting quotes were provided in this response.
          </div>
        )}

        {/* Quote Cards Section */}
        {message.quotes && message.quotes.length > 0 && (
          <div className="mt-5 pt-4 border-t border-stone-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                Supporting Citations ({message.quotes.length})
              </span>
              <span className="text-[10px] text-stone-400">
                Verified against canonical text
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {message.quotes.map((q) => (
                <QuoteCard
                  key={q.id || q.localId}
                  quote={q}
                  onOpenInViewer={onOpenQuoteInViewer}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
