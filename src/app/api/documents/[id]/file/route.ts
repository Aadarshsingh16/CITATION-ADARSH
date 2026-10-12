import { NextResponse } from "next/server";
import { getDocumentFile } from "@/server/documents";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const file = await getDocumentFile(id);

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    return new Response(new Uint8Array(file.data), {
      status: 200,
      headers: {
        "Content-Type": file.mime,
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.filename)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
