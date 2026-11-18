import { expect, it } from "vitest";

import type { Block } from "@/lib/extractors";

import { figurePosition, findBlock, headingPosition, readableIndex } from "./blockNav";

const B: Block[] = [
  { type: "h2", text: "Intro" },
  { type: "p", text: "a" },
  { type: "figure", id: "f1" },
  { type: "p", text: "b" },
  { type: "h2", text: "Fin" },
  { type: "p", text: "c" },
];

it("busca el bloque siguiente o anterior por tipo, sin incluir el actual", () => {
  expect(findBlock(B, -1, "any", 1)).toBe(0);
  expect(findBlock(B, 5, "any", 1)).toBeNull();
  expect(findBlock(B, 0, "any", -1)).toBeNull();
  expect(findBlock(B, 0, "h2", 1)).toBe(4);
  expect(findBlock(B, 4, "h2", -1)).toBe(0);
  expect(findBlock(B, 0, "figure", 1)).toBe(2);
});

it("posiciones de títulos, gráficos y texto leíble", () => {
  expect(headingPosition(B, 4)).toEqual({ n: 2, total: 2 });
  expect(headingPosition(B, 1)).toBeNull();
  expect(figurePosition(B, 2)).toBe(1);
  expect(figurePosition(B, 1)).toBeNull();
  expect(readableIndex(B, 3)).toBe(2);
  expect(readableIndex(B, 2)).toBeNull();
});
