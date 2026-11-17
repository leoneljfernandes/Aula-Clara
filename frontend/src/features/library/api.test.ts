import { describe, expect, it } from "vitest";

import { libraryApi } from "./api";
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
});
