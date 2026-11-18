import { beforeEach, expect, it } from "vitest";

import { grantVoiceConsent, hasVoiceConsent, revokeVoiceConsent } from "./consent";

beforeEach(() => window.localStorage.clear());
it("el consentimiento se guarda por tipo", () => {
  expect(hasVoiceConsent("commands")).toBe(false);
  grantVoiceConsent("commands");
  expect(hasVoiceConsent("commands")).toBe(true);
  expect(hasVoiceConsent("captions")).toBe(false);
  expect(JSON.parse(window.localStorage.getItem("aulaclara.voiceConsent") ?? "null")).toEqual({
    commands: true,
  });
});

it("un valor guardado corrupto no cuenta como consentimiento", () => {
  window.localStorage.setItem("aulaclara.voiceConsent", "no es json");
  expect(hasVoiceConsent("commands")).toBe(false);
  window.localStorage.setItem("aulaclara.voiceConsent", JSON.stringify({ commands: "sí" }));
  expect(hasVoiceConsent("commands")).toBe(false);
});

it("revocar el permiso borra solo ese tipo y deja el otro", () => {
  grantVoiceConsent("commands");
  grantVoiceConsent("captions");
  revokeVoiceConsent("captions");
  expect(hasVoiceConsent("captions")).toBe(false);
  expect(hasVoiceConsent("commands")).toBe(true);
  revokeVoiceConsent("commands");
  expect(window.localStorage.getItem("aulaclara.voiceConsent")).toBeNull();
});
