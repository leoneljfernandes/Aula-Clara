import type { Block } from "@/lib/extractors";
import { dataUrlToBlob, svgToJpeg } from "@/lib/extractors";

/**
 * La imagen de una figura lista para enviar a la IA, o `null` si no se pudo armar (distinto de un error de la IA).
 * Con `dataUrl` es la imagen original; sin ella, es el gráfico SVG que está dibujado en el bloque `#blk-{index}`.
 */
export async function figureImageBlob(
  block: Extract<Block, { type: "figure" }>,
  index: number,
): Promise<Blob | null> {
  try {
    if (block.dataUrl) return await dataUrlToBlob(block.dataUrl);
    const svg = document.querySelector<SVGSVGElement>(`#blk-${index} svg`);
    return svg ? await svgToJpeg(svg) : null;
  } catch {
    return null;
  }
}
