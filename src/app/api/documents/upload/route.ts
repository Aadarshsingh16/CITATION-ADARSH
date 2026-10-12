import { NextResponse } from "next/server";
import { createDocumentFromUpload } from "@/server/documents";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        {
          error: {
            reason: "no_file",
            message: "No file was provided in the upload request.",
            nextStep: "Select a PDF or DOCX file to upload.",
          },
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await createDocumentFromUpload(file.name, buffer);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 422 }
      );
    }

    return NextResponse.json({ document: result.document }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: {
          reason: "server_error",
          message: `Upload processing failed: ${msg}`,
          nextStep: "Please try uploading again.",
        },
      },
      { status: 500 }
    );
  }
}
