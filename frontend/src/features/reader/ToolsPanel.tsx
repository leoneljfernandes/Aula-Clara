import type { ReactNode } from "react";

import { Button } from "@/components/Button";
import {
  FONTS,
  type FontId,
  MAX_FS,
  MIN_FS,
  RATES,
  ThemeButtons,
  clamp,
  usePreferences,
} from "@/features/preferences";
import { useAnnounce } from "@/lib/announcer";
import { hasTTS } from "@/lib/speech";
import type { ReadAloud } from "@/lib/useReadAloud";

const H3 = "mb-3 text-base font-bold tracking-wide text-[var(--muted)] uppercase";

function AudioSection({ audio, total }: { audio: ReadAloud; total: number }): ReactNode {
  const { settings, updateSettings } = usePreferences();
  const announce = useAnnounce();
  return (
    <section
      aria-labelledby="t-audio"
      className={settings.audioFocus ? "-mx-1 rounded-2xl border-2 border-[var(--accent)] p-4" : ""}
    >
      <h3 id="t-audio" className={H3}>
        Lectura en voz alta
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {audio.status === "playing" ? (
          <Button variant="primary" onClick={audio.pause} aria-label="Pausar lectura">
            ❚❚
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={audio.play}
            aria-label={audio.status === "paused" ? "Continuar lectura" : "Reproducir lectura"}
          >
            ▶
          </Button>
        )}
        <Button onClick={audio.pause} disabled={audio.status !== "playing"} aria-label="Pausar">
          ❚❚
        </Button>
        <Button onClick={audio.stop} disabled={audio.status === "stopped"} aria-label="Detener lectura">
          ■
        </Button>
      </div>
      <div className="mt-3" role="group" aria-label="Velocidad de lectura">
        <span className="mb-2 block text-base font-bold">Velocidad</span>
        <div className="grid grid-cols-3 gap-2">
          {RATES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={settings.rate === r}
              onClick={() => {
                updateSettings({ rate: r });
                announce(`Velocidad ${r}`);
              }}
              className={`min-h-12 rounded-xl border-2 font-bold ${settings.rate === r ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--onAccent)]" : "border-[var(--border)] hover:bg-[var(--soft)]"}`}
            >
              x{String(r).replace(".", ",")}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-3 text-base" aria-live="polite">
        {audio.status === "stopped"
          ? "Listo para leer."
          : `${audio.status === "paused" ? "En pausa" : "Leyendo"} · bloque ${audio.idx + 1} de ${total}`}
      </p>
      {!hasTTS && (
        <p className="mt-1 text-sm text-[var(--muted)]">Tu navegador no tiene voz: se simula el avance.</p>
      )}
    </section>
  );
}

export function ToolsPanel({ audio, total }: { audio: ReadAloud; total: number }): ReactNode {
  const { settings, updateSettings } = usePreferences();
  const announce = useAnnounce();
  const zoom = (delta: number): void => {
    const next = clamp(settings.fontSize + delta, MIN_FS, MAX_FS);
    updateSettings({ fontSize: next });
    announce(`Tamaño ${next} píxeles`);
  };
  const audioSection = <AudioSection audio={audio} total={total} />;

  return (
    <div className="space-y-8 p-5">
      {settings.audioFocus && audioSection}
      <section aria-labelledby="t-size">
        <h3 id="t-size" className={H3}>
          Tamaño del texto
        </h3>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => zoom(-2)}
            disabled={settings.fontSize <= MIN_FS}
            aria-label="Achicar texto"
            className="flex-1 text-xl"
          >
            A−
          </Button>
          <span className="w-16 text-center text-lg font-bold" aria-hidden="true">
            {settings.fontSize}px
          </span>
          <Button
            onClick={() => zoom(2)}
            disabled={settings.fontSize >= MAX_FS}
            aria-label="Agrandar texto"
            className="flex-1 text-2xl"
          >
            A+
          </Button>
        </div>
        <label htmlFor="lh2" className="mt-4 mb-1 flex justify-between text-base font-bold">
          <span>Interlineado</span>
          <span>{settings.lineHeight.toFixed(1)}</span>
        </label>
        <input
          id="lh2"
          type="range"
          min="1.3"
          max="2.4"
          step="0.1"
          value={settings.lineHeight}
          onChange={(e) => updateSettings({ lineHeight: +e.target.value })}
          className="w-full"
          style={{ accentColor: "var(--accent)", height: 32 }}
        />
      </section>
      <section aria-labelledby="t-theme">
        <h3 id="t-theme" className={H3}>
          Tema
        </h3>
        <ThemeButtons compact />
      </section>
      <section aria-labelledby="t-font">
        <h3 id="t-font" className={H3}>
          Tipografía
        </h3>
        <label htmlFor="font-sel" className="sr-only">
          Tipografía del documento
        </label>
        <select
          id="font-sel"
          value={settings.font}
          onChange={(e) => {
            const font = e.target.value as FontId;
            updateSettings({ font });
            announce(`Tipografía ${FONTS[font].label}`);
          }}
          className="min-h-[52px] w-full rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-3 text-lg font-bold text-[var(--fg)]"
        >
          {Object.entries(FONTS).map(([id, f]) => (
            <option key={id} value={id}>
              {f.label}
            </option>
          ))}
        </select>
      </section>
      {!settings.audioFocus && audioSection}
      <section aria-labelledby="t-keys" className="text-base">
        <h3 id="t-keys" className={H3}>
          Atajos
        </h3>
        <ul className="space-y-1 text-[var(--muted)]">
          <li>
            <kbd className="font-bold text-[var(--fg)]">Alt+P</kbd> leer / pausar
          </li>
          <li>
            <kbd className="font-bold text-[var(--fg)]">Alt+= / Alt+−</kbd> tamaño
          </li>
          <li>
            <kbd className="font-bold text-[var(--fg)]">Alt+T</kbd> tema ·{" "}
            <kbd className="font-bold text-[var(--fg)]">Alt+A</kbd> asistente
          </li>
        </ul>
      </section>
    </div>
  );
}
