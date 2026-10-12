"use client";

import React from "react";

export interface QuotePillProps {
  id: string;
  docId?: string;
  status?: "pending" | "verified" | "unverified" | "dropped";
  onClick?: () => void;
}

export function QuotePill({ id, docId, status = "pending", onClick }: QuotePillProps) {
  let badgeStyles = "bg-stone-100 text-stone-600 border-stone-300 hover:bg-stone-200";
  let statusIcon = null;
  const docLabel = docId ? `${docId}·#${id}` : id;
  let titleText = `Quote [${docLabel}] - Verification pending`;

  if (status === "pending") {
    badgeStyles = "bg-stone-100 text-stone-500 border-stone-200 animate-pulse";
  } else if (status === "verified") {
    badgeStyles =
      "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700 shadow-2xs";
    statusIcon = (
      <svg className="w-2.5 h-2.5 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    );
    titleText = `Quote [${docLabel}] - Verified in contract text`;
  } else if (status === "unverified") {
    badgeStyles =
      "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700 shadow-2xs";
    statusIcon = (
      <svg className="w-2.5 h-2.5 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    );
    titleText = `Quote [${docLabel}] - Unverified quote`;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={titleText}
      className={`inline-flex items-center align-baseline px-1.5 py-0.2 mx-0.5 text-[11px] font-mono font-medium rounded-md border transition-all cursor-pointer ${badgeStyles}`}
    >
      <span>[{docLabel}]</span>
      {statusIcon}
    </button>
  );
}
