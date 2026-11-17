import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { extractDocx } from "./docx";
import { ImportError } from "./types";

/** DOCX mínimo: un título (Heading1), dos párrafos y una lista. */
async function makeDocx(paragraphs: string): Promise<File> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}</w:body></w:document>`,
  );
  const bytes = await zip.generateAsync({ type: "arraybuffer" });
  return new File([bytes], "apunte.docx");
}

const p = (text: string, style?: string): string =>
  `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}<w:r><w:t>${text}</w:t></w:r></w:p>`;

describe("extractDocx (con mammoth de verdad)", () => {
  it("convierte un Word en título y párrafos", async () => {
    const file = await makeDocx(
      p("Epidemiología", "Heading1") + p("Primer párrafo del apunte.") + p("Segundo párrafo."),
    );
    const doc = await extractDocx(file, "apunte");
    expect(doc.title).toBe("Epidemiología");
    expect(doc.blocks).toEqual([
      { type: "h2", text: "Epidemiología" },
      { type: "p", text: "Primer párrafo del apunte." },
      { type: "p", text: "Segundo párrafo." },
    ]);
  });

  it("un Word sin texto se rechaza", async () => {
    await expect(extractDocx(await makeDocx(""), "vacío")).rejects.toMatchObject({ reason: "empty" });
  });

  it("un archivo que no es un .docx falla con ImportError", async () => {
    await expect(extractDocx(new File(["nada"], "x.docx"), "x")).rejects.toBeInstanceOf(ImportError);
  });
});
