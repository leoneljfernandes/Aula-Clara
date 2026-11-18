import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReadAloudEngine, type ReadState, withNotice } from "./speech";

// jsdom no tiene speechSynthesis: el motor corre en modo simulado, que es el que se prueba acá.
describe("ReadAloudEngine (simulado)", () => {
  const states: ReadState[] = [];
  const finished = vi.fn();
  const make = (items: string[], rate = 1) =>
    new ReadAloudEngine(
      items,
      () => rate,
      (s) => states.push(s),
      finished,
    );

  beforeEach(() => {
    vi.useFakeTimers();
    states.length = 0;
    finished.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("lee los párrafos en orden y avisa al terminar", () => {
    const engine = make(["uno dos", "tres cuatro"]);
    engine.play();
    expect(states.at(-1)).toEqual({ status: "playing", idx: 0 });
    vi.advanceTimersByTime(800);
    expect(states.at(-1)).toEqual({ status: "playing", idx: 1 });
    vi.advanceTimersByTime(800);
    expect(states.at(-1)).toEqual({ status: "stopped", idx: -1 });
    expect(finished).toHaveBeenCalledOnce();
  });

  it("pausa y continúa en el mismo párrafo", () => {
    const engine = make(["a b", "c d", "e f"]);
    engine.play();
    vi.advanceTimersByTime(800); // pasa al 1
    engine.pause();
    vi.advanceTimersByTime(5_000); // en pausa no avanza
    expect(states.at(-1)).toEqual({ status: "paused", idx: 1 });
    engine.play();
    expect(states.at(-1)).toEqual({ status: "playing", idx: 1 });
  });

  it("detener vuelve al inicio y cancela lo pendiente", () => {
    const engine = make(["a b", "c d"]);
    engine.play();
    engine.stop();
    vi.advanceTimersByTime(10_000);
    expect(states.at(-1)).toEqual({ status: "stopped", idx: -1 });
    expect(finished).not.toHaveBeenCalled();
  });

  it("a mayor velocidad avanza antes", () => {
    const slow = make(["uno dos tres cuatro"], 0.75);
    slow.play();
    vi.advanceTimersByTime(1_700); // 4 palabras * 380 / 0.75 = 2026 ms
    expect(states.at(-1)?.status).toBe("playing");
    vi.advanceTimersByTime(400);
    expect(states.at(-1)?.status).toBe("stopped");
  });
});

describe("withNotice", () => {
  it("agrega el aviso tras la frase, con un punto si el texto no lo trae", () => {
    expect(withNotice("Segun", "Se cortó.")).toBe("Segun. Se cortó.");
    expect(withNotice("Listo. ", "Se cortó.")).toBe("Listo. Se cortó.");
    expect(withNotice("¿Seguro?", "Se cortó.")).toBe("¿Seguro? Se cortó.");
  });
});
