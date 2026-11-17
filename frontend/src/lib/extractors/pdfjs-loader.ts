import type * as PdfJs from "pdfjs-dist";

/** Carga pdf.js bajo demanda: queda en un chunk aparte y no pesa en el bundle inicial. */
export async function loadPdfJs(): Promise<typeof PdfJs> {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}
