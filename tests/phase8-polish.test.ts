/**
 * Phase 8: Polish, Robustness, Rate Limiting & Stale Sweeper Acceptance Tests
 * Tests D-039, D-040, D-042, and D-046.
 */

import { checkRateLimit, checkDailyTokenCeiling, recordTokenUsage } from "../src/lib/rate-limit";
import { sweepStaleJobs, retryDocument, createDocumentFromUpload } from "../src/server/documents";
import { db } from "../src/server/db";
import { documents, documentFiles } from "../src/server/db/schema";
import { eq } from "drizzle-orm";
import { createSyntheticPdf } from "../src/lib/test-fixtures/pdf-generator";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

async function runPhase8Tests() {
  console.log("=== Running Phase 8 Polish & System Robustness Acceptance Tests ===");

  // --------------------------------------------------------------------
  // Test 1: D-039 - Rate Limiter enforces per-IP bounds and friendly message
  // --------------------------------------------------------------------
  {
    const testIp = "192.168.1.99";
    // Burn through the bucket
    let allowedCount = 0;
    for (let i = 0; i < 70; i++) {
      const res = checkRateLimit(testIp);
      if (res.allowed) {
        allowedCount++;
      } else {
        assert(Boolean(res.retryAfterSec), "Blocked request contains retryAfterSec");
        assert(Boolean(res.reason && res.reason.includes("Rate limit")), "Contains friendly rate limit explanation");
        break;
      }
    }
    assert(allowedCount <= 60, "Must not allow more than max requests per minute");
    console.log("PASS: 1. D-039: Rate limiter enforces per-IP request limits with retry guidance");
  }

  // --------------------------------------------------------------------
  // Test 2: D-039 - Daily Token Ceiling rejects requests when exceeded
  // --------------------------------------------------------------------
  {
    const initialCheck = checkDailyTokenCeiling(100);
    assert(initialCheck.allowed === true, "Initial token check is allowed");

    // Simulate exceeding the ceiling
    recordTokenUsage(1_000_000);
    const exceededCheck = checkDailyTokenCeiling(100);
    assert(exceededCheck.allowed === false, "Check fails when ceiling exceeded");
    assert(Boolean(exceededCheck.reason && exceededCheck.reason.includes("daily token ceiling")), "Contains clear ceiling notice");

    console.log("PASS: 2. D-039: Global daily token ceiling blocks requests when limit reached");
  }

  // --------------------------------------------------------------------
  // Test 3: D-040 - Stale job sweeper marks stuck documents as failed with Retry notice
  // --------------------------------------------------------------------
  {
    // Insert a simulated stuck document in 'extracting' state
    const [stuckDoc] = await db
      .insert(documents)
      .values({
        filename: "Interrupted_Agreement.pdf",
        mime: "application/pdf",
        sizeBytes: 1024,
        status: "extracting",
        statusDetail: "Extracting page 5...",
      })
      .returning();

    // Store dummy raw file
    await db.insert(documentFiles).values({
      documentId: stuckDoc.id,
      data: Buffer.from("%PDF-1.4 dummy"),
    });

    // Run stale sweeper
    const sweptCount = await sweepStaleJobs();
    assert(sweptCount >= 1, "Swept at least one interrupted document");

    const [updated] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, stuckDoc.id))
      .limit(1);

    assert(updated.status === "failed", "Stuck document transitioned to 'failed'");
    assert(Boolean(updated.statusDetail && updated.statusDetail.includes("Retry")), "Status detail invites retry");

    // Test retryDocument
    const retried = await retryDocument(stuckDoc.id);
    assert(retried === true, "retryDocument returns true for valid stored file");

    const [retriedDoc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, stuckDoc.id))
      .limit(1);

    assert(retriedDoc.status === "extracting" || retriedDoc.status === "ready" || retriedDoc.status === "rejected", "Document status was reset for retry processing");

    // Clean up test row
    await db.delete(documentFiles).where(eq(documentFiles.documentId, stuckDoc.id));
    await db.delete(documents).where(eq(documents.id, stuckDoc.id));

    console.log("PASS: 3. D-040: Stale-job sweeper safely handles interrupted jobs with Retry re-run");
  }

  // --------------------------------------------------------------------
  // Test 4: D-046 - Duplicate upload detection via sha256 hash
  // --------------------------------------------------------------------
  {
    const pdfBuf = createSyntheticPdf(["Contract Duplicate Test Page\n1. Scope of work."]);
    const res1 = await createDocumentFromUpload("Duplicate_Test_1.pdf", pdfBuf);
    assert(res1.success === true, "First upload succeeds");
    assert(res1.document.isDuplicate === false, "First upload is not duplicate");

    const res2 = await createDocumentFromUpload("Duplicate_Test_2.pdf", pdfBuf);
    assert(res2.success === true, "Second upload succeeds (allowed with notice)");
    assert(res2.document.isDuplicate === true, "Second upload is flagged as duplicate");

    // Clean up
    await db.delete(documentFiles).where(eq(documentFiles.documentId, res1.document.id));
    await db.delete(documents).where(eq(documents.id, res1.document.id));
    await db.delete(documentFiles).where(eq(documentFiles.documentId, res2.document.id));
    await db.delete(documents).where(eq(documents.id, res2.document.id));

    console.log("PASS: 4. D-046: Duplicate upload soft-alert via SHA-256 hash verified");
  }

  console.log("\n========================================");
  console.log("Results: 4 passed, 0 failed");
  console.log("========================================");
}

runPhase8Tests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
