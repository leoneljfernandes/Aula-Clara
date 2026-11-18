import { useEffect, useState } from "react";

import type { Block } from "@/lib/extractors";
import type { ReadAloud } from "@/lib/useReadAloud";

import { type BlockKind, figurePosition, findBlock, headingPosition, readableIndex } from "./blockNav";
import { prefersReducedMotion } from "./hooks";

interface Options {
  blocks: readonly Block[];
  audio: ReadAloud;
  voiceGuide: boolean;
  /** Índice (en `blocks`) del bloque que se está leyendo en voz alta, o -1: el cursor lo sigue. */
  activeBlock: number;
  announce: (message: string) => void;
}

export interface ReaderNavigation {
  /** Bloque donde está el cursor (índice en `blocks`), o -1 si todavía no se movió. */
  cursor: number;
  move: (kind: BlockKind, dir: 1 | -1) => void;
  setCursor: (index: number) => void;
}

/** Cursor de bloque: mueve el foco entre párrafos, títulos y gráficos sin agregar paradas de Tab. */
export function useReaderNavigation({
  blocks,
  audio,
  voiceGuide,
  activeBlock,
  announce,
}: Options): ReaderNavigation {
  const [cursor, setCursor] = useState(-1);

  // El cursor sigue a la lectura: si el audio avanza solo, «bloque siguiente» sale de donde se está leyendo.
  // Se ajusta durante el render (patrón de React para derivar estado de una prop): sin efecto ni parpadeo.
  const [seenActive, setSeenActive] = useState(activeBlock);
  if (activeBlock !== seenActive) {
    setSeenActive(activeBlock);
    if (activeBlock >= 0 && activeBlock < blocks.length) setCursor(activeBlock);
  }

  // ...y al foco: tocar o tabular a un bloque (o al botón de una figura) lo vuelve el bloque actual.
  useEffect(() => {
    const onFocusIn = (e: FocusEvent): void => {
      const block = e.target instanceof Element ? e.target.closest('[id^="blk-"]') : null;
      const index = block ? Number(block.id.slice("blk-".length)) : NaN;
      if (Number.isInteger(index) && index >= 0 && index < blocks.length) setCursor(index);
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [blocks.length]);

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
    // preventScroll: el desplazamiento nativo del foco no debe pelear con el suave de abajo.
    target?.focus({ preventScroll: true });
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
