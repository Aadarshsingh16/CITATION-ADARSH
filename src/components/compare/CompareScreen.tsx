"use client";

import React, { useState, useEffect } from "react";
import type { DocumentRecord } from "@/lib/types";
import type { ComparisonResult, ClauseComparison, SignificanceLevel } from "@/lib/compare/types";
import { FileGlyph } from "../ui/FileGlyph";
import { Spine, type SpineTick } from "../ui/Spine";
import {
  ArrowRightLeft,
  Search,
  Scale,
  Banknote,
  LogOut,
  CalendarClock,
  Layers,
  Lock,
  Landmark,
  ListChecks,
  BookOpen,
  CircleEllipsis,
  Loader2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  GitCompare,
} from "lucide-react";

interface CompareScreenProps {
  documents: DocumentRecord[];
  initialDocAId?: string;
  initialDocBId?: string;
}

function getCategoryIcon(title?: string) {
  const cat = (title || "").toLowerCase();
  if (cat.includes("liab") || cat.includes("indemn")) return <Scale className="w-3.5 h-3.5 text-[#B4440A]" />;
  if (cat.includes("pay") || cat.includes("fee") || cat.includes("invoic")) return <Banknote className="w-3.5 h-3.5 text-[#0B7A5F]" />;
  if (cat.includes("terminat")) return <LogOut className="w-3.5 h-3.5 text-[#B5224E]" />;
  if (cat.includes("term") || cat.includes("renew")) return <CalendarClock className="w-3.5 h-3.5 text-[#4B3FD6]" />;
  if (cat.includes("scope") || cat.includes("service")) return <Layers className="w-3.5 h-3.5 text-[#5A5775]" />;
  if (cat.includes("confid") || cat.includes("ip")) return <Lock className="w-3.5 h-3.5 text-[#2A5C9A]" />;
  if (cat.includes("law") || cat.includes("jurisdict") || cat.includes("govern")) return <Landmark className="w-3.5 h-3.5 text-[#2A5C9A]" />;
  return <CircleEllipsis className="w-3.5 h-3.5 text-[#6E6B87]" />;
}

interface DiffPart {
  type: "equal" | "delete" | "insert";
  value: string;
}

function computeWordDiff(textA: string, textB: string): DiffPart[] {
  if (!textA && textB) return [{ type: "insert", value: textB }];
  if (textA && !textB) return [{ type: "delete", value: textA }];
  if (!textA && !textB) return [];
  if (textA === textB) return [{ type: "equal", value: textA }];

  const tokensA = textA.match(/\S+|\s+/g) || [];
  const tokensB = textB.match(/\S+|\s+/g) || [];

  const m = tokensA.length;
  const n = tokensB.length;
  if (m * n > 250000) {
    return [
      { type: "delete", value: textA },
      { type: "insert", value: textB },
    ];
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (tokensA[i] === tokensB[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const diff: DiffPart[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && tokensA[i - 1] === tokensB[j - 1]) {
      diff.unshift({ type: "equal", value: tokensA[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ type: "insert", value: tokensB[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      diff.unshift({ type: "delete", value: tokensA[i - 1] });
      i--;
    }
  }

  const combined: DiffPart[] = [];
  for (const item of diff) {
    const prev = combined[combined.length - 1];
    if (prev && prev.type === item.type) {
      prev.value += item.value;
    } else {
      combined.push({ ...item });
    }
  }
  return combined;
}

function DiffText({
  textA,
  textB,
  mode,
}: {
  textA: string;
  textB: string;
  mode: "inline" | "earlier" | "amended";
}) {
  const diff = React.useMemo(() => computeWordDiff(textA, textB), [textA, textB]);

  if (diff.length === 0) return null;

  if (mode === "earlier") {
    return (
      <span>
        {diff.map((part, idx) => {
          if (part.type === "insert") return null;
          if (part.type === "delete") {
            return (
              <span
                key={idx}
                className="line-through text-[#B5224E] bg-[#FCE3EA] px-0.5 rounded-[2px] font-medium"
                title="Removed in amended version"
              >
                {part.value}
              </span>
            );
          }
          return <span key={idx}>{part.value}</span>;
        })}
      </span>
    );
  }

  if (mode === "amended") {
    return (
      <span>
        {diff.map((part, idx) => {
          if (part.type === "delete") return null;
          if (part.type === "insert") {
            return (
              <span
                key={idx}
                className="underline decoration-2 text-[#0B7A5F] bg-[#DDF3EA] px-0.5 rounded-[2px] font-semibold"
                title="Added in amended version"
              >
                {part.value}
              </span>
            );
          }
          return <span key={idx}>{part.value}</span>;
        })}
      </span>
    );
  }

  // Inline unified diff
  return (
    <span>
      {diff.map((part, idx) => {
        if (part.type === "delete") {
          return (
            <span
              key={idx}
              className="line-through text-[#B5224E] bg-[#FCE3EA] px-0.5 rounded-[2px] font-medium mr-0.5"
              title="Removed"
            >
              {part.value}
            </span>
          );
        }
        if (part.type === "insert") {
          return (
            <span
              key={idx}
              className="underline decoration-2 text-[#0B7A5F] bg-[#DDF3EA] px-0.5 rounded-[2px] font-semibold mr-0.5"
              title="Added"
            >
              {part.value}
            </span>
          );
        }
        return <span key={idx}>{part.value}</span>;
      })}
    </span>
  );
}

export function CompareScreen({
  documents,
  initialDocAId,
  initialDocBId,
}: CompareScreenProps) {
  const [docAId, setDocAId] = useState<string>(initialDocAId || (documents[0]?.id ?? ""));
  const [docBId, setDocBId] = useState<string>(initialDocBId || (documents[1]?.id ?? ""));

  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<SignificanceLevel | "all">("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"order" | "significance">("order");
  const [viewMode, setViewMode] = useState<"side_by_side" | "inline">("side_by_side");

  const runComparison = async (idA: string, idB: string) => {
    if (!idA || !idB || idA === idB) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docAId: idA, docBId: idB }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setResult(data.comparison);
      if (data.comparison?.comparisons?.[0]?.id) {
        setActiveId(data.comparison.comparisons[0].id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialDocAId && initialDocBId && initialDocAId !== initialDocBId) {
      void runComparison(initialDocAId, initialDocBId);
    }
  }, [initialDocAId, initialDocBId]);

  const handleSwap = () => {
    const temp = docAId;
    setDocAId(docBId);
    setDocBId(temp);
  };

  const sortedComparisons = React.useMemo(() => {
    const list = [...(result?.comparisons || [])];
    if (sortBy === "significance") {
      const order: Record<SignificanceLevel, number> = {
        high: 0,
        medium: 1,
        low: 2,
        cosmetic: 3,
      };
      list.sort((a, b) => order[a.significance] - order[b.significance]);
    }
    return list;
  }, [result, sortBy]);

  const filtered = sortedComparisons.filter((c) => {
    if (filter !== "all" && c.significance !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        (c.clauseA?.text || "").toLowerCase().includes(q) ||
        (c.clauseB?.text || "").toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeComparison: ClauseComparison | undefined =
    filtered.find((c) => c.id === activeId) || filtered[0];

  const headlineSummary = React.useMemo(() => {
    if (!result) return "";
    const total = result.comparisons.length;
    if (total === 0) return "No differences were detected between the two contract versions.";
    const high = result.stats.high;
    const med = result.stats.medium;
    const highItems = result.comparisons
      .filter((c) => c.significance === "high")
      .map((c) => c.clauseB?.title || c.clauseA?.title || c.summary.slice(0, 35))
      .filter(Boolean);
    const highlightText =
      highItems.length > 0 ? ` Key substantive revisions affect ${highItems.slice(0, 3).join(", ")}.` : "";
    return `Comparison between ${result.docA.title} and ${result.docB.title} identified ${total} clause differences, including ${high} high-significance and ${med} medium-significance revisions.${highlightText}`;
  }, [result]);

  // Build change map Spine ticks
  const spineTicks: SpineTick[] = (result?.comparisons || []).map((c, i) => {
    const total = result!.comparisons.length || 1;
    const pos = i / total;
    let color = "#6E6B87";
    if (c.significance === "high") color = "#B4440A";
    else if (c.significance === "medium") color = "#8A6A00";
    else if (c.significance === "low") color = "#2A5C9A";

    return {
      id: c.id,
      position: pos,
      color,
      label: `${c.significance.toUpperCase()}: ${c.clauseB?.number || c.clauseA?.number || `Item ${i + 1}`}`,
      tooltip: `${c.significance.toUpperCase()}: ${c.summary.slice(0, 45)}...`,
    };
  });

  return (
    <div className="flex-1 h-full overflow-hidden flex flex-col bg-[#F1F0F8] font-sans">
      {/* 1. Fixed Top Controls Header (Version slots, timeline map, and filters) */}
      <div className="bg-white border-b border-[#E3E1EF] px-6 py-3 shrink-0 space-y-2.5 shadow-2xs z-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Version Selection Row */}
          <div className="flex items-center gap-2 flex-1 max-w-3xl">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10.5px] font-bold text-[#6E6B87] uppercase tracking-wider block mb-0.5">
                Earlier Version
              </label>
              <select
                value={docAId}
                onChange={(e) => setDocAId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-[8px] bg-[#F7F7FC] border border-[#E3E1EF] text-[13px] text-[#17142B] font-medium focus:ring-2 focus:ring-[#4B3FD6] cursor-pointer"
              >
                <option value="">Select contract...</option>
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.filename}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleSwap}
              className="p-1.5 mt-3.5 rounded-[8px] bg-white border border-[#E3E1EF] hover:border-[#17142B] text-[#5A5775] hover:text-[#17142B] transition-colors cursor-pointer shadow-2xs shrink-0"
              title="Swap versions"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>

            <div className="flex-1 min-w-[200px]">
              <label className="text-[10.5px] font-bold text-[#6E6B87] uppercase tracking-wider block mb-0.5">
                Amended Version
              </label>
              <select
                value={docBId}
                onChange={(e) => setDocBId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-[8px] bg-[#F7F7FC] border border-[#E3E1EF] text-[13px] text-[#17142B] font-medium focus:ring-2 focus:ring-[#4B3FD6] cursor-pointer"
              >
                <option value="">Select contract...</option>
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.filename}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => void runComparison(docAId, docBId)}
              disabled={!docAId || !docBId || docAId === docBId || loading}
              className="mt-3.5 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-[8px] bg-[#17142B] hover:bg-[#3B3855] text-white text-[13px] font-semibold transition-colors disabled:opacity-40 cursor-pointer shadow-xs shrink-0"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Aligning...</span>
                </>
              ) : (
                <>
                  <GitCompare className="w-3.5 h-3.5 text-[#FFD84D]" />
                  <span>Compare</span>
                </>
              )}
            </button>
          </div>

          {/* Stats Badges */}
          {result && (
            <div className="flex items-center gap-2 text-[12px] pt-3">
              <span className="font-semibold text-[#17142B]">{result.comparisons.length} clauses analysed</span>
              <span className="px-2 py-0.5 rounded-[6px] bg-[#FFE6D0] text-[#B4440A] font-bold">
                {result.stats.high} High
              </span>
              <span className="px-2 py-0.5 rounded-[6px] bg-[#FFF0A8] text-[#8A6A00] font-bold">
                {result.stats.medium} Medium
              </span>
              <span className="px-2 py-0.5 rounded-[6px] bg-[#E1ECF9] text-[#2A5C9A] font-bold">
                {result.stats.low} Low
              </span>
              <span className="px-2 py-0.5 rounded-[6px] bg-[#ECEBF5] text-[#5A5775] font-bold">
                {result.stats.cosmetic} Cosmetic
              </span>
            </div>
          )}
        </div>

        {/* Change Map Timeline with headline summary and clear labels */}
        {result && (
          <div className="pt-2 border-t border-[#F1F0F8] space-y-2">
            {headlineSummary && (
              <p className="font-reading text-[13px] leading-relaxed text-[#17142B] bg-[#F7F7FC] px-3 py-2 rounded-[8px] border border-[#E3E1EF]">
                {headlineSummary}
              </p>
            )}

            <div className="flex items-center justify-between text-[11px] text-[#6E6B87]">
              <span className="font-semibold text-[#17142B]">
                Contract Change Timeline (Click any tick to inspect clause):
              </span>
              <div className="flex items-center gap-3 font-mono text-[10.5px]">
                <span>Clause 1 (Start)</span>
                <span>────────────</span>
                <span>Clause {result.comparisons.length} (End)</span>
              </div>
            </div>

            <Spine
              cells={result.comparisons.length || 30}
              ticks={spineTicks}
              thickness={12}
              onSelect={(idx) => {
                const target = result.comparisons[idx];
                if (target) {
                  setFilter("all");
                  setActiveId(target.id);
                }
              }}
            />

            {/* Filter Tabs, Sort Control & Search */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-1.5 text-[11.5px]">
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className={`px-2.5 py-0.5 rounded-[6px] font-medium cursor-pointer transition-colors ${
                    filter === "all" ? "bg-[#17142B] text-white" : "bg-[#F7F7FC] text-[#5A5775] hover:bg-[#ECEBF5]"
                  }`}
                >
                  All ({result.comparisons.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("high")}
                  className={`px-2.5 py-0.5 rounded-[6px] font-medium cursor-pointer transition-colors ${
                    filter === "high" ? "bg-[#B4440A] text-white" : "bg-[#FFE6D0] text-[#B4440A]"
                  }`}
                >
                  High ({result.stats.high})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("medium")}
                  className={`px-2.5 py-0.5 rounded-[6px] font-medium cursor-pointer transition-colors ${
                    filter === "medium" ? "bg-[#8A6A00] text-white" : "bg-[#FFF0A8] text-[#8A6A00]"
                  }`}
                >
                  Medium ({result.stats.medium})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("low")}
                  className={`px-2.5 py-0.5 rounded-[6px] font-medium cursor-pointer transition-colors ${
                    filter === "low" ? "bg-[#2A5C9A] text-white" : "bg-[#E1ECF9] text-[#2A5C9A]"
                  }`}
                >
                  Low ({result.stats.low})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("cosmetic")}
                  className={`px-2.5 py-0.5 rounded-[6px] font-medium cursor-pointer transition-colors ${
                    filter === "cosmetic" ? "bg-[#5A5775] text-white" : "bg-[#ECEBF5] text-[#5A5775]"
                  }`}
                >
                  Cosmetic ({result.stats.cosmetic})
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-[11px] text-[#6E6B87]">
                  <span>Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as "order" | "significance")}
                    className="px-2 py-0.5 rounded-[6px] bg-[#F7F7FC] border border-[#E3E1EF] text-[11px] text-[#17142B] cursor-pointer"
                  >
                    <option value="order">Document Order</option>
                    <option value="significance">Significance (High to Low)</option>
                  </select>
                </div>

                <div className="relative">
                  <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6E6B87]" />
                  <input
                    type="text"
                    placeholder="Search clause text..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-7 pr-2.5 py-0.5 bg-[#F7F7FC] border border-[#E3E1EF] rounded-[6px] text-[11.5px] text-[#17142B] focus:outline-none focus:ring-1 focus:ring-[#4B3FD6] w-44"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error notification */}
      {error && (
        <div className="p-3 mx-6 my-2 rounded-[10px] bg-[#FEE4E2] border border-[#B42318]/20 text-[#B42318] text-[12.5px] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Comparison failed: {error}</span>
          </div>
          <button
            type="button"
            onClick={() => void runComparison(docAId, docBId)}
            className="text-xs font-semibold underline hover:no-underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. Main Comparison Split Workspace (fixed viewport, independent scroll panes) */}
      {!result ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-12 h-12 rounded-[14px] bg-white border border-[#E3E1EF] shadow-xs flex items-center justify-center text-[#4B3FD6] mb-3">
            <ArrowRightLeft className="w-6 h-6" />
          </div>
          <h2 className="text-[18px] font-semibold text-[#17142B] mb-1">
            Compare Contract Versions
          </h2>
          <p className="text-[13px] text-[#6E6B87] max-w-md mb-4 leading-relaxed">
            Select two versions above and click Compare to identify modified clauses, liability cap adjustments, payment changes, and cosmetic edits.
          </p>
          {documents.length >= 2 && (
            <button
              type="button"
              onClick={() => void runComparison(docAId, docBId)}
              className="px-4 py-2 rounded-[10px] bg-[#17142B] text-white text-[13px] font-medium hover:bg-[#3B3855] transition-colors cursor-pointer shadow-xs"
            >
              Compare Selected Versions
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 gap-4 p-4 min-h-0">
          {/* Left Clause Navigator (4 cols / 340px) */}
          <div className="md:col-span-4 h-full bg-white rounded-[14px] border border-[#E3E1EF] p-2.5 overflow-y-auto space-y-1.5 shadow-2xs">
            <div className="text-[11.5px] font-bold text-[#6E6B87] uppercase tracking-wider px-2 py-1">
              Clauses ({filtered.length})
            </div>
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-[#6E6B87] text-[12.5px]">
                No clauses match the selected filter.
              </div>
            ) : (
              filtered.map((c, idx) => {
                const isSelected = activeComparison && activeComparison.id === c.id;
                const ref = c.clauseB?.number || c.clauseA?.number || `Item ${idx + 1}`;
                const title = c.clauseB?.title || c.clauseA?.title || "Clause";
                const kindLabel =
                  c.type === "added"
                    ? "Added"
                    : c.type === "removed"
                    ? "Removed"
                    : c.type === "renumbered"
                    ? "Renumbered"
                    : c.significance === "cosmetic"
                    ? "Wording only"
                    : "Changed";

                return (
                  <div
                    key={c.id || idx}
                    onClick={() => setActiveId(c.id)}
                    className={`p-2.5 rounded-[10px] border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#E8E6FB] border-[#4B3FD6] ring-1 ring-[#4B3FD6]/30 shadow-xs"
                        : "bg-[#F7F7FC] border-[#E3E1EF] hover:border-[#CFCCE0] hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 gap-1">
                      <div className="flex items-center gap-1.5 font-semibold text-[13px] text-[#17142B] truncate max-w-[190px]">
                        {getCategoryIcon(title)}
                        <span className="truncate">{ref} · {title}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className={`px-1.5 py-0.5 rounded-[4px] text-[9.5px] font-bold uppercase tracking-wider ${
                            kindLabel === "Added"
                              ? "bg-[#DDF3EA] text-[#0B7A5F]"
                              : kindLabel === "Removed"
                              ? "bg-[#FCE3EA] text-[#B5224E]"
                              : kindLabel === "Wording only"
                              ? "bg-[#ECEBF5] text-[#5A5775]"
                              : "bg-[#E8E6FB] text-[#4B3FD6]"
                          }`}
                        >
                          {kindLabel}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded-[4px] text-[9.5px] font-bold uppercase tracking-wider ${
                            c.significance === "high"
                              ? "bg-[#FFE6D0] text-[#B4440A]"
                              : c.significance === "medium"
                              ? "bg-[#FFF0A8] text-[#8A6A00]"
                              : c.significance === "low"
                              ? "bg-[#E1ECF9] text-[#2A5C9A]"
                              : "bg-[#ECEBF5] text-[#5A5775]"
                          }`}
                        >
                          {c.significance}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11.5px] text-[#5A5775] line-clamp-2 leading-relaxed">
                      {c.summary}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Detail Diff Inspector (8 cols) */}
          <div className="md:col-span-8 h-full bg-white rounded-[14px] border border-[#E3E1EF] p-5 overflow-y-auto space-y-4 shadow-2xs">
            {activeComparison ? (
              <>
                {/* Clause Summary Banner & View Toggle */}
                <div className="p-4 rounded-[12px] bg-[#F7F7FC] border border-[#E3E1EF] space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-[15px] text-[#17142B] flex items-center gap-2">
                      {getCategoryIcon(activeComparison.clauseB?.title || activeComparison.clauseA?.title)}
                      <span>
                        {activeComparison.clauseB?.number || activeComparison.clauseA?.number} —{" "}
                        {activeComparison.clauseB?.title || activeComparison.clauseA?.title || "Clause Analysis"}
                      </span>
                    </h3>

                    <div className="flex items-center gap-2">
                      {/* View Mode Toggle: Side by side vs Inline */}
                      <div className="flex items-center gap-0.5 bg-[#E3E1EF]/70 p-0.5 rounded-[8px]">
                        <button
                          type="button"
                          onClick={() => setViewMode("side_by_side")}
                          className={`px-2.5 py-1 rounded-[6px] text-[11px] font-medium transition-colors cursor-pointer ${
                            viewMode === "side_by_side"
                              ? "bg-white text-[#17142B] shadow-2xs font-bold"
                              : "text-[#5A5775] hover:text-[#17142B]"
                          }`}
                        >
                          Side by side
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode("inline")}
                          className={`px-2.5 py-1 rounded-[6px] text-[11px] font-medium transition-colors cursor-pointer ${
                            viewMode === "inline"
                              ? "bg-white text-[#17142B] shadow-2xs font-bold"
                              : "text-[#5A5775] hover:text-[#17142B]"
                          }`}
                        >
                          Inline
                        </button>
                      </div>

                      <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[4px] bg-[#E8E6FB] text-[#4B3FD6]">
                        {activeComparison.type.replace("_", " ")}
                      </span>
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[4px] ${
                          activeComparison.significance === "high"
                            ? "bg-[#FFE6D0] text-[#B4440A]"
                            : activeComparison.significance === "medium"
                            ? "bg-[#FFF0A8] text-[#8A6A00]"
                            : activeComparison.significance === "low"
                            ? "bg-[#E1ECF9] text-[#2A5C9A]"
                            : "bg-[#ECEBF5] text-[#5A5775]"
                        }`}
                      >
                        {activeComparison.significance} Significance
                      </span>
                    </div>
                  </div>

                  <p className="font-reading text-[14px] leading-relaxed text-[#17142B]">
                    {activeComparison.summary}
                  </p>

                  {/* Financial & Legal Signals Chips */}
                  {activeComparison.signals && activeComparison.signals.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#E3E1EF]">
                      <span className="text-[10px] font-bold text-[#6E6B87] uppercase tracking-wider mr-1">
                        Signals:
                      </span>
                      {activeComparison.signals.map((sig, sIdx) => (
                        <span
                          key={sIdx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-[#E8E6FB] border border-[#4B3FD6]/20 text-[11.5px] font-medium text-[#17142B]"
                        >
                          <span className="font-bold text-[#4B3FD6] capitalize">{sig.type}:</span>
                          <span>{sig.description}</span>
                          {sig.direction && (
                            <span className="text-[9.5px] font-bold uppercase tracking-wider px-1 py-0.2 rounded bg-white text-[#4B3FD6]">
                              {sig.direction}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Diff Text Pane: Side-by-Side OR Inline */}
                {viewMode === "inline" ? (
                  <div className="p-4 rounded-[12px] border border-[#E3E1EF] bg-white shadow-xs space-y-2">
                    <div className="font-semibold text-[12.5px] text-[#17142B] pb-2 border-b border-[#E3E1EF] flex items-center justify-between">
                      <span>Unified Redline Diff</span>
                      <div className="flex items-center gap-3 text-[11px]">
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#B5224E]"></span>
                          <span className="line-through text-[#B5224E] font-medium">Removed</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#0B7A5F]"></span>
                          <span className="underline decoration-2 text-[#0B7A5F] font-semibold">Added</span>
                        </span>
                      </div>
                    </div>
                    <div className="font-reading text-[14.5px] leading-relaxed text-[#17142B] whitespace-pre-wrap select-text">
                      <DiffText
                        textA={activeComparison.clauseA?.text || ""}
                        textB={activeComparison.clauseB?.text || ""}
                        mode="inline"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Earlier Version */}
                    <div className="p-4 rounded-[12px] border border-[#E3E1EF] bg-[#F7F7FC]">
                      <div className="font-semibold text-[12.5px] text-[#5A5775] pb-2 mb-2 border-b border-[#E3E1EF] flex items-center justify-between">
                        <span className="truncate max-w-[240px]">{result.docA.title}</span>
                        <span className="text-[11px] font-normal text-[#6E6B87]">Earlier Version</span>
                      </div>
                      <div className="font-reading text-[14px] leading-relaxed text-[#3B3855] whitespace-pre-wrap select-text">
                        {activeComparison.clauseA?.text ? (
                          <DiffText
                            textA={activeComparison.clauseA.text}
                            textB={activeComparison.clauseB?.text || ""}
                            mode="earlier"
                          />
                        ) : (
                          <span className="italic text-[#6E6B87]">Clause not present in earlier version</span>
                        )}
                      </div>
                    </div>

                    {/* Amended Version */}
                    <div className="p-4 rounded-[12px] border-2 border-[#4B3FD6]/30 bg-white shadow-xs">
                      <div className="font-semibold text-[12.5px] text-[#17142B] pb-2 mb-2 border-b border-[#E3E1EF] flex items-center justify-between">
                        <span className="truncate max-w-[240px] text-[#4B3FD6] font-bold">{result.docB.title}</span>
                        <span className="text-[11px] font-normal text-[#0B7A5F] bg-[#DDF3EA] px-1.5 py-0.5 rounded-[4px]">
                          Amended Version
                        </span>
                      </div>
                      <div className="font-reading text-[14px] leading-relaxed text-[#17142B] whitespace-pre-wrap select-text">
                        {activeComparison.clauseB?.text ? (
                          <DiffText
                            textA={activeComparison.clauseA?.text || ""}
                            textB={activeComparison.clauseB.text}
                            mode="amended"
                          />
                        ) : (
                          <span className="italic text-[#6E6B87]">Clause removed in later version</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="py-24 text-center text-[#6E6B87]">
                Select a clause change on the left to inspect side-by-side or unified redline text.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
