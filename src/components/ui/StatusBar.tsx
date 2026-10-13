import React from "react";
import { Check, AlertTriangle, Sparkles, Clock, Info, XCircle } from "lucide-react";
import type { RejectionReason } from "@/lib/types";

export type StatusBarState =
  | "verified"
  | "verified_with_gaps"
  | "repaired"
  | "unverified"
  | "pending"
  | "info"
  | "danger";

interface StatusBarProps {
  state: StatusBarState;
  reason?: RejectionReason | string | null;
  customExplanation?: string;
  className?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  state,
  reason,
  customExplanation,
  className = "",
}) => {
  let label = "Checking";
  let explanation = "Looking for this quote in the document";
  let bg = "bg-[#E5E7EB]";
  let fg = "text-[#4B5563]";
  let icon = <Clock className="w-4 h-4 mr-1.5 shrink-0" />;

  switch (state) {
    case "verified":
      label = "Verified";
      explanation = "Found in the document";
      bg = "bg-[#DCFCE7]";
      fg = "text-[#15803D]";
      icon = <Check className="w-4 h-4 mr-1.5 shrink-0" />;
      break;

    case "verified_with_gaps":
      label = "Verified";
      explanation = "Found in the document, with gaps in the quote";
      bg = "bg-[#DCFCE7]";
      fg = "text-[#15803D]";
      icon = <Check className="w-4 h-4 mr-1.5 shrink-0" />;
      break;

    case "repaired":
      label = "Repaired";
      explanation = "Re-copied from the document, then verified";
      bg = "bg-[#EDE9FE]";
      fg = "text-[#6D28D9]";
      icon = <Sparkles className="w-4 h-4 mr-1.5 shrink-0" />;
      break;

    case "unverified":
      label = "Unverified";
      bg = "bg-[#FEF3C7]";
      fg = "text-[#B45309]";
      icon = <AlertTriangle className="w-4 h-4 mr-1.5 shrink-0" />;

      if (reason === "not_found") {
        explanation = "We could not find this wording in the document";
      } else if (reason === "too_short") {
        explanation = "Too short to check reliably";
      } else if (reason === "wrong_document") {
        explanation = "This wording is in a different document";
      } else if (reason === "corrupt" || reason === "encrypted" || reason === "no_text_layer") {
        explanation = "Document extraction prevented verification";
      } else {
        explanation = "We could not check this quote";
      }
      break;

    case "info":
      label = "Partial";
      explanation = customExplanation || "Partial coverage";
      bg = "bg-[#DBEAFE]";
      fg = "text-[#1D4ED8]";
      icon = <Info className="w-4 h-4 mr-1.5 shrink-0" />;
      break;

    case "danger":
      label = "Failed";
      explanation = customExplanation || "An error occurred";
      bg = "bg-[#FEE2E2]";
      fg = "text-[#B91C1C]";
      icon = <XCircle className="w-4 h-4 mr-1.5 shrink-0" />;
      break;

    case "pending":
    default:
      label = "Checking";
      explanation = "Looking for this quote in the document";
      bg = "bg-[#E5E7EB]";
      fg = "text-[#4B5563]";
      icon = <Clock className="w-4 h-4 mr-1.5 shrink-0" />;
      break;
  }

  if (customExplanation && state !== "info" && state !== "danger") {
    explanation = customExplanation;
  }

  return (
    <div
      className={`flex items-center justify-between h-8 px-3 rounded-t-[8px] ${bg} ${fg} text-[13px] font-sans ${className}`}
      role="status"
    >
      <div className="flex items-center font-semibold text-[13px] tracking-tight">
        {icon}
        <span>{label}</span>
      </div>
      <div className="italic text-[12.5px] opacity-80 text-right truncate ml-2">
        {explanation}
      </div>
    </div>
  );
};
