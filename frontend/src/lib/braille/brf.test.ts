import { expect, it } from "vitest";
import { NABCC, toBrfDocument, toBrfLine } from "./brf";

it("la tabla NABCC tiene los 64 patrones de 6 puntos", () => {
  expect(NABCC).toHaveLength(64);
});

it.each([
  ["⠀", " "],
  ["⠁", "A"],
  ["⠂", "1"],
  ["⠄", "'"],
  ["⠨", "."],
  ["⠼", "#"],
  ["⠿", "="],
  ["⠷", "("],
  ["⠾", ")"],
])("%s → %s", (cell, ascii) => expect(toBrfLine(cell)).toBe(ascii));

it("rechaza caracteres que no son Braille de 6 puntos", () => {
  expect(() => toBrfLine("a")).toThrow(RangeError);
});

it("separa líneas con CRLF y páginas con salto de página", () => {
  expect(toBrfDocument([["⠁", "⠃"], ["⠉"]])).toBe("A\r\nB\fC");
});
