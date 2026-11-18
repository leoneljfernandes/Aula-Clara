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

export type ControlSpec =
  | (BaseControl & { key: KeysOfType<boolean>; kind: "toggle" })
  | (BaseControl & {
      key: KeysOfType<string>;
      kind: "choice";
      options: readonly { value: string; label: string }[];
    });

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
];

/** Dónde se dibujan los controles: el onboarding los muestra todos; el lector, solo los `inReader`. */
export type ControlPlacement = "onboarding" | "reader";

export function controlsFor(
  placement: ControlPlacement,
  controls: readonly ControlSpec[] = CONTROLS,
): readonly ControlSpec[] {
  return controls.filter((c) => placement === "onboarding" || c.inReader);
}
