import { beforeEach, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "./settings";
import { isOnboarded, loadSettings, markOnboarded, saveSettings } from "./storage";

beforeEach(() => window.localStorage.clear());

it("lee ajustes de la versión 1 (objeto plano) y los guarda en la versión 2", () => {
  window.localStorage.setItem("aulaclara.settings", JSON.stringify({ font: "verdana", fontSize: 99 }));
  const loaded = loadSettings();
  expect(loaded).toEqual({ ...DEFAULT_SETTINGS, font: "verdana" });
  saveSettings(loaded);
  expect(JSON.parse(window.localStorage.getItem("aulaclara.settings") ?? "")).toEqual({
    schemaVersion: 2,
    settings: loaded,
  });
});

it("lee el sobre de la versión 2", () => {
  window.localStorage.setItem(
    "aulaclara.settings",
    JSON.stringify({ schemaVersion: 2, settings: { theme: "sepia", fontSize: "grande" } }),
  );
  expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, theme: "sepia" });
});

it("una persona con el perfil de la versión anterior ya hizo el onboarding, y la clave vieja se borra", () => {
  window.localStorage.setItem("aulaclara.profile", JSON.stringify("dislexia"));
  expect(isOnboarded()).toBe(true);
  expect(window.localStorage.getItem("aulaclara.profile")).toBeNull();
  expect(window.localStorage.getItem("aulaclara.onboarded")).toBe("true");
});

it("sin nada guardado no hizo el onboarding; markOnboarded lo registra", () => {
  expect(isOnboarded()).toBe(false);
  markOnboarded();
  expect(isOnboarded()).toBe(true);
});
