"use client";

import React, { useState, useEffect, useRef } from "react";
import type { StoredMessage, StoredQuote, StoredChat } from "@/server/chat";
import { MessageBubble } from "./MessageBubble";

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

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
          // Load messages of latest thread
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

      // Mark the latest message as stopped
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
    setIsStreaming(true);

    const userTempId = `user-${Date.now()}`;
    const assistantTempId = `assistant-${Date.now()}`;

    // Optimistically append user message and placeholder assistant message
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
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          chatId: currentChatId || undefined,
          documentIds: selectedDocIds,
          question: textToSend,
          deepResearch,
        }),
      });

      if (!response.ok || !response.body) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const evtBlock of events) {
          if (!evtBlock.trim()) continue;
          const lines = evtBlock.split("\n");
          let eventName = "message";
          let dataStr = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventName = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              dataStr = line.slice(6).trim();
            }
          }

          if (!dataStr) continue;
          let parsed: any = null;
          try {
            parsed = JSON.parse(dataStr);
          } catch {
            continue;
          }

          if (eventName === "init") {
            setCurrentChatId(parsed.chatId);
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id === userTempId) return { ...m, id: parsed.userMessageId, chatId: parsed.chatId };
                if (m.id === assistantTempId) return { ...m, id: parsed.assistantMessageId, chatId: parsed.chatId, mode: parsed.mode };
                return m;
              })
            );
          } else if (eventName === "agent_trace") {
            setProgressText(`Agent [Round ${parsed.round}]: ${parsed.message}`);
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.role === "assistant") {
                const currentStats = (last.stats as any) || {};
                const currentTrace = Array.isArray(currentStats.trace) ? [...currentStats.trace] : [];
                const existIdx = currentTrace.findIndex((t: any) => t.id === parsed.id);
                if (existIdx >= 0) {
                  currentTrace[existIdx] = parsed;
                } else {
                  currentTrace.push(parsed);
                }
                next[next.length - 1] = {
                  ...last,
                  mode: "agent",
                  stats: { ...currentStats, trace: currentTrace },
                };
              }
              return next;
            });
          } else if (eventName === "progress") {
            setProgressText(parsed.step || `Analyzing (${parsed.percent}%)...`);
          } else if (eventName === "token") {
            setProgressText(null);
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.role === "assistant") {
                next[next.length - 1] = {
                  ...last,
                  content: last.content + (parsed.text || ""),
                };
              }
              return next;
            });
          } else if (eventName === "quote") {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.role === "assistant") {
                const existingQuoteIdx = last.quotes.findIndex(
                  (q) => q.localId === parsed.localId
                );
                const updatedQuote: StoredQuote = {
                  id: parsed.id,
                  messageId: last.id,
                  localId: parsed.localId,
                  documentId: parsed.documentId,
                  documentName: parsed.documentName,
                  text: parsed.text,
                  status: parsed.status,
                  reason: parsed.reason,
                  matches: parsed.matches,
                  createdAt: new Date(),
                };

                let newQuotes = [...last.quotes];
                if (existingQuoteIdx >= 0) {
                  newQuotes[existingQuoteIdx] = updatedQuote;
                } else {
                  newQuotes.push(updatedQuote);
                }

                next[next.length - 1] = {
                  ...last,
                  quotes: newQuotes,
                };
              }
              return next;
            });
          } else if (eventName === "coverage") {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.role === "assistant") {
                next[next.length - 1] = {
                  ...last,
                  coverage: parsed,
                };
              }
              return next;
            });
          } else if (eventName === "done") {
            setIsStreaming(false);
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.role === "assistant") {
                next[next.length - 1] = {
                  ...last,
                  content: parsed.content || last.content,
                  status: parsed.stopped ? "stopped" : "complete",
                };
              }
              return next;
            });
          } else if (eventName === "error") {
            setIsStreaming(false);
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.role === "assistant") {
                next[next.length - 1] = {
                  ...last,
                  status: "error",
                  content: `${last.content}\n\n[Error: ${parsed.message || "Failed to generate answer"}]`,
                };
              }
              return next;
            });
          }
        }
      }
    } catch (err: any) {
      if (!controller.signal.aborted) {
        setIsStreaming(false);
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = {
              ...last,
              status: "error",
              content: `${last.content}\n\n[Error: ${err.message || "Network error"}]`,
            };
          }
          return next;
        });
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  const hasDocsSelected = selectedDocIds.length > 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-stone-50/50 relative overflow-hidden">
      {/* 1. Header with scope indicator, history toggle, and actions */}
      <header className="h-14 border-b border-stone-200 px-6 flex items-center justify-between bg-white shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            Analysis Scope:
          </span>
          {hasDocsSelected ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200">
                {selectedDocIds.length} document{selectedDocIds.length > 1 ? "s" : ""} selected
              </span>
              {activeDocFilename && (
                <span className="text-xs font-medium text-stone-600 truncate max-w-xs">
                  ({activeDocFilename})
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-stone-400 italic">
              Select at least one document in the sidebar to chat
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Thread History Button */}
          {chatHistory.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowHistoryMenu((p) => !p)}
                className="text-xs font-medium text-stone-600 bg-stone-50 hover:bg-stone-100 px-2.5 py-1 rounded-md border border-stone-200 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>History ({chatHistory.length})</span>
              </button>

              {showHistoryMenu && (
                <div className="absolute right-0 top-9 w-64 bg-white rounded-xl shadow-lg border border-stone-200 py-1.5 z-50">
                  <div className="px-3 py-1.5 border-b border-stone-100 text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                    Past Conversations
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {chatHistory.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => loadPastChat(c)}
                        className={`w-full text-left px-3 py-2 text-xs truncate transition-colors cursor-pointer ${
                          c.id === currentChatId
                            ? "bg-indigo-50 text-indigo-900 font-semibold"
                            : "text-stone-700 hover:bg-stone-50"
                        }`}
                      >
                        {c.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* New Chat Button */}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={startNewChat}
              className="text-xs font-medium text-stone-600 bg-stone-50 hover:bg-stone-100 px-2.5 py-1 rounded-md border border-stone-200 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>New Chat</span>
            </button>
          )}

          <span className="text-[11px] text-emerald-800 font-medium bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            Strict Quote Verification
          </span>
        </div>
      </header>

      {/* 2. Messages Stream Container */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col justify-center items-center text-center max-w-lg mx-auto py-12">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 border border-indigo-100 shadow-xs">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>

            <h2 className="text-base font-bold text-stone-900 mb-1.5">
              Legal Contract Assistant
            </h2>
            <p className="text-xs text-stone-500 mb-6 leading-relaxed max-w-sm">
              Ask targeted questions about terms, liabilities, termination, or dispute clauses.
              Every assertion is verified with verbatim quotes.
            </p>

            {/* Suggested Starter Questions */}
            {hasDocsSelected ? (
              <div className="space-y-2 text-left w-full">
                <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">
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
                    className="w-full text-left p-3 rounded-xl border border-stone-200/80 bg-white hover:border-indigo-300 hover:bg-indigo-50/30 text-xs text-stone-700 font-medium transition-all flex items-center justify-between group shadow-2xs cursor-pointer"
                  >
                    <span className="truncate">{query}</span>
                    <svg className="w-3.5 h-3.5 text-stone-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-stone-300 bg-white text-xs text-stone-500">
                Select a document in the library sidebar to begin chatting.
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((m, idx) => {
              const isLastMessage = idx === messages.length - 1;
              return (
                <MessageBubble
                  key={m.id || idx}
                  message={m}
                  isStreaming={isStreaming && isLastMessage && m.role === "assistant"}
                  onOpenQuoteInViewer={onOpenQuoteInViewer}
                />
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 3. Composer Bar */}
      <div className="p-4 border-t border-stone-200 bg-white shrink-0">
        {progressText && (
          <div className="max-w-3xl mx-auto mb-2.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs flex items-center gap-2 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
            <span className="font-medium">{progressText}</span>
          </div>
        )}
        <div className="max-w-3xl mx-auto flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!hasDocsSelected || isStreaming}
              placeholder={
                hasDocsSelected
                  ? "Ask about contractual clauses, terms, or obligations (Shift+Enter for new line)..."
                  : "Select a document in the library to enable asking questions."
              }
              className="w-full bg-stone-50 border border-stone-300 rounded-xl px-4 py-2.5 text-xs text-stone-800 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white resize-none shadow-2xs disabled:bg-stone-100 disabled:cursor-not-allowed transition-all"
            />
          </div>

          {/* Action buttons: Stop (during streaming) or Send */}
          {isStreaming ? (
            <button
              type="button"
              onClick={handleStop}
              className="h-10 px-4 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!hasDocsSelected || !input.trim()}
              className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <span>Ask</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          )}
        </div>

        {/* Deep Research Toggle (Part C, C7, D-037) */}
        <div className="max-w-3xl mx-auto flex items-center justify-between pt-2 px-1">
          <label className="flex items-center gap-2 cursor-pointer text-xs select-none group">
            <input
              type="checkbox"
              checked={deepResearch}
              onChange={(e) => setDeepResearch(e.target.checked)}
              disabled={isStreaming}
              className="w-3.5 h-3.5 rounded text-indigo-600 border-stone-300 focus:ring-indigo-500 cursor-pointer"
            />
            <span className="font-semibold text-stone-700 group-hover:text-indigo-600 transition">
              ⚡ Deep Research Mode
            </span>
            <span className="text-[11px] text-stone-400 hidden sm:inline">
              (Multi-round autonomous research with tools: search_document, get_section, list_clauses)
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
