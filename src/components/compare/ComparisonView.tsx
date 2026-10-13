"use client";

import React, { useState, useEffect } from "react";
import type { ComparisonResult, ClauseComparison, SignificanceLevel } from "@/lib/compare/types";
import {
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
  X,
  Search,
  ArrowRightLeft,
} from "lucide-react";

interface ComparisonViewProps {
  docAId: string;
  docBId: string;
  onClose: () => void;
}

function getCategoryIcon(category?: string) {
  const cat = (category || "").toLowerCase();
  if (cat.includes("liab") || cat.includes("indemn")) return <Scale className="w-3.5 h-3.5 text-[#C2410C]" />;
  if (cat.includes("pay") || cat.includes("fee") || cat.includes("invoic")) return <Banknote className="w-3.5 h-3.5 text-[#15803D]" />;
  if (cat.includes("terminat")) return <LogOut className="w-3.5 h-3.5 text-[#B91C1C]" />;
  if (cat.includes("term") || cat.includes("renew")) return <CalendarClock className="w-3.5 h-3.5 text-[#2563EB]" />;
  if (cat.includes("scope") || cat.includes("service")) return <Layers className="w-3.5 h-3.5 text-[#4B5563]" />;
  if (cat.includes("confid") || cat.includes("ip") || cat.includes("intellect")) return <Lock className="w-3.5 h-3.5 text-[#6D28D9]" />;
  if (cat.includes("law") || cat.includes("jurisdict") || cat.includes("govern")) return <Landmark className="w-3.5 h-3.5 text-[#1D4ED8]" />;
  if (cat.includes("oblig")) return <ListChecks className="w-3.5 h-3.5 text-[#374151]" />;
  if (cat.includes("def")) return <BookOpen className="w-3.5 h-3.5 text-[#374151]" />;
  return <CircleEllipsis className="w-3.5 h-3.5 text-[#6B7280]" />;
}

function getSignificanceStyle(level: SignificanceLevel) {
  switch (level) {
    case "high":
      return "bg-[#FFEDD5] text-[#C2410C] border-[#FED7AA]";
    case "medium":
      return "bg-[#FEF9C3] text-[#A16207] border-[#FDE047]";
    case "low":
      return "bg-[#DBEAFE] text-[#1D4ED8] border-[#BFDBFE]";
    case "cosmetic":
    default:
      return "bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]";
  }
}

export function ComparisonView({ docAId, docBId, onClose }: ComparisonViewProps) {
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SignificanceLevel | "all">("all");
  const [sortBy, setSortBy] = useState<"order" | "significance">("significance");
  const [search, setSearch] = useState("");
  const [selectedClauseIndex, setSelectedClauseIndex] = useState(0);

  useEffect(() => {
    let ignore = false;
    async function fetchComparison() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ docAId, docBId }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }

        const data = await res.json();
        if (!ignore) {
          setResult(data.comparison);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void fetchComparison();
    return () => {
      ignore = true;
    };
  }, [docAId, docBId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-[16px] shadow-2xl p-8 max-w-md w-full text-center border border-[#E5E7EB]">
          <div className="w-10 h-10 border-3 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <h3 className="text-[16px] font-semibold text-[#111827]">Comparing Contracts</h3>
          <p className="text-[13px] text-[#6B7280] mt-1">
            Aligning clauses, extracting financial signals, and evaluating significance...
          </p>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-[16px] shadow-2xl p-6 max-w-md w-full border border-[#E5E7EB] text-center">
          <div className="w-10 h-10 rounded-full bg-[#FEE2E2] text-[#B91C1C] flex items-center justify-center mx-auto mb-3 font-bold text-lg">
            ✕
          </div>
          <h3 className="text-[16px] font-semibold text-[#111827]">Comparison Failed</h3>
          <p className="text-[13px] text-[#B91C1C] mt-1">{error || "No comparison data returned."}</p>
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#111827] text-white text-[13px] font-medium rounded-[8px] hover:bg-[#1F2937] transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Filter comparisons
  const filtered = result.comparisons.filter((c) => {
    if (filter !== "all" && c.significance !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const textA = c.clauseA?.text.toLowerCase() || "";
      const textB = c.clauseB?.text.toLowerCase() || "";
      const sum = c.summary.toLowerCase();
      return textA.includes(q) || textB.includes(q) || sum.includes(q);
    }
    return true;
  });

  // Sort comparisons
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "significance") {
      const rank: Record<SignificanceLevel, number> = {
        high: 4,
        medium: 3,
        low: 2,
        cosmetic: 1,
      };
      const diff = rank[b.significance] - rank[a.significance];
      if (diff !== 0) return diff;
    }
    return 0;
  });

  const activeComparison: ClauseComparison | undefined = sorted[selectedClauseIndex] || sorted[0];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex flex-col p-4 sm:p-6 overflow-hidden font-sans">
      <div className="bg-white rounded-[16px] shadow-[0_8px_24px_rgba(17,24,39,0.14)] flex flex-col h-full w-full max-w-7xl mx-auto overflow-hidden border border-[#E5E7EB]">
        {/* 1. Header Toolbar (Section 6.10) */}
        <header className="bg-white border-b border-[#E5E7EB] px-6 py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[8px] bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-bold text-[12px]">
                <ArrowRightLeft className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-[16px] font-semibold text-[#111827]">
                  Compare: {result.docA.title} <span className="text-[#9CA3AF]">vs</span> {result.docB.title}
                </h2>
                <div className="text-[12px] text-[#6B7280]">
                  Found {result.comparisons.length} total clauses across both versions
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] rounded-[6px] transition-colors cursor-pointer"
              title="Close comparison"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Filter Pills and Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#F3F4F6] text-[12.5px]">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#6B7280] font-medium mr-1">Filter:</span>
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`px-2.5 py-1 rounded-[6px] text-[12px] font-medium transition-colors cursor-pointer ${
                  filter === "all"
                    ? "bg-[#111827] text-white"
                    : "bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]"
                }`}
              >
                All ({result.comparisons.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("high")}
                className={`px-2.5 py-1 rounded-[6px] text-[12px] font-medium border transition-colors cursor-pointer ${
                  filter === "high"
                    ? "bg-[#C2410C] text-white border-[#C2410C]"
                    : "bg-[#FFEDD5] text-[#C2410C] border-[#FED7AA] hover:bg-[#FED7AA]"
                }`}
              >
                High ({result.stats.high})
              </button>
              <button
                type="button"
                onClick={() => setFilter("medium")}
                className={`px-2.5 py-1 rounded-[6px] text-[12px] font-medium border transition-colors cursor-pointer ${
                  filter === "medium"
                    ? "bg-[#A16207] text-white border-[#A16207]"
                    : "bg-[#FEF9C3] text-[#A16207] border-[#FDE047] hover:bg-[#FDE047]"
                }`}
              >
                Medium ({result.stats.medium})
              </button>
              <button
                type="button"
                onClick={() => setFilter("low")}
                className={`px-2.5 py-1 rounded-[6px] text-[12px] font-medium border transition-colors cursor-pointer ${
                  filter === "low"
                    ? "bg-[#1D4ED8] text-white border-[#1D4ED8]"
                    : "bg-[#DBEAFE] text-[#1D4ED8] border-[#BFDBFE] hover:bg-[#BFDBFE]"
                }`}
              >
                Low ({result.stats.low})
              </button>
              <button
                type="button"
                onClick={() => setFilter("cosmetic")}
                className={`px-2.5 py-1 rounded-[6px] text-[12px] font-medium border transition-colors cursor-pointer ${
                  filter === "cosmetic"
                    ? "bg-[#4B5563] text-white border-[#4B5563]"
                    : "bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB] hover:bg-[#E5E7EB]"
                }`}
              >
                Cosmetic ({result.stats.cosmetic})
              </button>
            </div>

            {/* Search & Sort Controls */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  type="text"
                  placeholder="Search changes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 pr-2.5 py-1 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[8px] text-[12px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB] w-44"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[#6B7280] font-medium">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "order" | "significance")}
                  className="bg-white border border-[#E5E7EB] rounded-[8px] px-2 py-1 text-[12px] text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                >
                  <option value="significance">Significance</option>
                  <option value="order">Document order</option>
                </select>
              </div>
            </div>
          </div>
        </header>

        {/* 2. Master / Detail Comparison Body */}
        <div className="flex flex-1 min-h-0">
          {/* Left Change List (320px) */}
          <div className="w-[340px] border-r border-[#E5E7EB] bg-[#F9FAFB] overflow-y-auto p-3 space-y-2">
            {sorted.length === 0 ? (
              <div className="py-12 text-center text-[#6B7280] text-[13px]">
                No changes match the selected filter.
              </div>
            ) : (
              sorted.map((c, idx) => {
                const isSelected =
                  activeComparison &&
                  ((activeComparison.clauseB?.id &&
                    activeComparison.clauseB.id === c.clauseB?.id) ||
                    (activeComparison.clauseA?.id &&
                      activeComparison.clauseA.id === c.clauseA?.id) ||
                    selectedClauseIndex === idx);

                const ref = c.clauseB?.number || c.clauseA?.number || `Item ${idx + 1}`;
                const title = c.clauseB?.title || c.clauseA?.title || "Clause";

                return (
                  <div
                    key={c.clauseB?.id || c.clauseA?.id || idx}
                    onClick={() => setSelectedClauseIndex(idx)}
                    className={`p-3 rounded-[10px] border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#EFF6FF] border-[#2563EB] shadow-xs"
                        : "bg-white border-[#E5E7EB] hover:border-[#D1D5DB]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-[13px] text-[#111827]">
                        {getCategoryIcon(title)}
                        <span>{ref}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-[4px] text-[10.5px] font-bold uppercase tracking-wider border ${getSignificanceStyle(
                          c.significance
                        )}`}
                      >
                        {c.significance}
                      </span>
                    </div>

                    <p className="text-[12px] text-[#4B5563] line-clamp-2 leading-relaxed">
                      {c.summary}
                    </p>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-[#6B7280]">
                      <span className="capitalize font-medium text-[#2563EB]">
                        {c.type.replace("_", " ")}
                      </span>
                      {c.signals.length > 0 && (
                        <span className="text-[#6B7280]">
                          {c.signals.length} {c.signals.length === 1 ? "signal" : "signals"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Detail Pane: Side-by-Side Clauses */}
          <div className="flex-1 bg-white overflow-y-auto p-6">
            {activeComparison ? (
              <div className="space-y-6 max-w-4xl">
                {/* Clause Header & Summary */}
                <div className="p-4 rounded-[12px] bg-[#F9FAFB] border border-[#E5E7EB]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-[6px] text-[11px] font-bold uppercase tracking-wider border ${getSignificanceStyle(
                          activeComparison.significance
                        )}`}
                      >
                        {activeComparison.significance}
                      </span>
                      <h3 className="text-[15px] font-bold text-[#111827]">
                        {activeComparison.clauseB?.title ||
                          activeComparison.clauseA?.title ||
                          "Clause Comparison"}
                      </h3>
                    </div>

                    <span className="text-[12px] font-medium text-[#6B7280] capitalize">
                      {activeComparison.type.replace("_", " ")}
                    </span>
                  </div>

                  <p className="text-[13.5px] text-[#111827] leading-relaxed">
                    {activeComparison.summary}
                  </p>

                  {activeComparison.signals.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#E5E7EB] flex flex-wrap gap-2">
                      {activeComparison.signals.map((sig, sIdx) => (
                        <span
                          key={sIdx}
                          className="inline-flex items-center text-[11.5px] px-2.5 py-0.5 rounded-[5px] bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]"
                        >
                          {sig.description}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Side-by-Side Texts */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Left: Earlier Version (docA) */}
                  <div className="p-4 rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB]">
                    <div className="font-semibold text-[13px] text-[#4B5563] pb-2 mb-3 border-b border-[#E5E7EB] flex items-center justify-between">
                      <span className="truncate">{result.docA.title}</span>
                      <span className="text-[11px] font-normal text-[#9CA3AF]">
                        {activeComparison.clauseA ? "Original" : "Not Present"}
                      </span>
                    </div>

                    {activeComparison.clauseA ? (
                      <div className="font-contract text-[14px] leading-relaxed text-[#374151] whitespace-pre-wrap" dir="auto">
                        {activeComparison.clauseA.text}
                      </div>
                    ) : (
                      <div className="text-[13px] text-[#9CA3AF] italic py-8 text-center">
                        Clause was added in new version.
                      </div>
                    )}
                  </div>

                  {/* Right: Later Version (docB) */}
                  <div className="p-4 rounded-[12px] border border-[#E5E7EB] bg-white shadow-xs">
                    <div className="font-semibold text-[13px] text-[#111827] pb-2 mb-3 border-b border-[#E5E7EB] flex items-center justify-between">
                      <span className="truncate">{result.docB.title}</span>
                      <span className="text-[11px] font-normal text-[#2563EB]">
                        {activeComparison.clauseB ? "Amended" : "Removed"}
                      </span>
                    </div>

                    {activeComparison.clauseB ? (
                      <div className="font-contract text-[14px] leading-relaxed text-[#111827] whitespace-pre-wrap" dir="auto">
                        {activeComparison.clauseB.text}
                      </div>
                    ) : (
                      <div className="text-[13px] text-[#9CA3AF] italic py-8 text-center">
                        Clause was removed in this version.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-[#6B7280]">
                Select a clause change on the left to inspect side-by-side wording.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
