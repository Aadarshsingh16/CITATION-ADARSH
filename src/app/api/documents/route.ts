import { NextResponse } from "next/server";
import { listDocuments } from "@/server/documents";

export async function GET() {
  try {
    const docs = await listDocuments();
    return NextResponse.json({ documents: docs }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to fetch documents: ${msg}` },
      { status: 500 }
    );
  }
}
