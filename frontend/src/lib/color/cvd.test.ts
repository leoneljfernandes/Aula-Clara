import { expect, it } from "vitest";

import { deltaE2000, relativeLuminance, rgbToLab } from "./convert";
import {
  applyMatrix,
  daltonizeMatrix,
  enhancementKind,
  feColorMatrixValues,
  sampleAverage,
  simulate,
} from "./cvd";

it.each(["protan", "deutan", "tritan", "achromat"] as const)("%s conserva el blanco y el negro", (kind) => {
  expect(simulate([255, 255, 255], kind)).toEqual([255, 255, 255]);
  expect(simulate([0, 0, 0], kind)).toEqual([0, 0, 0]);
});

it("con protanopía el rojo se ve más oscuro", () => {
  expect(relativeLuminance(simulate([255, 0, 0], "protan"))).toBeLessThan(relativeLuminance([255, 0, 0]));
});

it("con acromatopsia todo se ve gris, con la luminancia del color", () => {
  const [r, g, b] = simulate([200, 40, 40], "achromat");
  expect(r).toBe(g);
  expect(g).toBe(b);
});

it("las filas de las matrices de simulación suman 1: un gris sigue siendo gris", () => {
  for (const kind of ["protan", "deutan", "tritan"] as const) {
    const [r, g, b] = simulate([128, 128, 128], kind);
    expect(Math.abs(r - 128)).toBeLessThanOrEqual(1);
    expect(Math.abs(g - 128)).toBeLessThanOrEqual(1);
    expect(Math.abs(b - 128)).toBeLessThanOrEqual(1);
  }
});

it("el realce conserva el blanco y separa el rojo del verde para una persona con deuteranopía", () => {
  const m = daltonizeMatrix("deutan");
  expect(applyMatrix([255, 255, 255], m)).toEqual([255, 255, 255]);
  const seen = (rgb: readonly [number, number, number]) => rgbToLab(simulate(rgb, "deutan"));
  const before = deltaE2000(seen([200, 40, 40]), seen([40, 160, 40]));
  const after = deltaE2000(seen(applyMatrix([200, 40, 40], m)), seen(applyMatrix([40, 160, 40], m)));
  expect(after).toBeGreaterThan(before);
});

it("el realce de tritanopía también conserva el blanco", () => {
  expect(applyMatrix([255, 255, 255], daltonizeMatrix("tritan"))).toEqual([255, 255, 255]);
});

it("arma los 20 valores de feColorMatrix", () => {
  const values = feColorMatrixValues(daltonizeMatrix("protan")).split(" ");
  expect(values).toHaveLength(20);
  expect(values.slice(15)).toEqual(["0.000000", "0.000000", "0.000000", "1.000000", "0.000000"]);
  expect(values[3]).toBe("0.000000");
});

it("promedia una ventana de 3 × 3 y recorta en los bordes", () => {
  const data = new Uint8ClampedArray(3 * 3 * 4);
  for (let i = 0; i < 9; i++) data.set([i === 4 ? 90 : 0, 0, 0, 255], i * 4);
  expect(sampleAverage(data, 3, 3, 1, 1)).toEqual([10, 0, 0]);
  expect(sampleAverage(data, 3, 3, 0, 0)).toEqual([23, 0, 0]); // 90 / 4 píxeles, redondeado
});

it("el realce depende del tipo: sin daltonismo y con acromatopsia no hay, y «no sé» usa deuteranopía", () => {
  expect(enhancementKind("none")).toBeNull();
  expect(enhancementKind("achromat")).toBeNull();
  expect(enhancementKind("unsure")).toBe("deutan");
  expect(enhancementKind("protan")).toBe("protan");
  expect(enhancementKind("tritan")).toBe("tritan");
});
