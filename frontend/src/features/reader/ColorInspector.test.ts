import { expect, it } from "vitest";

import { moveReticle, sampleAt } from "./ColorInspector";

it("las flechas mueven la mira un 2 % y con Shift un 10 %", () => {
  expect(moveReticle({ x: 0.5, y: 0.5 }, "ArrowRight", false)).toEqual({ x: 0.52, y: 0.5 });
  expect(moveReticle({ x: 0.5, y: 0.5 }, "ArrowLeft", true)).toEqual({ x: 0.4, y: 0.5 });
  expect(moveReticle({ x: 0.5, y: 0.5 }, "ArrowUp", false)).toEqual({ x: 0.5, y: 0.48 });
  expect(moveReticle({ x: 0.5, y: 0.5 }, "ArrowDown", true)).toEqual({ x: 0.5, y: 0.6 });
});

it("la mira no se sale de la imagen", () => {
  expect(moveReticle({ x: 0.99, y: 0.01 }, "ArrowRight", true)).toEqual({ x: 1, y: 0.01 });
  expect(moveReticle({ x: 0.99, y: 0.01 }, "ArrowUp", true)).toEqual({ x: 0.99, y: 0 });
});

it("otras teclas no mueven nada", () => {
  expect(moveReticle({ x: 0.3, y: 0.3 }, "KeyA", false)).toBeNull();
});

it("la muestra cae en el píxel de la mira, dentro de la imagen", () => {
  expect(sampleAt({ x: 0, y: 0 }, 100, 50)).toEqual({ px: 0, py: 0 });
  expect(sampleAt({ x: 1, y: 1 }, 100, 50)).toEqual({ px: 99, py: 49 });
  expect(sampleAt({ x: 0.5, y: 0.5 }, 101, 51)).toEqual({ px: 50, py: 25 });
});
