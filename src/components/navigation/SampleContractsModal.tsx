"use client";

import React, { useState } from "react";
import { X, Sparkles, Loader2, CheckCircle2, FileText, Trash2 } from "lucide-react";

interface SampleContractsModalProps {
  onClose: () => void;
  onRefreshDocs: () => Promise<void>;
}

export function SampleContractsModal({
  onClose,
  onRefreshDocs,
}: SampleContractsModalProps) {
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSeed = async () => {
    setLoading(true);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/documents/seed-samples", { method: "POST" });
      if (res.ok) {
        setSuccessMsg("Sample contracts loaded successfully.");
        await onRefreshDocs();
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#17142B]/40 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-white rounded-[18px] border border-[#E3E1EF] shadow-[0_10px_28px_-6px_rgba(23,20,43,0.16)] max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-[#E3E1EF] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-[8px] bg-[#DDF3EA] text-[#0B7A5F] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-[16px] font-semibold text-[#17142B]">
              Sample Contracts
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-[6px] text-[#6E6B87] hover:text-[#17142B] hover:bg-[#F1F0F8] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-[13.5px] text-[#3B3855] leading-relaxed">
          <p className="text-[#5A5775]">
            Quickly test multi-doc queries, quote verification, and comparison using pre-built synthetic contracts:
          </p>

          <div className="space-y-2">
            <div className="p-2.5 rounded-[10px] bg-[#F7F7FC] border border-[#E3E1EF] flex items-start gap-2.5">
              <FileText className="w-4 h-4 text-[#B5224E] shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-[#17142B] text-[13px] block">Master Services Agreement (2024)</span>
                <span className="text-[12px] text-[#6E6B87]">4 pages · Payment terms, convenience termination, governing law</span>
              </div>
            </div>

            <div className="p-2.5 rounded-[10px] bg-[#F7F7FC] border border-[#E3E1EF] flex items-start gap-2.5">
              <FileText className="w-4 h-4 text-[#B5224E] shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-[#17142B] text-[13px] block">Amendment No. 1 (Services Agreement)</span>
                <span className="text-[12px] text-[#6E6B87]">2 pages · Planted modifications for Version Comparison</span>
              </div>
            </div>

            <div className="p-2.5 rounded-[10px] bg-[#F7F7FC] border border-[#E3E1EF] flex items-start gap-2.5">
              <FileText className="w-4 h-4 text-[#B5224E] shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-[#17142B] text-[13px] block">Mutual NDA (Standard)</span>
                <span className="text-[12px] text-[#6E6B87]">2 pages · Confidentiality scope and exclusions</span>
              </div>
            </div>
          </div>

          {successMsg && (
            <div className="p-2.5 rounded-[8px] bg-[#DDF3EA] border border-[#0B7A5F]/20 text-[#0B7A5F] text-[12.5px] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        <div className="px-6 py-3 bg-[#F7F7FC] border-t border-[#E3E1EF] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-[10px] text-[#6E6B87] hover:text-[#17142B] text-[13px] font-medium transition-colors cursor-pointer"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handleSeed}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-[10px] bg-[#17142B] hover:bg-[#3B3855] text-white text-[13px] font-medium transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Loading...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-[#FFD84D]" />
                <span>Load Sample Contracts</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
