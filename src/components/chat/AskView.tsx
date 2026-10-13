"use client";

import React, { useState, useEffect, useRef } from "react";
import type { StoredMessage, StoredQuote, StoredChat } from "@/server/chat";
import type { DocumentRecord } from "@/lib/types";
import { AskExchange } from "./AskExchange";
import { ReadingDesk } from "../reading/ReadingDesk";
import { FileGlyph } from "../ui/FileGlyph";
import { Spine } from "../ui/Spine";
import {
  MessageSquare,
  Plus,
  Compass,
  ArrowUp,
  Square,
  Sparkles,
  Layers,
  ChevronRight,
  X,
  FilePlus,
} from "lucide-react";

interface AskViewProps {
  selectedDocIds: string[];
  documents: DocumentRecord[];
  onOpenLibrary: () => void;
  onUpdateSelectedDocs: (docIds: string[]) => void;
}

export function AskView({
  selectedDocIds,
  documents,
  onOpenLibrary,
  onUpdateSelectedDocs,
}: AskViewProps) {
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<StoredChat[]>([]);
  const [deepResearch, setDeepResearch] = useState(false);
  const [progressText, setProgressText] = useState<string | null>(null);

  // Reading desk state
  const [deskDocId, setDeskDocId] = useState<string | null>(null);
  const [activeQuoteCitation, setActiveQuoteCitation] = useState<{
    text: string;
    documentId?: string;
    quoteId?: string;
  } | null>(null);

  // Document picker dialog
  const [showDocPicker, setShowDocPicker] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Doc names map
  const docNamesMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const d of documents) {
      map[d.id] = d.filename;
    }
    return map;
  }, [documents]);

  const selectedDocs = React.useMemo(() => {
    return documents.filter((d) => selectedDocIds.includes(d.id));
  }, [documents, selectedDocIds]);

  // Load chat history when primary document changes
  useEffect(() => {
    if (selectedDocIds.length === 0) {
      setMessages([]);
      setCurrentChatId(null);
      setChatHistory([]);
      return;
    }

    const primaryDocId = selectedDocIds[0];
    fetch(`/api/chats?documentId=${primaryDocId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.chats && data.chats.length > 0) {
          setChatHistory(data.chats);
          const latest = data.chats[0];
          setCurrentChatId(latest.id);
          fetch(`/api/chats/${latest.id}/messages`)
            .then((res) => res.json())
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
          next[next.length - 1] = { ...last, status: "stopped" };
        }
        return next;
      });
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const q = (textToSend || input).trim();
    if (!q || isStreaming || selectedDocIds.length === 0) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setIsStreaming(true);
    setProgressText(null);

    const userTempId = `user-${Date.now()}`;
    const assistantTempId = `assistant-${Date.now()}`;

    const optimisticUser: StoredMessage = {
      id: userTempId,
      chatId: currentChatId || "",
      role: "user",
      content: q,
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
          question: q,
          enableAgent: deepResearch,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      if (!res.body) throw new Error("No response body received");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() || "";

        for (const block of blocks) {
          const blockTrimmed = block.trim();
          if (!blockTrimmed) continue;

          let eventName = "message";
          let dataStr = "";

          for (const rawLine of blockTrimmed.split("\n")) {
            const line = rawLine.trim();
            if (line.startsWith("event:")) {
              eventName = line.replace(/^event:\s*/, "").trim();
            } else if (line.startsWith("data:")) {
              dataStr = line.replace(/^data:\s*/, "").trim();
            }
          }

          if (!dataStr) continue;
          if (dataStr === "[DONE]") break;

          try {
            const ev = JSON.parse(dataStr);
            const eventType = ev.type || eventName;

            if (eventType === "init") {
              if (ev.chatId && !currentChatId) {
                setCurrentChatId(ev.chatId);
              }
            } else if (eventType === "progress") {
              setProgressText(ev.message || "Reading clauses...");
            } else if (eventType === "trace" || eventType === "agent_trace") {
              setProgressText(ev.step?.label || ev.label || "Researching...");
            } else if (eventType === "token") {
              const tokenText = ev.text ?? ev.token ?? "";
              if (tokenText) {
                setMessages((prev) => {
                  const next = [...prev];
                  const lastIdx = next.length - 1;
                  if (lastIdx >= 0 && next[lastIdx].role === "assistant") {
                    next[lastIdx] = {
                      ...next[lastIdx],
                      content: (next[lastIdx].content || "") + tokenText,
                    };
                  }
                  return next;
                });
              }
            } else if (eventType === "quote") {
              const quoteObj = ev.quote || ev;
              if (quoteObj && quoteObj.localId) {
                setMessages((prev) => {
                  const next = [...prev];
                  const lastIdx = next.length - 1;
                  if (lastIdx >= 0 && next[lastIdx].role === "assistant") {
                    const existingQuotes = next[lastIdx].quotes || [];
                    const qIdx = existingQuotes.findIndex(
                      (q) => q.localId === quoteObj.localId
                    );
                    if (qIdx >= 0) existingQuotes[qIdx] = quoteObj;
                    else existingQuotes.push(quoteObj);
                    next[lastIdx] = {
                      ...next[lastIdx],
                      quotes: [...existingQuotes],
                    };
                  }
                  return next;
                });
              }
            } else if (eventType === "coverage") {
              setMessages((prev) => {
                const next = [...prev];
                const lastIdx = next.length - 1;
                if (lastIdx >= 0 && next[lastIdx].role === "assistant") {
                  next[lastIdx] = { ...next[lastIdx], coverage: ev.coverage || ev };
                }
                return next;
              });
            } else if (eventType === "done" || eventType === "complete") {
              setProgressText(null);
              setMessages((prev) => {
                const next = [...prev];
                const lastIdx = next.length - 1;
                if (lastIdx >= 0 && next[lastIdx].role === "assistant") {
                  next[lastIdx] = {
                    ...next[lastIdx],
                    id: ev.messageId || next[lastIdx].id,
                    content: ev.content !== undefined ? ev.content : next[lastIdx].content,
                    mode: ev.mode || next[lastIdx].mode,
                    coverage: ev.coverage || next[lastIdx].coverage,
                    quotes: ev.quotes || next[lastIdx].quotes,
                    stats: ev.stats || next[lastIdx].stats,
                    status: ev.stopped ? "stopped" : "complete",
                  };
                }
                return next;
              });
            } else if (eventType === "error") {
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
            // ignore
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

  const handleOpenQuoteInDesk = (quote: StoredQuote) => {
    setDeskDocId(quote.documentId || selectedDocIds[0]);
    setActiveQuoteCitation({
      text: quote.text,
      documentId: quote.documentId,
      quoteId: quote.id,
    });
  };

  // Group messages into exchanges (user question -> assistant answer)
  const exchanges: Array<{
    id: string;
    question: string;
    answerMessage: StoredMessage;
  }> = [];

  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === "user") {
      const q = messages[i].content;
      const nextMsg = messages[i + 1];
      if (nextMsg && nextMsg.role === "assistant") {
        exchanges.push({
          id: nextMsg.id || `exch-${i}`,
          question: q,
          answerMessage: nextMsg,
        });
        i++; // skip assistant
      }
    }
  }

  const isDeskOpen = !!deskDocId;

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-white select-none relative font-sans">
      {/* 1. Chats Rail (232px, groups conversations by day) */}
      <aside
        aria-label="Past conversations rail"
        className={`bg-[#F7F7FC] border-r border-[#E3E1EF] flex flex-col shrink-0 transition-all duration-200 ${
          isDeskOpen ? "w-14 items-center p-2" : "w-[232px] p-3"
        }`}
      >
        <button
          type="button"
          onClick={startNewChat}
          className={`rounded-[10px] bg-white border border-[#E3E1EF] hover:border-[#17142B] text-[13px] font-semibold text-[#17142B] transition-colors cursor-pointer shadow-2xs flex items-center justify-center gap-1.5 ${
            isDeskOpen ? "w-10 h-10 p-0" : "w-full py-2 px-3 mb-3"
          }`}
          title="New conversation"
        >
          <Plus className="w-4 h-4 text-[#4B3FD6]" />
          {!isDeskOpen && <span>New chat</span>}
        </button>

        {!isDeskOpen && (
          <div className="flex-1 overflow-y-auto space-y-1">
            <div className="text-[11px] font-semibold text-[#6E6B87] uppercase tracking-wider px-2 py-1">
              Conversations
            </div>
            {chatHistory.length === 0 ? (
              <p className="text-[12px] text-[#6E6B87] px-2 py-4 italic">No past threads</p>
            ) : (
              chatHistory.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => loadPastChat(c)}
                  className={`w-full text-left px-2.5 py-2 rounded-[8px] text-[12.5px] truncate transition-colors cursor-pointer ${
                    c.id === currentChatId
                      ? "bg-[#E8E6FB] text-[#4B3FD6] font-semibold"
                      : "text-[#3B3855] hover:bg-white"
                  }`}
                  title={c.title}
                >
                  {c.title || "Contract analysis"}
                </button>
              ))
            )}
          </div>
        )}
      </aside>

      {/* 2. Main Ask Reading Workspace */}
      <main
        className={`flex-1 flex flex-col h-full overflow-hidden transition-all duration-200 ${
          isDeskOpen ? "max-w-[480px]" : "flex-1"
        }`}
      >
        {/* Context bar (Section 6.2) */}
        <div className="h-14 px-6 border-b border-[#E3E1EF] bg-white flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {selectedDocs.length === 0 ? (
              <span className="text-[13.5px] text-[#6E6B87]">No document chosen</span>
            ) : (
              selectedDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[#F7F7FC] border border-[#E3E1EF] text-[12.5px] font-medium text-[#17142B] max-w-[200px]"
                >
                  <FileGlyph filename={doc.filename} mime={doc.mime} />
                  <span className="truncate">{doc.filename}</span>
                  {selectedDocs.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSelectedDocs(selectedDocIds.filter((id) => id !== doc.id))
                      }
                      className="p-0.5 hover:bg-[#E3E1EF] rounded-[4px] text-[#6E6B87]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))
            )}

            <button
              type="button"
              onClick={() => setShowDocPicker(true)}
              className="text-[12.5px] font-medium text-[#4B3FD6] hover:underline px-1.5 py-1 cursor-pointer"
            >
              + Add document
            </button>
          </div>

          {/* Mode tag */}
          <div className="text-[12px] text-[#6E6B87] font-medium hidden sm:block">
            {selectedDocs.length > 1
              ? "Comparative analysis"
              : selectedDocs.length === 1
              ? "Read in full"
              : "Select document"}
          </div>
        </div>

        {/* Exchanges Reading Flow */}
        <div className="flex-1 overflow-y-auto px-8 py-4 select-text">
          {selectedDocs.length === 0 ? (
            <div className="py-20 text-center max-w-md mx-auto">
              <h3 className="text-[18px] font-semibold text-[#17142B] mb-2">
                Choose a document to begin
              </h3>
              <p className="text-[13px] text-[#6E6B87] mb-4">
                Select a contract from your library to analyze clauses and inspect citations.
              </p>
              <button
                type="button"
                onClick={onOpenLibrary}
                className="px-4 py-2 rounded-[10px] bg-[#17142B] text-white text-[13px] font-medium hover:bg-[#3B3855] transition-colors cursor-pointer"
              >
                Go to Library
              </button>
            </div>
          ) : exchanges.length === 0 ? (
            /* Section 6.2 Empty Chat State */
            <div className="py-12 max-w-xl mx-auto text-left">
              <div className="mb-6">
                <h1 className="text-[26px] font-semibold text-[#17142B] tracking-tight leading-snug mb-1">
                  {selectedDocs[0].filename}
                </h1>
                <p className="text-[14px] text-[#6E6B87]">
                  Ask questions to inspect liability caps, payments, and governing law with verified citations.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-[12px] font-semibold text-[#6E6B87] uppercase tracking-wider mb-2">
                  Suggested Questions:
                </p>
                {[
                  "Summarise the key obligations",
                  "Is there a termination for convenience clause?",
                  "What are the payment terms and late interest rates?",
                  "What is the liability cap or aggregate damage limit?",
                ].map((qText, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSendMessage(qText)}
                    className="w-full text-left p-3.5 rounded-[12px] border border-[#E3E1EF] bg-white hover:border-[#4B3FD6] hover:bg-[#E8E6FB]/20 text-[14px] text-[#17142B] font-medium transition-all flex items-center justify-between group cursor-pointer shadow-2xs"
                  >
                    <span>{qText}</span>
                    <ArrowUp className="w-3.5 h-3.5 text-[#6E6B87] group-hover:text-[#4B3FD6] rotate-45 transition-transform" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto">
              {exchanges.map((exch, idx) => (
                <AskExchange
                  key={exch.id}
                  question={exch.question}
                  answerMessage={exch.answerMessage}
                  isStreaming={isStreaming && idx === exchanges.length - 1}
                  documentNames={docNamesMap}
                  onOpenQuoteInViewer={handleOpenQuoteInDesk}
                  showMargin={!isDeskOpen}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Floating Composer (Section 6.2) */}
        {selectedDocs.length > 0 && (
          <div className="p-4 bg-gradient-to-t from-white via-white to-transparent shrink-0">
            <div className="max-w-3xl mx-auto bg-white rounded-[16px] border border-[#E3E1EF] p-2.5 shadow-[0_1px_2px_rgba(23,20,43,0.06),0_10px_28px_-6px_rgba(23,20,43,0.16)] flex flex-col gap-2">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSendMessage();
                  }
                }}
                placeholder="Ask about clauses, terms, obligations (Shift+Enter for newline)..."
                className="w-full px-2 py-1 text-[14.5px] text-[#17142B] placeholder-[#6E6B87] focus:outline-none resize-none font-sans"
              />

              <div className="flex items-center justify-between pt-1 border-t border-[#F1F0F8]">
                {/* Deep research switch */}
                <button
                  type="button"
                  onClick={() => setDeepResearch((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-[12px] font-medium transition-colors cursor-pointer ${
                    deepResearch
                      ? "bg-[#E8E6FB] text-[#4B3FD6] border border-[#4B3FD6]/30"
                      : "text-[#5A5775] hover:text-[#17142B] border border-transparent"
                  }`}
                  title="Enable autonomous tool-calling research agent"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Deep research</span>
                </button>

                {/* Send / Stop Button */}
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="inline-flex items-center gap-1 px-4 py-1.5 rounded-[10px] bg-white border border-[#17142B] text-[#17142B] hover:bg-[#F1F0F8] text-[13px] font-semibold cursor-pointer shadow-xs"
                  >
                    <Square className="w-3 h-3 fill-[#17142B]" />
                    <span>Stop</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={!input.trim()}
                    className="inline-flex items-center gap-1 px-4 py-1.5 rounded-[10px] bg-[#17142B] hover:bg-[#3B3855] text-white text-[13px] font-semibold transition-colors disabled:opacity-40 cursor-pointer shadow-xs"
                  >
                    <span>Ask</span>
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 3. Reading Desk: Document Viewer (Mounted only when open, Section 6.3) */}
      {isDeskOpen && deskDocId && (
        <ReadingDesk
          documentId={deskDocId}
          activeQuote={activeQuoteCitation}
          onClose={() => {
            setDeskDocId(null);
            setActiveQuoteCitation(null);
          }}
          onClearActiveQuote={() => setActiveQuoteCitation(null)}
        />
      )}

      {/* Document Picker Modal (Section 6.6) */}
      {showDocPicker && (
        <div className="fixed inset-0 z-50 bg-[#17142B]/40 backdrop-blur-xs flex items-center justify-center p-4 select-none">
          <div className="bg-white rounded-[18px] border border-[#E3E1EF] shadow-[0_10px_28px_-6px_rgba(23,20,43,0.16)] max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-[#E3E1EF]">
              <h3 className="font-semibold text-[16px] text-[#17142B]">
                Choose Documents
              </h3>
              <button
                type="button"
                onClick={() => setShowDocPicker(false)}
                className="p-1 rounded-[6px] text-[#6E6B87] hover:text-[#17142B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2">
              {documents.map((d) => {
                const isSelected = selectedDocIds.includes(d.id);
                return (
                  <div
                    key={d.id}
                    onClick={() => {
                      if (isSelected) {
                        onUpdateSelectedDocs(selectedDocIds.filter((id) => id !== d.id));
                      } else {
                        onUpdateSelectedDocs([...selectedDocIds, d.id]);
                      }
                    }}
                    className={`p-3 rounded-[10px] border transition-colors cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "bg-[#E8E6FB] border-[#4B3FD6]"
                        : "bg-[#F7F7FC] border-[#E3E1EF] hover:border-[#CFCCE0]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileGlyph filename={d.filename} mime={d.mime} />
                      <div className="min-w-0">
                        <span className="text-[13px] font-semibold text-[#17142B] block truncate">
                          {d.filename}
                        </span>
                        {d.pageCount && (
                          <span className="text-[11.5px] text-[#6E6B87]">
                            {d.pageCount} pages
                          </span>
                        )}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="rounded-[4px] border-[#CFCCE0] text-[#4B3FD6] cursor-pointer"
                    />
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDocPicker(false)}
                className="px-4 py-1.5 rounded-[10px] bg-[#17142B] text-white text-[13px] font-semibold hover:bg-[#3B3855] transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
