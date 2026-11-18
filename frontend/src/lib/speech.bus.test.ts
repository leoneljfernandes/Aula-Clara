import { afterEach, beforeEach, expect, it, vi } from "vitest";

class FakeUtterance {
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  text: string;
  constructor(text: string) {
    this.text = text;
  }
}
const spoken: FakeUtterance[] = [];
const synth = {
  paused: false,
  speak: (u: FakeUtterance) => spoken.push(u),
  cancel: () => spoken.splice(0).forEach((u) => u.onerror?.({ error: "interrupted" })),
  pause: vi.fn(() => {
    synth.paused = true;
  }),
  resume: vi.fn(() => {
    synth.paused = false;
  }),
  getVoices: () => [],
};

let speech: typeof import("./speech");
beforeEach(async () => {
  spoken.length = 0;
  synth.paused = false;
  synth.pause.mockClear();
  synth.resume.mockClear();
  vi.resetModules();
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  speech = await import("./speech");
});
afterEach(() => vi.unstubAllGlobals());

it("hablar algo suelto pausa la lectura del documento en el mismo párrafo", () => {
  const states: unknown[] = [];
  const engine = new speech.ReadAloudEngine(
    ["a", "b"],
    () => 1,
    (s) => states.push(s),
    vi.fn(),
  );
  engine.play();
  speech.speakOnce("respuesta del asistente");
  expect(states.at(-1)).toEqual({ status: "paused", idx: 0 });
  engine.play();
  expect(states.at(-1)).toEqual({ status: "playing", idx: 0 });
});

it("isSpeaking y subscribe siguen la locución", () => {
  const seen: boolean[] = [];
  speech.speechBus.subscribe((s) => seen.push(s));
  speech.speakOnce("hola");
  expect(speech.speechBus.isSpeaking()).toBe(true);
  spoken.at(-1)!.onend!();
  expect(speech.speechBus.isSpeaking()).toBe(false);
  expect(seen).toEqual([true, false]);
});

it("playFrom lee desde el párrafo pedido y silence lo deja en pausa", () => {
  const states: unknown[] = [];
  const engine = new speech.ReadAloudEngine(
    ["a", "b", "c"],
    () => 1,
    (s) => states.push(s),
    vi.fn(),
  );
  engine.playFrom(2);
  expect(states.at(-1)).toEqual({ status: "playing", idx: 2 });
  speech.speechBus.silence();
  expect(states.at(-1)).toEqual({ status: "paused", idx: 2 });
  expect(speech.speechBus.isSpeaking()).toBe(false);
});

it("silence con la lectura en pausa del usuario la deja en pausa y al continuar relee el párrafo", () => {
  const states: unknown[] = [];
  const engine = new speech.ReadAloudEngine(
    ["a", "b"],
    () => 1,
    (s) => states.push(s),
    vi.fn(),
  );
  engine.play();
  engine.pause();
  speech.speechBus.silence();
  expect(states.at(-1)).toEqual({ status: "paused", idx: 0 });
  synth.resume.mockClear();
  engine.play();
  expect(synth.resume).not.toHaveBeenCalled();
  expect(states.at(-1)).toEqual({ status: "playing", idx: 0 });
  expect(spoken).toHaveLength(1);
});

it("el árbitro sigue ocupado entre párrafos y se libera al terminar la lectura", () => {
  const seen: boolean[] = [];
  const finished = vi.fn();
  const engine = new speech.ReadAloudEngine(["a", "b"], () => 1, vi.fn(), finished);
  speech.speechBus.subscribe((s) => seen.push(s));
  engine.play();
  spoken.at(-1)!.onend!();
  expect(speech.speechBus.isSpeaking()).toBe(true);
  spoken.at(-1)!.onend!();
  expect(speech.speechBus.isSpeaking()).toBe(false);
  expect(finished).toHaveBeenCalledOnce();
  expect(seen).toEqual([true, false]);
});

it("claim avisa al dueño anterior antes de cancelar la voz", () => {
  const order: string[] = [];
  const first = { onInterrupted: () => order.push("interrumpido") };
  const cancel = vi.spyOn(synth, "cancel").mockImplementation(() => void order.push("cancel"));
  speech.speechBus.claim(first);
  order.length = 0;
  speech.speechBus.claim({ onInterrupted: vi.fn() });
  expect(order).toEqual(["interrumpido", "cancel"]);
  cancel.mockRestore();
});

it("si el motor no estaba hablando, silence no lo mueve", () => {
  const states: unknown[] = [];
  const engine = new speech.ReadAloudEngine(
    ["a"],
    () => 1,
    (s) => states.push(s),
    vi.fn(),
  );
  engine.play();
  engine.stop();
  states.length = 0;
  speech.speechBus.silence();
  expect(states).toEqual([]);
});

it("en pausa del usuario isSpeaking es false y avisa; al continuar vuelve a ser true", () => {
  const seen: boolean[] = [];
  const engine = new speech.ReadAloudEngine(["a", "b"], () => 1, vi.fn(), vi.fn());
  engine.play();
  speech.speechBus.subscribe((s) => seen.push(s));
  engine.pause();
  expect(speech.speechBus.isSpeaking()).toBe(false);
  expect(seen).toEqual([false]);
  engine.play();
  expect(speech.speechBus.isSpeaking()).toBe(true);
  expect(seen).toEqual([false, true]);
  expect(synth.resume).toHaveBeenCalledOnce();
  expect(spoken).toHaveLength(1); // se reanudó, no se volvió a hablar
});

it("hablar algo suelto con la lectura en pausa la interrumpe y deja isSpeaking en true", () => {
  const states: unknown[] = [];
  const engine = new speech.ReadAloudEngine(
    ["a", "b"],
    () => 1,
    (s) => states.push(s),
    vi.fn(),
  );
  engine.play();
  engine.pause();
  const seen: boolean[] = [];
  speech.speechBus.subscribe((s) => seen.push(s));
  speech.speakOnce("respuesta");
  expect(states.at(-1)).toEqual({ status: "paused", idx: 0 });
  expect(speech.speechBus.isSpeaking()).toBe(true);
  expect(seen).toEqual([true]);
  engine.play();
  expect(states.at(-1)).toEqual({ status: "playing", idx: 0 });
});

it("silence con la lectura en pausa no avisa de nada nuevo y play relee el párrafo", () => {
  const states: unknown[] = [];
  const engine = new speech.ReadAloudEngine(
    ["a", "b"],
    () => 1,
    (s) => states.push(s),
    vi.fn(),
  );
  engine.play();
  engine.pause();
  const seen: boolean[] = [];
  speech.speechBus.subscribe((s) => seen.push(s));
  speech.speechBus.silence();
  expect(seen).toEqual([]);
  expect(states.at(-1)).toEqual({ status: "paused", idx: 0 });
  engine.play();
  expect(states.at(-1)).toEqual({ status: "playing", idx: 0 });
  expect(spoken).toHaveLength(1);
  expect(speech.speechBus.isSpeaking()).toBe(true);
});

it("silence corta la voz antes de avisar a los suscriptores", () => {
  const order: string[] = [];
  speech.speakOnce("hola");
  speech.speechBus.subscribe((s) => order.push(`aviso ${s}`));
  const cancel = vi.spyOn(synth, "cancel").mockImplementation(() => void order.push("cancel"));
  speech.speechBus.silence();
  expect(order).toEqual(["cancel", "aviso false"]);
  cancel.mockRestore();
});

it("cancelar una voz en pausa la reanuda antes para que la próxima no quede muda", () => {
  const engine = new speech.ReadAloudEngine(["a"], () => 1, vi.fn(), vi.fn());
  engine.play();
  engine.pause();
  expect(synth.paused).toBe(true);
  speech.speakOnce("respuesta");
  expect(synth.paused).toBe(false);
});

it("seguir de párrafo en párrafo cancela la voz una sola vez por párrafo", () => {
  const cancel = vi.spyOn(synth, "cancel");
  const engine = new speech.ReadAloudEngine(["a", "b"], () => 1, vi.fn(), vi.fn());
  engine.play();
  expect(cancel).toHaveBeenCalledTimes(1);
  cancel.mockRestore();
});
