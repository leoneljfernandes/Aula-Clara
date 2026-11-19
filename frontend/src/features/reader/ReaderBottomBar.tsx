import type { ReactNode } from "react";

interface BlockActions {
  /** El texto del párrafo (o de la selección) sobre el que actúan los botones. */
  text: string;
  onExplain(): void;
  /** Solo si el bloque se puede leer en voz alta. */
  onReadFrom?(): void;
  onAsk(): void;
  onClear(): void;
}

interface NavActions {
  onPrev(): void;
  onNext(): void;
  playing: boolean;
  /** Sin esto (audio oculto), la barra no ofrece «Leer». */
  onPlayPause?(): void;
  /** Solo si los comandos por voz están activos y el navegador sabe reconocer voz. */
  onVoice?(): void;
  listening: boolean;
  onAssistant(): void;
}

/**
 * Barra fija abajo del lector con las acciones principales, para no tener que apuntar a botones chicos ni
 * esperar a que algo aparezca al pasar el mouse. No renderiza nada si no hay qué mostrar.
 */
const ACTION =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-2 text-center text-sm leading-tight font-bold text-[var(--fg)] hover:bg-[var(--soft)] sm:text-base";
const PRIMARY = "border-[var(--accent)] bg-[var(--accent)] text-[var(--onAccent)] hover:brightness-110";
// Navegación: icono arriba y nombre abajo en el teléfono, para que entren 5 botones en una fila.
const NAV_BUTTON =
  "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-1 text-xs leading-tight font-bold text-[var(--fg)] hover:bg-[var(--soft)] sm:flex-row sm:gap-2 sm:text-base";

// La navegación entra en una fila de 5 en un teléfono de 360 px; en uno más angosto el último pasa abajo.

/** Alto que hay que reservar bajo el documento para que la barra no tape nada (criterio 2.4.11). */
export const BAR_SPACE = { nav: "pb-36 scroll-pb-36", withBlock: "pb-64 scroll-pb-64" } as const;

export function ReaderBottomBar({
  block,
  nav,
}: {
  block: BlockActions | null;
  nav: NavActions | null;
}): ReactNode {
  if (!block && !nav) return null;
  return (
    <nav
      aria-label="Barra simplificada"
      className="fixed inset-x-0 bottom-0 z-30 border-t-4 border-[var(--accent)] bg-[var(--panel)] px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:px-4"
    >
      {block && (
        <div className={`grid grid-cols-2 gap-2 sm:grid-cols-4 ${nav ? "mb-2" : ""}`}>
          <button type="button" className={`${ACTION} ${PRIMARY}`} onClick={block.onExplain}>
            <span aria-hidden="true">✦</span> Explicar este párrafo más simple
          </button>
          {block.onReadFrom && (
            <button type="button" className={ACTION} onClick={block.onReadFrom}>
              <span aria-hidden="true">🔊</span> Leer desde este párrafo
            </button>
          )}
          <button type="button" className={ACTION} onClick={block.onAsk}>
            <span aria-hidden="true">❓</span> Preguntar sobre este párrafo
          </button>
          <button type="button" className={ACTION} onClick={block.onClear}>
            <span aria-hidden="true">✕</span> Quitar selección
          </button>
        </div>
      )}
      {nav && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(4rem,1fr))] gap-1.5 sm:gap-2">
          <button type="button" className={NAV_BUTTON} onClick={nav.onPrev}>
            <span aria-hidden="true" className="text-lg sm:text-base">
              ⬆
            </span>
            Anterior
          </button>
          <button type="button" className={NAV_BUTTON} onClick={nav.onNext}>
            <span aria-hidden="true" className="text-lg sm:text-base">
              ⬇
            </span>
            Siguiente
          </button>
          {nav.onPlayPause && (
            <button type="button" className={`${NAV_BUTTON} ${PRIMARY}`} onClick={nav.onPlayPause}>
              <span aria-hidden="true" className="text-lg sm:text-base">
                {nav.playing ? "❚❚" : "▶"}
              </span>
              {nav.playing ? "Pausar" : "Leer"}
            </button>
          )}
          {nav.onVoice && (
            <button type="button" className={NAV_BUTTON} aria-pressed={nav.listening} onClick={nav.onVoice}>
              <span aria-hidden="true" className="text-lg sm:text-base">
                🎙
              </span>
              Voz
            </button>
          )}
          <button type="button" className={NAV_BUTTON} onClick={nav.onAssistant}>
            <span aria-hidden="true" className="text-lg sm:text-base">
              ✦
            </span>
            Asistente
          </button>
        </div>
      )}
    </nav>
  );
}
