import fs from "node:fs";
import path from "node:path";

const src = path.resolve(process.cwd(), "node_modules/pdfjs-dist/build/pdf.worker.mjs");
const destDir = path.resolve(process.cwd(), "public");
const dest = path.join(destDir, "pdf.worker.mjs");

if (fs.existsSync(src)) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
  console.log("✓ Synchronized pdf.worker.mjs to public/pdf.worker.mjs");
}
