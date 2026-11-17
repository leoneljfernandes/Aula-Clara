/** Utilidades de imagen en el navegador: reducir y comprimir antes de guardar o de enviar a la IA (≤ 4 MB). */
const MAX_SIDE = 1568; // más grande no mejora la descripción y sí gasta cuota
const MIN_SIDE = 80; // íconos y adornos no se muestran como figuras

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export function isUsefulSize(width: number, height: number): boolean {
  return width >= MIN_SIDE && height >= MIN_SIDE;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      quality,
    );
  });
}

/** Dibuja la fuente en un canvas de fondo blanco (el JPEG no tiene transparencia) y la comprime. */
export async function toJpeg(source: CanvasImageSource, width: number, height: number): Promise<Blob> {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d not available");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.85, 0.7, 0.5]) {
    const blob = await canvasToBlob(canvas, quality);
    if (blob.size <= MAX_IMAGE_BYTES) return blob;
  }
  throw new Error("image too large even after compression");
}

/** Reduce cualquier imagen (PNG, JPEG, SVG…) a un JPEG liviano. */
export async function resizeImage(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  try {
    return await toJpeg(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

/** Rasteriza un <svg> del DOM (el gráfico del documento de ejemplo) para poder enviarlo a la IA. */
export async function svgToJpeg(svg: SVGSVGElement): Promise<Blob> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  // Las variables CSS del tema no existen fuera del documento: se resuelven a colores reales.
  const computed = getComputedStyle(svg);
  const resolve = (name: string, fallback: string): string =>
    computed.getPropertyValue(name).trim() || fallback;
  const markup = new XMLSerializer()
    .serializeToString(clone)
    .replaceAll("var(--border)", resolve("--border", "#6b7280"))
    .replaceAll("var(--fg)", resolve("--fg", "#0a0a0a"))
    .replaceAll("var(--accent)", resolve("--accent", "#1d4ed8"));
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return await toJpeg(img, img.naturalWidth || 640, img.naturalHeight || 340);
  } finally {
    URL.revokeObjectURL(url);
  }
}
