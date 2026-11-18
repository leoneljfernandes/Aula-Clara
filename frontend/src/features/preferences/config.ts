import type { ReadingSettings } from "./settings";

/** Temas, tipografías y perfiles: los mismos valores del prototipo original. */
export interface ThemeDef {
  label: string;
  swatch: readonly [string, string];
  vars: Record<
    "bg" | "fg" | "panel" | "muted" | "border" | "accent" | "onAccent" | "soft" | "hl" | "hlFg" | "focus",
    string
  >;
}

export const THEMES = {
  claro: {
    label: "Claro",
    swatch: ["#FFFFFF", "#0A0A0A"],
    vars: {
      bg: "#FFFFFF",
      fg: "#0A0A0A",
      panel: "#F3F4F6",
      muted: "#374151",
      border: "#6B7280",
      accent: "#1D4ED8",
      onAccent: "#FFFFFF",
      soft: "#E0E7FF",
      hl: "#FDE047",
      hlFg: "#0A0A0A",
      focus: "#C2410C",
    },
  },
  sepia: {
    label: "Sepia",
    swatch: ["#F4ECD8", "#2B2113"],
    vars: {
      bg: "#F4ECD8",
      fg: "#2B2113",
      panel: "#EADFC2",
      muted: "#4A3B26",
      border: "#8A7556",
      accent: "#7C2D12",
      onAccent: "#FFFFFF",
      soft: "#E4D3AA",
      hl: "#E9B949",
      hlFg: "#1A1208",
      focus: "#1D4ED8",
    },
  },
  oscuro: {
    label: "Oscuro cálido",
    swatch: ["#1C1917", "#F2E8D8"],
    vars: {
      bg: "#1C1917",
      fg: "#F2E8D8",
      panel: "#292524",
      muted: "#D6C8B2",
      border: "#A8A29E",
      accent: "#FDBA74",
      onAccent: "#1C1917",
      soft: "#3A332E",
      hl: "#92400E",
      hlFg: "#FFF7ED",
      focus: "#FDE047",
    },
  },
  contraste: {
    label: "Alto contraste",
    swatch: ["#000000", "#FFE600"],
    vars: {
      bg: "#000000",
      fg: "#FFE600",
      panel: "#0A0A0A",
      muted: "#FFFFFF",
      border: "#FFE600",
      accent: "#00E5FF",
      onAccent: "#000000",
      soft: "#262600",
      hl: "#FFFFFF",
      hlFg: "#000000",
      focus: "#FF4FD8",
    },
  },
} as const satisfies Record<string, ThemeDef>;

export type ThemeId = keyof typeof THEMES;
export const THEME_ORDER: readonly ThemeId[] = ["claro", "sepia", "oscuro", "contraste"];

export interface FontDef {
  label: string;
  css: string;
}

export const FONTS = {
  arial: { label: "Arial", css: "Arial, Helvetica, sans-serif" },
  verdana: { label: "Verdana", css: "Verdana, Geneva, sans-serif" },
  atkinson: { label: "Atkinson Hyperlegible", css: "'Atkinson Hyperlegible', Verdana, sans-serif" },
  dyslexic: { label: "OpenDyslexic", css: "'OpenDyslexic', Verdana, sans-serif" },
} as const satisfies Record<string, FontDef>;

export type FontId = keyof typeof FONTS;

export const MIN_FS = 14;
export const MAX_FS = 40;
export const RATES = [0.75, 1, 1.5] as const;

export interface Profile {
  id: "dislexia" | "vision" | "fatiga" | "custom";
  title: string;
  icon: string;
  desc: string;
  tags: readonly string[];
  preset: Partial<ReadingSettings> | null;
}

export const PROFILES: readonly Profile[] = [
  {
    id: "dislexia",
    title: "Dislexia",
    icon: "Aa",
    desc: "Fuente especializada, mayor interlineado y más espacio entre letras.",
    tags: ["OpenDyslexic", "Interlineado amplio", "Fondo sepia"],
    preset: { font: "dyslexic", fontSize: 21, lineHeight: 1.9, theme: "sepia", audioFocus: false },
  },
  {
    id: "vision",
    title: "Visión reducida",
    icon: "A+",
    desc: "Alto contraste y texto grande para leer sin esfuerzo.",
    tags: ["Texto 28 px", "Negro y amarillo", "Tipografía legible"],
    preset: { font: "atkinson", fontSize: 28, lineHeight: 1.7, theme: "contraste", audioFocus: false },
  },
  {
    id: "fatiga",
    title: "Fatiga visual",
    icon: "☾",
    desc: "Modo oscuro cálido y la lectura en voz alta siempre a mano.",
    tags: ["Modo oscuro cálido", "Audio destacado", "Verdana"],
    preset: { font: "verdana", fontSize: 20, lineHeight: 1.8, theme: "oscuro", audioFocus: true },
  },
  {
    id: "custom",
    title: "Personalizado",
    icon: "⚙",
    desc: "Elegí vos el tamaño, los colores y la tipografía.",
    tags: ["Control total"],
    preset: null,
  },
];

export const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

export function readingStyle(s: ReadingSettings): React.CSSProperties {
  return {
    fontFamily: FONTS[s.font].css,
    fontSize: `${s.fontSize}px`,
    lineHeight: s.lineHeight,
    ...(s.font === "dyslexic" ? { letterSpacing: "0.04em", wordSpacing: "0.12em" } : null),
  };
}
