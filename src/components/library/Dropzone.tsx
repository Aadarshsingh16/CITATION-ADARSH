"use client";

import React, { useState, useRef } from "react";
import type { DismissibleError, DocumentRecord } from "@/lib/types";
import { UploadCloud, Sparkles, Loader2 } from "lucide-react";

interface DropzoneProps {
  onUploadSuccess: (doc: DocumentRecord) => void;
  onUploadError: (err: DismissibleError) => void;
  onSeedSamples: () => Promise<void>;
  isSeeding: boolean;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  onUploadSuccess,
  onUploadError,
  onSeedSamples,
  isSeeding,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        onUploadError({
          id: Math.random().toString(36).substring(2, 9),
          filename: file.name,
          reason: data.error?.reason || "wrong_extension",
          message: data.error?.message || "File upload failed.",
          nextStep: data.error?.nextStep || "Check the file format and try again.",
          timestamp: Date.now(),
        });
      } else if (data.document) {
        onUploadSuccess(data.document);
      }
    } catch {
      onUploadError({
        id: Math.random().toString(36).substring(2, 9),
        filename: file.name,
        reason: "corrupt",
        message: "Network or server connection failed during upload.",
        nextStep: "Check server connection and retry.",
        timestamp: Date.now(),
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = () => {
    setIsDragOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-2.5 font-sans">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-[12px] p-4 text-center cursor-pointer transition-all duration-150 ${
          isDragOver
            ? "border-[#2563EB] bg-[#EFF6FF] scale-[1.01]"
            : "border-[#D1D5DB] hover:border-[#2563EB] bg-[#F9FAFB] hover:bg-white"
        } ${isUploading ? "opacity-75 pointer-events-none" : ""}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="flex flex-col items-center justify-center">
          {isUploading ? (
            <div className="flex flex-col items-center py-1">
              <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin mb-1.5" />
              <span className="text-[12px] font-medium text-[#111827]">
                Uploading and verifying...
              </span>
            </div>
          ) : (
            <>
              <div className="w-8 h-8 rounded-full bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center mb-1.5">
                <UploadCloud className="w-4 h-4" />
              </div>
              <p className="text-[12.5px] font-medium text-[#111827]">
                Drop PDF or DOCX here, or <span className="text-[#2563EB] underline">browse</span>
              </p>
              <p className="text-[11px] text-[#6B7280] mt-0.5">
                Up to 25MB, max 400 pages
              </p>
            </>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void onSeedSamples();
        }}
        disabled={isSeeding || isUploading}
        className="w-full py-1.5 px-3 text-[12.5px] font-medium text-[#2563EB] bg-[#EFF6FF] hover:bg-[#DBEAFE] rounded-[8px] border border-[#BFDBFE] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
      >
        {isSeeding ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Seeding sample contracts...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>Try with sample contracts</span>
          </>
        )}
      </button>
    </div>
  );
};
