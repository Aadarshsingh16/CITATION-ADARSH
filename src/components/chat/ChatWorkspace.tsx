"use client";

import React, { useState, useEffect, useRef } from "react";
import type { StoredMessage, StoredQuote, StoredChat } from "@/server/chat";
import { MessageBubble } from "./MessageBubble";
import {
  Square,
  ArrowUp,
  History,
  Plus,
  Compass,
  FileText,
  ChevronDown,
  Sparkles,
} from "lucide-react";

export interface ChatWorkspaceProps {
  selectedDocIds: string[];
  activeDocFilename?: string;
  onOpenQuoteInViewer?: (quote: StoredQuote) => void;
}

export function ChatWorkspace({
  selectedDocIds,
  activeDocFilename,
  onOpenQuoteInViewer,
}: ChatWorkspaceProps) {
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<StoredChat[]>([]);
  const [showHistoryMenu, setShowHistoryMenu] = useState(false);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [deepResearch, setDeepResearch] = useState(false);
  const [docNamesMap, setDocNamesMap] = useState<Record<string, string>>({});

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Fetch document names map for multi-doc labels
  useEffect(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then((d) => {
        if (d.documents) {
          const m: Record<string, string> = {};
          for (const doc of d.documents) {
            m[doc.id] = doc.filename;
          }
          setDocNamesMap(m);
        }
      })
      .catch(console.error);
  }, [selectedDocIds]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  // Load chat threads when selected documents change
  useEffect(() => {
    if (selectedDocIds.length === 0) {
      setMessages([]);
      setCurrentChatId(null);
      setChatHistory([]);
      return;
    }

    const primaryDocId = selectedDocIds[0];
    fetch(`/api/chats?documentId=${primaryDocId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.chats && data.chats.length > 0) {
          setChatHistory(data.chats);
          const latest = data.chats[0];
          setCurrentChatId(latest.id);
          fetch(`/api/chats/${latest.id}/messages`)
            .then((r) => r.json())
            .then((mRes) => {
              if (mRes.messages) setMessages(mRes.messages);
            })
            .catch(console.error);
        } else {
          setChatHistory([]);
          setCurrentChatId(null);
          setMessages([]);
        }
      })
      .catch(console.error);
  }, [selectedDocIds]);

  const loadPastChat = (chat: StoredChat) => {
    setCurrentChatId(chat.id);
    setShowHistoryMenu(false);
    fetch(`/api/chats/${chat.id}/messages`)
      .then((r) => r.json())
      .then((mRes) => {
        if (mRes.messages) setMessages(mRes.messages);
      })
      .catch(console.error);
  };

  const startNewChat = () => {
    setCurrentChatId(null);
    setMessages([]);
    setShowHistoryMenu(false);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
      setProgressText(null);

      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === "assistant") {
          next[next.length - 1] = {
            ...last,
            status: "stopped",
          };
        }
        return next;
      });
    }
  };

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = (queryText || input).trim();
    if (!textToSend || isStreaming || selectedDocIds.length === 0) return;

    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setIsStreaming(true);
    setProgressText(null);

    const userTempId = `user-${Date.now()}`;
    const assistantTempId = `assistant-${Date.now()}`;

    const optimisticUser: StoredMessage = {
      id: userTempId,
      chatId: currentChatId || "",
      role: "user",
      content: textToSend,
      status: "complete",
      quotes: [],
      createdAt: new Date(),
    };

    const optimisticAssistant: StoredMessage = {
      id: assistantTempId,
      chatId: currentChatId || "",
      role: "assistant",
      content: "",
      status: "complete",
      quotes: [],
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, optimisticUser, optimisticAssistant]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: currentChatId,
          documentIds: selectedDocIds,
          question: textToSend,
          enableAgent: deepResearch,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      if (!res.body) {
        throw new Error("No response body received");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const block of lines) {
          const trimmed = block.trim();
          if (!trimmed.startsWith("data:")) continue;
          const jsonStr = trimmed.replace(/^data:\s*/, "");
          if (jsonStr === "[DONE]") break;

          try {
            const ev = JSON.parse(jsonStr);

            if (ev.type === "init") {
              if (ev.chatId && !currentChatId) {
                setCurrentChatId(ev.chatId);
              }
            } else if (ev.type === "progress") {
              setProgressText(ev.message || "Analyzing clauses...");
            } else if (ev.type === "trace") {
              setProgressText(ev.step?.label || "Researching...");
            } else if (ev.type === "token") {
              setMessages((prev) => {
                const next = [...prev];
                const lastIdx = next.length - 1;
                if (lastIdx >= 0 && next[lastIdx].role === "assistant") {
                  next[lastIdx] = {
                    ...next[lastIdx],
                    content: (next[lastIdx].content || "") + (ev.token || ""),
                  };
                }
                return next;
              });
            } else if (ev.type === "quote") {
              setMessages((prev) => {
                const next = [...prev];
                const lastIdx = next.length - 1;
                if (lastIdx >= 0 && next[lastIdx].role === "assistant") {
                  const existingQuotes = next[lastIdx].quotes || [];
                  const quoteIdx = existingQuotes.findIndex(
                    (q) => q.localId === ev.quote.localId
                  );
                  if (quoteIdx >= 0) {
                    existingQuotes[quoteIdx] = ev.quote;
                  } else {
                    existingQuotes.push(ev.quote);
                  }
                  next[lastIdx] = {
                    ...next[lastIdx],
                    quotes: [...existingQuotes],
                  };
                }
                return next;
              });
            } else if (ev.type === "complete") {
              setProgressText(null);
              setMessages((prev) => {
                const next = [...prev];
                const lastIdx = next.length - 1;
                if (lastIdx >= 0 && next[lastIdx].role === "assistant") {
                  next[lastIdx] = {
                    ...next[lastIdx],
                    id: ev.messageId || next[lastIdx].id,
                    mode: ev.mode,
                    coverage: ev.coverage,
                    quotes: ev.quotes || next[lastIdx].quotes,
                    stats: ev.stats,
                    status: "complete",
                  };
                }
                return next;
              });
            } else if (ev.type === "error") {
              setProgressText(null);
              setMessages((prev) => {
                const next = [...prev];
                const lastIdx = next.length - 1;
                if (lastIdx >= 0 && next[lastIdx].role === "assistant") {
                  next[lastIdx] = {
                    ...next[lastIdx],
                    content:
                      next[lastIdx].content +
                      `\n\n[Error: ${ev.message || "Request failed"}]`,
                    status: "error",
                  };
                }
                return next;
              });
            }
          } catch {
            // ignore malformed SSE block
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        setMessages((prev) => {
          const next = [...prev];
          const lastIdx = next.length - 1;
          if (lastIdx >= 0 && next[lastIdx].role === "assistant") {
            next[lastIdx] = {
              ...next[lastIdx],
              content:
                next[lastIdx].content +
                `\n\n[Failed to complete request: ${(err as Error)?.message || String(err)}]`,
              status: "error",
            };
          }
          return next;
        });
      }
    } finally {
      setIsStreaming(false);
      setProgressText(null);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
  };

  const hasDocsSelected = selectedDocIds.length > 0;
  const headerTitle =
    selectedDocIds.length > 1
      ? `${selectedDocIds.length} documents`
      : selectedDocIds.length === 1
      ? docNamesMap[selectedDocIds[0]] || activeDocFilename || "Selected Document"
      : "No document selected";

  return (
    <div className="flex flex-col h-full bg-white font-sans select-none overflow-hidden">
      {/* 1. Header (Section 6.5) */}
      <div className="px-5 py-3 border-b border-[#E5E7EB] bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-[8px] bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-[#111827] truncate" title={headerTitle}>
              {headerTitle}
            </h2>
            <div className="text-[11.5px] text-[#6B7280]">
              {selectedDocIds.length > 1
                ? "Cross-contract synthesis and quote attribution"
                : "Strict quote verification and absence honesty"}
            </div>
          </div>
        </div>

        {/* Chat History & New Thread */}
        <div className="flex items-center gap-2">
          {chatHistory.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowHistoryMenu(!showHistoryMenu)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#F9FAFB] hover:bg-[#F3F4F6] border border-[#E5E7EB] text-[12.5px] font-medium text-[#4B5563] transition-colors cursor-pointer"
              >
                <History className="w-3.5 h-3.5 text-[#6B7280]" />
                <span>History</span>
                <ChevronDown className="w-3 h-3 text-[#9CA3AF]" />
              </button>

              {showHistoryMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_8px_24px_rgba(17,24,39,0.12)] p-1 z-30">
                  <div className="p-1.5 text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider">
                    Past Conversations
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-0.5">
                    {chatHistory.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => loadPastChat(c)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-[6px] text-[12px] truncate transition-colors cursor-pointer ${
                          c.id === currentChatId
                            ? "bg-[#EFF6FF] text-[#2563EB] font-medium"
                            : "hover:bg-[#F9FAFB] text-[#374151]"
                        }`}
                      >
                        {c.title || "Contract analysis thread"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={startNewChat}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[8px] bg-white hover:bg-[#F9FAFB] border border-[#D1D5DB] text-[12.5px] font-medium text-[#111827] transition-colors cursor-pointer shadow-xs focus:ring-2 focus:ring-[#2563EB]"
          >
            <Plus className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>New chat</span>
          </button>
        </div>
      </div>

      {/* 2. Message List */}
      <div className="flex-1 overflow-y-auto p-5 select-text">
        {messages.length === 0 ? (
          <div className="max-w-[560px] mx-auto py-12 text-center">
            <div className="w-10 h-10 rounded-full bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center mx-auto mb-3">
              <Compass className="w-5 h-5" />
            </div>
            <h3 className="text-[17px] font-semibold text-[#111827] mb-1.5">
              Verified Legal Contract Analysis
            </h3>
            <p className="text-[13px] text-[#6B7280] mb-6 leading-relaxed">
              Ask questions about clauses, payment schedules, liabilities, or governance.
              Every assertion is verified against canonical text with interactive quote chips.
            </p>

            {/* Suggested Starter Questions (Section 6.6) */}
            {hasDocsSelected ? (
              <div className="space-y-2 text-left">
                <p className="text-[11.5px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-2">
                  Suggested Questions:
                </p>
                {[
                  "What are the termination provisions and notice periods?",
                  "What are the payment terms, due dates, and late interest rates?",
                  "What is the governing law and dispute resolution jurisdiction?",
                  "Is there a limitation of liability or aggregate damage cap?",
                ].map((query, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSendMessage(query)}
                    className="w-full text-left p-3 rounded-[10px] border border-[#E5E7EB] bg-white hover:border-[#BFDBFE] hover:bg-[#EFF6FF]/40 text-[13px] text-[#374151] font-medium transition-all flex items-center justify-between group cursor-pointer shadow-xs"
                  >
                    <span className="truncate">{query}</span>
                    <ArrowUp className="w-3.5 h-3.5 text-[#9CA3AF] group-hover:text-[#2563EB] group-hover:translate-x-0.5 transition-all shrink-0 ml-2 rotate-45" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-[12px] border border-dashed border-[#D1D5DB] bg-[#F9FAFB] text-[13px] text-[#6B7280]">
                Select a document in the library panel to begin analyzing.
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-[720px] mx-auto space-y-4">
            {messages.map((m, idx) => {
              const isLastMessage = idx === messages.length - 1;
              return (
                <MessageBubble
                  key={m.id || idx}
                  message={m}
                  isStreaming={isStreaming && isLastMessage && m.role === "assistant"}
                  onOpenQuoteInViewer={onOpenQuoteInViewer}
                  documentNames={docNamesMap}
                />
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 3. Composer Bar (Section 6.6) */}
      <div className="p-4 border-t border-[#E5E7EB] bg-white shrink-0">
        {progressText && (
          <div className="max-w-[720px] mx-auto mb-2.5 px-3 py-1.5 rounded-[8px] bg-[#EFF6FF] border border-[#BFDBFE] text-[#1D4ED8] text-[12px] flex items-center gap-2 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-[#2563EB] animate-ping" />
            <span className="font-medium">{progressText}</span>
          </div>
        )}

        {/* Selected Documents Context Chips */}
        {selectedDocIds.length > 1 && (
          <div className="max-w-[720px] mx-auto mb-2 flex flex-wrap gap-1.5">
            {selectedDocIds.map((id, i) => (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-[#F3F4F6] border border-[#E5E7EB] text-[11.5px] text-[#374151]"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
                <span className="truncate max-w-[160px]">{docNamesMap[id] || `Doc ${i + 1}`}</span>
              </span>
            ))}
          </div>
        )}

        <div className="max-w-[720px] mx-auto flex items-end gap-2.5">
          {/* Rounded 12px input with auto-grow up to 6 lines */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              rows={2}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              disabled={!hasDocsSelected || isStreaming}
              placeholder={
                hasDocsSelected
                  ? "Ask about contractual clauses, terms, or obligations (Shift+Enter for newline)..."
                  : "Select a document in the library to enable asking questions."
              }
              className="w-full bg-[#F9FAFB] border border-[#D1D5DB] rounded-[12px] px-3.5 py-2.5 text-[13.5px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white resize-none shadow-xs disabled:bg-[#F3F4F6] disabled:cursor-not-allowed transition-all leading-normal"
            />
          </div>

          {/* Deep research toggle chip (Section 6.6) */}
          <label
            className={`flex items-center gap-1.5 h-10 px-3 rounded-[8px] border text-[12px] font-medium transition-colors cursor-pointer select-none shrink-0 ${
              deepResearch
                ? "bg-[#EFF6FF] border-[#2563EB] text-[#2563EB]"
                : "bg-white border-[#D1D5DB] text-[#4B5563] hover:bg-[#F9FAFB]"
            }`}
            title="Lets the assistant look things up step by step (Part C)"
          >
            <input
              type="checkbox"
              checked={deepResearch}
              onChange={(e) => setDeepResearch(e.target.checked)}
              disabled={isStreaming}
              className="hidden"
            />
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Deep research</span>
          </label>

          {/* Send (primary) or Stop button (Section 6.6) */}
          {isStreaming ? (
            <button
              type="button"
              onClick={handleStop}
              className="h-10 px-4 rounded-[8px] bg-white border border-[#D1D5DB] hover:bg-[#F9FAFB] text-[#111827] text-[13px] font-medium flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
              title="Stop response"
            >
              <Square className="w-3.5 h-3.5 text-[#B91C1C] fill-[#B91C1C]" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!hasDocsSelected || !input.trim()}
              className="h-10 px-4 rounded-[8px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[13px] font-medium flex items-center gap-1.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-1"
            >
              <span>Ask</span>
              <ArrowUp className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
