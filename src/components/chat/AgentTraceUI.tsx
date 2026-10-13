"use client";

import React, { useState } from "react";
import type { AgentTraceStep } from "@/lib/agent/loop";

export interface AgentTraceUIProps {
  trace: AgentTraceStep[];
  isStreaming?: boolean;
}

export function AgentTraceUI({ trace, isStreaming = false }: AgentTraceUIProps) {
  const [isOpen, setIsOpen] = useState(isStreaming || trace.length <= 4);

  if (!trace || trace.length === 0) return null;

  const successfulLookups = trace.filter((t) => t.status === "success").length;
  const latestStep = trace[trace.length - 1];

  return (
    <div className="mb-3 rounded-xl border border-indigo-200/80 bg-indigo-50/40 overflow-hidden text-xs">
      {/* Header / Summary Toggle */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3.5 py-2.5 flex items-center justify-between bg-indigo-50/70 hover:bg-indigo-100/50 transition cursor-pointer text-left"
      >
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-md bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
            ⚡
          </span>
          <span className="font-semibold text-indigo-950">
            Agent Research Trace
          </span>
          <span className="text-[11px] text-indigo-700 font-medium bg-indigo-100/80 px-2 py-0.5 rounded-full border border-indigo-200">
            {trace.length} action{trace.length === 1 ? "" : "s"} ({successfulLookups} lookups)
          </span>

          {isStreaming && (
            <span className="flex items-center gap-1.5 text-[11px] text-indigo-600 font-medium ml-1">
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
              <span>Researching...</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isOpen && latestStep && (
            <span className="text-[11px] text-stone-500 max-w-xs truncate hidden sm:inline">
              Latest: {latestStep.message}
            </span>
          )}
          <svg
            className={`w-4 h-4 text-indigo-600 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expandable Trace Steps List */}
      {isOpen && (
        <div className="p-3 space-y-2 border-t border-indigo-100 bg-white/70">
          {trace.map((step, idx) => (
            <div
              key={step.id || idx}
              className="flex items-start gap-2.5 p-2 rounded-lg bg-stone-50 border border-stone-200/70 text-xs"
            >
              {/* Status Icon */}
              <div className="mt-0.5 shrink-0">
                {step.status === "pending" ? (
                  <span className="w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin inline-block" />
                ) : step.status === "success" ? (
                  <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold">
                    ✓
                  </span>
                ) : (
                  <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-[10px] font-bold">
                    !
                  </span>
                )}
              </div>

              {/* Step Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-stone-800 font-mono text-[11px]">
                    Round {step.round}: {step.tool}
                  </span>
                  {step.durationMs !== undefined && (
                    <span className="text-[10px] text-stone-400">
                      {step.durationMs}ms
                    </span>
                  )}
                </div>

                <p className="text-stone-600 mt-0.5 text-[11px] leading-relaxed">
                  {step.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
