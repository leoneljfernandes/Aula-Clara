import type { ReadingSettings } from "./settings";

export type ControlGroup = "lectura" | "voz" | "interfaz" | "asistente" | "colores";

/** Claves de `ReadingSettings` cuyo valor es de tipo `V` (o una unión de subtipos de `V`). */
type KeysOfType<V> = {
  [K in keyof ReadingSettings]-?: ReadingSettings[K] extends V ? K : never;
}[keyof ReadingSettings];

interface BaseControl {
  label: string;
  help?: string;
  group: ControlGroup;
  /** Si se ofrece también en el panel de herramientas del lector, además del onboarding. */
  inReader: boolean;
}

type ToggleKey = KeysOfType<boolean>;
type ChoiceKey = KeysOfType<string>;

/**
 * Un control por clave: la unión se arma clave por clave para que las opciones de un `choice` tengan el
 * tipo de su ajuste (`ThemeId` para `theme`). Un valor mal escrito no compila.
 */
export type ControlSpec =
  | { [K in ToggleKey]: BaseControl & { key: K; kind: "toggle" } }[ToggleKey]
  | {
      [K in ChoiceKey]: BaseControl & {
        key: K;
        kind: "choice";
        options: readonly { value: ReadingSettings[K]; label: string }[];
      };
    }[ChoiceKey];

/** Orden y título con que `SettingsControls` agrupa los controles. */
export const CONTROL_GROUPS: readonly { id: ControlGroup; title: string }[] = [
  { id: "lectura", title: "Lectura" },
  { id: "voz", title: "Voz" },
  { id: "interfaz", title: "Interfaz" },
  { id: "asistente", title: "Asistente" },
  { id: "colores", title: "Colores" },
];

/**
 * Registro de controles por capacidad. Una capacidad nueva = un campo en `ReadingSettings` + una entrada
 * acá: la UI de ajustes (onboarding y lector) se genera sola, no se escribe a mano.
 */
export const CONTROLS: readonly ControlSpec[] = [
  {
    key: "audioFocus",
    kind: "toggle",
    label: "Destacar la lectura en voz alta",
    group: "lectura",
    inReader: false,
  },
  {
    key: "singleKeyShortcuts",
    kind: "toggle",
    label: "Atajos de una sola tecla",
    help: "J y K para moverte por bloques, Espacio para leer y 1 a 4 para el asistente. No funcionan mientras escribís.",
    group: "voz",
    inReader: true,
  },
  {
    key: "voiceGuide",
    kind: "toggle",
    label: "Guía por voz (si no usás lector de pantalla)",
    help: "Lee en voz alta el bloque al que te movés y las respuestas del asistente. Si usás NVDA, JAWS o VoiceOver, dejalo apagado para no escuchar dos voces.",
    group: "voz",
    inReader: true,
  },
];

/** Dónde se dibujan los controles: el onboarding los muestra todos; el lector, solo los `inReader`. */
export type ControlPlacement = "onboarding" | "reader";

export function controlsFor(
  placement: ControlPlacement,
  controls: readonly ControlSpec[] = CONTROLS,
): readonly ControlSpec[] {
  return controls.filter((c) => placement === "onboarding" || c.inReader);
}
