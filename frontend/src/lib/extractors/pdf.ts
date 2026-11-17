import type { PDFPageProxy } from "pdfjs-dist";

import { blobToDataUrl, isUsefulSize, toJpeg } from "./image";
import { joinPages, pageToBlocks, type TextItem } from "./paragraphs";
import { loadPdfJs } from "./pdfjs-loader";
import { type Block, type ExtractedDocument, ImportError } from "./types";

const MAX_PAGES = 150;
const MAX_FIGURES = 20;
const MIN_TEXT_CHARS = 40; // por debajo: es un PDF escaneado (solo imágenes)

async function pageText(page: PDFPageProxy): Promise<TextItem[]> {
  const content = await page.getTextContent();
  const items: TextItem[] = [];
  for (const item of content.items) {
    if (!("str" in item)) continue;
    const [scaleX = 0, , , scaleY = 0, x = 0, y = 0] = item.transform as number[];
    items.push({ str: item.str, x, y, size: Math.abs(scaleY) || Math.abs(scaleX) || item.height });
  }
  return items;
}

interface RawImage {
  width: number;
  height: number;
  data?: Uint8ClampedArray;
  kind?: number;
  bitmap?: ImageBitmap;
}

/** Convierte una imagen embebida (RGB/RGBA/gris de pdf.js) a JPEG. Devuelve null si no se puede o no vale la pena. */
async function toFigure(raw: RawImage, id: string): Promise<Block | null> {
  if (!isUsefulSize(raw.width, raw.height)) return null;
  let source: CanvasImageSource;
  if (raw.bitmap) {
    source = raw.bitmap;
  } else if (raw.data) {
    const canvas = document.createElement("canvas");
    canvas.width = raw.width;
    canvas.height = raw.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const rgba = ctx.createImageData(raw.width, raw.height);
    const pixels = raw.width * raw.height;
    const channels = raw.data.length / pixels;
    for (let i = 0; i < pixels; i++) {
      const src = i * channels;
      const dst = i * 4;
      const r = raw.data[src] ?? 0;
      rgba.data[dst] = r;
      rgba.data[dst + 1] = channels >= 3 ? (raw.data[src + 1] ?? 0) : r;
      rgba.data[dst + 2] = channels >= 3 ? (raw.data[src + 2] ?? 0) : r;
      rgba.data[dst + 3] = channels === 4 ? (raw.data[src + 3] ?? 255) : 255;
    }
    ctx.putImageData(rgba, 0, 0);
    source = canvas;
  } else {
    return null;
  }
  const jpeg = await toJpeg(source, raw.width, raw.height);
  return { type: "figure", id, dataUrl: await blobToDataUrl(jpeg) };
}

async function pageFigures(
  page: PDFPageProxy,
  pageNumber: number,
  pdfjs: Awaited<ReturnType<typeof loadPdfJs>>,
  budget: number,
): Promise<Block[]> {
  const figures: Block[] = [];
  try {
    const ops = await page.getOperatorList();
    const seen = new Set<string>();
    for (let i = 0; i < ops.fnArray.length && figures.length < budget; i++) {
      if (ops.fnArray[i] !== pdfjs.OPS.paintImageXObject) continue;
      const name = (ops.argsArray[i] as string[])[0];
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const raw = await new Promise<RawImage | null>((resolve) => {
        try {
          page.objs.get(name, (obj: RawImage | null) => resolve(obj));
        } catch {
          resolve(null);
        }
      });
      const figure = raw ? await toFigure(raw, `p${pageNumber}-${name}`).catch(() => null) : null;
      if (figure) figures.push(figure);
    }
  } catch {
    // una página con imágenes ilegibles no tira abajo todo el documento
  }
  return figures;
}

export async function extractPdf(file: Blob, fallbackTitle: string): Promise<ExtractedDocument> {
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  let pdf;
  try {
    pdf = await task.promise;
  } catch (cause) {
    throw new ImportError(
      "failed",
      "No pudimos abrir este PDF. Puede estar dañado o protegido con contraseña.",
      { cause },
    );
  }
  try {
    const pages: Block[][] = [];
    let figureCount = 0;
    for (let n = 1; n <= Math.min(pdf.numPages, MAX_PAGES); n++) {
      const page = await pdf.getPage(n);
      const blocks = pageToBlocks(await pageText(page));
      const figures = await pageFigures(page, n, pdfjs, MAX_FIGURES - figureCount);
      figureCount += figures.length;
      pages.push([...blocks, ...figures]); // sin posición exacta: las figuras van al final de su página
    }
    const blocks = joinPages(pages);
    const chars = blocks.reduce((sum, b) => sum + (b.type === "figure" ? 0 : b.text.length), 0);
    if (chars < MIN_TEXT_CHARS) {
      throw new ImportError(
        "scanned",
        "Este PDF parece escaneado: tiene imágenes pero no texto que podamos leer. Todavía no reconocemos texto en imágenes (OCR).",
      );
    }
    const title = blocks.find((b) => b.type === "h2");
    return { title: title?.type === "h2" ? title.text : fallbackTitle, blocks };
  } finally {
    await task.destroy();
  }
}
