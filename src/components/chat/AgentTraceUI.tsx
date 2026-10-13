"use client";

import React, { useState } from "react";
import type { AgentTraceStep } from "@/lib/agent/loop";
import { ChevronDown, Check, Loader2, Sparkles, AlertCircle } from "lucide-react";

export interface AgentTraceUIProps {
  trace: AgentTraceStep[];
  isStreaming?: boolean;
}

export function AgentTraceUI({ trace, isStreaming = false }: AgentTraceUIProps) {
  const [isOpen, setIsOpen] = useState(isStreaming || trace.length <= 4);

  if (!trace || trace.length === 0) return null;

  const successfulLookups = trace.filter((t) => t.status === "success").length;
  const isCapReached = trace.some((t) => t.message?.toLowerCase().includes("limit reached") || t.message?.toLowerCase().includes("maximum rounds"));

  return (
    <div className="mb-3.5 rounded-[10px] border border-[#BFDBFE] bg-[#EFF6FF] overflow-hidden text-[12.5px] font-sans">
      {/* Header / Summary Toggle */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3.5 py-2.5 flex items-center justify-between bg-[#DBEAFE]/40 hover:bg-[#DBEAFE]/70 transition-colors cursor-pointer text-left"
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-[4px] bg-[#2563EB] text-white flex items-center justify-center shrink-0">
            <Sparkles className="w-3 h-3" />
          </div>
          <span className="font-semibold text-[#1E3A8A]">
            Deep research
          </span>
          <span className="text-[11.5px] text-[#1D4ED8] font-medium bg-white/80 px-2 py-0.5 rounded-[4px] border border-[#BFDBFE]">
            {trace.length} {trace.length === 1 ? "lookup" : "lookups"}
          </span>

          {isStreaming && (
            <span className="flex items-center gap-1.5 text-[11.5px] text-[#2563EB] font-medium ml-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Searching clauses...</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-[#6B7280]">
          <ChevronDown
            className={`w-4 h-4 text-[#2563EB] transition-transform duration-150 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* Cap Reached Notice (Section 6.11) */}
      {isCapReached && (
        <div className="px-3.5 py-2 bg-[#FEF3C7] border-t border-[#FCD34D] text-[12px] text-[#B45309] flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Research limit reached, answered with what was found.</span>
        </div>
      )}

      {/* Expanded Trace Steps */}
      {isOpen && (
        <div className="p-3 bg-white/60 border-t border-[#DBEAFE] space-y-2">
          {trace.map((step, idx) => {
            const isLatest = idx === trace.length - 1 && isStreaming;
            const isInvalid = step.status === "error" || step.message?.includes("invalid");

            return (
              <div
                key={step.id || idx}
                className="flex items-start gap-2.5 text-[12px] leading-relaxed"
              >
                <div className="mt-0.5 shrink-0">
                  {isLatest ? (
                    <Loader2 className="w-3.5 h-3.5 text-[#2563EB] animate-spin" />
                  ) : isInvalid ? (
                    <span className="w-3.5 h-3.5 rounded-full bg-[#FEF3C7] text-[#B45309] flex items-center justify-center text-[10px] font-bold">
                      !
                    </span>
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full bg-[#DCFCE7] text-[#15803D] flex items-center justify-center">
                      <Check className="w-2.5 h-2.5" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[#111827]">
                    {step.message || "Executing research action"}
                  </div>
                  {isInvalid && (
                    <div className="text-[11px] text-[#6B7280] italic mt-0.5">
                      That lookup was invalid, trying again
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
