import { request } from "@/lib/http";
import { storage } from "@/lib/storage";

import { DEFAULT_SETTINGS, type ReadingSettings, sanitizePatch, snakeToCamelKeys } from "./settings";

const CACHE_KEY = "aulaclara.presets";
/** El wizard no puede quedar esperando los 45 s del cliente HTTP. */
const TIMEOUT_MS = 5000;

export interface Preset {
  id: string;
  title: string;
  icon: string;
  description: string;
  tags: readonly string[];
  settings: Partial<ReadingSettings>;
}

export interface PresetCatalog {
  presets: readonly Preset[];
  source: "live" | "cache" | "unavailable";
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Valida un elemento del DTO del backend; lo inválido se descarta. Los ajustes desconocidos se ignoran. */
function toPreset(raw: unknown): Preset | null {
  if (!isRecord(raw)) return null;
  const { id, title, icon, description, tags, settings } = raw;
  if (
    typeof id !== "string" ||
    typeof title !== "string" ||
    typeof icon !== "string" ||
    typeof description !== "string" ||
    !Array.isArray(tags) ||
    !tags.every((t) => typeof t === "string") ||
    !isRecord(settings)
  ) {
    return null;
  }
  return {
    id,
    title,
    icon,
    description,
    tags: tags as string[],
    settings: sanitizePatch(snakeToCamelKeys(settings)).patch,
  };
}

function toPresets(raw: unknown): Preset[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const preset = toPreset(item);
    return preset ? [preset] : [];
  });
}

/** Catálogo del backend; si falla, el último que se guardó en caché; si tampoco hay, vacío. */
export async function loadPresetCatalog(): Promise<PresetCatalog> {
  try {
    const dto = await request<unknown>({ method: "GET", url: "/presets", timeout: TIMEOUT_MS, retry: false });
    if (!Array.isArray(dto)) throw new Error("catálogo con forma inesperada");
    storage.set(CACHE_KEY, { savedAt: new Date().toISOString(), presets: dto });
    return { presets: toPresets(dto), source: "live" };
  } catch {
    const cached = storage.get<{ presets?: unknown }>(CACHE_KEY);
    const presets = toPresets(cached?.presets);
    return presets.length > 0 ? { presets, source: "cache" } : { presets: [], source: "unavailable" };
  }
}

/** Elegir un preset reemplaza los ajustes: parte de los valores por defecto, no de los actuales. */
export function applyPreset(preset: Preset): ReadingSettings {
  return { ...DEFAULT_SETTINGS, ...preset.settings };
}

/** `id` del preset cuyos ajustes coinciden exactamente con `settings`, o `null`. */
export function matchPreset(presets: readonly Preset[], settings: ReadingSettings): string | null {
  const keys = Object.keys(DEFAULT_SETTINGS) as (keyof ReadingSettings)[];
  return (
    presets.find((p) => {
      const applied = applyPreset(p);
      return keys.every((k) => applied[k] === settings[k]);
    })?.id ?? null
  );
}
