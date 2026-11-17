import { describe, expect, it } from "vitest";

import { joinPages, pageToBlocks, type TextItem } from "./paragraphs";

const line = (str: string, y: number, size = 12, x = 50): TextItem => ({ str, x, y, size });

describe("pageToBlocks", () => {
  it("detecta un título por tamaño y une las líneas de un párrafo", () => {
    const blocks = pageToBlocks([
      line("Introducción", 700, 20),
      line("Primera línea del párrafo", 660),
      line("segunda línea del mismo.", 646),
    ]);
    expect(blocks).toEqual([
      { type: "h2", text: "Introducción" },
      { type: "p", text: "Primera línea del párrafo segunda línea del mismo." },
    ]);
  });

  it("separa párrafos cuando el salto vertical es mayor al normal", () => {
    const blocks = pageToBlocks([
      line("Uno.", 700),
      line("Dos.", 686),
      line("Tres.", 640),
      line("Cuatro.", 626),
    ]);
    expect(blocks).toEqual([
      { type: "p", text: "Uno. Dos." },
      { type: "p", text: "Tres. Cuatro." },
    ]);
  });

  it("ordena por posición aunque los fragmentos lleguen desordenados y une los de una misma línea", () => {
    const blocks = pageToBlocks([line("mundo", 700, 12, 120), line("hola", 700, 12, 50)]);
    expect(blocks).toEqual([{ type: "p", text: "hola mundo" }]);
  });

  it("reconstruye palabras cortadas con guion al final de línea", () => {
    const blocks = pageToBlocks([line("la accesi-", 700), line("bilidad importa.", 686)]);
    expect(blocks).toEqual([{ type: "p", text: "la accesibilidad importa." }]);
  });

  it("ignora fragmentos vacíos y páginas sin texto", () => {
    expect(pageToBlocks([line("  ", 700)])).toEqual([]);
    expect(pageToBlocks([])).toEqual([]);
  });
});

describe("joinPages", () => {
  it("une un párrafo cortado por el salto de página", () => {
    const merged = joinPages([
      [{ type: "p", text: "El texto sigue en la" }],
      [
        { type: "p", text: "página siguiente." },
        { type: "p", text: "Otro." },
      ],
    ]);
    expect(merged).toEqual([
      { type: "p", text: "El texto sigue en la página siguiente." },
      { type: "p", text: "Otro." },
    ]);
  });

  it("no une si el párrafo anterior ya terminó", () => {
    const merged = joinPages([[{ type: "p", text: "Terminó." }], [{ type: "p", text: "nueva idea" }]]);
    expect(merged).toHaveLength(2);
  });
});
