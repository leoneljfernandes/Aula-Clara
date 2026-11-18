import type { PageFormat } from "@/lib/braille/layout";
import { storage } from "@/lib/storage";

const KEY = "aulaclara.braille";

export const COLS_RANGE = { min: 28, max: 42 } as const;
export const ROWS_RANGE = { min: 20, max: 30 } as const;
export const DEFAULT_FORMAT: PageFormat = { cols: 40, rows: 25 };

const inRange = (v: unknown, r: { min: number; max: number }): v is number =>
  Number.isInteger(v) && (v as number) >= r.min && (v as number) <= r.max;

/** El formato de la impresora Braille guardado; cada campo se valida por separado contra su rango. */
export function loadBrailleFormat(): PageFormat {
  const raw = storage.get<Partial<Record<keyof PageFormat, unknown>>>(KEY);
  return {
    cols: inRange(raw?.cols, COLS_RANGE) ? raw.cols : DEFAULT_FORMAT.cols,
    rows: inRange(raw?.rows, ROWS_RANGE) ? raw.rows : DEFAULT_FORMAT.rows,
  };
}

export function saveBrailleFormat(format: PageFormat): void {
  storage.set(KEY, format);
}
