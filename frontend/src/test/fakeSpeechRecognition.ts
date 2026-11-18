import { vi } from "vitest";

interface FakeResult {
  0: { transcript: string };
  isFinal: boolean;
  length: 1;
}

/** Doble de `SpeechRecognition` para tests: no oye nada, los tests le dictan resultados, errores y cierres. */
export class FakeRecognition {
  static instances: FakeRecognition[] = [];

  lang = "";
  continuous = false;
  interimResults = false;
  processLocally = false;
  starts = 0;
  stops = 0;
  aborts = 0;

  onresult: ((e: { resultIndex: number; results: FakeResult[] }) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;

  constructor() {
    FakeRecognition.instances.push(this);
  }

  start(): void {
    this.starts++;
  }
  stop(): void {
    this.stops++;
  }
  abort(): void {
    this.aborts++;
  }

  private emitResult(text: string, isFinal: boolean): void {
    this.onresult?.({ resultIndex: 0, results: [{ 0: { transcript: text }, isFinal, length: 1 }] });
  }
  emitFinal(text: string): void {
    this.emitResult(text, true);
  }
  emitInterim(text: string): void {
    this.emitResult(text, false);
  }
  emitError(error: string): void {
    this.onerror?.({ error });
  }
  emitEnd(): void {
    this.onend?.();
  }
}

/** Hace que el navegador de prueba tenga reconocimiento de voz (`webkitSpeechRecognition`). */
export function installFakeRecognition(): void {
  vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
}
