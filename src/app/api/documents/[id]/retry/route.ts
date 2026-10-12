import { NextResponse } from "next/server";
import { retryDocument } from "@/server/documents";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ok = await retryDocument(id);

    if (!ok) {
      return NextResponse.json({ error: "Document not found or cannot be retried" }, { status: 404 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
