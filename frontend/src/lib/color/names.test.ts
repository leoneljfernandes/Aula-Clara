import { expect, it } from "vitest";

import { hexToRgb } from "./convert";
import { COLOR_NAMES, nameColor } from "./names";

it.each([
  [[220, 30, 30], "Rojo"],
  [[30, 180, 50], "Verde"],
  [[20, 80, 210], "Azul"],
  [[240, 220, 30], "Amarillo"],
  [[128, 128, 128], "Gris"],
  [[0, 0, 0], "Negro"],
  [[255, 255, 255], "Blanco"],
] as const)("%j se llama %s", (rgb, name) => {
  expect(nameColor(rgb).name).toBe(name);
});

it("devuelve el hex medido", () => {
  expect(nameColor([220, 30, 30]).hex).toBe("#DC1E1E");
});

it("son 18 nombres sin repetir", () => {
  expect(COLOR_NAMES).toHaveLength(18);
  expect(new Set(COLOR_NAMES.map((c) => c.name)).size).toBe(18);
});

it("cada color de referencia se llama como su propio nombre", () => {
  for (const { name, hex } of COLOR_NAMES) expect(nameColor(hexToRgb(hex)).name).toBe(name);
});
