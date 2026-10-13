/**
 * Comparison API Endpoint (Phase 6, D-028, B8, B10)
 * POST: /api/compare
 * Body: { docAId: string, docBId: string }
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { documents, pages } from "@/server/db/schema";
import { compareDocuments } from "@/lib/compare";
import { checkRateLimit, checkDailyTokenCeiling } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    // Rate limit & Daily Token Ceiling Check (D-039)
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const rlCheck = checkRateLimit(clientIp);
    if (!rlCheck.allowed) {
      return NextResponse.json({ error: rlCheck.reason }, { status: 429 });
    }

    const ceilingCheck = checkDailyTokenCeiling(2000);
    if (!ceilingCheck.allowed) {
      return NextResponse.json({ error: ceilingCheck.reason }, { status: 429 });
    }

    const body = await req.json();
    const { docAId, docBId } = body;

    if (!docAId || !docBId) {
      return NextResponse.json(
        { error: "Both docAId and docBId are required for comparison." },
        { status: 400 }
      );
    }

    if (docAId === docBId) {
      return NextResponse.json(
        { error: "Cannot compare a document against itself." },
        { status: 400 }
      );
    }

    // Fetch Doc A
    const [docA] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, docAId))
      .limit(1);

    if (!docA || !docA.text) {
      return NextResponse.json({ error: `Document A (${docAId}) not found or unindexed` }, { status: 404 });
    }

    // Fetch Doc B
    const [docB] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, docBId))
      .limit(1);

    if (!docB || !docB.text) {
      return NextResponse.json({ error: `Document B (${docBId}) not found or unindexed` }, { status: 404 });
    }

    // Fetch pages for both
    const pagesA = await db
      .select()
      .from(pages)
      .where(eq(pages.documentId, docAId))
      .orderBy(pages.pageNumber);

    const pagesB = await db
      .select()
      .from(pages)
      .where(eq(pages.documentId, docBId))
      .orderBy(pages.pageNumber);

    const comparison = compareDocuments(
      {
        id: docA.id,
        title: docA.filename,
        filename: docA.filename,
        canonicalText: docA.text,
        pages: pagesA.map((p) => ({
          pageNumber: p.pageNumber,
          startOffset: p.startOffset,
          endOffset: p.endOffset,
        })),
      },
      {
        id: docB.id,
        title: docB.filename,
        filename: docB.filename,
        canonicalText: docB.text,
        pages: pagesB.map((p) => ({
          pageNumber: p.pageNumber,
          startOffset: p.startOffset,
          endOffset: p.endOffset,
        })),
      }
    );

    return NextResponse.json({
      success: true,
      comparison,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Comparison API failed:", message);
    return NextResponse.json(
      { error: `Comparison failed: ${message}` },
      { status: 500 }
    );
  }
}
