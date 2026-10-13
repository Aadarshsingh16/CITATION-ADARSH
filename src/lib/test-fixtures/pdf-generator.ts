/**
 * Generates valid minimal synthetic PDF buffers for testing and demo seeding.
 */
export function createSyntheticPdf(pages: string[]): Buffer {
  const objects: string[] = [];
  const xrefOffsets: number[] = [];

  // obj 1: Catalog
  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);

  // obj 2: Pages container
  const kids = pages.map((_, i) => `${3 + i * 2} 0 R`).join(" ");
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`);

  // obj for font: let's put it as the last object
  const fontObjNum = 3 + pages.length * 2;

  // page objects and contents
  for (let i = 0; i < pages.length; i++) {
    const pageNum = 3 + i * 2;
    const contentNum = pageNum + 1;
    const pageText = pages[i];

    // Build content stream with word-wrapping to prevent glyph clipping past page boundaries
    const rawLines = pageText.split("\n");
    const lines: string[] = [];
    for (const raw of rawLines) {
      if (raw.length <= 65) {
        lines.push(raw);
      } else {
        const words = raw.split(" ");
        let current = "";
        for (const w of words) {
          if (current && (current + " " + w).length > 65) {
            lines.push(current);
            current = w;
          } else {
            current = current ? current + " " + w : w;
          }
        }
        if (current) lines.push(current);
      }
    }

    let streamBody = "BT\n/F1 12 Tf\n";
    let isFirst = true;
    for (const line of lines) {
      if (!line) {
        streamBody += `0 -16 Td () Tj\n`;
        continue;
      }
      const escaped = line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
      if (isFirst) {
        streamBody += `50 750 Td (${escaped}) Tj\n`;
        isFirst = false;
      } else {
        streamBody += `0 -16 Td (${escaped}) Tj\n`;
      }
    }
    streamBody += "ET\n";

    const streamLength = Buffer.byteLength(streamBody, "utf-8");

    // Page obj
    objects.push(
      `${pageNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentNum} 0 R /Resources << /Font << /F1 ${fontObjNum} 0 R >> >> >>\nendobj\n`
    );

    // Contents obj
    objects.push(
      `${contentNum} 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamBody}endstream\nendobj\n`
    );
  }

  // Font object
  objects.push(
    `${fontObjNum} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`
  );

  let pdfStr = "%PDF-1.4\n";
  for (const obj of objects) {
    xrefOffsets.push(Buffer.byteLength(pdfStr, "utf-8"));
    pdfStr += obj;
  }

  const startXref = Buffer.byteLength(pdfStr, "utf-8");
  pdfStr += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

  for (const off of xrefOffsets) {
    const padded = String(off).padStart(10, "0");
    pdfStr += `${padded} 00000 n \n`;
  }

  pdfStr += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

  return Buffer.from(pdfStr, "utf-8");
}

/**
 * Creates an image-only / blank PDF with no readable text layer (for scanned PDF quality gate test).
 */
export function createScannedPdf(numPages = 2): Buffer {
  const emptyPages = Array(numPages).fill("");
  return createSyntheticPdf(emptyPages);
}
