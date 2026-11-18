import type { ChatAction } from "./api";

/** Las consultas de un toque del panel del asistente. El lector las dispara también desde el teclado. */
export const QUICK_ACTIONS: ReadonlyArray<readonly [label: string, action: ChatAction]> = [
  ["Resumir esta página", "summarize"],
  ["Explicar conceptos clave", "key_concepts"],
  ["Crear 3 preguntas de repaso", "quiz"],
  ["Glosario fácil", "glossary"],
  ["Esquema visual", "visual_outline"],
];

/** Lo que se le pide a la IA para explicar un fragmento más simple (el botón del panel, el popover y la tecla 4). */
export const explainPrompt = (text: string): string =>
  `Explicame este párrafo con palabras más simples: «${text}»`;

export const quickActionLabel = (action: ChatAction): string =>
  QUICK_ACTIONS.find(([, a]) => a === action)?.[0] ?? "";

/** Lo que se muestra en el chat cuando se pide la definición de una palabra o frase corta elegida. */
export const definePrompt = (text: string): string => `Definí el término «${text}»`;
