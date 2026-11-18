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

/**
 * Barra fija abajo del lector con las acciones principales, para no tener que apuntar a botones chicos ni
 * esperar a que algo aparezca al pasar el mouse. No renderiza nada si no hay qué mostrar.
 */
export function ReaderBottomBar({ block }: { block: BlockActions | null }): ReactNode {
  if (!block) return null;
  return (
    <nav
      aria-label="Barra simplificada"
      className="fixed inset-x-0 bottom-0 z-30 border-t-4 border-[var(--accent)] bg-[var(--panel)] px-4 py-3 shadow-2xl"
    >
      <div className="flex flex-wrap gap-3">
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
    </nav>
  );
}
