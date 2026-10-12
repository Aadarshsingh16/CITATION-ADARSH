/**
 * Core domain types for Contract Analyser.
 */

export type DocumentStatus =
  | "uploading"
  | "extracting"
  | "indexing"
  | "ready"
  | "rejected"
  | "failed";

export type RejectionReason =
  | "wrong_extension"
  | "magic_byte_mismatch"
  | "file_too_large"
  | "page_limit_exceeded"
  | "encrypted"
  | "no_text_layer"
  | "corrupt";

export interface PageItemMap {
  starts: number[];
  lens: number[];
}

export interface DocumentRecord {
  id: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  status: DocumentStatus;
  statusDetail?: string | null;
  rejectReason?: string | null;
  pageCount?: number | null;
  charCount?: number | null;
  text?: string | null;
  sha256?: string | null;
  unreadablePages?: number[] | null;
  createdAt: Date | string;
  isDuplicate?: boolean;
}

export interface PageRecord {
  id: string;
  documentId: string;
  pageNumber: number;
  startOffset: number;
  endOffset: number;
  items?: PageItemMap | null;
}

export interface ChunkRecord {
  id: string;
  documentId: string;
  ordinal: number;
  startOffset: number;
  endOffset: number;
  heading?: string | null;
  clauseRef?: string | null;
  tokenEst: number;
}

export interface Coverage {
  mode: "full" | "map_reduce" | "retrieval" | "agent";
  chunksTotal: number;
  chunksRead: number;
  complete: boolean;
  unreadablePages: number[];
  perDoc?: Record<string, { chunksTotal: number; chunksRead: number }>;
}

export interface DismissibleError {
  id: string;
  filename: string;
  reason: RejectionReason;
  message: string;
  nextStep: string;
  timestamp: number;
}
