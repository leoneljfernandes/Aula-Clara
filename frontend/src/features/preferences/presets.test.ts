import { beforeEach, describe, expect, it, vi } from "vitest";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/http", async (o) => ({ ...(await o<typeof import("@/lib/http")>()), request }));

import { DEFAULT_SETTINGS } from "./settings";
import { applyPreset, loadPresetCatalog, matchPreset } from "./presets";

const DTO = {
  id: "dislexia",
  title: "Dislexia",
  icon: "Aa",
  description: "d",
  tags: ["t"],
  settings: { font: "dyslexic", font_size: 21, inventado: true },
};

beforeEach(() => {
  request.mockReset();
  window.localStorage.clear();
});

describe("loadPresetCatalog", () => {
  it("trae el catálogo, lo pasa a camelCase, descarta lo desconocido y lo guarda en caché", async () => {
    request.mockResolvedValue([DTO, { id: "roto" }]);
    const catalog = await loadPresetCatalog();
    expect(request).toHaveBeenCalledWith({ method: "GET", url: "/presets", timeout: 5000, retry: false });
    expect(catalog.source).toBe("live");
    expect(catalog.presets).toEqual([
      {
        id: "dislexia",
        title: "Dislexia",
        icon: "Aa",
        description: "d",
        tags: ["t"],
        settings: { font: "dyslexic", fontSize: 21 },
      },
    ]);
    expect(JSON.parse(window.localStorage.getItem("aulaclara.presets") ?? "{}").presets).toEqual([
      DTO,
      { id: "roto" },
    ]);
  });
  it("un id repetido se descarta: queda el primero", async () => {
    request.mockResolvedValue([DTO, { ...DTO, title: "Repetido" }]);
    const catalog = await loadPresetCatalog();
    expect(catalog.presets.map((p) => [p.id, p.title])).toEqual([["dislexia", "Dislexia"]]);
  });
  it("si el backend falla, usa la caché", async () => {
    window.localStorage.setItem(
      "aulaclara.presets",
      JSON.stringify({ savedAt: "2026-11-18T00:00:00Z", presets: [DTO] }),
    );
    request.mockRejectedValue(new Error("caído"));
    const catalog = await loadPresetCatalog();
    expect(catalog.source).toBe("cache");
    expect(catalog.presets.map((p) => p.id)).toEqual(["dislexia"]);
  });
  it("un catálogo en vivo vacío no pisa la caché y se usa la caché", async () => {
    const cache = JSON.stringify({ savedAt: "2026-11-18T00:00:00Z", presets: [DTO] });
    window.localStorage.setItem("aulaclara.presets", cache);
    request.mockResolvedValue([]);
    const catalog = await loadPresetCatalog();
    expect(catalog.source).toBe("cache");
    expect(catalog.presets.map((p) => p.id)).toEqual(["dislexia"]);
    expect(window.localStorage.getItem("aulaclara.presets")).toBe(cache);
  });
  it("un catálogo en vivo sin ningún elemento válido tampoco pisa la caché", async () => {
    const cache = JSON.stringify({ savedAt: "2026-11-18T00:00:00Z", presets: [DTO] });
    window.localStorage.setItem("aulaclara.presets", cache);
    request.mockResolvedValue([{ id: "roto" }]);
    expect((await loadPresetCatalog()).source).toBe("cache");
    expect(window.localStorage.getItem("aulaclara.presets")).toBe(cache);
  });
  it("un catálogo en vivo vacío sin caché no hay presets", async () => {
    request.mockResolvedValue([]);
    expect(await loadPresetCatalog()).toEqual({ presets: [], source: "unavailable" });
    expect(window.localStorage.getItem("aulaclara.presets")).toBeNull();
  });
  it("sin backend ni caché no hay presets", async () => {
    request.mockRejectedValue(new Error("caído"));
    expect(await loadPresetCatalog()).toEqual({ presets: [], source: "unavailable" });
  });
});

it("applyPreset parte de los valores por defecto: no arrastra ajustes anteriores", () => {
  const preset = {
    id: "a",
    title: "A",
    icon: "A",
    description: "",
    tags: [],
    settings: { font: "dyslexic" as const },
  };
  expect(applyPreset(preset)).toEqual({ ...DEFAULT_SETTINGS, font: "dyslexic" });
  expect(matchPreset([preset], { ...DEFAULT_SETTINGS, font: "dyslexic" })).toBe("a");
  expect(matchPreset([preset], { ...DEFAULT_SETTINGS, font: "dyslexic", fontSize: 30 })).toBeNull();
});
