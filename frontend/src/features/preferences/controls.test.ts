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
