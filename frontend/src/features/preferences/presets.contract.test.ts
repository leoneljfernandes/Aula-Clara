// el catálogo del backend solo usa capacidades que el frontend conoce
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { sanitizePatch, snakeToCamelKeys } from "./settings";

const seed = JSON.parse(
  // vitest corre desde frontend/; en jsdom import.meta.url no es un file: URL
  readFileSync(resolve(process.cwd(), "../backend/app/seed/presets.json"), "utf8"),
) as Array<{ id: string; settings: Record<string, unknown> }>;

it.each(seed.map((p) => [p.id, p] as const))(
  "el preset %s solo usa ajustes y valores conocidos",
  (_id, preset) => {
    expect(sanitizePatch(snakeToCamelKeys(preset.settings)).rejected).toEqual([]);
  },
);

it("los ids son únicos", () => {
  expect(new Set(seed.map((p) => p.id)).size).toBe(seed.length);
});
