import type { PageFormat } from "@/lib/braille/layout";

/**
 * Medidas de la hoja en milímetros. Son los valores usuales del Braille impreso (Marburg Medium): hay que
 * confirmarlos con el papel o la impresora de la institución.
 */
export const GEOMETRY = {
  pageMm: { w: 210, h: 297 },
  marginMm: 15,
  dotSpacingMm: 2.5,
  cellPitchMm: 6,
  linePitchMm: 10,
  dotDiameterMm: 1.5,
} as const;

interface Geometry {
  readonly pageMm: { readonly w: number; readonly h: number };
  readonly marginMm: number;
  readonly dotSpacingMm: number;
  readonly cellPitchMm: number;
  readonly linePitchMm: number;
  readonly dotDiameterMm: number;
}

/** Cuántos pasos de `pitch` entran en `span`, contando el primero (un epsilon evita errores de coma flotante). */
const steps = (span: number, pitch: number): number => Math.floor(span / pitch + 1e-9) + 1;

/**
 * Celdas por línea y líneas por página que caben en la hoja. Una celda más entra si
 * `(n − 1) · cellPitch + dotSpacing + dotDiameter ≤ ancho útil` y, con las líneas, `2 · dotSpacing` de alto de celda.
 */
export function printGrid(g: Geometry = GEOMETRY): PageFormat {
  const usableW = g.pageMm.w - 2 * g.marginMm;
  const usableH = g.pageMm.h - 2 * g.marginMm;
  return {
    cols: steps(usableW - g.dotSpacingMm - g.dotDiameterMm, g.cellPitchMm),
    rows: steps(usableH - 2 * g.dotSpacingMm - g.dotDiameterMm, g.linePitchMm),
  };
}

/** Centro de cada punto levantado de una celda, en milímetros desde el centro del punto 1. */
export function dotCenters(cellChar: string, g: Geometry = GEOMETRY): { x: number; y: number }[] {
  const bits = (cellChar.codePointAt(0) ?? 0x2800) - 0x2800;
  const centers: { x: number; y: number }[] = [];
  for (let dot = 0; dot < 6; dot++) {
    if (bits & (1 << dot)) centers.push({ x: dot < 3 ? 0 : g.dotSpacingMm, y: (dot % 3) * g.dotSpacingMm });
  }
  return centers;
}
