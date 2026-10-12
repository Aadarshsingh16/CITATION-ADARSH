import { eq, inArray, desc } from "drizzle-orm";
import { db } from "./db";
import { documents, documentFiles, pages, chunks } from "./db/schema";
import { validateUploadedFile, type ValidationFailure } from "../lib/ingestion/validate";
import { extractPdf } from "../lib/ingestion/extract-pdf";
import { extractDocx } from "../lib/ingestion/extract-docx";
import { buildCanonicalFromPdf, buildCanonicalFromDocx } from "../lib/ingestion/canonical";
import { chunkCanonicalText } from "../lib/chunking/chunker";
import type { DocumentRecord } from "../lib/types";

let staleSweepExecuted = false;

/**
 * Sweeps any interrupted jobs left in progress (D-040).
 */
export async function sweepStaleJobs(): Promise<number> {
  if (!process.env.DATABASE_URL) return 0;
  try {
    const staleStatuses = ["uploading", "extracting", "indexing"] as const;
    const staleDocs = await db
      .select({ id: documents.id })
      .from(documents)
      .where(inArray(documents.status, staleStatuses));

    if (staleDocs.length === 0) return 0;

    await db
      .update(documents)
      .set({
        status: "failed",
        statusDetail: "Processing was interrupted. Click Retry to re-run from the stored file.",
      })
      .where(inArray(documents.status, staleStatuses));

    return staleDocs.length;
  } catch (err) {
    console.error("Error sweeping stale jobs:", err);
    return 0;
  }
}

/**
 * Ensure stale job sweep runs once on initial invocation.
 */
export async function ensureStaleSweep(): Promise<void> {
  if (!staleSweepExecuted) {
    staleSweepExecuted = true;
    await sweepStaleJobs();
  }
}

export interface IngestionResultSuccess {
  success: true;
  document: DocumentRecord;
}

export interface IngestionResultFailure {
  success: false;
  error: ValidationFailure;
}

export type IngestionResult = IngestionResultSuccess | IngestionResultFailure;

/**
 * Validates, records, and initiates background processing of an uploaded file.
 */
export async function createDocumentFromUpload(
  filename: string,
  buffer: Buffer
): Promise<IngestionResult> {
  await ensureStaleSweep();

  // 1. Validation & Magic-byte check
  const valResult = validateUploadedFile(filename, buffer);
  if (!valResult.valid) {
    return {
      success: false,
      error: valResult,
    };
  }

  // 2. Check for duplicate upload via SHA-256 (D-046)
  const existingWithHash = await db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.sha256, valResult.sha256))
    .limit(1);

  const isDuplicate = existingWithHash.length > 0;

  // 3. Create initial document row
  const [doc] = await db
    .insert(documents)
    .values({
      filename,
      mime: valResult.mime,
      sizeBytes: buffer.length,
      status: "uploading",
      statusDetail: "Saving document...",
      sha256: valResult.sha256,
    })
    .returning();

  // 4. Store raw binary into document_files (D-031)
  await db.insert(documentFiles).values({
    documentId: doc.id,
    data: buffer,
  });

  // 5. Trigger asynchronous processing
  void processDocument(doc.id).catch((err) => {
    console.error(`Background ingestion failed for doc ${doc.id}:`, err);
  });

  return {
    success: true,
    document: {
      ...doc,
      isDuplicate,
    },
  };
}

/**
 * Full extraction, canonicalization, and chunking pipeline.
 */
export async function processDocument(documentId: string): Promise<void> {
  try {
    // 1. Read raw file buffer
    const [fileRow] = await db
      .select({ data: documentFiles.data })
      .from(documentFiles)
      .where(eq(documentFiles.documentId, documentId))
      .limit(1);

    if (!fileRow) {
      await db
        .update(documents)
        .set({
          status: "failed",
          statusDetail: "Raw document file not found.",
        })
        .where(eq(documents.id, documentId));
      return;
    }

    const [docRow] = await db
      .select({ filename: documents.filename, mime: documents.mime })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    const isPdf = docRow.mime === "application/pdf" || docRow.filename.toLowerCase().endsWith(".pdf");

    // Update status to extracting
    await db
      .update(documents)
      .set({
        status: "extracting",
        statusDetail: "Starting extraction...",
      })
      .where(eq(documents.id, documentId));

    if (isPdf) {
      // PDF extraction
      const pdfRes = await extractPdf(fileRow.data, async (cur, total, msg) => {
        await db
          .update(documents)
          .set({ statusDetail: msg })
          .where(eq(documents.id, documentId));
      });

      if (!pdfRes.success) {
        // Quality gate rejected (scanned, encrypted, etc.)
        await db
          .update(documents)
          .set({
            status: "rejected",
            rejectReason: pdfRes.reason,
            statusDetail: pdfRes.message,
          })
          .where(eq(documents.id, documentId));
        return;
      }

      // Assemble canonical text
      const canonical = buildCanonicalFromPdf(pdfRes.pages);

      // Transition to indexing
      await db
        .update(documents)
        .set({
          status: "indexing",
          statusDetail: "Indexing document chunks...",
          text: canonical.text,
          pageCount: canonical.pageCount,
          charCount: canonical.charCount,
          unreadablePages: pdfRes.unreadablePages,
        })
        .where(eq(documents.id, documentId));

      // Insert pages with rendered item offset maps (D-035)
      for (const p of canonical.pages) {
        await db.insert(pages).values({
          documentId,
          pageNumber: p.pageNumber,
          startOffset: p.startOffset,
          endOffset: p.endOffset,
          items: p.items,
        });
      }

      // Chunk canonical text
      const draftChunks = chunkCanonicalText(canonical.text);
      for (const c of draftChunks) {
        await db.insert(chunks).values({
          documentId,
          ordinal: c.ordinal,
          startOffset: c.startOffset,
          endOffset: c.endOffset,
          heading: c.heading,
          clauseRef: c.clauseRef,
          tokenEst: c.tokenEst,
        });
      }

      // Mark ready
      await db
        .update(documents)
        .set({
          status: "ready",
          statusDetail: "Document is ready for analysis.",
        })
        .where(eq(documents.id, documentId));
    } else {
      // DOCX extraction
      await db
        .update(documents)
        .set({
          status: "extracting",
          statusDetail: "Extracting Word document text...",
        })
        .where(eq(documents.id, documentId));

      const docxRes = await extractDocx(fileRow.data);

      if (!docxRes.success) {
        await db
          .update(documents)
          .set({
            status: "rejected",
            rejectReason: docxRes.reason,
            statusDetail: docxRes.message,
          })
          .where(eq(documents.id, documentId));
        return;
      }

      const canonical = buildCanonicalFromDocx(docxRes.sections);

      await db
        .update(documents)
        .set({
          status: "indexing",
          statusDetail: "Indexing sections...",
          text: canonical.text,
          pageCount: canonical.pageCount,
          charCount: canonical.charCount,
        })
        .where(eq(documents.id, documentId));

      for (const p of canonical.pages) {
        await db.insert(pages).values({
          documentId,
          pageNumber: p.pageNumber,
          startOffset: p.startOffset,
          endOffset: p.endOffset,
          items: null,
        });
      }

      const draftChunks = chunkCanonicalText(canonical.text);
      for (const c of draftChunks) {
        await db.insert(chunks).values({
          documentId,
          ordinal: c.ordinal,
          startOffset: c.startOffset,
          endOffset: c.endOffset,
          heading: c.heading,
          clauseRef: c.clauseRef,
          tokenEst: c.tokenEst,
        });
      }

      await db
        .update(documents)
        .set({
          status: "ready",
          statusDetail: "Document is ready for analysis.",
        })
        .where(eq(documents.id, documentId));
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await db
      .update(documents)
      .set({
        status: "failed",
        statusDetail: `Extraction failed: ${errorMsg}`,
      })
      .where(eq(documents.id, documentId));
  }
}

/**
 * Retries processing for a failed document from its stored raw file.
 */
export async function retryDocument(documentId: string): Promise<boolean> {
  const [doc] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!doc) return false;

  // Clean existing derived rows
  await db.delete(pages).where(eq(pages.documentId, documentId));
  await db.delete(chunks).where(eq(chunks.documentId, documentId));

  // Reset status
  await db
    .update(documents)
    .set({
      status: "extracting",
      statusDetail: "Restarting extraction...",
      rejectReason: null,
    })
    .where(eq(documents.id, documentId));

  void processDocument(documentId).catch(console.error);
  return true;
}

/**
 * Lists all documents in descending order of upload.
 */
export async function listDocuments(): Promise<DocumentRecord[]> {
  await ensureStaleSweep();
  return db
    .select()
    .from(documents)
    .orderBy(desc(documents.createdAt));
}

/**
 * Gets a single document by ID.
 */
export async function getDocument(documentId: string): Promise<DocumentRecord | null> {
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  return doc || null;
}

/**
 * Gets pages for a document, ordered by page number.
 */
export async function getDocumentPages(documentId: string) {
  return db
    .select()
    .from(pages)
    .where(eq(pages.documentId, documentId))
    .orderBy(pages.pageNumber);
}

/**
 * Gets chunks for a document, ordered by ordinal.
 */
export async function getDocumentChunks(documentId: string) {
  return db
    .select()
    .from(chunks)
    .where(eq(chunks.documentId, documentId))
    .orderBy(chunks.ordinal);
}

/**
 * Deletes a document and its cascading records.
 */
export async function deleteDocument(documentId: string): Promise<boolean> {
  const res = await db.delete(documents).where(eq(documents.id, documentId)).returning();
  return res.length > 0;
}

/**
 * Retrieves the raw file binary data, mime type, and filename for a document.
 */
export async function getDocumentFile(
  documentId: string
): Promise<{ data: Buffer; mime: string; filename: string } | null> {
  const [doc] = await db
    .select({ filename: documents.filename, mime: documents.mime })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!doc) return null;

  const [fileRow] = await db
    .select({ data: documentFiles.data })
    .from(documentFiles)
    .where(eq(documentFiles.documentId, documentId))
    .limit(1);

  if (!fileRow || !fileRow.data) return null;

  return {
    data: Buffer.from(fileRow.data),
    mime: doc.mime,
    filename: doc.filename,
  };
}
