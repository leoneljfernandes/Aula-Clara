import type { ReactNode } from "react";

import { Button } from "@/components/Button";

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
      className="fixed inset-x-0 bottom-0 z-30 border-t-4 border-[var(--accent)] bg-[var(--panel)] px-4 py-3 shadow-2xl"
    >
      {block && (
        <div className="mb-3 flex flex-wrap gap-3">
          <Button variant="primary" onClick={block.onExplain}>
            <span aria-hidden="true">✦</span> Explicar este párrafo más simple
          </Button>
          {block.onReadFrom && (
            <Button onClick={block.onReadFrom}>
              <span aria-hidden="true">🔊</span> Leer desde este párrafo
            </Button>
          )}
          <Button onClick={block.onAsk}>
            <span aria-hidden="true">❓</span> Preguntar sobre este párrafo
          </Button>
          <Button onClick={block.onClear}>
            <span aria-hidden="true">✕</span> Quitar selección
          </Button>
        </div>
      )}
      {nav && (
        <div className="flex flex-wrap gap-3">
          <Button onClick={nav.onPrev}>
            <span aria-hidden="true">⬆</span> Anterior
          </Button>
          <Button onClick={nav.onNext}>
            <span aria-hidden="true">⬇</span> Siguiente
          </Button>
          {nav.onPlayPause && (
            <Button variant="primary" onClick={nav.onPlayPause}>
              {nav.playing ? (
                <>
                  <span aria-hidden="true">❚❚</span> Pausar
                </>
              ) : (
                <>
                  <span aria-hidden="true">▶</span> Leer
                </>
              )}
            </Button>
          )}
          {nav.onVoice && (
            <Button aria-pressed={nav.listening} onClick={nav.onVoice}>
              <span aria-hidden="true">🎙</span> Voz
            </Button>
          )}
          <Button onClick={nav.onAssistant}>
            <span aria-hidden="true">✦</span> Asistente
          </Button>
        </div>
      )}
    </nav>
  );
}
