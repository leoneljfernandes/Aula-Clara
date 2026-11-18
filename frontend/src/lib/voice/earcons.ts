const DURATION = 0.08; // segundos
const GAIN = 0.15;
const TONES = { start: [440, 660], stop: [660, 440] } as const;

type AudioContextCtor = new () => AudioContext;

function audioContextCtor(): AudioContextCtor | undefined {
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext;
}

/** Tono corto que marca cuándo empieza o termina de escuchar. Sin `AudioContext` no suena y no falla. */
export function playEarcon(kind: "start" | "stop"): void {
  try {
    const Ctx = audioContextCtor();
    if (!Ctx) return;
    const ctx = new Ctx();
    void ctx.resume?.();
    const [from, to] = TONES[kind];
    const now = ctx.currentTime;
    const end = now + DURATION;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.linearRampToValueAtTime(to, end);
    gain.gain.setValueAtTime(GAIN, now);
    gain.gain.linearRampToValueAtTime(0, end); // sin corte seco: evita el «clic»
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.onended = () => void ctx.close?.();
    osc.start(now);
    osc.stop(end);
  } catch {
    // sin audio: el aviso sonoro es un extra, nunca bloquea
  }
}
