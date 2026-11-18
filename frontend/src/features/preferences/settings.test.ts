import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, sanitizePatch, sanitizeSettings, snakeToCamelKeys } from "./settings";

describe("sanitizeSettings", () => {
  it("sin datos devuelve los valores por defecto", () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings("basura")).toEqual(DEFAULT_SETTINGS);
  });
  it("conserva lo válido y reemplaza lo inválido campo por campo", () => {
    expect(sanitizeSettings({ theme: "neon", fontSize: "grande", font: "dyslexic", lineHeight: 9 })).toEqual({
      ...DEFAULT_SETTINGS,
      font: "dyslexic",
    });
  });
  it("rechaza tamaños fuera de rango o no enteros, y velocidades desconocidas", () => {
    expect(sanitizeSettings({ fontSize: 13, rate: 2 })).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ fontSize: 20.5, lineHeight: Number.NaN })).toEqual(DEFAULT_SETTINGS);
  });
});

describe("sanitizePatch", () => {
  it("devuelve solo los campos conocidos y válidos, y nombra los rechazados", () => {
    expect(sanitizePatch({ font: "dyslexic", voiceOver: true, theme: "neon" })).toEqual({
      patch: { font: "dyslexic" },
      rejected: ["voiceOver", "theme"],
    });
  });
  it("no confunde claves del prototipo con campos conocidos", () => {
    expect(sanitizePatch({ constructor: 1 })).toEqual({ patch: {}, rejected: ["constructor"] });
  });
});

it("snakeToCamelKeys convierte solo las claves", () => {
  expect(snakeToCamelKeys({ font_size: 21, audio_focus: false, theme: "sepia" })).toEqual({
    fontSize: 21,
    audioFocus: false,
    theme: "sepia",
  });
});
