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

/** Los elementos válidos, sin ids repetidos: de cada id queda el primero (el id es la `key` de cada tarjeta). */
function toPresets(raw: unknown): Preset[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.flatMap((item) => {
    const preset = toPreset(item);
    if (!preset || seen.has(preset.id)) return [];
    seen.add(preset.id);
    return [preset];
  });
}

/** Catálogo del backend; si falla o no trae ningún preset válido, el último guardado en caché; si tampoco hay, vacío. */
export async function loadPresetCatalog(): Promise<PresetCatalog> {
  try {
    const dto = await request<unknown>({ method: "GET", url: "/presets", timeout: TIMEOUT_MS, retry: false });
    const presets = toPresets(dto);
    // Una respuesta vacía o toda inválida no debe pisar una caché buena.
    if (presets.length > 0) {
      storage.set(CACHE_KEY, { savedAt: new Date().toISOString(), presets: dto });
      return { presets, source: "live" };
    }
  } catch {
    // sin backend: se cae a la caché
  }
  const cached = toPresets(storage.get<{ presets?: unknown }>(CACHE_KEY)?.presets);
  return cached.length > 0 ? { presets: cached, source: "cache" } : { presets: [], source: "unavailable" };
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
