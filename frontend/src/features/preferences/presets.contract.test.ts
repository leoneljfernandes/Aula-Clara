// @vitest-environment node
// el catálogo del backend solo usa capacidades que el frontend conoce
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { sanitizePatch, snakeToCamelKeys } from "./settings";

const seed = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../../backend/app/seed/presets.json", import.meta.url)), "utf8"),
) as Array<{ id: string; settings: Record<string, unknown> }>;

it("el seed no está vacío", () => {
  expect(seed.length).toBeGreaterThan(0);
});

it.each(seed.map((p) => [p.id, p] as const))(
  "el preset %s solo usa ajustes y valores conocidos",
  (_id, preset) => {
    expect(sanitizePatch(snakeToCamelKeys(preset.settings)).rejected).toEqual([]);
  },
);

it("los ids son únicos", () => {
  expect(new Set(seed.map((p) => p.id)).size).toBe(seed.length);
});
