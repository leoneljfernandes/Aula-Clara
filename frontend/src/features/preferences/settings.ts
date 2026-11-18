import { FONTS, type FontId, MAX_FS, MIN_FS, RATES, THEMES, type ThemeId } from "./config";

/** Todo lo que una persona puede ajustar. Agregar una capacidad: un campo acá, su entrada en FIELDS y su valor en DEFAULT_SETTINGS. */
export interface ReadingSettings {
  theme: ThemeId;
  font: FontId;
  fontSize: number;
  lineHeight: number;
  rate: number;
  audioFocus: boolean;
  singleKeyShortcuts: boolean;
  voiceGuide: boolean;
  voiceCommands: "off" | "push" | "continuous";
  brailleTools: boolean;
}

export const DEFAULT_SETTINGS: ReadingSettings = {
  theme: "claro",
  font: "atkinson",
  fontSize: 20,
  lineHeight: 1.7,
  rate: 1,
  audioFocus: false,
  singleKeyShortcuts: false,
  voiceGuide: false,
  voiceCommands: "off",
  brailleTools: false,
};

export const SETTINGS_SCHEMA_VERSION = 2;
export const LINE_HEIGHT = { min: 1.3, max: 2.4, step: 0.1 } as const;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Un validador por campo: TypeScript exige que no falte ninguno. */
const FIELDS: { [K in keyof ReadingSettings]: (v: unknown) => v is ReadingSettings[K] } = {
  theme: (v): v is ThemeId => typeof v === "string" && Object.hasOwn(THEMES, v),
  font: (v): v is FontId => typeof v === "string" && Object.hasOwn(FONTS, v),
  fontSize: (v): v is number => Number.isInteger(v) && (v as number) >= MIN_FS && (v as number) <= MAX_FS,
  lineHeight: (v): v is number =>
    typeof v === "number" && Number.isFinite(v) && v >= LINE_HEIGHT.min && v <= LINE_HEIGHT.max,
  rate: (v): v is number => typeof v === "number" && (RATES as readonly number[]).includes(v),
  audioFocus: (v): v is boolean => typeof v === "boolean",
  singleKeyShortcuts: (v): v is boolean => typeof v === "boolean",
  voiceGuide: (v): v is boolean => typeof v === "boolean",
  voiceCommands: (v): v is ReadingSettings["voiceCommands"] =>
    v === "off" || v === "push" || v === "continuous",
  brailleTools: (v): v is boolean => typeof v === "boolean",
};

const isKnownField = (key: string): key is keyof ReadingSettings => Object.hasOwn(FIELDS, key);

/** Conserva lo válido campo por campo y completa el resto con los valores por defecto. */
export function sanitizeSettings(raw: unknown): ReadingSettings {
  const { patch } = sanitizePatch(raw);
  return { ...DEFAULT_SETTINGS, ...patch };
}

/** Solo los campos conocidos y válidos; `rejected` nombra los desconocidos o inválidos. */
export function sanitizePatch(raw: unknown): { patch: Partial<ReadingSettings>; rejected: string[] } {
  const patch: Record<string, unknown> = {};
  const rejected: string[] = [];
  if (!isRecord(raw)) return { patch: {}, rejected };
  for (const [key, value] of Object.entries(raw)) {
    if (isKnownField(key) && FIELDS[key](value)) patch[key] = value;
    else rejected.push(key);
  }
  return { patch: patch as Partial<ReadingSettings>, rejected };
}

/** `font_size` -> `fontSize`: convierte solo las claves, nunca los valores. */
export function snakeToCamelKeys(raw: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase()),
      value,
    ]),
  );
}
