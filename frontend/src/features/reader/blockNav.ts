import type { Block } from "@/lib/extractors";

export type BlockKind = "any" | "h2" | "figure";

/** Índice del bloque más cercano de ese tipo, buscando desde `from + dir` (sin incluir `from`). */
export function findBlock(
  blocks: readonly Block[],
  from: number,
  kind: BlockKind,
  dir: 1 | -1,
): number | null {
  for (let i = from + dir; i >= 0 && i < blocks.length; i += dir) {
    if (kind === "any" || blocks[i]?.type === kind) return i;
  }
  return null;
}

/** «Sección n de total» de un título, o null si el bloque no es un título. */
export function headingPosition(
  blocks: readonly Block[],
  index: number,
): { n: number; total: number } | null {
  if (blocks[index]?.type !== "h2") return null;
  return {
    n: blocks.slice(0, index + 1).filter((b) => b.type === "h2").length,
    total: blocks.filter((b) => b.type === "h2").length,
  };
}

/** Número de gráfico (1, 2…) de una figura, o null si el bloque no es una figura. */
export function figurePosition(blocks: readonly Block[], index: number): number | null {
  if (blocks[index]?.type !== "figure") return null;
  return blocks.slice(0, index + 1).filter((b) => b.type === "figure").length;
}

/** Posición en la lista de textos leíbles (todo menos las figuras), o null para una figura. */
export function readableIndex(blocks: readonly Block[], index: number): number | null {
  if (blocks[index] === undefined || blocks[index].type === "figure") return null;
  return blocks.slice(0, index).filter((b) => b.type !== "figure").length;
}
