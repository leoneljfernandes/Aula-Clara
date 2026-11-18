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
  {
    key: "voiceCommands",
    kind: "choice",
    label: "Comandos por voz",
    options: [
      { value: "off", label: "Apagados" },
      { value: "push", label: "Al tocar el micrófono" },
      { value: "continuous", label: "Manos libres (escucha siempre)" },
    ],
    help: "Necesita Chrome, Edge o Safari.",
    group: "voz",
    inReader: true,
  },
  {
    key: "brailleTools",
    kind: "toggle",
    label: "Herramientas de Braille",
    help: "Muestra el botón «Braille» en el lector para ver el documento en Braille, descargarlo como .BRF o imprimirlo en relieve.",
    group: "lectura",
    inReader: true,
  },
  {
    key: "uiScale",
    kind: "choice",
    label: "Tamaño de los botones",
    options: [
      { value: "normal", label: "Normal" },
      { value: "large", label: "Grandes y pantalla simplificada" },
    ],
    group: "interfaz",
    inReader: true,
  },
  {
    key: "clickGuard",
    kind: "choice",
    label: "Evitar clics dobles involuntarios",
    options: [
      { value: "off", label: "No" },
      { value: "normal", label: "Sí" },
      { value: "strong", label: "Sí, más fuerte" },
    ],
    help: "Ignora un segundo clic sobre el mismo botón si llega demasiado rápido. No afecta al teclado.",
    group: "interfaz",
    inReader: true,
  },
  {
    key: "clickToSelect",
    kind: "toggle",
    label: "Elegir un párrafo con un clic",
    help: "Un clic o Enter sobre un párrafo lo selecciona, sin arrastrar el mouse, y muestra acciones grandes abajo.",
    group: "interfaz",
    inReader: true,
  },
  {
    key: "aiLanguage",
    kind: "choice",
    label: "Cómo te responde el asistente",
    options: [
      { value: "standard", label: "Estándar" },
      { value: "plain", label: "Lenguaje claro" },
      { value: "easy", label: "Lectura Fácil" },
    ],
    help: "Lenguaje claro: oraciones cortas y directas. Lectura Fácil: todavía más simple, con ejemplos.",
    group: "asistente",
    inReader: true,
  },
  {
    key: "hideAudio",
    kind: "toggle",
    label: "Ocultar la lectura en voz alta",
    help: "Saca de la pantalla los controles de audio que no usás.",
    group: "interfaz",
    inReader: true,
  },
  {
    key: "visualAlerts",
    kind: "toggle",
    label: "Mostrar los avisos en pantalla",
    help: "Cada aviso («Preferencias guardadas», «Tema Sepia»…) queda visible hasta el siguiente.",
    group: "interfaz",
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
