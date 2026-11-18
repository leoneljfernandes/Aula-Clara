import { describe, expect, it } from "vitest";
import { cell } from "./table";
import { toBraille, toBrailleWords } from "./translate";

const b = (text: string) => toBraille(text).braille;

it("cell arma el carácter Unicode desde los puntos", () => {
  expect(cell(1)).toBe("⠁");
  expect(cell(4, 6)).toBe("⠨");
  expect(cell(1, 2, 3, 4, 5, 6)).toBe("⠿");
});

describe("Braille español, signografía básica (CBE, B 2 v3)", () => {
  it.each([
    ["hola", "⠓⠕⠇⠁"],
    ["educación", "⠑⠙⠥⠉⠁⠉⠊⠬⠝"],
    ["español", "⠑⠎⠏⠁⠻⠕⠇"],
    ["pingüino", "⠏⠊⠝⠛⠳⠊⠝⠕"],
    ["Aula", "⠨⠁⠥⠇⠁"],
    ["2026", "⠼⠃⠚⠃⠋"],
    ["Fin.", "⠨⠋⠊⠝⠄"],
    ["(sí)", "⠣⠎⠌⠜"],
    ["¿Qué?", "⠢⠨⠟⠥⠮⠢"],
    ["¡ya!", "⠖⠽⠁⠖"],
    ["a, b; c: d", "⠁⠂⠀⠃⠆⠀⠉⠒⠀⠙"],
    ["«web»", "⠦⠺⠑⠃⠦"],
    ["pre-test", "⠏⠗⠑⠤⠞⠑⠎⠞"],
  ])("«%s»", (ink, braille) => expect(b(ink)).toBe(braille));

  // Reglas confirmadas en B 2 v3 (junio de 2023):
  it.each([
    // §7.1, recurso 2: dos signos de mayúscula antes de la primera letra de la sigla.
    ["IA", "⠨⠨⠊⠁"],
    ["ONCE", "⠨⠨⠕⠝⠉⠑"],
    ["(IA)", "⠣⠨⠨⠊⠁⠜"],
    // §7.1, recurso 1 (B 2 no define las mayúsculas parciales): un signo por cada mayúscula.
    ["PDFs", "⠨⠏⠨⠙⠨⠋⠎"],
    // §8.1: el separador decimal es el punto 2, venga como «,», «.» o «’» en el original.
    ["3,5", "⠼⠉⠂⠑"],
    ["73.81", "⠼⠛⠉⠂⠓⠁"],
    ["73’81", "⠼⠛⠉⠂⠓⠁"],
    // §8.1: grupos de tres cifras separados con el punto 3 y un solo signo de número.
    ["26.653", "⠼⠃⠋⠄⠋⠑⠉"],
    ["501.439.678", "⠼⠑⠚⠁⠄⠙⠉⠊⠄⠋⠛⠓"],
    // §8.2: prefijo de latina minúscula (punto 5) entre un número y una letra a–j.
    ["3a", "⠼⠉⠐⠁"],
    ["8b", "⠼⠓⠐⠃"],
    ["3k", "⠼⠉⠅"],
  ])("«%s»", (ink, braille) => expect(b(ink)).toBe(braille));
});

it("los caracteres sin signo se omiten, una palabra que queda vacía no deja espacios, y se informan una sola vez", () => {
  expect(toBraille("x ∑ y ∑ @")).toEqual({ braille: "⠭⠀⠽", unsupported: ["∑", "@"] });
});

it("toBrailleWords alinea cada palabra con su transcripción", () => {
  expect(toBrailleWords("Aula clara")).toEqual([
    { ink: "Aula", braille: "⠨⠁⠥⠇⠁" },
    { ink: "clara", braille: "⠉⠇⠁⠗⠁" },
  ]);
});
