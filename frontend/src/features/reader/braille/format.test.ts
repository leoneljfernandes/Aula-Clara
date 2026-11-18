import { beforeEach, expect, it } from "vitest";
import { loadBrailleFormat, saveBrailleFormat } from "./format";

beforeEach(() => window.localStorage.clear());

it("sin nada guardado usa 40 celdas por 25 líneas", () => {
  expect(loadBrailleFormat()).toEqual({ cols: 40, rows: 25 });
});

it("guarda y recupera el formato", () => {
  saveBrailleFormat({ cols: 32, rows: 22 });
  expect(loadBrailleFormat()).toEqual({ cols: 32, rows: 22 });
});

it("valida cada campo contra su rango y usa el valor por defecto en el que no sirve", () => {
  window.localStorage.setItem("aulaclara.braille", JSON.stringify({ cols: 99, rows: 22 }));
  expect(loadBrailleFormat()).toEqual({ cols: 40, rows: 22 });
  window.localStorage.setItem("aulaclara.braille", "{no es json");
  expect(loadBrailleFormat()).toEqual({ cols: 40, rows: 25 });
});
