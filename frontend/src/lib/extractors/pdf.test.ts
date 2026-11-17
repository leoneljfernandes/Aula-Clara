// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

// En Node se usa la build "legacy" de pdf.js sin worker; el resto de extractPdf corre tal cual.
vi.mock("./pdfjs-loader", async () => {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return { loadPdfJs: async () => pdfjs };
});

import { extractPdf } from "./pdf";
import { ImportError } from "./types";

/** PDF mínimo válido: una página por entrada, cada una con líneas (texto, tamaño, y). */
function makePdf(pages: Array<Array<[string, number, number]>>): Blob {
  const objects: string[] = [];
  const kids: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(""); // /Pages se completa abajo
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"); // objeto 3
  pages.forEach((lines, i) => {
    const content = lines.map(([text, size, y]) => `BT /F1 ${size} Tf 50 ${y} Td (${text}) Tj ET`).join("\n");
    const pageObj = 4 + i * 2;
    kids.push(`${pageObj} 0 R`);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageObj + 1} 0 R >>`,
    );
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  objects[1] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} >>`;

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([body]);
}

describe("extractPdf (con pdf.js de verdad)", () => {
  it("extrae título y párrafos de un PDF con texto", async () => {
    const pdf = makePdf([
      [
        ["Accesibilidad digital", 22, 740],
        ["La accesibilidad es una condicion de calidad del material educativo.", 12, 700],
        ["Debe pensarse desde el diseno y no como una adaptacion posterior.", 12, 686],
        ["Segundo parrafo separado del primero por un salto mayor de linea.", 12, 640],
      ],
    ]);
    const doc = await extractPdf(pdf, "apunte");
    expect(doc.title).toBe("Accesibilidad digital");
    expect(doc.blocks.map((b) => b.type)).toEqual(["h2", "p", "p"]);
    expect(doc.blocks[1]).toMatchObject({ text: expect.stringContaining("condicion de calidad") });
    expect(doc.blocks[1]).toMatchObject({ text: expect.stringContaining("adaptacion posterior") });
  });

  it("une un párrafo cortado por el salto de página", async () => {
    const pdf = makePdf([
      [["Este parrafo empieza en la primera pagina y todavia no termina porque sigue en la", 12, 700]],
      [["pagina siguiente hasta cerrar la idea con un punto final.", 12, 700]],
    ]);
    const doc = await extractPdf(pdf, "apunte");
    expect(doc.blocks).toHaveLength(1);
    expect(doc.blocks[0]).toMatchObject({ text: expect.stringContaining("en la pagina siguiente") });
  });

  it("un PDF sin texto (escaneado) se rechaza con un mensaje claro", async () => {
    await expect(extractPdf(makePdf([[]]), "escaneado")).rejects.toMatchObject({
      name: "ImportError",
      reason: "scanned",
      message: expect.stringContaining("escaneado"),
    });
  });

  it("un archivo que no es PDF falla con ImportError, no con un error crudo", async () => {
    await expect(extractPdf(new Blob(["esto no es un pdf"]), "x")).rejects.toBeInstanceOf(ImportError);
  });
});
