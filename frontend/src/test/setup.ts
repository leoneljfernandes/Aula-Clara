import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";

import { IDBFactory } from "fake-indexeddb";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  if (typeof window !== "undefined") {
    window.localStorage.clear();
    window.sessionStorage.clear();
  }
  // Lo que un test guarda en IndexedDB (p. ej. la descripción de una figura) no pasa al siguiente.
  globalThis.indexedDB = new IDBFactory();
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
