import { describe, expect, it } from "vitest";

import { normalizeSpeech, parseCommand, commandCatalog } from "./commands";

it("normaliza mayúsculas, tildes y puntuación", () => {
  expect(normalizeSpeech("  Siguiente   PÁRRAFO. ")).toBe("siguiente parrafo");
});

it.each([
  ["Siguiente párrafo.", { kind: "nextBlock" }],
  ["PAUSAR", { kind: "pause" }],
  ["siguiente sección", { kind: "nextHeading" }],
  ["más rápido", { kind: "faster" }],
  ["preguntas de repaso", { kind: "quiz" }],
  ["preguntar qué es la mitosis", { kind: "ask", question: "qué es la mitosis" }],
  ["Asistente ¿cuándo empezó?", { kind: "ask", question: "¿cuándo empezó?" }],
])("«%s»", (said, expected) => {
  expect(parseCommand(said)).toEqual(expected);
});

it("no confunde frases que solo contienen un comando", () => {
  expect(parseCommand("hola")).toBeNull();
  expect(parseCommand("leer el siguiente capítulo")).toBeNull();
  expect(parseCommand("preguntar")).toBeNull();
});

it.each([
  ["leer", "play"],
  ["reproducir", "play"],
  ["continuar", "play"],
  ["pausa", "pause"],
  ["detener", "stop"],
  ["parar", "stop"],
  ["siguiente", "nextBlock"],
  ["bajar", "nextBlock"],
  ["anterior", "prevBlock"],
  ["párrafo anterior", "prevBlock"],
  ["subir", "prevBlock"],
  ["siguiente título", "nextHeading"],
  ["siguiente gráfico", "nextFigure"],
  ["siguiente imagen", "nextFigure"],
  ["más lento", "slower"],
  ["resumir", "summarize"],
  ["resumen", "summarize"],
  ["conceptos clave", "keyConcepts"],
  ["preguntas", "quiz"],
  ["describir imagen", "describeFigure"],
  ["interpretar gráfico", "describeFigure"],
  ["braille", "openBraille"],
  ["traducir a braille", "openBraille"],
])("la tabla de frases: «%s» es %s", (said, kind) => {
  expect(parseCommand(said)).toEqual({ kind });
});

it("la pregunta conserva el texto original, sin la primera palabra", () => {
  expect(parseCommand("  Preguntar:   ¿Qué dice la LEY?  ")).toEqual({
    kind: "ask",
    question: "¿Qué dice la LEY?",
  });
  expect(parseCommand("asistente, resumí el capítulo")).toEqual({
    kind: "ask",
    question: "resumí el capítulo",
  });
  expect(parseCommand("preguntar ¿?")).toBeNull();
});

it.each([
  ["leé", "play"],
  ["pausá", "pause"],
  ["detené", "stop"],
  ["pará", "stop"],
  ["resumí", "summarize"],
  ["bajá", "nextBlock"],
  ["subí", "prevBlock"],
])("voseo: «%s» es %s", (said, kind) => {
  expect(parseCommand(said)).toEqual({ kind });
});

describe("modo manos libres: las acciones de IA exigen «asistente»", () => {
  const continuous = { continuous: true };

  it.each([
    ["resumir"],
    ["resumen"],
    ["resumí"],
    ["conceptos clave"],
    ["preguntas"],
    ["preguntas de repaso"],
    ["describir imagen"],
    ["interpretar gráfico"],
    ["preguntar qué es la mitosis"],
    ["asistente ¿cuándo empezó?"], // menos de 3 palabras
    ["asistente qué es"],
  ])("«%s» suelto se ignora", (said) => {
    expect(parseCommand(said, continuous)).toBeNull();
  });

  it.each([
    ["asistente resumir", "summarize"],
    ["Asistente, resumí", "summarize"],
    ["asistente conceptos clave", "keyConcepts"],
    ["asistente preguntas", "quiz"],
    ["asistente describir imagen", "describeFigure"],
  ])("«%s» es %s", (said, kind) => {
    expect(parseCommand(said, continuous)).toEqual({ kind });
  });

  it("«asistente» + una pregunta de 3 palabras o más la manda", () => {
    expect(parseCommand("Asistente ¿qué dice la ley?", continuous)).toEqual({
      kind: "ask",
      question: "¿qué dice la ley?",
    });
  });

  it.each([
    ["leer", "play"],
    ["pausar", "pause"],
    ["detener", "stop"],
    ["siguiente", "nextBlock"],
    ["anterior", "prevBlock"],
    ["siguiente sección", "nextHeading"],
    ["siguiente gráfico", "nextFigure"],
    ["más rápido", "faster"],
    ["más lento", "slower"],
    ["braille", "openBraille"],
  ])("los comandos de lectura siguen sin prefijo: «%s» es %s", (said, kind) => {
    expect(parseCommand(said, continuous)).toEqual({ kind });
  });

  it("el modo por botón no cambia", () => {
    expect(parseCommand("resumir", { continuous: false })).toEqual({ kind: "summarize" });
    expect(parseCommand("preguntar qué es", { continuous: false })).toEqual({
      kind: "ask",
      question: "qué es",
    });
  });
});

describe("catálogo de frases", () => {
  it("«ayuda», «comandos» y «qué puedo decir» abren la lista de comandos", () => {
    expect(parseCommand("ayuda")).toEqual({ kind: "showHelp" });
    expect(parseCommand("Comandos")).toEqual({ kind: "showHelp" });
    expect(parseCommand("¿Qué puedo decir?")).toEqual({ kind: "showHelp" });
    expect(parseCommand("ayuda", { continuous: true })).toEqual({ kind: "showHelp" });
  });

  it("cada comando tiene una etiqueta y un grupo, y el catálogo no deja ninguna frase afuera", () => {
    const catalog = commandCatalog();
    expect(catalog.map((g) => g.title)).toEqual(["Lectura", "Navegación", "Asistente de IA", "Otros"]);
    const listed = catalog.flatMap((g) => g.entries.flatMap((e) => e.phrases));
    expect(listed).toEqual(expect.arrayContaining(["leer", "siguiente", "resumir", "braille", "ayuda"]));
    expect(new Set(listed).size).toBe(listed.length);
  });

  it("toda frase del catálogo se entiende como el comando con que aparece", () => {
    for (const group of commandCatalog()) {
      for (const entry of group.entries) {
        for (const phrase of entry.phrases) {
          expect(parseCommand(phrase)).toEqual({ kind: entry.kind });
        }
      }
    }
  });

  it("marca las acciones que gastan cuota de la IA", () => {
    const entries = commandCatalog().flatMap((g) => g.entries);
    expect(entries.find((e) => e.kind === "summarize")?.usesAI).toBe(true);
    expect(entries.find((e) => e.kind === "play")?.usesAI).toBe(false);
  });
});
