import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { speechBus } from "@/lib/speech";
import { FakeRecognition, installFakeRecognition } from "@/test/fakeSpeechRecognition";

import { playEarcon } from "./earcons";
import { createRecognizer, speechRecognitionAvailable } from "./recognizer";

vi.mock("./earcons", () => ({ playEarcon: vi.fn() }));

const opts = () => ({
  continuous: true,
  interim: false,
  onFinal: vi.fn(),
  onListeningChange: vi.fn(),
  onError: vi.fn(),
});
beforeEach(() => {
  vi.useFakeTimers();
  FakeRecognition.instances = [];
  vi.mocked(playEarcon).mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("sin soporte devuelve null", () => {
  expect(speechRecognitionAvailable()).toBe(false);
  expect(createRecognizer(opts())).toBeNull();
});

it("configura español de Argentina y entrega el texto final", () => {
  installFakeRecognition();
  const o = opts();
  createRecognizer(o)!.start();
  const fake = FakeRecognition.instances[0]!;
  expect(fake.lang).toBe("es-AR");
  expect(fake.continuous).toBe(true);
  fake.emitFinal("  siguiente párrafo ");
  expect(o.onFinal).toHaveBeenCalledWith("siguiente párrafo");
});

it("en modo continuo se reinicia a los 300 ms, y no después de stop()", () => {
  installFakeRecognition();
  const r = createRecognizer(opts())!;
  r.start();
  const fake = FakeRecognition.instances[0]!;
  fake.emitEnd();
  vi.advanceTimersByTime(300);
  expect(fake.starts).toBe(2);
  r.stop();
  vi.advanceTimersByTime(1_000);
  expect(fake.starts).toBe(2);
});

it("si no hay permiso avisa y no reintenta", () => {
  installFakeRecognition();
  const o = opts();
  createRecognizer(o)!.start();
  const fake = FakeRecognition.instances[0]!;
  fake.emitError("not-allowed");
  fake.emitEnd();
  vi.advanceTimersByTime(1_000);
  expect(o.onError).toHaveBeenCalledWith("not-allowed");
  expect(fake.starts).toBe(1);
});

it("se calla mientras la app habla y vuelve a escuchar después", () => {
  installFakeRecognition();
  createRecognizer(opts())!.start();
  const fake = FakeRecognition.instances[0]!;
  const owner = { onInterrupted: vi.fn() };
  speechBus.claim(owner); // simula una locución en curso
  expect(fake.aborts).toBe(1);
  speechBus.release(owner);
  vi.advanceTimersByTime(300);
  expect(fake.starts).toBe(2);
});

it("mapea los errores del navegador y avisa los cambios de escucha", () => {
  installFakeRecognition();
  const o = opts();
  createRecognizer({ ...o, continuous: false })!.start();
  const fake = FakeRecognition.instances[0]!;
  expect(fake.continuous).toBe(false);
  expect(o.onListeningChange).toHaveBeenLastCalledWith(true);
  fake.emitError("language-not-supported");
  expect(o.onError).toHaveBeenLastCalledWith("language");
  fake.emitError("service-not-allowed");
  expect(o.onError).toHaveBeenLastCalledWith("not-allowed");
  fake.emitError("no-speech");
  expect(o.onError).toHaveBeenLastCalledWith("no-speech");
  fake.emitError("network");
  expect(o.onError).toHaveBeenLastCalledWith("network");
  fake.emitError("bad-grammar");
  expect(o.onError).toHaveBeenLastCalledWith("other");
  fake.emitError("audio-capture");
  expect(o.onError).toHaveBeenLastCalledWith("no-microphone");
  fake.emitEnd();
  expect(o.onListeningChange).toHaveBeenLastCalledWith(false);
});

it("entrega el texto parcial solo si se pidió", () => {
  installFakeRecognition();
  const o = opts();
  const onInterim = vi.fn();
  createRecognizer({ ...o, interim: true, onInterim })!.start();
  const fake = FakeRecognition.instances[0]!;
  expect(fake.interimResults).toBe(true);
  fake.emitInterim(" hola ");
  expect(onInterim).toHaveBeenCalledWith("hola");
  expect(o.onFinal).not.toHaveBeenCalled();
});

it("dispose apaga todo y no reintenta", () => {
  installFakeRecognition();
  const r = createRecognizer(opts())!;
  r.start();
  const fake = FakeRecognition.instances[0]!;
  r.dispose();
  fake.emitEnd();
  vi.advanceTimersByTime(1_000);
  expect(fake.starts).toBe(1);
});

const earcons = (): unknown[] => vi.mocked(playEarcon).mock.calls.map(([kind]) => kind);

it("sin micrófono (audio-capture) apaga todo al instante y no reintenta", () => {
  installFakeRecognition();
  const o = opts();
  createRecognizer(o)!.start();
  const fake = FakeRecognition.instances[0]!;
  fake.emitError("audio-capture"); // sin `end` después: algunos navegadores nunca lo mandan
  expect(o.onError).toHaveBeenCalledExactlyOnceWith("no-microphone");
  expect(o.onListeningChange).toHaveBeenLastCalledWith(false);
  fake.emitEnd(); // un `end` tardío no hace nada
  vi.advanceTimersByTime(10_000);
  expect(fake.starts).toBe(1);
  expect(o.onError).toHaveBeenCalledTimes(1);
  expect(earcons()).toEqual(["start", "stop"]);
});

it("un error fatal apaga el micrófono sin esperar el `end`", () => {
  installFakeRecognition();
  const o = opts();
  createRecognizer(o)!.start();
  const fake = FakeRecognition.instances[0]!;
  fake.emitError("not-allowed");
  expect(o.onListeningChange).toHaveBeenLastCalledWith(false);
  expect(earcons()).toEqual(["start", "stop"]);
  fake.emitEnd();
  expect(earcons()).toEqual(["start", "stop"]); // el `end` posterior no repite nada
});

it("tras 5 errores de red seguidos se rinde: apaga y avisa una sola vez, con esperas crecientes", () => {
  installFakeRecognition();
  const o = opts();
  createRecognizer(o)!.start();
  const fake = FakeRecognition.instances[0]!;
  [300, 600, 1_200, 2_400].forEach((wait, i) => {
    fake.emitError("network");
    fake.emitEnd();
    vi.advanceTimersByTime(wait - 1);
    expect(fake.starts).toBe(i + 1);
    vi.advanceTimersByTime(1);
    expect(fake.starts).toBe(i + 2);
  });
  expect(o.onError).not.toHaveBeenCalled(); // mientras reintenta, no molesta
  fake.emitError("network");
  expect(o.onError).toHaveBeenCalledExactlyOnceWith("network");
  expect(o.onListeningChange).toHaveBeenLastCalledWith(false);
  fake.emitEnd();
  vi.advanceTimersByTime(60_000);
  expect(fake.starts).toBe(5);
  expect(o.onError).toHaveBeenCalledTimes(1);
});

it("un resultado reinicia la cuenta de errores de red", () => {
  installFakeRecognition();
  const o = opts();
  createRecognizer(o)!.start();
  const fake = FakeRecognition.instances[0]!;
  for (let i = 0; i < 4; i++) {
    fake.emitError("network");
    fake.emitEnd();
    vi.advanceTimersByTime(5_000);
  }
  fake.emitFinal("hola");
  fake.emitError("network"); // sería el quinto, pero la cuenta volvió a cero
  fake.emitEnd();
  expect(o.onError).not.toHaveBeenCalled();
  vi.advanceTimersByTime(300); // y la espera también volvió a 300 ms
  expect(fake.starts).toBe(6);
});

it("sin voz en modo continuo es normal: reinicia sin avisar; en modo al tocar, sí avisa", () => {
  installFakeRecognition();
  const continuous = opts();
  createRecognizer(continuous)!.start();
  const a = FakeRecognition.instances[0]!;
  a.emitError("no-speech");
  a.emitEnd();
  vi.advanceTimersByTime(300);
  expect(continuous.onError).not.toHaveBeenCalled();
  expect(a.starts).toBe(2);

  const push = { ...opts(), continuous: false };
  createRecognizer(push)!.start();
  FakeRecognition.instances[1]!.emitError("no-speech");
  expect(push.onError).toHaveBeenCalledExactlyOnceWith("no-speech");
});

it("en modo al tocar, si la app empieza a hablar se corta la escucha y no vuelve sola", () => {
  installFakeRecognition();
  const o = { ...opts(), continuous: false };
  createRecognizer(o)!.start();
  const fake = FakeRecognition.instances[0]!;
  const owner = { onInterrupted: vi.fn() };
  speechBus.claim(owner);
  expect(fake.aborts).toBe(1);
  fake.emitError("aborted"); // el navegador avisa del corte: no es un error de la persona
  fake.emitEnd();
  speechBus.release(owner);
  vi.advanceTimersByTime(5_000);
  expect(o.onError).not.toHaveBeenCalled();
  expect(o.onListeningChange).toHaveBeenLastCalledWith(false);
  expect(fake.starts).toBe(1);
  expect(earcons()).toEqual(["start", "stop"]);
});

it("si la app ya está hablando al encender el modo continuo, empieza a escuchar 300 ms después de que calle", () => {
  installFakeRecognition();
  const owner = { onInterrupted: vi.fn() };
  speechBus.claim(owner);
  const o = opts();
  createRecognizer(o)!.start();
  const fake = FakeRecognition.instances[0]!;
  expect(fake.starts).toBe(0);
  expect(o.onListeningChange).toHaveBeenLastCalledWith(true);
  speechBus.release(owner);
  vi.advanceTimersByTime(299);
  expect(fake.starts).toBe(0);
  vi.advanceTimersByTime(1);
  expect(fake.starts).toBe(1);
});

it("si start() del navegador falla, reintenta y después se rinde sin ruido", () => {
  installFakeRecognition();
  const start = vi.spyOn(FakeRecognition.prototype, "start").mockImplementation(() => {
    throw new DOMException("ya empezó", "InvalidStateError");
  });
  const o = opts();
  createRecognizer(o)!.start();
  expect(start).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(300 * 5);
  expect(start).toHaveBeenCalledTimes(6); // el intento inicial y 5 reintentos
  expect(o.onListeningChange).toHaveBeenLastCalledWith(false);
  vi.advanceTimersByTime(10_000);
  expect(start).toHaveBeenCalledTimes(6);
  expect(o.onError).not.toHaveBeenCalled();
});

it("en una sola frase, si el navegador cierra la sesión sin resultado ni error, avisa que no respondió", () => {
  installFakeRecognition();
  const o = opts();
  createRecognizer({ ...o, continuous: false })!.start();
  FakeRecognition.instances[0]!.emitEnd();
  expect(o.onError).toHaveBeenCalledExactlyOnceWith("unresponsive");
  expect(o.onListeningChange).toHaveBeenLastCalledWith(false);
});

it("en una sola frase, si pasan 15 s sin ningún resultado ni error, lo corta y avisa", () => {
  installFakeRecognition();
  const o = opts();
  createRecognizer({ ...o, continuous: false })!.start();
  const fake = FakeRecognition.instances[0]!;
  vi.advanceTimersByTime(14_999);
  expect(o.onError).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(o.onError).toHaveBeenCalledExactlyOnceWith("unresponsive");
  expect(fake.aborts).toBe(1);
  expect(o.onListeningChange).toHaveBeenLastCalledWith(false);
});

it("un resultado o un error del navegador evita el aviso de «no respondió»", () => {
  installFakeRecognition();
  const heard = opts();
  createRecognizer({ ...heard, continuous: false })!.start();
  const first = FakeRecognition.instances[0]!;
  first.emitFinal("siguiente");
  first.emitEnd();
  vi.advanceTimersByTime(20_000);
  expect(heard.onError).not.toHaveBeenCalled();

  const failed = opts();
  createRecognizer({ ...failed, continuous: false })!.start();
  const second = FakeRecognition.instances[1]!;
  second.emitError("no-speech");
  second.emitEnd();
  vi.advanceTimersByTime(20_000);
  expect(failed.onError).toHaveBeenCalledExactlyOnceWith("no-speech");
});

it("detener a mano o en manos libres no cuenta como «no respondió»", () => {
  installFakeRecognition();
  const stopped = opts();
  const r = createRecognizer({ ...stopped, continuous: false })!;
  r.start();
  r.stop();
  FakeRecognition.instances[0]!.emitEnd();
  vi.advanceTimersByTime(20_000);
  expect(stopped.onError).not.toHaveBeenCalled();

  const handsFree = opts();
  createRecognizer({ ...handsFree, continuous: true })!.start();
  FakeRecognition.instances[1]!.emitEnd();
  vi.advanceTimersByTime(20_000);
  expect(handsFree.onError).not.toHaveBeenCalled();
});
