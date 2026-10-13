/**
 * Zod Schemas and Function Definitions for Agent Tools (Phase 7, Part C, D-026, D-027)
 */

import { z } from "zod";

export const SearchDocumentSchema = z.object({
  query: z
    .string()
    .min(1, "query must not be empty")
    .max(200, "query must be at most 200 characters"),
  top_k: z
    .number()
    .int("top_k must be an integer")
    .min(1, "top_k must be at least 1")
    .max(10, "top_k cannot exceed 10")
    .optional()
    .default(5),
  doc_id: z.string().optional(),
});

export const GetSectionSchema = z
  .object({
    ref: z.string().optional(),
    chunk_id: z.string().optional(),
    doc_id: z.string().optional(),
  })
  .refine(
    (data) => Boolean(data.ref || data.chunk_id),
    {
      message: "At least one of 'ref' or 'chunk_id' must be provided",
      path: ["ref"],
    }
  );

export const ListClausesSchema = z.object({
  doc_id: z.string().optional(),
});

export type SearchDocumentArgs = z.infer<typeof SearchDocumentSchema>;
export type GetSectionArgs = z.infer<typeof GetSectionSchema>;
export type ListClausesArgs = z.infer<typeof ListClausesSchema>;

/**
 * OpenAI / OpenRouter function calling tool specifications.
 */
export const AGENT_TOOLS_SPEC = [
  {
    type: "function",
    function: {
      name: "search_document",
      description: "Search document chunks using keyword search (BM25) to find relevant clauses or provisions.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search term or concept to find in the contract (e.g. 'termination for convenience', 'limitation of liability', 'payment milestone').",
          },
          top_k: {
            type: "integer",
            description: "Maximum number of results to return (1 to 10, default 5).",
          },
          doc_id: {
            type: "string",
            description: "Optional document ID to restrict search to a specific contract in multi-doc chats.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_section",
      description: "Retrieve the full verbatim text of a specific contract section or chunk by its clause reference (e.g. '14.2') or chunk ID.",
      parameters: {
        type: "object",
        properties: {
          ref: {
            type: "string",
            description: "Clause number or title (e.g. '14.2' or 'Limitation of Liability').",
          },
          chunk_id: {
            type: "string",
            description: "Exact chunk identifier from a previous search result.",
          },
          doc_id: {
            type: "string",
            description: "Optional document ID for disambiguation.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_clauses",
      description: "List the outline of all numbered clauses, sections, and headings in the document.",
      parameters: {
        type: "object",
        properties: {
          doc_id: {
            type: "string",
            description: "Optional document ID to list clauses for a specific contract.",
          },
        },
      },
    },
  },
];
