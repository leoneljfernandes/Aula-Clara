import { speechBus } from "@/lib/speech";

import { playEarcon } from "./earcons";

export type RecognitionErrorKind =
  "not-allowed" | "no-speech" | "network" | "language" | "no-microphone" | "other";

export interface RecognizerOptions {
  continuous: boolean;
  interim: boolean;
  onFinal(text: string): void;
  onInterim?(text: string): void;
  onListeningChange(listening: boolean): void;
  onError(kind: RecognitionErrorKind): void;
}

export interface Recognizer {
  start(): void;
  stop(): void;
  dispose(): void;
}

/** Lo mínimo que se usa de `SpeechRecognition`: el tipo del DOM no es igual en todos los navegadores. */
interface BrowserRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  processLocally?: boolean;
  onresult: ((e: BrowserResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface BrowserResultEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

interface BrowserRecognitionCtor {
  new (): BrowserRecognition;
  available?(options: { langs: string[]; processLocally?: boolean }): Promise<string>;
}

const LANG = "es-AR";
const RESTART_MS = 300;
const MAX_RESTART_MS = 5_000;
const MAX_START_RETRIES = 5;
/** Errores de red seguidos (en modo continuo) tras los cuales se deja de insistir. */
const MAX_NETWORK_ERRORS = 5;

function recognitionCtor(): BrowserRecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: BrowserRecognitionCtor;
    webkitSpeechRecognition?: BrowserRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Se evalúa en cada llamada, no al importar: el navegador o un test pueden agregar la API después. */
export function speechRecognitionAvailable(): boolean {
  return recognitionCtor() !== undefined;
}

function mapError(error: string): RecognitionErrorKind {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "not-allowed";
    case "language-not-supported":
      return "language";
    case "audio-capture":
      return "no-microphone";
    case "no-speech":
    case "network":
      return error;
    default:
      return "other";
  }
}

/**
 * Envuelve el reconocimiento de voz del navegador. Mientras la app habla (`speechBus.isSpeaking()`) se calla
 * para no oírse a sí misma; en modo continuo vuelve a escuchar 300 ms después. Nunca guarda ni registra
 * lo que oye: el texto va solo a `onFinal` y `onInterim`.
 */
export function createRecognizer(opts: RecognizerOptions): Recognizer | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = LANG;
  rec.continuous = opts.continuous;
  rec.interimResults = opts.interim;

  // Si el idioma ya está instalado en el dispositivo, se prefiere: el audio no sale del equipo.
  let local = false;
  try {
    void Ctor.available?.({ langs: [LANG], processLocally: true })
      .then((status) => {
        local = status === "available";
      })
      .catch(() => {});
  } catch {
    // sin la API de reconocimiento local: se usa el servicio del navegador
  }

  let wanted = false; // la persona lo quiere encendido
  let running = false; // hay una sesión del navegador entre start() y end
  let listening = false; // lo último que se avisó
  let networkErrors = 0; // errores de red seguidos, sin ningún resultado en el medio
  let paused = false; // en pausa porque la app habla (solo modo continuo)
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let unsubscribe: (() => void) | undefined;

  const setListening = (value: boolean): void => {
    if (listening === value) return;
    listening = value;
    opts.onListeningChange(value);
  };

  /** Apaga el micrófono de verdad (no es un reinicio automático): avisa y suena el tono de fin. */
  function finish(): void {
    wanted = false;
    paused = false;
    running = false;
    clearTimeout(timer);
    unsubscribe?.();
    unsubscribe = undefined;
    if (listening) {
      setListening(false);
      playEarcon("stop");
    }
  }

  function beginSession(attempt = 0): void {
    if (!wanted || disposed) return;
    try {
      if (local) rec.processLocally = true;
      rec.start();
      running = true;
    } catch {
      // el navegador sigue cerrando la sesión anterior: se reintenta un momento después
      if (attempt < MAX_START_RETRIES) timer = setTimeout(() => beginSession(attempt + 1), RESTART_MS);
      else finish();
    }
  }

  /** 300 ms entre reinicios normales; con errores de red seguidos la espera se duplica, hasta 5 s. */
  const restartDelay = (): number =>
    Math.min(RESTART_MS * 2 ** Math.max(0, networkErrors - 1), MAX_RESTART_MS);

  const scheduleRestart = (): void => {
    clearTimeout(timer);
    timer = setTimeout(() => beginSession(), restartDelay());
  };

  const onSpeakingChange = (speaking: boolean): void => {
    if (!wanted) return;
    if (speaking) {
      clearTimeout(timer);
      if (opts.continuous) paused = true;
      if (running) {
        try {
          rec.abort();
        } catch {
          // ya estaba cerrándose
        }
      }
    } else if (paused) {
      paused = false;
      scheduleRestart();
    }
  };

  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i];
      const text = result?.[0]?.transcript.trim();
      if (!result || !text) continue;
      networkErrors = 0;
      if (result.isFinal) opts.onFinal(text);
      else if (opts.interim) opts.onInterim?.(text);
    }
  };

  rec.onerror = (e) => {
    if (e.error === "aborted") return; // lo causamos nosotros al callarnos o apagar
    const kind = mapError(e.error);
    // Sin voz es normal en modo continuo (cada ciclo sin hablar termina así): se reinicia sin avisar.
    if (kind === "no-speech" && opts.continuous) return;
    let fatal = kind === "not-allowed" || kind === "language" || kind === "no-microphone";
    if (kind === "network" && opts.continuous) {
      networkErrors++;
      if (networkErrors < MAX_NETWORK_ERRORS) return; // se reintenta con espera creciente, sin molestar
      fatal = true;
    }
    opts.onError(kind);
    // Se apaga acá, sin esperar el `end`: algunos navegadores no lo mandan. El `end` tardío ya no hace nada.
    if (fatal) finish();
  };

  rec.onend = () => {
    running = false;
    if (paused) return; // nos callamos por la voz de la app: se reanuda cuando termine
    if (wanted && opts.continuous) {
      scheduleRestart(); // reinicio automático: sin tonos ni cambio de estado
      return;
    }
    finish();
  };

  return {
    start() {
      if (disposed || wanted) return;
      wanted = true;
      networkErrors = 0;
      paused = false;
      unsubscribe = speechBus.subscribe(onSpeakingChange);
      setListening(true);
      playEarcon("start");
      if (opts.continuous && speechBus.isSpeaking()) {
        paused = true; // la app está hablando: se empieza a escuchar cuando termine
        return;
      }
      beginSession();
    },
    stop() {
      if (!wanted) return;
      if (running) {
        wanted = false;
        clearTimeout(timer);
        try {
          rec.stop(); // el `end` que sigue cierra el estado y avisa
        } catch {
          finish();
        }
      } else {
        finish();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      if (running) {
        try {
          rec.abort();
        } catch {
          // ya estaba cerrándose
        }
      }
      unsubscribe?.();
      unsubscribe = undefined;
      clearTimeout(timer);
      wanted = false;
      running = false;
      setListening(false);
    },
  };
}
