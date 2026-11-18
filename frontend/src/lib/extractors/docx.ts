import { blobToDataUrl, dataUrlToBlob, isUsefulSize, toJpeg } from "./image";
import { type Block, type ExtractedDocument, ImportError } from "./types";

/** HTML que genera mammoth → bloques. Pura (recibe el HTML): se prueba sin archivos. */
export function htmlToBlocks(html: string): Block[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks: Block[] = [];
  let figures = 0;

  const pushImages = (el: Element): void => {
    for (const img of el.querySelectorAll("img")) {
      const src = img.getAttribute("src");
      if (src?.startsWith("data:image/")) {
        blocks.push({
          type: "figure",
          id: `img-${++figures}`,
          dataUrl: src,
          alt: img.getAttribute("alt") ?? "",
        });
      }
    }
  };

  for (const el of doc.body.children) {
    const tag = el.tagName.toLowerCase();
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (/^h[1-6]$/.test(tag)) {
      if (text) blocks.push({ type: "h2", text });
    } else if (tag === "ul" || tag === "ol") {
      el.querySelectorAll("li").forEach((li, i) => {
        const item = (li.textContent ?? "").replace(/\s+/g, " ").trim();
        if (item) blocks.push({ type: "p", text: `${tag === "ol" ? `${i + 1}.` : "•"} ${item}` });
      });
    } else if (tag === "table") {
      el.querySelectorAll("tr").forEach((tr) => {
        const row = [...tr.querySelectorAll("th,td")].map((c) => (c.textContent ?? "").trim()).join(" · ");
        if (row.replaceAll("·", "").trim()) blocks.push({ type: "p", text: row });
      });
    } else if (text) {
      blocks.push({ type: "p", text });
    }
    pushImages(el);
  }
  return blocks;
}

/** Las imágenes se llevan a JPEG liviano; las muy chicas (viñetas, íconos) se descartan. */
async function compressFigures(blocks: Block[]): Promise<Block[]> {
  const result: Block[] = [];
  for (const block of blocks) {
    if (block.type !== "figure" || !block.dataUrl) {
      result.push(block);
      continue;
    }
    try {
      const bitmap = await createImageBitmap(await dataUrlToBlob(block.dataUrl));
      if (isUsefulSize(bitmap.width, bitmap.height)) {
        const jpeg = await toJpeg(bitmap, bitmap.width, bitmap.height);
        result.push({ ...block, dataUrl: await blobToDataUrl(jpeg) });
      }
      bitmap.close();
    } catch {
      result.push(block); // si no se puede comprimir, se conserva tal cual
    }
  }
  return result;
}

export async function extractDocx(file: Blob, fallbackTitle: string): Promise<ExtractedDocument> {
  const mammoth = (await import("mammoth/mammoth.browser")).default;
  let html: string;
  try {
    const result = await mammoth.convertToHtml(
      { arrayBuffer: await file.arrayBuffer() },
      {
        convertImage: mammoth.images.imgElement(async (image) => ({
          src: `data:${image.contentType};base64,${await image.read("base64")}`,
        })),
      },
    );
    html = result.value;
  } catch (cause) {
    throw new ImportError(
      "failed",
      "No pudimos abrir este archivo Word. Probá guardarlo de nuevo como .docx.",
      { cause },
    );
  }
  const blocks = await compressFigures(htmlToBlocks(html));
  const text = blocks.filter((b) => b.type !== "figure");
  if (text.length === 0) throw new ImportError("empty", "Este documento no tiene texto para leer.");
  const first = blocks.find((b) => b.type === "h2");
  return { title: first?.type === "h2" ? first.text : fallbackTitle, blocks };
}
