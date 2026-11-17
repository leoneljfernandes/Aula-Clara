import { describe, expect, it } from "vitest";

import { htmlToBlocks } from "./docx";
import { detectKind, ImportError } from "./index";

describe("htmlToBlocks", () => {
  it("convierte títulos, párrafos, listas y tablas", () => {
    const blocks = htmlToBlocks(
      "<h1>Unidad 1</h1><p>Texto  con   espacios.</p><ul><li>uno</li><li>dos</li></ul><ol><li>a</li></ol><table><tr><th>Año</th><td>2024</td></tr></table>",
    );
    expect(blocks).toEqual([
      { type: "h2", text: "Unidad 1" },
      { type: "p", text: "Texto con espacios." },
      { type: "p", text: "• uno" },
      { type: "p", text: "• dos" },
      { type: "p", text: "1. a" },
      { type: "p", text: "Año · 2024" },
    ]);
  });

  it("conserva las imágenes embebidas como figuras", () => {
    const blocks = htmlToBlocks('<p>Mirá <img src="data:image/png;base64,AAAA" alt=""></p>');
    expect(blocks).toEqual([
      { type: "p", text: "Mirá" },
      { type: "figure", id: "img-1", dataUrl: "data:image/png;base64,AAAA", alt: "" },
    ]);
  });

  it("descarta párrafos vacíos", () => {
    expect(htmlToBlocks("<p> </p><h2></h2>")).toEqual([]);
  });
});

describe("detectKind", () => {
  const file = (name: string): File => new File(["x"], name);

  it("acepta PDF y DOCX", () => {
    expect(detectKind(file("a.PDF"))).toBe("PDF");
    expect(detectKind(file("a.docx"))).toBe("Word");
  });

  it.each([
    ["clase.pptx", /PowerPoint/],
    ["viejo.doc", /\.docx/],
    ["foto.png", /no es compatible/],
  ])("%s no se admite y explica qué hacer", (name, message) => {
    expect(() => detectKind(file(name))).toThrow(ImportError);
    expect(() => detectKind(file(name))).toThrow(message);
  });
});
