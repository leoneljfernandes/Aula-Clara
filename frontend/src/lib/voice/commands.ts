/** Intérprete de comandos de voz: puro, sin navegador. Solo entiende frases completas (salvo «preguntar …»). */

type SimpleKind =
  | "play"
  | "pause"
  | "stop"
  | "nextBlock"
  | "prevBlock"
  | "nextHeading"
  | "nextFigure"
  | "faster"
  | "slower"
  | "summarize"
  | "keyConcepts"
  | "quiz"
  | "describeFigure"
  | "openBraille"
  | "showHelp";

export type VoiceCommand = { kind: SimpleKind } | { kind: "ask"; question: string };

/** Minúsculas, sin tildes, sin signos de puntuación y con espacios simples. */
export function normalizeSpeech(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PHRASES: Record<SimpleKind, readonly string[]> = {
  play: ["leer", "lee", "reproducir", "continuar"],
  pause: ["pausar", "pausa"],
  stop: ["detener", "detene", "parar", "para"],
  nextBlock: ["siguiente", "siguiente parrafo", "bajar", "baja"],
  prevBlock: ["anterior", "parrafo anterior", "subir", "subi"],
  nextHeading: ["siguiente seccion", "siguiente titulo"],
  nextFigure: ["siguiente grafico", "siguiente imagen"],
  faster: ["mas rapido"],
  slower: ["mas lento"],
  summarize: ["resumir", "resumi", "resumen"],
  keyConcepts: ["conceptos clave"],
  quiz: ["preguntas", "preguntas de repaso"],
  describeFigure: ["describir imagen", "interpretar grafico"],
  openBraille: ["braille", "traducir a braille"],
  showHelp: ["ayuda", "comandos", "que puedo decir"],
};

export type CommandGroup = "Lectura" | "Navegación" | "Asistente de IA" | "Otros";

/**
 * Cómo se presenta cada comando en la lista de ayuda. El tipo `Record` obliga a describir cada comando nuevo:
 * así la lista nunca queda desactualizada respecto de `PHRASES`. El orden de acá es el orden de la lista.
 */
const COMMAND_INFO: Record<SimpleKind, { group: CommandGroup; label: string }> = {
  play: { group: "Lectura", label: "Leer el documento (desde el párrafo elegido)" },
  pause: { group: "Lectura", label: "Pausar la lectura" },
  stop: { group: "Lectura", label: "Detener la lectura" },
  faster: { group: "Lectura", label: "Leer más rápido" },
  slower: { group: "Lectura", label: "Leer más lento" },
  nextBlock: { group: "Navegación", label: "Párrafo siguiente" },
  prevBlock: { group: "Navegación", label: "Párrafo anterior" },
  nextHeading: { group: "Navegación", label: "Título siguiente" },
  nextFigure: { group: "Navegación", label: "Gráfico siguiente" },
  summarize: { group: "Asistente de IA", label: "Resumir el documento" },
  keyConcepts: { group: "Asistente de IA", label: "Conceptos clave" },
  quiz: { group: "Asistente de IA", label: "Preguntas de repaso" },
  describeFigure: { group: "Asistente de IA", label: "Describir el gráfico" },
  openBraille: { group: "Otros", label: "Abrir Braille" },
  showHelp: { group: "Otros", label: "Ver esta lista de comandos" },
};

export interface CatalogEntry {
  kind: SimpleKind;
  label: string;
  phrases: readonly string[];
  /** Gasta una consulta de la cuota de IA (en manos libres exige decir antes «asistente»). */
  usesAI: boolean;
}

export interface CatalogGroup {
  title: CommandGroup;
  entries: readonly CatalogEntry[];
}

const GROUP_ORDER: readonly CommandGroup[] = ["Lectura", "Navegación", "Asistente de IA", "Otros"];

/** Todas las frases que se reconocen, agrupadas para mostrarlas. Sale de `PHRASES`: es la fuente única. */
export function commandCatalog(): CatalogGroup[] {
  const kinds = Object.keys(COMMAND_INFO) as SimpleKind[];
  return GROUP_ORDER.map((title) => ({
    title,
    entries: kinds
      .filter((kind) => COMMAND_INFO[kind].group === title)
      .map((kind) => ({
        kind,
        label: COMMAND_INFO[kind].label,
        phrases: PHRASES[kind],
        usesAI: AI_KINDS.has(kind),
      })),
  }));
}

const BY_PHRASE = new Map<string, SimpleKind>(
  (Object.entries(PHRASES) as [SimpleKind, readonly string[]][]).flatMap(([kind, phrases]) =>
    phrases.map((phrase) => [phrase, kind] as const),
  ),
);

/** «preguntar …» o «asistente …»: lo que sigue a la primera palabra, tal como se dijo. */
const ASK = /^(?:preguntar|asistente)(?![\p{L}\p{N}])[\s,.:;]*(.*)$/isu;
const ASSISTANT = /^asistente(?![\p{L}\p{N}])[\s,.:;]*(.*)$/isu;

/** Las que gastan cuota de la IA: en manos libres, un titular leído por un lector de pantalla no debe dispararlas. */
const AI_KINDS: ReadonlySet<SimpleKind> = new Set(["summarize", "keyConcepts", "quiz", "describeFigure"]);
const MIN_HANDS_FREE_QUESTION_WORDS = 3;

export interface ParseOptions {
  /**
   * Manos libres: el micrófono está siempre abierto y puede oír voces ajenas. Las acciones de IA exigen
   * decir antes «asistente» (y la pregunta, al menos 3 palabras); la lectura y la navegación van sin prefijo.
   */
  continuous?: boolean;
}

export function parseCommand(
  transcript: string,
  { continuous = false }: ParseOptions = {},
): VoiceCommand | null {
  const simple = BY_PHRASE.get(normalizeSpeech(transcript));
  if (!continuous) {
    if (simple) return { kind: simple };
    const question = ASK.exec(transcript.trim())?.[1]?.trim();
    // Sin nada pronunciable después («preguntar ¿?») no hay pregunta.
    return question && normalizeSpeech(question) !== "" ? { kind: "ask", question } : null;
  }
  if (simple && !AI_KINDS.has(simple)) return { kind: simple };
  const rest = ASSISTANT.exec(transcript.trim())?.[1]?.trim();
  if (!rest) return null;
  const prefixed = BY_PHRASE.get(normalizeSpeech(rest));
  if (prefixed && AI_KINDS.has(prefixed)) return { kind: prefixed };
  const words = normalizeSpeech(rest).split(" ").filter(Boolean).length;
  return words >= MIN_HANDS_FREE_QUESTION_WORDS ? { kind: "ask", question: rest } : null;
}
