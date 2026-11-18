import { expect, it } from "vitest";
import { dotCenters, printGrid } from "./printGeometry";

it("en A4 con margen de 15 mm entran 30 celdas por 27 líneas", () => {
  expect(printGrid()).toEqual({ cols: 30, rows: 27 });
});

it("ubica los puntos de una celda en milímetros", () => {
  expect(dotCenters("⠁")).toEqual([{ x: 0, y: 0 }]);
  expect(dotCenters("⠿")).toEqual([
    { x: 0, y: 0 },
    { x: 0, y: 2.5 },
    { x: 0, y: 5 },
    { x: 2.5, y: 0 },
    { x: 2.5, y: 2.5 },
    { x: 2.5, y: 5 },
  ]);
  expect(dotCenters("⠀")).toEqual([]);
});

it("una celda más solo entra si el último punto cabe en el ancho útil", () => {
  const narrow = {
    pageMm: { w: 100, h: 100 },
    marginMm: 10,
    dotSpacingMm: 2.5,
    cellPitchMm: 6,
    linePitchMm: 10,
    dotDiameterMm: 1.5,
  } as const;
  // ancho útil 80: (n−1)·6 + 2,5 + 1,5 ≤ 80 → n = 13
  expect(printGrid(narrow).cols).toBe(13);
});
