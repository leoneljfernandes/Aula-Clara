import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { speechBus } from "@/lib/speech";
import { FakeRecognition, installFakeRecognition } from "@/test/fakeSpeechRecognition";

import { createRecognizer, speechRecognitionAvailable } from "./recognizer";

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
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
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
  fake.emitError("audio-capture");
  expect(o.onError).toHaveBeenLastCalledWith("other");
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
