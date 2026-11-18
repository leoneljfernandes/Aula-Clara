import { describe, expect, it } from "vitest";

import { describeKeys, KEYMAP, matchShortcut, type KeyLike } from "./keymap";

const key = (code: string, extra: Partial<KeyLike> = {}): KeyLike => ({
  code,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  target: document.body,
  ...extra,
});
const el = (html: string): Element => {
  document.body.innerHTML = html;
  return document.body.firstElementChild!;
};

describe("matchShortcut", () => {
  it("Alt+letra funciona siempre", () => {
    expect(matchShortcut(key("KeyP", { altKey: true }), { singleKey: false })).toBe("playPause");
  });
  it("una tecla sola solo si está activado", () => {
    expect(matchShortcut(key("KeyJ"), { singleKey: false })).toBeNull();
    expect(matchShortcut(key("KeyJ"), { singleKey: true })).toBe("nextBlock");
    expect(matchShortcut(key("Digit1"), { singleKey: true })).toBe("summarize");
  });
  it.each([
    "<input>",
    "<textarea></textarea>",
    "<select><option>a</option></select>",
    "<div contenteditable='true'></div>",
    "<div role='textbox'></div>",
    "<div role='combobox'></div>",
  ])("no dispara una tecla sola mientras se escribe en %s", (html) => {
    expect(matchShortcut(key("KeyJ", { target: el(html) }), { singleKey: true })).toBeNull();
    expect(matchShortcut(key("Digit1", { target: el(html) }), { singleKey: true })).toBeNull();
  });
  it("Espacio sobre un botón activa el botón, no el atajo", () => {
    expect(matchShortcut(key("Space", { target: el("<button>x</button>") }), { singleKey: true })).toBeNull();
    expect(matchShortcut(key("Space"), { singleKey: true })).toBe("playPause");
  });
  it.each([
    "<a href='#'>x</a>",
    "<summary>x</summary>",
    "<input type='checkbox'>",
    "<div role='switch'></div>",
  ])("Espacio sobre %s no es un atajo", (html) => {
    expect(matchShortcut(key("Space", { target: el(html) }), { singleKey: true })).toBeNull();
  });
  it("con Ctrl o Meta no hay atajo de una tecla", () => {
    expect(matchShortcut(key("KeyJ", { ctrlKey: true }), { singleKey: true })).toBeNull();
    expect(matchShortcut(key("KeyJ", { metaKey: true }), { singleKey: true })).toBeNull();
  });
  it("con Alt no cae en la variante de una tecla", () => {
    expect(matchShortcut(key("KeyJ", { altKey: true }), { singleKey: true })).toBeNull();
  });
  it("Alt+↓ dentro de un select no se intercepta", () => {
    expect(
      matchShortcut(key("ArrowDown", { altKey: true, target: el("<select></select>") }), {
        singleKey: false,
      }),
    ).toBeNull();
    expect(matchShortcut(key("ArrowDown", { altKey: true }), { singleKey: false })).toBe("nextBlock");
  });
  it("Esc silencia aunque los atajos de una tecla estén apagados", () => {
    expect(matchShortcut(key("Escape"), { singleKey: false })).toBe("silence");
  });
  it("Esc silencia también dentro de un campo", () => {
    expect(matchShortcut(key("Escape", { target: el("<input>") }), { singleKey: false })).toBe("silence");
  });
});

it("ninguna combinación está asignada a dos acciones", () => {
  const bindings = KEYMAP.flatMap((s) => [
    ...(s.alt ?? []).map((c) => `alt:${c}`),
    ...(s.single ?? []).map((c) => `single:${c}`),
    ...(s.plain ?? []).map((c) => `plain:${c}`),
  ]);
  expect(new Set(bindings).size).toBe(bindings.length);
});

it("describeKeys muestra la variante con Alt y la de una tecla", () => {
  const next = KEYMAP.find((s) => s.id === "nextBlock")!;
  expect(describeKeys(next, { singleKey: true })).toBe("Alt + ↓ · J");
  expect(describeKeys(next, { singleKey: false })).toBe("Alt + ↓");
});

it("describeKeys nombra las teclas especiales", () => {
  const byId = (id: string) => KEYMAP.find((s) => s.id === id)!;
  expect(describeKeys(byId("playPause"), { singleKey: true })).toBe("Alt + P · Espacio");
  expect(describeKeys(byId("fontUp"), { singleKey: true })).toBe("Alt + =");
  expect(describeKeys(byId("fontDown"), { singleKey: true })).toBe("Alt + −");
  expect(describeKeys(byId("summarize"), { singleKey: true })).toBe("1");
  expect(describeKeys(byId("summarize"), { singleKey: false })).toBe("");
  expect(describeKeys(byId("silence"), { singleKey: false })).toBe("Esc");
});

it("Alt+V abre la lista de comandos de voz, y «V» sola solo con los atajos de una tecla", () => {
  expect(matchShortcut(key("KeyV", { altKey: true }), { singleKey: false })).toBe("voiceHelp");
  expect(matchShortcut(key("KeyV"), { singleKey: false })).toBeNull();
  expect(matchShortcut(key("KeyV"), { singleKey: true })).toBe("voiceHelp");
});
