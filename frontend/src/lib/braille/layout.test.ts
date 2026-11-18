import { expect, it } from "vitest";
import { paginate, wrap } from "./layout";

const len = (s: string) => [...s].length;

it("wrap corta entre palabras y ninguna línea supera el ancho", () => {
  expect(wrap("⠁⠁⠀⠃⠃⠃⠀⠉", 6)).toEqual(["⠁⠁⠀⠃⠃⠃", "⠉"]);
});

it("una palabra más larga que la línea se parte con ⠤", () => {
  const lines = wrap("⠁⠁⠁⠁⠁⠁⠁⠁", 4);
  expect(lines).toEqual(["⠁⠁⠁⠤", "⠁⠁⠁⠤", "⠁⠁"]);
  expect(lines.every((l) => len(l) <= 4)).toBe(true);
});

it("paginate separa párrafos, respeta el alto y no deja un título al final de una página", () => {
  const pages = paginate(
    [
      { braille: "⠁⠁⠁", heading: false },
      { braille: "⠃⠃", heading: true },
      { braille: "⠉", heading: false },
    ],
    { cols: 10, rows: 3 },
  );
  expect(pages).toEqual([["⠁⠁⠁"], ["⠃⠃", "", "⠉"]]);
});

it("ninguna página supera las líneas pedidas", () => {
  const paragraphs = Array.from({ length: 40 }, () => ({ braille: "⠁⠀".repeat(30), heading: false }));
  for (const page of paginate(paragraphs, { cols: 40, rows: 25 })) {
    expect(page.length).toBeLessThanOrEqual(25);
    expect(page.every((l) => len(l) <= 40)).toBe(true);
  }
});
