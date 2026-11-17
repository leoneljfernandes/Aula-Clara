/** Del texto suelto de un PDF a bloques (títulos y párrafos). Funciones puras: se prueban sin pdf.js. */
import type { Block } from "./types";

export interface TextItem {
  str: string;
  x: number;
  /** Línea base (origen abajo: más arriba en la página = y mayor). */
  y: number;
  /** Tamaño de fuente. */
  size: number;
}

interface Line {
  text: string;
  y: number;
  size: number;
}

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

/** Agrupa los fragmentos que comparten línea base y los ordena de arriba hacia abajo. */
export function toLines(items: readonly TextItem[]): Line[] {
  const rows: { y: number; items: TextItem[] }[] = [];
  for (const item of items) {
    if (!item.str.trim()) continue;
    const row = rows.find((r) => Math.abs(r.y - item.y) < Math.max(2, item.size * 0.3));
    if (row) row.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => {
      const ordered = row.items.sort((a, b) => a.x - b.x);
      return {
        y: row.y,
        size: Math.max(...ordered.map((i) => i.size)),
        text: ordered
          .map((i) => i.str)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
      };
    });
}

const SENTENCE_END = /[.!?:;…»")\]]$/;

/** Une las líneas de un mismo párrafo (con guiones de corte de palabra) y detecta títulos por tamaño. */
export function pageToBlocks(items: readonly TextItem[]): Block[] {
  const lines = toLines(items);
  if (lines.length === 0) return [];
  const bodySize = median(lines.map((l) => l.size));
  const gaps = lines
    .slice(1)
    .map((line, i) => (lines[i]?.y ?? 0) - line.y)
    .filter((g) => g > 0);
  // El salto típico entre líneas de un mismo párrafo, acotado: con pocas líneas la mediana la distorsionan los títulos.
  const normalGap = Math.min(median(gaps) || bodySize * 1.3, bodySize * 1.6);

  const blocks: Block[] = [];
  let current = "";
  const flush = (): void => {
    if (current) blocks.push({ type: "p", text: current });
    current = "";
  };

  lines.forEach((line, i) => {
    const prev = lines[i - 1];
    const isHeading = line.size >= bodySize * 1.25 && line.text.length <= 120;
    if (isHeading) {
      flush();
      const last = blocks.at(-1);
      // Un título partido en dos líneas se une.
      if (last?.type === "h2" && prev?.size === line.size) last.text += ` ${line.text}`;
      else blocks.push({ type: "h2", text: line.text });
      return;
    }
    const newParagraph = prev !== undefined && prev.y - line.y > normalGap * 1.5;
    if (newParagraph) flush();
    if (!current) current = line.text;
    else if (current.endsWith("-") && /^[a-záéíóúñ]/.test(line.text))
      current = current.slice(0, -1) + line.text;
    else current += ` ${line.text}`;
  });
  flush();
  return blocks;
}

/** Une los párrafos que el salto de página cortó a la mitad (no terminan en puntuación). */
export function joinPages(pages: readonly Block[][]): Block[] {
  const result: Block[] = [];
  for (const page of pages) {
    const [first, ...rest] = page;
    const last = result.at(-1);
    if (
      first?.type === "p" &&
      last?.type === "p" &&
      !SENTENCE_END.test(last.text) &&
      /^[a-záéíóúñ]/.test(first.text)
    ) {
      last.text += ` ${first.text}`;
      result.push(...rest);
    } else {
      result.push(...page);
    }
  }
  return result;
}
