/**
 * BM25 chunk retrieval engine for targeted queries on large contracts.
 * Always produces partial coverage (complete = false).
 */

import { BM25Index, type BM25Document } from "./bm25";
import type { ChunkRecord, Coverage } from "../types";

export interface DocumentWithChunks {
  id: string;
  label: string;
  filename: string;
  text: string;
  chunks: ChunkRecord[];
  unreadablePages?: number[];
}

export interface RetrievalResult {
  contextText: string;
  retrievedChunks: Array<{
    docId: string;
    chunkId: string;
    heading?: string | null;
    clauseRef?: string | null;
    startOffset: number;
    endOffset: number;
    text: string;
  }>;
  coverage: Coverage;
}

interface IndexableChunk extends BM25Document {
  docId: string;
  label: string;
  chunk: ChunkRecord;
  fullText: string;
}

/**
 * Retrieves the most relevant chunks using BM25 and includes adjacent neighbor chunks.
 */
export function retrieveChunksForQuery(
  documents: DocumentWithChunks[],
  query: string,
  options: { topK?: number; includeNeighbors?: boolean } = {}
): RetrievalResult {
  const topK = options.topK ?? 4;
  const includeNeighbors = options.includeNeighbors ?? true;

  // 1. Build indexable items from all documents
  const allIndexDocs: IndexableChunk[] = [];
  const totalChunksMap: Record<string, number> = {};

  for (const doc of documents) {
    totalChunksMap[doc.label] = doc.chunks.length;

    for (const chunk of doc.chunks) {
      const chunkText = doc.text.slice(chunk.startOffset, chunk.endOffset);
      allIndexDocs.push({
        id: `${doc.id}:${chunk.id}`,
        docId: doc.id,
        label: doc.label,
        chunk,
        text: `${chunk.heading || ""} ${chunk.clauseRef || ""} ${chunkText}`,
        fullText: chunkText,
      });
    }
  }

  // 2. Query BM25 index
  const index = new BM25Index(allIndexDocs);
  const searchResults = index.search(query, topK);

  // 3. Collect selected chunks plus optional immediate neighbors
  const selectedKeys = new Set<string>();

  for (const res of searchResults) {
    selectedKeys.add(res.doc.chunk.id);

    if (includeNeighbors) {
      // Find parent doc chunks
      const parentDoc = documents.find((d) => d.id === res.doc.docId);
      if (parentDoc) {
        const ord = res.doc.chunk.ordinal;
        const prev = parentDoc.chunks.find((c) => c.ordinal === ord - 1);
        const next = parentDoc.chunks.find((c) => c.ordinal === ord + 1);
        if (prev) selectedKeys.add(prev.id);
        if (next) selectedKeys.add(next.id);
      }
    }
  }

  // Fallback: if BM25 found nothing (e.g. query has no common terms), take top 2 chunks
  if (selectedKeys.size === 0 && allIndexDocs.length > 0) {
    for (let i = 0; i < Math.min(2, allIndexDocs.length); i++) {
      selectedKeys.add(allIndexDocs[i].chunk.id);
    }
  }

  // 4. Build output retrieved list sorted by document and ordinal
  const retrievedList: RetrievalResult["retrievedChunks"] = [];
  const perDocRead: Record<string, number> = {};
  let contextText = "";

  for (const doc of documents) {
    const docChunks = doc.chunks.filter((c) => selectedKeys.has(c.id));
    perDocRead[doc.label] = docChunks.length;

    if (docChunks.length > 0) {
      contextText += `=== DOCUMENT ${doc.label} (${doc.filename}) [${docChunks.length} of ${doc.chunks.length} sections] ===\n\n`;

      for (const c of docChunks) {
        const cText = doc.text.slice(c.startOffset, c.endOffset);
        retrievedList.push({
          docId: doc.id,
          chunkId: c.id,
          heading: c.heading,
          clauseRef: c.clauseRef,
          startOffset: c.startOffset,
          endOffset: c.endOffset,
          text: cText,
        });

        const headerStr = c.clauseRef || c.heading ? `[${c.clauseRef || ""} ${c.heading || ""}]` : "";
        contextText += `--- Section ${c.ordinal} ${headerStr} ---\n${cText}\n\n`;
      }
    }
  }

  const chunksTotal = allIndexDocs.length;
  const chunksRead = selectedKeys.size;
  const allUnreadable = Array.from(
    new Set(documents.flatMap((d) => d.unreadablePages || []))
  );

  const perDocCoverage: Record<string, { chunksTotal: number; chunksRead: number }> = {};
  for (const doc of documents) {
    perDocCoverage[doc.label] = {
      chunksTotal: doc.chunks.length,
      chunksRead: perDocRead[doc.label] || 0,
    };
  }

  const coverage: Coverage = {
    mode: "retrieval",
    chunksTotal,
    chunksRead,
    complete: false, // Retrieval is ALWAYS partial!
    unreadablePages: allUnreadable,
    perDoc: perDocCoverage,
  };

  return {
    contextText,
    retrievedChunks: retrievedList,
    coverage,
  };
}
