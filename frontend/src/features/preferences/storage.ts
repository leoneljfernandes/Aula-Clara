import { storage } from "@/lib/storage";

import { PROFILES, type Profile } from "./config";
import {
  DEFAULT_SETTINGS,
  type ReadingSettings,
  SETTINGS_SCHEMA_VERSION,
  sanitizeSettings,
} from "./settings";

const SETTINGS_KEY = "aulaclara.settings";
const ONBOARDED_KEY = "aulaclara.onboarded";
const PROFILE_KEY = "aulaclara.profile";

export function loadProfileId(): Profile["id"] | null {
  const id = storage.get<string>(PROFILE_KEY);
  return PROFILES.find((p) => p.id === id)?.id ?? null;
}

/**
 * Acepta el sobre `{ schemaVersion: 2, settings }` y el objeto plano de la versión 1.
 * Lo guardado puede venir de una versión vieja o estar corrupto: se valida campo a campo.
 */
export function loadSettings(): ReadingSettings {
  const saved = storage.get<unknown>(SETTINGS_KEY);
  if (saved === null) return { ...DEFAULT_SETTINGS };
  const isEnvelope =
    typeof saved === "object" && !Array.isArray(saved) && "schemaVersion" in saved && "settings" in saved;
  return sanitizeSettings(isEnvelope ? saved.settings : saved);
}

export function saveSettings(settings: ReadingSettings): void {
  storage.set(SETTINGS_KEY, { schemaVersion: SETTINGS_SCHEMA_VERSION, settings });
}

/** Quien tiene el perfil de la versión 1 ya hizo el onboarding: se migra a la marca nueva y la clave vieja se borra. */
export function isOnboarded(): boolean {
  if (storage.get<unknown>(PROFILE_KEY) !== null) {
    markOnboarded();
    storage.remove(PROFILE_KEY);
    return true;
  }
  return storage.get<boolean>(ONBOARDED_KEY) === true;
}

export function markOnboarded(): void {
  storage.set(ONBOARDED_KEY, true);
}

export function saveProfileId(id: Profile["id"]): void {
  storage.set(PROFILE_KEY, id);
}
