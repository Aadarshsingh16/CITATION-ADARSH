"use client";

import React, { useState, useRef } from "react";
import type { DismissibleError, DocumentRecord } from "@/lib/types";

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
    <div className="space-y-2.5">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200 ${
          isDragOver
            ? "border-indigo-500 bg-indigo-50/60 scale-[1.01]"
            : "border-stone-300 hover:border-indigo-400 bg-white hover:bg-stone-50/50"
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
              <svg
                className="animate-spin h-6 w-6 text-indigo-600 mb-2"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              <span className="text-xs font-semibold text-indigo-900">
                Uploading and verifying...
              </span>
            </div>
          ) : (
            <>
              <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 mb-2">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <p className="text-xs font-semibold text-stone-800">
                Drop PDF or DOCX here, or <span className="text-indigo-600">browse</span>
              </p>
              <p className="text-[11px] text-stone-500 mt-0.5">
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
        className="w-full py-2 px-3 text-xs font-medium text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
      >
        {isSeeding ? (
          <>
            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Seeding sample contracts...
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Try with sample contracts
          </>
        )}
      </button>
    </div>
  );
};
