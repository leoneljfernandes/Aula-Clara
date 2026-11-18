import { expect, it } from "vitest";
import { slugify } from "./slugify";

it("arma un nombre de archivo seguro", () => {
  expect(slugify("Accesibilidad digital: ¿barreras y oportunidades?")).toBe(
    "accesibilidad-digital-barreras-y-oportunidades",
  );
  expect(slugify("a".repeat(100))).toHaveLength(60);
});
