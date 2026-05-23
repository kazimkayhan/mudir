let pdfWorkerConfigured = false;

function configurePdfWorker(
  PDFParse: typeof import("pdf-parse").PDFParse
): void {
  if (PDFParse.isNodeJS || pdfWorkerConfigured) {
    return;
  }
  PDFParse.setWorker("/pdf.worker.min.mjs");
  pdfWorkerConfigured = true;
}

export async function extractTextFromStockReportPdf(
  data: Uint8Array
): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  configurePdfWorker(PDFParse);
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}
