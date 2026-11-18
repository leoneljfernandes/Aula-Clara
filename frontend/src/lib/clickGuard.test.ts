import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { installClickGuard } from "./clickGuard";

let off = () => {};
const now = vi.spyOn(performance, "now");
const click = (el: Element, at: number, detail = 1) => {
  now.mockReturnValue(at);
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail }));
};
beforeEach(() => {
  document.body.innerHTML = "<button id='x'><span>x</span></button><button id='y'>y</button>";
  off = installClickGuard(document, 350);
});
afterEach(() => off());

it("ignora un segundo clic del mouse sobre el mismo botón dentro del intervalo", () => {
  const onX = vi.fn();
  document.getElementById("x")!.addEventListener("click", onX);
  click(document.querySelector("#x span")!, 1_000);
  click(document.getElementById("x")!, 1_100);
  click(document.getElementById("x")!, 1_500);
  expect(onX).toHaveBeenCalledTimes(2);
});

it("no filtra el teclado ni un botón distinto", () => {
  const onX = vi.fn();
  const onY = vi.fn();
  document.getElementById("x")!.addEventListener("click", onX);
  document.getElementById("y")!.addEventListener("click", onY);
  click(document.getElementById("x")!, 1_000, 0);
  click(document.getElementById("x")!, 1_010, 0);
  click(document.getElementById("y")!, 1_020);
  expect(onX).toHaveBeenCalledTimes(2);
  expect(onY).toHaveBeenCalledTimes(1);
});

it("al desinstalarlo deja de filtrar", () => {
  off();
  const onX = vi.fn();
  document.getElementById("x")!.addEventListener("click", onX);
  click(document.getElementById("x")!, 1_000);
  click(document.getElementById("x")!, 1_010);
  expect(onX).toHaveBeenCalledTimes(2);
});
