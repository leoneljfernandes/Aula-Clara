/** La única tabla de atajos: el lector despacha por id y los diálogos de ayuda leen estas mismas filas. */

export type ShortcutId =
  | "playPause"
  | "stop"
  | "fontUp"
  | "fontDown"
  | "nextTheme"
  | "focusAssistant"
  | "nextBlock"
  | "prevBlock"
  | "nextHeading"
  | "nextFigure"
  | "toggleMic"
  | "openBraille"
  | "voiceHelp"
  | "summarize"
  | "keyConcepts"
  | "quiz"
  | "simplifyBlock"
  | "silence";

export interface Shortcut {
  id: ShortcutId;
  label: string;
  /** Con Alt: funcionan siempre. Valores de `KeyboardEvent.code`. */
  alt?: readonly string[];
  /** Una tecla sola: solo con «Atajos de una sola tecla» activo y fuera de un campo de escritura. */
  single?: readonly string[];
  /** Una tecla sola que funciona siempre, también dentro de un campo (Esc). */
  plain?: readonly string[];
  /** Capacidad que debe existir para mostrar el atajo en la ayuda. */
  requires?: "audio" | "voice" | "braille";
}

export const KEYMAP: readonly Shortcut[] = [
  { id: "playPause", label: "Leer / pausar", alt: ["KeyP"], single: ["Space"], requires: "audio" },
  { id: "stop", label: "Detener lectura", alt: ["KeyS"], requires: "audio" },
  { id: "fontUp", label: "Agrandar texto", alt: ["Equal", "NumpadAdd"] },
  { id: "fontDown", label: "Achicar texto", alt: ["Minus", "NumpadSubtract"] },
  { id: "nextTheme", label: "Cambiar tema de color", alt: ["KeyT"] },
  { id: "focusAssistant", label: "Ir al asistente", alt: ["KeyA"] },
  { id: "nextBlock", label: "Bloque siguiente", alt: ["ArrowDown"], single: ["KeyJ"] },
  { id: "prevBlock", label: "Bloque anterior", alt: ["ArrowUp"], single: ["KeyK"] },
  { id: "nextHeading", label: "Título siguiente", alt: ["KeyH"], single: ["KeyH"] },
  { id: "nextFigure", label: "Gráfico siguiente", alt: ["KeyG"], single: ["KeyG"] },
  {
    id: "toggleMic",
    label: "Activar o apagar el micrófono",
    alt: ["KeyM"],
    single: ["KeyM"],
    requires: "voice",
  },
  {
    id: "voiceHelp",
    label: "Ver los comandos de voz",
    alt: ["KeyV"],
    single: ["KeyV"],
    requires: "voice",
  },
  { id: "openBraille", label: "Abrir Braille", alt: ["KeyB"], single: ["KeyB"], requires: "braille" },
  { id: "summarize", label: "Resumir", single: ["Digit1", "Numpad1"] },
  { id: "keyConcepts", label: "Conceptos clave", single: ["Digit2", "Numpad2"] },
  { id: "quiz", label: "Preguntas de repaso", single: ["Digit3", "Numpad3"] },
  {
    id: "simplifyBlock",
    label: "Explicar el bloque actual más simple",
    single: ["Digit4", "Numpad4"],
  },
  { id: "silence", label: "Silenciar la voz", plain: ["Escape"] },
];

export type KeyLike = Pick<KeyboardEvent, "code" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey"> & {
  target: EventTarget | null;
};

const NON_TEXT_INPUTS = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

/** El foco está en algo donde se escribe (o se elige con el teclado): ahí las letras y los números son del campo. */
function isTypingTarget(target: Element | null): boolean {
  if (!target) return false;
  if (target.closest("textarea, select, [role='textbox'], [role='combobox']")) return true;
  if (target.closest("[contenteditable]:not([contenteditable='false'])")) return true;
  const input = target.closest("input");
  return input !== null && !NON_TEXT_INPUTS.has(input.type);
}

const SPACE_ACTIVATED =
  "button, a, summary, input[type='checkbox'], input[type='radio'], input[type='button'], " +
  "input[type='submit'], input[type='reset'], " +
  "[role='button'], [role='link'], [role='checkbox'], [role='radio'], [role='switch'], " +
  "[role='menuitem'], [role='option'], [role='tab']";

/** Qué atajo dispara esta tecla, o `null` si es de otra cosa (un campo, un botón, el navegador). */
export function matchShortcut(e: KeyLike, opts: { singleKey: boolean }): ShortcutId | null {
  if (e.ctrlKey || e.metaKey) return null;
  const target = e.target instanceof Element ? e.target : null;

  if (e.altKey) {
    // Alt+↑ / Alt+↓ abren el desplegable de un select o un combobox.
    if ((e.code === "ArrowUp" || e.code === "ArrowDown") && isTypingTarget(target)) return null;
    return KEYMAP.find((s) => s.alt?.includes(e.code))?.id ?? null;
  }

  const plain = KEYMAP.find((s) => s.plain?.includes(e.code));
  if (plain) return plain.id;

  if (!opts.singleKey || e.shiftKey || isTypingTarget(target)) return null;
  if (e.code === "Space" && target?.closest(SPACE_ACTIVATED)) return null;
  return KEYMAP.find((s) => s.single?.includes(e.code))?.id ?? null;
}

const KEY_NAMES: Readonly<Record<string, string>> = {
  Space: "Espacio",
  Equal: "=",
  Minus: "−",
  ArrowDown: "↓",
  ArrowUp: "↑",
  Escape: "Esc",
};

function keyName(code: string): string {
  return KEY_NAMES[code] ?? code.replace(/^(?:Key|Digit|Numpad)/, "");
}

/** Por ejemplo `"Alt + ↓ · J"`. De cada lista se muestra solo la primera tecla. */
export function describeKeys(s: Shortcut, opts: { singleKey: boolean }): string {
  const parts: string[] = [];
  if (s.alt?.[0]) parts.push(`Alt + ${keyName(s.alt[0])}`);
  if (opts.singleKey && s.single?.[0]) parts.push(keyName(s.single[0]));
  if (s.plain?.[0]) parts.push(keyName(s.plain[0]));
  return parts.join(" · ");
}
