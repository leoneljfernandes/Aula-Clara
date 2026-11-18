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
  | "openBraille";

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
  play: ["leer", "reproducir", "continuar"],
  pause: ["pausar", "pausa"],
  stop: ["detener", "parar"],
  nextBlock: ["siguiente", "siguiente parrafo", "bajar"],
  prevBlock: ["anterior", "parrafo anterior", "subir"],
  nextHeading: ["siguiente seccion", "siguiente titulo"],
  nextFigure: ["siguiente grafico", "siguiente imagen"],
  faster: ["mas rapido"],
  slower: ["mas lento"],
  summarize: ["resumir", "resumen"],
  keyConcepts: ["conceptos clave"],
  quiz: ["preguntas", "preguntas de repaso"],
  describeFigure: ["describir imagen", "interpretar grafico"],
  openBraille: ["braille", "traducir a braille"],
};

const BY_PHRASE = new Map<string, SimpleKind>(
  (Object.entries(PHRASES) as [SimpleKind, readonly string[]][]).flatMap(([kind, phrases]) =>
    phrases.map((phrase) => [phrase, kind] as const),
  ),
);

/** «preguntar …» o «asistente …»: lo que sigue a la primera palabra, tal como se dijo. */
const ASK = /^(?:preguntar|asistente)(?![\p{L}\p{N}])[\s,.:;]*(.*)$/isu;

export function parseCommand(transcript: string): VoiceCommand | null {
  const simple = BY_PHRASE.get(normalizeSpeech(transcript));
  if (simple) return { kind: simple };
  const question = ASK.exec(transcript.trim())?.[1]?.trim();
  // Sin nada pronunciable después («preguntar ¿?») no hay pregunta.
  if (question && normalizeSpeech(question) !== "") return { kind: "ask", question };
  return null;
}
