import type { Match, VerifyReason } from "@/lib/quotes";
import type { StatusBarState } from "../ui/StatusBar";
import type { ChipState } from "../ui/NumberChip";

export interface FormattedQuoteState {
  statusBarState: StatusBarState;
  chipState: ChipState;
  reason?: VerifyReason | string | null;
  locationText: string;
  isClickable: boolean;
  docTitle: string;
  docNumber?: string;
}

export function getQuoteState(
  status?: "verified" | "unverified" | "dropped" | "pending" | null,
  reason?: VerifyReason | string | null,
  matches?: Match[] | null,
  docName?: string,
  docIndex?: number,
  withGaps?: boolean,
  repaired?: boolean
): FormattedQuoteState {
  if (!status || status === "pending") {
    return {
      statusBarState: "pending",
      chipState: "pending",
      reason: null,
      locationText: "Checking...",
      isClickable: false,
      docTitle: docName || "Document",
      docNumber: docIndex !== undefined ? `D${docIndex + 1}` : undefined,
    };
  }

  let statusBarState: StatusBarState = "pending";
  let chipState: ChipState = "pending";
  let isClickable = false;

  if (status === "verified") {
    if (repaired) {
      statusBarState = "repaired";
      chipState = "repaired";
    } else if (withGaps) {
      statusBarState = "verified_with_gaps";
      chipState = "verified";
    } else {
      statusBarState = "verified";
      chipState = "verified";
    }
    isClickable = true;
  } else {
    statusBarState = "unverified";
    chipState = "unverified";
    isClickable = false;
  }

  let locationText = "In document";
  if (matches && matches.length > 0) {
    locationText = `Offset ${matches[0].start}..${matches[0].end}`;
  }

  return {
    statusBarState,
    chipState,
    reason,
    locationText,
    isClickable,
    docTitle: docName || "Document",
    docNumber: docIndex !== undefined ? `D${docIndex + 1}` : undefined,
  };
}
