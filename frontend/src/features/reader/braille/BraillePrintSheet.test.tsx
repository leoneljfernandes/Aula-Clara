import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { BraillePrintSheet } from "./BraillePrintSheet";

it("dibuja una hoja A4 en milímetros por página, con un círculo de 1,5 mm por punto", () => {
  render(<BraillePrintSheet pages={[["⠿⠁"], ["⠃", "⠀⠉"]]} />);
  const sheet = document.getElementById("braille-print-sheet")!;
  expect(sheet.parentElement).toBe(document.body);
  const svgs = sheet.querySelectorAll("svg");
  expect(svgs).toHaveLength(2);
  expect(svgs[0]).toHaveAttribute("width", "210mm");
  expect(svgs[0]).toHaveAttribute("height", "297mm");
  expect(svgs[0]).toHaveAttribute("viewBox", "0 0 210 297");
  expect(svgs[0]!.querySelectorAll("circle")).toHaveLength(7);
  expect(svgs[1]!.querySelectorAll("circle")).toHaveLength(4);
  expect(svgs[0]!.querySelector("circle")).toHaveAttribute("r", "0.75");
});

it("ubica la primera celda en el margen y la siguiente a 6 mm; la segunda línea a 10 mm", () => {
  render(<BraillePrintSheet pages={[["⠁⠁", "⠁"]]} />);
  const circles = [...document.querySelectorAll("#braille-print-sheet circle")].map((c) => [
    Number(c.getAttribute("cx")),
    Number(c.getAttribute("cy")),
  ]);
  expect(circles).toEqual([
    [15, 15],
    [21, 15],
    [15, 25],
  ]);
});
