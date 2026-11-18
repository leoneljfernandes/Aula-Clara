import { describe, expect, it } from "vitest";

import { idb } from "@/lib/idb";

import { libraryApi, withFigureAlt } from "./api";
import { SAMPLE_ARTICLE } from "./sample";

describe("libraryApi", () => {
  it("arranca con los 3 documentos semilla", () => {
    expect(libraryApi.list().map((d) => d.id)).toEqual(["d1", "d2", "d3"]);
  });

  it("el progreso solo avanza, nunca retrocede", () => {
    libraryApi.saveProgress("d1", 0.9);
    libraryApi.saveProgress("d1", 0.2);
    expect(libraryApi.get("d1")?.progress).toBe(0.9);
  });

  it("los documentos semilla abren el texto de ejemplo", async () => {
    expect(await libraryApi.loadArticle("d2")).toEqual(SAMPLE_ARTICLE);
  });

  it("el de ejemplo se agrega primero, con su contenido guardado en IndexedDB", async () => {
    const steps: number[] = [];
    const id = await libraryApi.importSample((s) => steps.push(s), 0);
    expect(steps).toEqual([0, 1, 2]);
    expect(libraryApi.list()[0]).toMatchObject({ id, progress: 0, type: "PDF" });
    expect((await libraryApi.loadArticle(id)).title).toBe(SAMPLE_ARTICLE.title);
  });

  it("sobrevive a un localStorage corrupto volviendo a los semilla", () => {
    window.localStorage.setItem("aulaclara.docs", "{no es json");
    expect(libraryApi.list()).toHaveLength(3);
  });

  it("rechaza un PowerPoint sin tocar la biblioteca", async () => {
    await expect(libraryApi.importFile(new File(["x"], "clase.pptx"), () => undefined)).rejects.toMatchObject(
      { reason: "unsupported" },
    );
    expect(libraryApi.list()).toHaveLength(3);
  });

  it("saveFigureAlt guarda la descripción en el bloque de la figura, también en un documento semilla", async () => {
    await libraryApi.saveFigureAlt("d1", "sample-chart", "Barras que crecen de 2019 a 2024.");
    const article = await libraryApi.loadArticle("d1");
    expect(article.blocks.find((b) => b.type === "figure")).toMatchObject({
      alt: "Barras que crecen de 2019 a 2024.",
    });
  });

  it("withFigureAlt solo cambia la figura pedida y no toca el artículo original", () => {
    const article = {
      title: "t",
      meta: "m",
      blocks: [
        { type: "figure" as const, id: "a" },
        { type: "figure" as const, id: "b" },
      ],
    };
    const next = withFigureAlt(article, "b", "torta");
    expect(next.blocks).toEqual([
      { type: "figure", id: "a" },
      { type: "figure", id: "b", alt: "torta" },
    ]);
    expect(article.blocks[1]).toEqual({ type: "figure", id: "b" });
  });

  it("dos descripciones guardadas a la vez no se pisan", async () => {
    await idb.set("article:dos", {
      title: "t",
      meta: "m",
      blocks: [
        { type: "figure", id: "a" },
        { type: "figure", id: "b" },
      ],
    });
    await Promise.all([
      libraryApi.saveFigureAlt("dos", "a", "primera"),
      libraryApi.saveFigureAlt("dos", "b", "segunda"),
    ]);
    const saved = await libraryApi.loadArticle("dos");
    expect(saved.blocks).toEqual([
      { type: "figure", id: "a", alt: "primera" },
      { type: "figure", id: "b", alt: "segunda" },
    ]);
  });
});
