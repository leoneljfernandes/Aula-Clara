import { useState } from "react";

import type { Block } from "@/lib/extractors";
import type { ReadAloud } from "@/lib/useReadAloud";

import { type BlockKind, figurePosition, findBlock, headingPosition, readableIndex } from "./blockNav";
import { prefersReducedMotion } from "./hooks";

interface Options {
  blocks: readonly Block[];
  audio: ReadAloud;
  voiceGuide: boolean;
  announce: (message: string) => void;
}

export interface ReaderNavigation {
  /** Bloque donde está el cursor (índice en `blocks`), o -1 si todavía no se movió. */
  cursor: number;
  move: (kind: BlockKind, dir: 1 | -1) => void;
  setCursor: (index: number) => void;
}

/** Cursor de bloque: mueve el foco entre párrafos, títulos y gráficos sin agregar paradas de Tab. */
export function useReaderNavigation({ blocks, audio, voiceGuide, announce }: Options): ReaderNavigation {
  const [cursor, setCursor] = useState(-1);

  const move = (kind: BlockKind, dir: 1 | -1): void => {
    const next = findBlock(blocks, cursor, kind, dir);
    if (next === null) {
      announce(dir === 1 ? "Fin del documento" : "Principio del documento");
      return;
    }
    setCursor(next);
    const block = blocks[next];
    const isFigure = block?.type === "figure";
    const target = document.getElementById(isFigure ? `fig-btn-${next}` : `blk-${next}`);
    target?.focus();
    target?.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });

    if (block?.type === "h2") {
      const pos = headingPosition(blocks, next);
      if (pos) announce(`Sección ${pos.n} de ${pos.total}: ${block.text}`);
    } else if (isFigure) {
      announce(`Gráfico ${figurePosition(blocks, next)}`);
    }

    const readable = readableIndex(blocks, next);
    if (readable !== null && (voiceGuide || audio.status === "playing")) audio.playFrom(readable);
  };

  return { cursor, move, setCursor };
}
