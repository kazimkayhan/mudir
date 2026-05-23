import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const workerPath = require.resolve(
  "pdfjs-dist/legacy/build/pdf.worker.min.mjs"
);
const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
mkdirSync(publicDir, { recursive: true });
copyFileSync(workerPath, join(publicDir, "pdf.worker.min.mjs"));
