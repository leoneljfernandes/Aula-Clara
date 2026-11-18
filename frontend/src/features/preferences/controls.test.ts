import { expect, it } from "vitest";

import { type ControlSpec, controlsFor } from "./controls";

const inReader: ControlSpec = {
  key: "audioFocus",
  kind: "toggle",
  label: "En el lector",
  group: "lectura",
  inReader: true,
};
const onlyOnboarding: ControlSpec = { ...inReader, label: "Solo en el onboarding", inReader: false };

it("controlsFor: el onboarding muestra todos los controles; el lector, solo los inReader", () => {
  expect(controlsFor("onboarding", [inReader, onlyOnboarding])).toEqual([inReader, onlyOnboarding]);
  expect(controlsFor("reader", [inReader, onlyOnboarding])).toEqual([inReader]);
});

// Test de tipos: lo comprueba `npm run typecheck` (un @ts-expect-error que sobra también es un error).
it("las opciones de un control de elección tienen el tipo de su ajuste", () => {
  const theme: ControlSpec = {
    key: "theme",
    kind: "choice",
    label: "Tema",
    group: "colores",
    inReader: true,
    options: [{ value: "sepia", label: "Sepia" }],
  };
  const typo: ControlSpec = {
    ...theme,
    // @ts-expect-error «neon» no es un tema
    options: [{ value: "neon", label: "Neón" }],
  };
  const otherKey: ControlSpec = {
    ...theme,
    // @ts-expect-error «dyslexic» es una tipografía, no un tema
    options: [{ value: "dyslexic", label: "OpenDyslexic" }],
  };
  expect([theme, typo, otherKey].map((c) => c.kind)).toEqual(["choice", "choice", "choice"]);
});
