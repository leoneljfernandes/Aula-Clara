import type { ChatAction } from "./api";

/** Las consultas de un toque del panel del asistente. El lector las dispara también desde el teclado. */
export const QUICK_ACTIONS: ReadonlyArray<readonly [label: string, action: ChatAction]> = [
  ["Resumir esta página", "summarize"],
  ["Explicar conceptos clave", "key_concepts"],
  ["Crear 3 preguntas de repaso", "quiz"],
];

/** Lo que se le pide a la IA para explicar un fragmento más simple (el botón del panel, el popover y la tecla 4). */
export const explainPrompt = (text: string): string =>
  `Explicame este párrafo con palabras más simples: «${text}»`;

export const quickActionLabel = (action: ChatAction): string =>
  QUICK_ACTIONS.find(([, a]) => a === action)?.[0] ?? "";
