import { expect, it } from "vitest";

import { normalizeSpeech, parseCommand } from "./commands";

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
