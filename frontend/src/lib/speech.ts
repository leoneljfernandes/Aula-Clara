/** Lectura en voz alta con la Web Speech API del navegador (sin costo y sin backend). */
export const hasTTS: boolean = (() => {
  try {
    return "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
  } catch {
    return false;
  }
})();

function spanishVoice(): SpeechSynthesisVoice | undefined {
  return window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("es"));
}

function utterance(text: string, rate: number): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "es-AR";
  u.rate = rate;
  const voice = spanishVoice();
  if (voice) u.voice = voice;
  return u;
}

function cancelSynthesis(): void {
  if (!hasTTS) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // nada que cancelar
  }
}

/** Quien habla (el motor de lectura o una locución suelta). Se entera cuando otra voz lo interrumpe. */
export interface SpeechOwner {
  onInterrupted(): void;
}

let current: SpeechOwner | null = null;
const listeners = new Set<(speaking: boolean) => void>();

function setCurrent(next: SpeechOwner | null): void {
  const was = current !== null;
  current = next;
  if (was === (next !== null)) return;
  for (const listener of [...listeners]) listener(next !== null);
}

/**
 * Árbitro de voz: hay un solo dueño a la vez. Quien empieza a hablar interrumpe al anterior y le avisa,
 * así la lectura del documento queda en pausa en vez de trabada. `isSpeaking` vale también en modo simulado.
 */
export const speechBus = {
  claim(owner: SpeechOwner): void {
    const previous = current;
    const wasSpeaking = previous !== null;
    current = owner;
    if (previous && previous !== owner) previous.onInterrupted();
    cancelSynthesis();
    if (!wasSpeaking) for (const listener of [...listeners]) listener(true);
  },
  release(owner: SpeechOwner): void {
    if (current === owner) setCurrent(null);
  },
  silence(): void {
    const previous = current;
    setCurrent(null);
    previous?.onInterrupted();
    cancelSynthesis();
  },
  isSpeaking: (): boolean => current !== null,
  subscribe(listener: (speaking: boolean) => void): () => void {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
};

/** Lee un texto suelto (descripción de una imagen, respuesta del asistente). */
export function speakOnce(text: string, rate = 1): boolean {
  if (!hasTTS) return false;
  const owner: SpeechOwner = { onInterrupted: () => {} };
  try {
    const u = utterance(text, rate);
    u.onend = () => speechBus.release(owner);
    u.onerror = () => speechBus.release(owner);
    speechBus.claim(owner);
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    speechBus.release(owner);
    return false;
  }
}

export interface ReadState {
  status: "playing" | "paused" | "stopped";
  /** Índice del párrafo que se está leyendo, o -1. */
  idx: number;
}

export const STOPPED: ReadState = { status: "stopped", idx: -1 };

/**
 * Lee una lista de párrafos de a uno. Si el navegador no tiene voces, simula el avance con un temporizador
 * (así la interfaz se puede probar y usar igual). Un `token` invalida los callbacks viejos al cambiar de párrafo.
 */
export class ReadAloudEngine {
  private token = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private idx = -1;
  private simulated = !hasTTS;
  private state: ReadState = STOPPED;
  /** Es el dueño actual del árbitro de voz. */
  private holding = false;
  /** Otra voz cortó la lectura: al continuar hay que releer el párrafo, no reanudar. */
  private interrupted = false;
  private readonly owner: SpeechOwner = { onInterrupted: () => this.onInterrupted() };

  private readonly items: readonly string[];
  private readonly getRate: () => number;
  private readonly onChange: (state: ReadState) => void;
  private readonly onFinished: () => void;

  constructor(
    items: readonly string[],
    getRate: () => number,
    onChange: (state: ReadState) => void,
    onFinished: () => void,
  ) {
    this.items = items;
    this.getRate = getRate;
    this.onChange = onChange;
    this.onFinished = onFinished;
  }

  private set(state: ReadState): void {
    this.state = state;
    this.idx = state.idx;
    this.onChange(state);
  }

  private cancelSpeech(): void {
    this.token++;
    clearTimeout(this.timer);
    if (this.holding) cancelSynthesis();
  }

  private release(): void {
    this.holding = false;
    speechBus.release(this.owner);
  }

  /** Otra voz tomó el árbitro (o se pidió silencio): la lectura queda en pausa en el mismo párrafo. */
  private onInterrupted(): void {
    this.token++;
    clearTimeout(this.timer);
    this.holding = false;
    this.interrupted = true;
    if (this.state.status === "stopped") return;
    this.set({ status: "paused", idx: this.idx });
  }

  private speakFrom(i: number): void {
    this.cancelSpeech();
    const mine = this.token;
    const text = this.items[i];
    if (text === undefined) {
      this.release();
      this.set(STOPPED);
      if (i >= this.items.length) this.onFinished();
      return;
    }
    this.interrupted = false;
    this.holding = true;
    speechBus.claim(this.owner);
    this.set({ status: "playing", idx: i });
    const next = (): void => {
      if (mine === this.token) this.speakFrom(i + 1);
    };
    const simulate = (): void => {
      const words = text.split(/\s+/).length;
      this.timer = setTimeout(next, (words * 380) / this.getRate());
    };
    if (!this.simulated) {
      try {
        const u = utterance(text, this.getRate());
        u.onend = next;
        u.onerror = (e) => {
          if (mine === this.token && e.error !== "interrupted" && e.error !== "canceled") {
            this.simulated = true; // la voz falló: se sigue en modo simulado
            simulate();
          }
        };
        window.speechSynthesis.speak(u);
        return;
      } catch {
        this.simulated = true;
      }
    }
    simulate();
  }

  play(): void {
    if (this.state.status === "paused") {
      if (!this.simulated && !this.interrupted) {
        try {
          window.speechSynthesis.resume();
          this.set({ status: "playing", idx: this.idx });
          return;
        } catch {
          // se reinicia el párrafo
        }
      }
      this.speakFrom(this.idx);
      return;
    }
    this.speakFrom(this.idx >= 0 ? this.idx : 0);
  }

  pause(): void {
    if (this.state.status !== "playing") return;
    if (!this.simulated) {
      try {
        window.speechSynthesis.pause();
      } catch {
        // sin voz: queda en pausa lógica
      }
    } else {
      this.token++;
      clearTimeout(this.timer);
    }
    this.set({ status: "paused", idx: this.idx });
  }

  /** Lee desde el párrafo `i` (índice en la lista de textos). */
  playFrom(i: number): void {
    if (i < 0 || i >= this.items.length) return;
    this.speakFrom(i);
  }

  stop(): void {
    this.cancelSpeech();
    this.release();
    this.interrupted = false;
    this.set(STOPPED);
  }

  /** Cambió la velocidad: se reinicia el párrafo actual con la nueva. */
  restartIfPlaying(): void {
    if (this.state.status === "playing") this.speakFrom(this.idx);
  }

  dispose(): void {
    this.cancelSpeech();
    this.release();
  }

  get isSimulated(): boolean {
    return this.simulated;
  }
}
