import { afterEach, expect, it, vi } from "vitest";

import { playEarcon } from "./earcons";

afterEach(() => vi.unstubAllGlobals());

it("sin AudioContext no suena ni falla", () => {
  expect(() => playEarcon("start")).not.toThrow();
});

it("el inicio sube de 440 a 660 Hz, el fin baja, a ganancia 0,15 y 80 ms", () => {
  const freq = { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() };
  const gain = { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() };
  const osc = { frequency: freq, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null };
  const ctx = {
    currentTime: 1,
    destination: {},
    createOscillator: () => osc,
    createGain: () => ({ gain, connect: vi.fn() }),
    close: vi.fn(),
  };
  vi.stubGlobal("AudioContext", function () {
    return ctx;
  });
  playEarcon("start");
  expect(freq.setValueAtTime).toHaveBeenCalledWith(440, 1);
  expect(freq.linearRampToValueAtTime).toHaveBeenCalledWith(660, 1.08);
  expect(osc.start).toHaveBeenCalled();
  expect(osc.stop).toHaveBeenCalledWith(1.08);
  playEarcon("stop");
  expect(freq.setValueAtTime).toHaveBeenLastCalledWith(660, 1);
  expect(freq.linearRampToValueAtTime).toHaveBeenLastCalledWith(440, 1.08);
});
