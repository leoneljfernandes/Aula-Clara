import { describe, expect, it } from "vitest";

import { contrastRatio, deltaE2000, hexToRgb, rgbToLab } from "@/lib/color/convert";
import { simulate } from "@/lib/color/cvd";

import { THEME_ORDER, THEMES } from "./config";

/** Contraste WCAG 2.1 entre dos colores hex. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

describe("contraste AA (4.5:1 texto, 3:1 foco y bordes) en los 4 temas", () => {
  it.each(THEME_ORDER)("%s", (id) => {
    const v = THEMES[id].vars;
    expect(contrast(v.fg, v.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(v.fg, v.panel)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(v.muted, v.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(v.muted, v.panel)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(v.onAccent, v.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(v.fg, v.soft)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(v.hlFg, v.hl)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(v.accent, v.bg)).toBeGreaterThanOrEqual(3);
    expect(contrast(v.border, v.bg)).toBeGreaterThanOrEqual(3);
    expect(contrast(v.focus, v.bg)).toBeGreaterThanOrEqual(3);
  });
});

describe.each(["protan", "deutan", "tritan"] as const)("los temas con %s", (kind) => {
  it.each(THEME_ORDER)("%s se sigue leyendo y el resaltado se distingue del fondo", (id) => {
    const v = THEMES[id].vars;
    const s = (hex: string) => simulate(hexToRgb(hex), kind);
    expect(contrastRatio(s(v.fg), s(v.bg))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(s(v.onAccent), s(v.accent))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(s(v.hlFg), s(v.hl))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(s(v.focus), s(v.bg))).toBeGreaterThanOrEqual(3);
    expect(deltaE2000(rgbToLab(s(v.hl)), rgbToLab(s(v.bg)))).toBeGreaterThanOrEqual(10);
  });
});
