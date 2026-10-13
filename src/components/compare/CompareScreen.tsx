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
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [search, setSearch] = useState("");
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
      setSelectedIdx(0);
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

  const filtered = (result?.comparisons || []).filter((c) => {
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
    filtered[selectedIdx] || filtered[0];

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
    <div className="flex-1 overflow-y-auto p-8 max-w-6xl w-full mx-auto font-sans relative">
      {/* 1. Header & Version Slots (Section 6.4) */}
      <div className="bg-white rounded-[18px] border border-[#E3E1EF] p-6 shadow-xs mb-6">
        <h1 className="text-[22px] font-semibold text-[#17142B] tracking-tight mb-4">
          Compare Versions
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
          {/* Earlier version slot */}
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-[12px] font-semibold text-[#6E6B87] uppercase tracking-wider block">
              Earlier Version
            </label>
            <select
              value={docAId}
              onChange={(e) => setDocAId(e.target.value)}
              className="w-full px-3 py-2 rounded-[10px] bg-[#F7F7FC] border border-[#E3E1EF] text-[13.5px] text-[#17142B] font-medium focus:ring-2 focus:ring-[#4B3FD6] cursor-pointer"
            >
              <option value="">Select contract...</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.filename}
                </option>
              ))}
            </select>
          </div>

          {/* Swap button */}
          <div className="flex justify-center md:pt-5">
            <button
              type="button"
              onClick={handleSwap}
              className="p-2 rounded-[10px] bg-white border border-[#E3E1EF] hover:border-[#17142B] text-[#5A5775] hover:text-[#17142B] transition-colors cursor-pointer shadow-2xs"
              title="Swap versions"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Later version slot */}
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-[12px] font-semibold text-[#6E6B87] uppercase tracking-wider block">
              Later Version
            </label>
            <select
              value={docBId}
              onChange={(e) => setDocBId(e.target.value)}
              className="w-full px-3 py-2 rounded-[10px] bg-[#F7F7FC] border border-[#E3E1EF] text-[13.5px] text-[#17142B] font-medium focus:ring-2 focus:ring-[#4B3FD6] cursor-pointer"
            >
              <option value="">Select contract...</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.filename}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => void runComparison(docAId, docBId)}
            disabled={!docAId || !docBId || docAId === docBId || loading}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-[10px] bg-[#17142B] hover:bg-[#3B3855] text-white text-[13.5px] font-semibold transition-colors disabled:opacity-40 cursor-pointer shadow-xs"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Aligning clauses & extracting signals...</span>
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-4 h-4 text-[#FFD84D]" />
                <span>Compare Versions</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-[14px] bg-[#FEE4E2] border border-[#B42318]/20 text-[#B42318] text-[13px] flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Comparison failed: {error}</span>
          </div>
          <button
            type="button"
            onClick={() => void runComparison(docAId, docBId)}
            className="px-2.5 py-1 rounded-[6px] bg-white border border-[#B42318]/30 font-semibold text-xs cursor-pointer hover:bg-[#FEE4E2]"
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. Results & Change Map (Section 6.4) */}
      {result && (
        <div className="space-y-6">
          {/* Change Map Spine */}
          <div className="bg-white rounded-[18px] border border-[#E3E1EF] p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-semibold text-[#17142B]">
                Contract Change Map
              </span>
              <span className="text-[12px] text-[#6E6B87]">
                {result.comparisons.length} clauses analysed · Ticks indicate modified terms
              </span>
            </div>

            <Spine
              cells={result.comparisons.length || 30}
              ticks={spineTicks}
              thickness={14}
              onSelect={(idx) => setSelectedIdx(idx)}
              className="my-3"
            />

            {/* Filter Chips */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#F1F0F8]">
              <div className="flex items-center gap-1.5 text-[12px]">
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className={`px-2.5 py-1 rounded-[6px] font-medium cursor-pointer transition-colors ${
                    filter === "all" ? "bg-[#17142B] text-white" : "bg-[#F7F7FC] text-[#5A5775] hover:bg-[#ECEBF5]"
                  }`}
                >
                  All ({result.comparisons.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("high")}
                  className={`px-2.5 py-1 rounded-[6px] font-medium cursor-pointer transition-colors ${
                    filter === "high" ? "bg-[#B4440A] text-white" : "bg-[#FFE6D0] text-[#B4440A]"
                  }`}
                >
                  High ({result.stats.high})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("medium")}
                  className={`px-2.5 py-1 rounded-[6px] font-medium cursor-pointer transition-colors ${
                    filter === "medium" ? "bg-[#8A6A00] text-white" : "bg-[#FFF0A8] text-[#8A6A00]"
                  }`}
                >
                  Medium ({result.stats.medium})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("low")}
                  className={`px-2.5 py-1 rounded-[6px] font-medium cursor-pointer transition-colors ${
                    filter === "low" ? "bg-[#2A5C9A] text-white" : "bg-[#E1ECF9] text-[#2A5C9A]"
                  }`}
                >
                  Low ({result.stats.low})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("cosmetic")}
                  className={`px-2.5 py-1 rounded-[6px] font-medium cursor-pointer transition-colors ${
                    filter === "cosmetic" ? "bg-[#5A5775] text-white" : "bg-[#ECEBF5] text-[#5A5775]"
                  }`}
                >
                  Cosmetic ({result.stats.cosmetic})
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6E6B87]" />
                <input
                  type="text"
                  placeholder="Search clause text..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 pr-2.5 py-1 bg-[#F7F7FC] border border-[#E3E1EF] rounded-[8px] text-[12px] text-[#17142B] focus:outline-none focus:ring-2 focus:ring-[#4B3FD6] w-40"
                />
              </div>
            </div>
          </div>

          {/* Master Detail Side-by-Side Change Explorer */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-white rounded-[18px] border border-[#E3E1EF] p-6 shadow-xs overflow-hidden">
            {/* Left list (4 cols) */}
            <div className="md:col-span-4 border-r border-[#E3E1EF] pr-4 space-y-2 max-h-[560px] overflow-y-auto">
              {filtered.map((c, idx) => {
                const isSelected = activeComparison && activeComparison.id === c.id;
                const ref = c.clauseB?.number || c.clauseA?.number || `Item ${idx + 1}`;
                const title = c.clauseB?.title || c.clauseA?.title || "Clause";

                return (
                  <div
                    key={c.id || idx}
                    onClick={() => setSelectedIdx(idx)}
                    className={`p-3 rounded-[10px] border transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-[#E8E6FB] border-[#4B3FD6]"
                        : "bg-[#F7F7FC] border-[#E3E1EF] hover:border-[#CFCCE0]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 font-semibold text-[13px] text-[#17142B]">
                        {getCategoryIcon(title)}
                        <span>{ref}</span>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold uppercase tracking-wider ${
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

                    <p className="text-[12px] text-[#5A5775] line-clamp-2 leading-relaxed">
                      {c.summary}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Right detail clause text (8 cols) */}
            <div className="md:col-span-8 space-y-4">
              {activeComparison ? (
                <>
                  <div className="p-4 rounded-[12px] bg-[#F7F7FC] border border-[#E3E1EF]">
                    <div className="flex items-center justify-between mb-1.5">
                      <h3 className="font-semibold text-[15px] text-[#17142B]">
                        {activeComparison.clauseB?.title || activeComparison.clauseA?.title || "Clause Analysis"}
                      </h3>
                      <span className="text-[11.5px] font-bold uppercase tracking-wider text-[#4B3FD6]">
                        {activeComparison.type.replace("_", " ")}
                      </span>
                    </div>
                    <p className="font-reading text-[15px] leading-relaxed text-[#17142B]">
                      {activeComparison.summary}
                    </p>
                  </div>

                  {/* Side-by-side texts */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-[12px] border border-[#E3E1EF] bg-[#F7F7FC]">
                      <div className="font-semibold text-[12.5px] text-[#5A5775] pb-2 mb-2 border-b border-[#E3E1EF]">
                        {result.docA.title} (Earlier)
                      </div>
                      <div className="font-reading text-[14px] leading-relaxed text-[#3B3855] whitespace-pre-wrap">
                        {activeComparison.clauseA?.text || (
                          <span className="italic text-[#6E6B87]">Clause not present in earlier version</span>
                        )}
                      </div>
                    </div>

                    <div className="p-4 rounded-[12px] border border-[#E3E1EF] bg-white shadow-xs">
                      <div className="font-semibold text-[12.5px] text-[#17142B] pb-2 mb-2 border-b border-[#E3E1EF]">
                        {result.docB.title} (Amended)
                      </div>
                      <div className="font-reading text-[14px] leading-relaxed text-[#17142B] whitespace-pre-wrap">
                        {activeComparison.clauseB?.text || (
                          <span className="italic text-[#6E6B87]">Clause removed in later version</span>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-20 text-center text-[#6E6B87]">
                  Select a clause change to inspect side-by-side text.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
