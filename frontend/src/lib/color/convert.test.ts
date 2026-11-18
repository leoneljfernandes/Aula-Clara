import { expect, it } from "vitest";

import {
  contrastRatio,
  deltaE2000,
  hexToRgb,
  linearToSrgb,
  relativeLuminance,
  rgbToHex,
  rgbToLab,
  srgbToLinear,
} from "./convert";

it("CIEDE2000 coincide con los datos de prueba de Sharma, Wu y Dalal (2005)", () => {
  expect(deltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485])).toBeCloseTo(2.0425, 4);
  expect(deltaE2000([50, 0, 0], [50, -1, 2])).toBeCloseTo(2.3669, 4);
});

it("la distancia de un color consigo mismo es cero y es simétrica", () => {
  const a = rgbToLab([220, 30, 30]);
  const b = rgbToLab([30, 180, 50]);
  expect(deltaE2000(a, a)).toBe(0);
  expect(deltaE2000(a, b)).toBeCloseTo(deltaE2000(b, a), 8);
});

it("el blanco es L 100 y el negro L 0", () => {
  const [l, a, b] = rgbToLab([255, 255, 255]);
  expect(l).toBeCloseTo(100, 1);
  expect(a).toBeCloseTo(0, 1);
  expect(b).toBeCloseTo(0, 1);
  expect(rgbToLab([0, 0, 0])[0]).toBeCloseTo(0, 5);
});

it("hex ida y vuelta, y luminancia WCAG", () => {
  expect(rgbToHex(hexToRgb("#1b7837"))).toBe("#1B7837");
  expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 5);
  expect(relativeLuminance([0, 0, 0])).toBe(0);
});

it("sRGB y RGB lineal son inversos", () => {
  for (const c of [0, 0.02, 0.2, 0.5, 1]) expect(linearToSrgb(srgbToLinear(c))).toBeCloseTo(c, 6);
});

it("el contraste WCAG es 21 entre blanco y negro, 1 entre iguales y no depende del orden", () => {
  expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 5);
  expect(contrastRatio([10, 20, 30], [10, 20, 30])).toBe(1);
  expect(contrastRatio([29, 78, 216], [255, 255, 255])).toBeCloseTo(
    contrastRatio([255, 255, 255], [29, 78, 216]),
    8,
  );
});
