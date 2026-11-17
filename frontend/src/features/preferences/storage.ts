import { storage } from "@/lib/storage";

import { DEFAULT_SETTINGS, FONTS, PROFILES, type Profile, type ReadingSettings, THEMES } from "./config";

const SETTINGS_KEY = "aulaclara.settings";
const PROFILE_KEY = "aulaclara.profile";

export function loadProfileId(): Profile["id"] | null {
  const id = storage.get<string>(PROFILE_KEY);
  return PROFILES.find((p) => p.id === id)?.id ?? null;
}

/** Lo guardado puede venir de una versión vieja o estar corrupto: se valida campo a campo. */
export function loadSettings(): ReadingSettings {
  const saved = storage.get<Partial<ReadingSettings>>(SETTINGS_KEY) ?? {};
  return {
    theme: saved.theme && saved.theme in THEMES ? saved.theme : DEFAULT_SETTINGS.theme,
    font: saved.font && saved.font in FONTS ? saved.font : DEFAULT_SETTINGS.font,
    fontSize: typeof saved.fontSize === "number" ? saved.fontSize : DEFAULT_SETTINGS.fontSize,
    lineHeight: typeof saved.lineHeight === "number" ? saved.lineHeight : DEFAULT_SETTINGS.lineHeight,
    rate: typeof saved.rate === "number" ? saved.rate : DEFAULT_SETTINGS.rate,
    audioFocus: typeof saved.audioFocus === "boolean" ? saved.audioFocus : DEFAULT_SETTINGS.audioFocus,
  };
}

export function saveSettings(settings: ReadingSettings): void {
  storage.set(SETTINGS_KEY, settings);
}

export function saveProfileId(id: Profile["id"]): void {
  storage.set(PROFILE_KEY, id);
}
