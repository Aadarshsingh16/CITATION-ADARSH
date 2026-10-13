/**
 * Agent Tool Implementations and Structured Error Handlers (Phase 7, C1, C5, D-027)
 */

import {
  SearchDocumentSchema,
  GetSectionSchema,
  ListClausesSchema,
  type SearchDocumentArgs,
  type GetSectionArgs,
  type ListClausesArgs,
} from "./schemas";
import { BM25Index } from "../chunking/bm25";
import type { ChunkRecord } from "../types";
import type { DocumentWithChunks } from "../chunking/retrieval";

export interface AgentToolContext {
  documents: DocumentWithChunks[];
  selectedDocIds: string[];
  readChunkIds: Set<string>;
}

export interface ToolExecutionResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  details?: string;
  available?: string[];
  progressMessage: string;
}

const AVAILABLE_TOOLS = ["search_document", "get_section", "list_clauses"];

/**
 * Executes an agent tool with strict validation and resilient error recovery.
 * Never throws an uncaught error.
 */
export async function executeAgentTool(
  toolName: string,
  rawArgs: unknown,
  context: AgentToolContext
): Promise<ToolExecutionResult> {
  try {
    // 1. Unknown tool
    if (!AVAILABLE_TOOLS.includes(toolName)) {
      return {
        ok: false,
        error: "unknown_tool",
        available: AVAILABLE_TOOLS,
        progressMessage: `Unknown tool '${toolName}', retrying with available tools`,
      };
    }

    // 2. Parse arguments if passed as JSON string
    let parsedArgs = rawArgs;
    if (typeof rawArgs === "string") {
      try {
        parsedArgs = JSON.parse(rawArgs);
      } catch {
        return {
          ok: false,
          error: "malformed_arguments",
          details: "Could not parse JSON arguments",
          progressMessage: "Malformed arguments received, requesting valid JSON",
        };
      }
    }

    if (typeof parsedArgs !== "object" || parsedArgs === null) {
      return {
        ok: false,
        error: "invalid_arguments",
        details: "Arguments must be an object",
        progressMessage: "Arguments must be a valid object, retrying",
      };
    }

    // 3. Dispatch to tool
    switch (toolName) {
      case "search_document":
        return executeSearchDocument(parsedArgs, context);
      case "get_section":
        return executeGetSection(parsedArgs, context);
      case "list_clauses":
        return executeListClauses(parsedArgs, context);
      default:
        return {
          ok: false,
          error: "unknown_tool",
          available: AVAILABLE_TOOLS,
          progressMessage: `Unknown tool '${toolName}'`,
        };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Tool execution error for '${toolName}':`, message);
    return {
      ok: false,
      error: "tool_failed",
      details: message,
      progressMessage: "That lookup encountered an internal issue, continuing",
    };
  }
}

/**
 * Tool: search_document
 */
function executeSearchDocument(
  args: unknown,
  context: AgentToolContext
): ToolExecutionResult {
  const parseResult = SearchDocumentSchema.safeParse(args);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0]?.message || "Invalid arguments";
    return {
      ok: false,
      error: "invalid_arguments",
      details: firstIssue,
      progressMessage: `Invalid search parameters: ${firstIssue}`,
    };
  }

  const { query, top_k, doc_id } = parseResult.data;

  // Validate doc_id if provided
  if (doc_id && !context.selectedDocIds.includes(doc_id)) {
    return {
      ok: false,
      error: "invalid_arguments",
      details: `doc_id '${doc_id}' is not among selected documents (${context.selectedDocIds.join(", ")})`,
      progressMessage: `Document ${doc_id} is not selected in this session`,
    };
  }

  // Filter docs
  const targetDocs = doc_id
    ? context.documents.filter((d) => d.id === doc_id)
    : context.documents;

  const allChunks: Array<{
    chunk: ChunkRecord;
    docId: string;
    docTitle: string;
    docText: string;
    pageNumber: number;
  }> = [];
  for (const doc of targetDocs) {
    const docTitle = (doc as any).title || doc.filename || doc.label || doc.id;
    const docText = (doc as any).canonicalText || doc.text || "";
    for (const chunk of doc.chunks) {
      const pageNumber =
        (doc as any).pages?.find(
          (p: any) => chunk.startOffset >= p.startOffset && chunk.startOffset < p.endOffset
        )?.pageNumber || 1;
      allChunks.push({ chunk, docId: doc.id, docTitle, docText, pageNumber });
    }
  }

  if (allChunks.length === 0) {
    return {
      ok: true,
      data: [],
      progressMessage: `Searched for "${query}" (no chunks available)`,
    };
  }

  // BM25 Ranking
  const allIndexDocs = allChunks.map((item) => {
    const chunkText =
      (item.chunk as any).text ||
      item.docText.slice(item.chunk.startOffset, item.chunk.endOffset);
    return {
      id: item.chunk.id,
      docId: item.docId,
      docTitle: item.docTitle,
      chunk: item.chunk,
      chunkText,
      pageNumber: item.pageNumber,
      text: `${item.chunk.heading || ""} ${item.chunk.clauseRef || ""} ${chunkText}`,
    };
  });

  const index = new BM25Index(allIndexDocs);
  const searchResults = index.search(query, top_k);

  const results = searchResults.map((item) => {
    // Mark as read
    context.readChunkIds.add(item.doc.chunk.id);

    // Make concise snippet
    const chunkText = item.doc.chunkText;
    const snippet =
      chunkText.length > 300
        ? chunkText.slice(0, 300).trim() + "..."
        : chunkText;

    return {
      chunk_id: item.doc.chunk.id,
      doc_id: item.doc.docId,
      doc_title: item.doc.docTitle,
      clause_ref: item.doc.chunk.clauseRef || `Chunk ${item.doc.chunk.ordinal}`,
      heading: item.doc.chunk.heading || "",
      score: Math.round(item.score * 100) / 100,
      snippet,
    };
  });

  return {
    ok: true,
    data: results,
    progressMessage: `Found ${results.length} matching section(s) for "${query}"`,
  };
}

/**
 * Tool: get_section
 */
function executeGetSection(
  args: unknown,
  context: AgentToolContext
): ToolExecutionResult {
  const parseResult = GetSectionSchema.safeParse(args);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0]?.message || "Invalid arguments";
    return {
      ok: false,
      error: "invalid_arguments",
      details: firstIssue,
      progressMessage: `Invalid section lookup parameters: ${firstIssue}`,
    };
  }

  const { ref, chunk_id, doc_id } = parseResult.data;

  const targetDocs = doc_id
    ? context.documents.filter((d) => d.id === doc_id)
    : context.documents;

  let foundChunk: ChunkRecord | null = null;
  let foundDocId = "";
  let foundDocTitle = "";

  for (const doc of targetDocs) {
      const docTitle = (doc as any).title || doc.filename || doc.label || doc.id;
      if (chunk_id) {
        const match = doc.chunks.find((c) => c.id === chunk_id);
        if (match) {
          foundChunk = match;
          foundDocId = doc.id;
          foundDocTitle = docTitle;
          break;
        }
      }

      if (ref) {
        const cleanRef = ref.toLowerCase().trim();
        let match = doc.chunks.find((c) => c.clauseRef?.toLowerCase() === cleanRef);
        if (!match) {
          match = doc.chunks.find((c) => c.heading?.toLowerCase().includes(cleanRef));
        }
        if (!match) {
          const docText = (doc as any).canonicalText || doc.text || "";
          match = doc.chunks.find((c) => {
            const chunkText = (c as any).text || docText.slice(c.startOffset, c.endOffset);
            return chunkText.toLowerCase().includes(cleanRef);
          });
        }
        if (match) {
          foundChunk = match;
          foundDocId = doc.id;
          foundDocTitle = docTitle;
          break;
        }
      }
  }

  if (!foundChunk) {
    return {
      ok: false,
      error: "section_not_found",
      details: `Could not find section with ref='${ref || ""}' chunk_id='${chunk_id || ""}'`,
      progressMessage: `Section '${ref || chunk_id}' was not found in document`,
    };
  }

  context.readChunkIds.add(foundChunk.id);

  const targetDoc = context.documents.find((d) => d.id === foundDocId);
  const targetDocText = (targetDoc as any)?.canonicalText || targetDoc?.text || "";
  const chunkText =
    (foundChunk as any).text ||
    targetDocText.slice(foundChunk.startOffset, foundChunk.endOffset);
  const foundPage =
    (targetDoc as any)?.pages?.find(
      (p: any) => foundChunk.startOffset >= p.startOffset && foundChunk.startOffset < p.endOffset
    )?.pageNumber || 1;

  return {
    ok: true,
    data: {
      chunk_id: foundChunk.id,
      doc_id: foundDocId,
      doc_title: foundDocTitle,
      clause_ref: foundChunk.clauseRef || `Chunk ${foundChunk.ordinal}`,
      heading: foundChunk.heading || "",
      text: chunkText,
      page: foundPage,
    },
    progressMessage: `Read clause ${foundChunk.clauseRef || foundChunk.id}${foundChunk.heading ? ` (${foundChunk.heading})` : ""}`,
  };
}

/**
 * Tool: list_clauses
 */
function executeListClauses(
  args: unknown,
  context: AgentToolContext
): ToolExecutionResult {
  const parseResult = ListClausesSchema.safeParse(args);
  if (!parseResult.success) {
    return {
      ok: false,
      error: "invalid_arguments",
      details: parseResult.error.issues[0]?.message || "Invalid arguments",
      progressMessage: "Invalid parameters for list_clauses",
    };
  }

  const { doc_id } = parseResult.data;
  const targetDocs = doc_id
    ? context.documents.filter((d) => d.id === doc_id)
    : context.documents;

  const outline: Array<{
    ref: string;
    heading: string;
    chunk_id: string;
    doc_id: string;
    page: number;
  }> = [];

  for (const doc of targetDocs) {
    const docText = (doc as any).canonicalText || doc.text || "";
    for (const chunk of doc.chunks) {
      const page =
        (doc as any).pages?.find(
          (p: any) => chunk.startOffset >= p.startOffset && chunk.startOffset < p.endOffset
        )?.pageNumber || 1;
      const chunkText =
        (chunk as any).text || docText.slice(chunk.startOffset, chunk.endOffset);
      outline.push({
        ref: chunk.clauseRef || `Sec ${chunk.ordinal}`,
        heading: chunk.heading || chunkText.slice(0, 50).trim(),
        chunk_id: chunk.id,
        doc_id: doc.id,
        page,
      });
    }
  }

  return {
    ok: true,
    data: {
      total_clauses: outline.length,
      clauses: outline.slice(0, 50), // cap outline to first 50 sections for compact context
    },
    progressMessage: `Listed ${outline.length} clause(s) across selected contract(s)`,
  };
}
