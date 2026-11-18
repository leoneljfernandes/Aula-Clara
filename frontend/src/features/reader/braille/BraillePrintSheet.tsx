import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import { dotCenters, GEOMETRY } from "./printGeometry";

/**
 * La hoja para imprimir en relieve: una página A4 en milímetros por cada página Braille, con un círculo por punto,
 * en negro sobre blanco. Va en `document.body` para que `@media print` pueda ocultar todo lo demás.
 */
export function BraillePrintSheet({ pages }: { pages: readonly (readonly string[])[] }): ReactNode {
  const { pageMm, marginMm, cellPitchMm, linePitchMm, dotDiameterMm } = GEOMETRY;
  return createPortal(
    <div id="braille-print-sheet">
      {pages.map((page, p) => (
        <svg
          key={p}
          width={`${pageMm.w}mm`}
          height={`${pageMm.h}mm`}
          viewBox={`0 0 ${pageMm.w} ${pageMm.h}`}
          style={{ background: "#fff" }}
        >
          {page.flatMap((line, row) =>
            [...line].flatMap((cell, col) =>
              dotCenters(cell).map((dot, d) => (
                <circle
                  key={`${row}-${col}-${d}`}
                  cx={marginMm + col * cellPitchMm + dot.x}
                  cy={marginMm + row * linePitchMm + dot.y}
                  r={dotDiameterMm / 2}
                  fill="#000"
                />
              )),
            ),
          )}
        </svg>
      ))}
    </div>,
    document.body,
  );
}
