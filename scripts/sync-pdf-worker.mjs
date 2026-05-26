import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
// Use the pdfjs-dist version bundled with pdf-parse (not a separate top-level copy).
const pdfParseEntry = require.resolve("pdf-parse");
const workerPath = require.resolve(
  "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
  { paths: [pdfParseEntry] }
);
const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
mkdirSync(publicDir, { recursive: true });
copyFileSync(workerPath, join(publicDir, "pdf.worker.min.mjs"));
