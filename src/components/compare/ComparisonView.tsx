"use client";

import React, { useState, useEffect } from "react";
import type { ComparisonResult, ClauseComparison, SignificanceLevel } from "@/lib/compare/types";

interface ComparisonViewProps {
  docAId: string;
  docBId: string;
  onClose: () => void;
}

export function ComparisonView({ docAId, docBId, onClose }: ComparisonViewProps) {
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SignificanceLevel | "all">("all");
  const [sortBy, setSortBy] = useState<"order" | "significance">("significance");
  const [search, setSearch] = useState("");

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

    fetchComparison();
    return () => {
      ignore = true;
    };
  }, [docAId, docBId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-stone-900">Comparing Contracts</h3>
          <p className="text-sm text-stone-600 mt-1">
            Aligning clauses, extracting financial signals, and evaluating significance...
          </p>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            ✕
          </div>
          <h3 className="text-lg font-semibold text-stone-900 text-center">Comparison Failed</h3>
          <p className="text-sm text-red-600 mt-2 text-center">{error || "No data returned."}</p>
          <div className="mt-6 flex justify-center">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-stone-800 text-white text-sm font-medium rounded-lg hover:bg-stone-700 transition"
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
    return 0; // maintain document order
  });

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/75 backdrop-blur-sm flex flex-col p-4 sm:p-6 overflow-hidden">
      <div className="bg-stone-50 rounded-2xl shadow-2xl flex flex-col h-full w-full max-w-7xl mx-auto overflow-hidden border border-stone-200">
        {/* Top Header */}
        <header className="bg-white border-b border-stone-200 px-6 py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm">
                VS
              </span>
              <div>
                <h2 className="text-base font-bold text-stone-900">
                  Contract Version Comparison
                </h2>
                <div className="text-xs text-stone-500 flex items-center gap-2 mt-0.5">
                  <span className="font-semibold text-stone-700">{result.docA.title}</span>
                  <span>vs</span>
                  <span className="font-semibold text-stone-700">{result.docB.title}</span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="px-3 py-1.5 text-stone-600 hover:text-stone-900 text-sm font-semibold rounded-lg hover:bg-stone-100 transition"
            >
              ✕ Close
            </button>
          </div>

          {/* Stats Bar & Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-stone-100 text-xs">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5">
              <span className="text-stone-500 font-medium mr-1">Significance:</span>
              <button
                onClick={() => setFilter("all")}
                className={`px-2.5 py-1 rounded-full font-medium transition ${
                  filter === "all"
                    ? "bg-stone-900 text-white"
                    : "bg-stone-200 text-stone-700 hover:bg-stone-300"
                }`}
              >
                All ({result.comparisons.length})
              </button>
              <button
                onClick={() => setFilter("high")}
                className={`px-2.5 py-1 rounded-full font-medium transition ${
                  filter === "high"
                    ? "bg-red-600 text-white"
                    : "bg-red-100 text-red-800 hover:bg-red-200"
                }`}
              >
                High ({result.stats.high})
              </button>
              <button
                onClick={() => setFilter("medium")}
                className={`px-2.5 py-1 rounded-full font-medium transition ${
                  filter === "medium"
                    ? "bg-amber-600 text-white"
                    : "bg-amber-100 text-amber-800 hover:bg-amber-200"
                }`}
              >
                Medium ({result.stats.medium})
              </button>
              <button
                onClick={() => setFilter("low")}
                className={`px-2.5 py-1 rounded-full font-medium transition ${
                  filter === "low"
                    ? "bg-blue-600 text-white"
                    : "bg-blue-100 text-blue-800 hover:bg-blue-200"
                }`}
              >
                Low ({result.stats.low})
              </button>
              <button
                onClick={() => setFilter("cosmetic")}
                className={`px-2.5 py-1 rounded-full font-medium transition ${
                  filter === "cosmetic"
                    ? "bg-stone-600 text-white"
                    : "bg-stone-200 text-stone-600 hover:bg-stone-300"
                }`}
              >
                Cosmetic ({result.stats.cosmetic})
              </button>
            </div>

            {/* Sort & Search Controls */}
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search clauses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="px-2.5 py-1 bg-stone-100 border border-stone-200 rounded-lg text-xs text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500 w-44"
              />

              <div className="flex items-center gap-1.5">
                <span className="text-stone-500 font-medium">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "order" | "significance")}
                  className="bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs text-stone-700 focus:outline-none"
                >
                  <option value="significance">Significance (High to Low)</option>
                  <option value="order">Document Order</option>
                </select>
              </div>
            </div>
          </div>
        </header>

        {/* Content Comparison List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {sorted.length === 0 ? (
            <div className="text-center py-16 text-stone-500">
              <p className="text-sm font-medium">No clauses match the selected filter.</p>
            </div>
          ) : (
            sorted.map((item) => (
              <ClauseComparisonCard key={item.id} comp={item} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ClauseComparisonCard({ comp }: { comp: ClauseComparison }) {
  const significanceBadgeColors: Record<SignificanceLevel, string> = {
    high: "bg-red-100 text-red-800 border-red-300",
    medium: "bg-amber-100 text-amber-800 border-amber-300",
    low: "bg-blue-100 text-blue-800 border-blue-300",
    cosmetic: "bg-stone-100 text-stone-600 border-stone-200",
  };

  const typeLabels: Record<string, string> = {
    identical: "Unchanged",
    modified: "Modified",
    renumbered: "Renumbered",
    added: "Added in Doc B",
    removed: "Removed in Doc B",
  };

  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden transition hover:shadow-md">
      {/* Card Header */}
      <div className="bg-stone-50/75 border-b border-stone-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider border ${
              significanceBadgeColors[comp.significance]
            }`}
          >
            {comp.significance}
          </span>
          <span className="text-xs font-semibold text-stone-500">
            • {typeLabels[comp.type] || comp.type}
          </span>
          {(comp.clauseB?.number || comp.clauseA?.number) && (
            <span className="text-xs font-bold text-stone-800">
              Clause {comp.clauseB?.number || comp.clauseA?.number}
              {(comp.clauseB?.title || comp.clauseA?.title) && (
                <span className="font-normal text-stone-600 ml-1">
                  - {comp.clauseB?.title || comp.clauseA?.title}
                </span>
              )}
            </span>
          )}
        </div>

        {comp.signals.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {comp.signals.map((sig, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-[11px] font-semibold"
              >
                {sig.type.toUpperCase()}: {sig.from ? `${sig.from} → ` : ""}{sig.to || "removed"}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Substantive Summary (B9, D-041) */}
      <div className="px-4 py-2.5 bg-amber-50/40 border-b border-amber-100 text-xs text-stone-800 flex items-start gap-2">
        <span className="font-bold text-amber-800 shrink-0">Summary:</span>
        <span className="flex-1 font-medium">{comp.summary}</span>
      </div>

      {/* Side by Side Diff */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-stone-200 text-xs font-serif leading-relaxed">
        {/* Left Column: Doc A */}
        <div className="p-4 bg-stone-50/30">
          <div className="text-[11px] font-sans font-bold uppercase text-stone-400 mb-1.5 flex items-center justify-between">
            <span>Doc A (Original)</span>
            {comp.clauseA?.page && <span>Page {comp.clauseA.page}</span>}
          </div>
          {comp.clauseA ? (
            <p className="text-stone-800 whitespace-pre-wrap">{comp.clauseA.text}</p>
          ) : (
            <p className="text-stone-400 italic">Clause does not exist in Document A</p>
          )}
        </div>

        {/* Right Column: Doc B */}
        <div className="p-4 bg-white">
          <div className="text-[11px] font-sans font-bold uppercase text-stone-400 mb-1.5 flex items-center justify-between">
            <span>Doc B (Revised)</span>
            {comp.clauseB?.page && <span>Page {comp.clauseB.page}</span>}
          </div>
          {comp.clauseB ? (
            <p className="text-stone-900 font-medium whitespace-pre-wrap">{comp.clauseB.text}</p>
          ) : (
            <p className="text-stone-400 italic">Clause removed from Document B</p>
          )}
        </div>
      </div>
    </div>
  );
}
