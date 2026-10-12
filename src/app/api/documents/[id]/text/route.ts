import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { documents, pages } from "@/server/db/schema";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const docPages = await db
      .select()
      .from(pages)
      .where(eq(pages.documentId, id))
      .orderBy(pages.pageNumber);

    return NextResponse.json(
      {
        id: doc.id,
        filename: doc.filename,
        mime: doc.mime,
        status: doc.status,
        pageCount: doc.pageCount,
        charCount: doc.charCount,
        text: doc.text,
        unreadablePages: doc.unreadablePages,
        pages: docPages,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
