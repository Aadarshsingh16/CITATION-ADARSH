"use client";

import React from "react";
import { X, ShieldCheck, Keyboard, FileText, CheckCircle2 } from "lucide-react";

interface HelpModalProps {
  onClose: () => void;
}

export function HelpModal({ onClose }: HelpModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-[#17142B]/40 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-white rounded-[18px] border border-[#E3E1EF] shadow-[0_10px_28px_-6px_rgba(23,20,43,0.16)] max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E3E1EF] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-[8px] bg-[#DDF3EA] text-[#0B7A5F] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="text-[16px] font-semibold text-[#17142B]">
              Verification & Shortcuts
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

        {/* Content */}
        <div className="p-6 space-y-5 text-[13.5px] text-[#3B3855] leading-relaxed">
          <div>
            <h4 className="font-semibold text-[14px] text-[#17142B] mb-1.5 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#0B7A5F]" />
              How Quote Verification Works
            </h4>
            <p className="text-[#5A5775]">
              Every citation generated in an answer is extracted and verified strictly against the
              original document's canonical text. Model-reported offsets are ignored. If even a single word
              is altered or hallucinated, the citation is marked as <strong>Unverified</strong> with the exact reason.
            </p>
          </div>

          <div className="border-t border-[#F1F0F8] pt-4">
            <h4 className="font-semibold text-[14px] text-[#17142B] mb-2 flex items-center gap-1.5">
              <Keyboard className="w-4 h-4 text-[#4B3FD6]" />
              Keyboard Shortcuts
            </h4>
            <div className="space-y-2 font-mono text-[12px]">
              <div className="flex items-center justify-between py-1 px-2.5 rounded-[6px] bg-[#F7F7FC]">
                <span className="font-sans text-[#3B3855]">Send message</span>
                <kbd className="px-2 py-0.5 rounded-[4px] bg-white border border-[#E3E1EF] text-[#17142B] shadow-2xs">Enter</kbd>
              </div>
              <div className="flex items-center justify-between py-1 px-2.5 rounded-[6px] bg-[#F7F7FC]">
                <span className="font-sans text-[#3B3855]">Newline in composer</span>
                <kbd className="px-2 py-0.5 rounded-[4px] bg-white border border-[#E3E1EF] text-[#17142B] shadow-2xs">Shift + Enter</kbd>
              </div>
              <div className="flex items-center justify-between py-1 px-2.5 rounded-[6px] bg-[#F7F7FC]">
                <span className="font-sans text-[#3B3855]">Close desk / modal</span>
                <kbd className="px-2 py-0.5 rounded-[4px] bg-white border border-[#E3E1EF] text-[#17142B] shadow-2xs">Esc</kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#F7F7FC] border-t border-[#E3E1EF] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-[10px] bg-[#17142B] text-white text-[13px] font-medium hover:bg-[#3B3855] transition-colors cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
