import { expect, it } from "vitest";
import { articleToParagraphs } from "./articleToBraille";

const article = {
  title: "Hola",
  meta: "x",
  blocks: [
    { type: "h2" as const, text: "Uno" },
    { type: "p" as const, text: "a ∑" },
    { type: "figure" as const, id: "f1" },
    { type: "figure" as const, id: "f2", alt: "barras" },
  ],
};

it("transcribe título, secciones, párrafos y figuras, y cuenta lo pendiente", () => {
  const out = articleToParagraphs(article, {});
  expect(out.paragraphs.map((p) => p.heading)).toEqual([true, true, false, false, false]);
  expect(out.unsupported).toEqual(["∑"]);
  expect(out.undescribedFigures).toBe(1);
});

it("una descripción recién hecha cuenta como descrita", () => {
  expect(articleToParagraphs(article, { f1: "torta" }).undescribedFigures).toBe(0);
});

it("las figuras se numeran y dicen «sin descripción» cuando no la tienen", () => {
  const out = articleToParagraphs(article, {});
  const texts = out.paragraphs.map((p) => p.braille);
  expect(texts[3]).toBe(toBrailleOf("Gráfico 1: sin descripción."));
  expect(texts[4]).toBe(toBrailleOf("Gráfico 2: barras."));
});

it("una descripción vacía (como la de las imágenes de Word) cuenta como pendiente", () => {
  const empty = { ...article, blocks: [{ type: "figure" as const, id: "w", alt: "" }] };
  expect(articleToParagraphs(empty, {}).undescribedFigures).toBe(1);
});

it("no duplica el punto final de la descripción", () => {
  const out = articleToParagraphs(
    { ...article, blocks: [{ type: "figure" as const, id: "f", alt: "Barras." }] },
    {},
  );
  expect(out.paragraphs[1]?.braille).toBe(toBrailleOf("Gráfico 1: Barras."));
});

import { toBraille } from "@/lib/braille/translate";
function toBrailleOf(text: string): string {
  return toBraille(text).braille;
}
