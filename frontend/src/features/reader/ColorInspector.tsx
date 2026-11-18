import { type KeyboardEvent, type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";

import { type RGB } from "@/lib/color/convert";
import { sampleAverage } from "@/lib/color/cvd";
import { nameColor } from "@/lib/color/names";

/** Posición de la mira como fracción del ancho y del alto de la imagen (0 a 1). */
export interface Reticle {
  x: number;
  y: number;
}

const STEP = 0.02;
const BIG_STEP = 0.1;
/** El nombre se anuncia cuando la mira se quedó quieta este tiempo, no en cada flecha. */
const ANNOUNCE_DELAY_MS = 300;

const clamp01 = (n: number): number => Math.round(Math.min(1, Math.max(0, n)) * 1e4) / 1e4;

/** Mueve la mira con las flechas (2 % del ancho o del alto; 10 % con Shift). `null` si la tecla no es una flecha. */
export function moveReticle(pos: Reticle, code: string, shift: boolean): Reticle | null {
  const step = shift ? BIG_STEP : STEP;
  switch (code) {
    case "ArrowLeft":
      return { x: clamp01(pos.x - step), y: pos.y };
    case "ArrowRight":
      return { x: clamp01(pos.x + step), y: pos.y };
    case "ArrowUp":
      return { x: pos.x, y: clamp01(pos.y - step) };
    case "ArrowDown":
      return { x: pos.x, y: clamp01(pos.y + step) };
    default:
      return null;
  }
}

/** El píxel de la imagen sobre el que está la mira. */
export function sampleAt(pos: Reticle, width: number, height: number): { px: number; py: number } {
  return { px: Math.round(pos.x * (width - 1)), py: Math.round(pos.y * (height - 1)) };
}

interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Decodifica la imagen en un canvas en memoria para poder leer sus píxeles. */
async function readPixels(image: Blob): Promise<Pixels> {
  const bitmap = await createImageBitmap(image);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("canvas unavailable");
  context.drawImage(bitmap, 0, 0);
  const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
  bitmap.close?.();
  return { data, width: bitmap.width, height: bitmap.height };
}

/**
 * Inspector de colores: una mira sobre la figura que nombra el color de cada punto, con el puntero, el dedo o el
 * teclado (flechas; `Esc` sale). Promedia 3 × 3 píxeles para que el ruido de un JPEG no cambie el nombre.
 */
export function ColorInspector({ image, onClose }: { image: Blob; onClose: () => void }): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const [pixels, setPixels] = useState<Pixels | null>(null);
  const [failed, setFailed] = useState(false);
  const [pos, setPos] = useState<Reticle>({ x: 0.5, y: 0.5 });
  const [moved, setMoved] = useState(false);
  const [announced, setAnnounced] = useState("");

  useEffect(() => {
    ref.current?.focus();
  }, []);

  useEffect(() => {
    let current = true;
    readPixels(image)
      .then((read) => current && setPixels(read))
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, [image]);

  let measured: { name: string; hex: string; rgb: RGB } | null = null;
  if (pixels) {
    const { px, py } = sampleAt(pos, pixels.width, pixels.height);
    const rgb = sampleAverage(pixels.data, pixels.width, pixels.height, px, py);
    measured = { ...nameColor(rgb), rgb };
  }
  const label = measured ? `${measured.name} · ${measured.hex}` : "";

  // Se anuncia al quedarse quieta la mira (y solo después de moverla): no en cada flecha ni al abrir.
  useEffect(() => {
    if (!moved || !label) return;
    const timer = setTimeout(() => setAnnounced(label), ANNOUNCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [moved, label]);

  const place = (event: PointerEvent<HTMLDivElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    setPos({
      x: clamp01((event.clientX - rect.left) / rect.width),
      y: clamp01((event.clientY - rect.top) / rect.height),
    });
    setMoved(true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    const next = moveReticle(pos, event.code, event.shiftKey);
    if (!next) return;
    event.preventDefault();
    setPos(next);
    setMoved(true);
  };

  return (
    <>
      <div
        ref={ref}
        role="application"
        aria-roledescription="inspector de colores"
        aria-label="Inspector de colores. Usá las flechas para recorrer la imagen y Esc para salir."
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={place}
        onPointerMove={(event) =>
          event.buttons > 0 || event.pointerType === "mouse" ? place(event) : undefined
        }
        className="absolute inset-0 cursor-crosshair rounded-2xl"
      >
        <span
          aria-hidden="true"
          style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
          className="pointer-events-none absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white outline-2 outline-black"
        />
        {measured && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-2 rounded-lg border-2 border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-base font-bold"
          >
            <span
              className="inline-block h-6 w-6 rounded border-2 border-[var(--fg)]"
              style={{ background: `rgb(${measured.rgb.join(",")})` }}
            />
            <span>{measured.name}</span>
            <span>{measured.hex}</span>
          </div>
        )}
      </div>
      <p aria-live="polite" className="sr-only">
        {announced}
      </p>
      {failed && (
        <p role="alert" className="absolute bottom-2 left-2 rounded-lg bg-[var(--panel)] px-2 py-1">
          No pudimos leer los colores de esta imagen.
        </p>
      )}
    </>
  );
}
