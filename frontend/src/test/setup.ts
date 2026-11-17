import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";

import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// Sin backend en los tests: la IA responde con el mock local.
beforeEach(() => {
  vi.stubEnv("VITE_AI_MODE", "mock");
});

afterEach(() => {
  cleanup();
  if (typeof window !== "undefined") window.localStorage.clear();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

// jsdom no implementa scrollIntoView ni matchMedia (los tests de entorno node no tienen DOM).
if (typeof window !== "undefined") {
  Element.prototype.scrollIntoView = vi.fn();
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}
