import { BLANK, cell } from "./table";

export interface BrailleParagraph {
  braille: string;
  heading: boolean;
}

export interface PageFormat {
  cols: number;
  rows: number;
}

/** Guion Braille (puntos 3-6): marca que una palabra continúa en la línea siguiente. */
const HYPHEN = cell(3, 6);

/**
 * Corta en `BLANK` sin dejarlo al principio ni al final de una línea. Una palabra de más de `cols` celdas se parte
 * en tramos de `cols − 1` celdas seguidos de ⠤; el último tramo va sin ⠤.
 */
export function wrap(braille: string, cols: number): string[] {
  const width = Math.max(2, cols);
  const lines: string[] = [];
  let current = "";
  for (const word of braille.split(BLANK).filter(Boolean)) {
    let rest = [...word];
    if (rest.length > width) {
      if (current) lines.push(current);
      while (rest.length > width) {
        lines.push(rest.slice(0, width - 1).join("") + HYPHEN);
        rest = rest.slice(width - 1);
      }
      current = rest.join("");
    } else if (!current) {
      current = rest.join("");
    } else if ([...current].length + 1 + rest.length <= width) {
      current += BLANK + rest.join("");
    } else {
      lines.push(current);
      current = rest.join("");
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Reparte los párrafos en páginas de `rows` líneas. Deja una línea en blanco entre párrafos (salvo al principio de
 * una página) y un título nunca termina una página: si al ubicarlo la página queda llena, pasa a la siguiente.
 */
export function paginate(paragraphs: readonly BrailleParagraph[], format: PageFormat): string[][] {
  const rows = Math.max(1, format.rows);
  const pages: string[][] = [];
  let page: string[] = [];

  const newPage = () => {
    if (page.length > 0) pages.push(page);
    page = [];
  };

  paragraphs.forEach((paragraph, p) => {
    const lines = wrap(paragraph.braille, format.cols);
    if (lines.length === 0) return;
    if (paragraph.heading && page.length > 0) {
      // Un título necesita lugar para sí mismo y, si hay algo después, para la línea en blanco y una línea del párrafo
      // que sigue: si no, quedaría solo al final de la página.
      const needed = page.length + 1 + lines.length;
      const last = p === paragraphs.length - 1;
      if (last ? needed >= rows : needed + 2 > rows) newPage();
    }
    lines.forEach((line, i) => {
      const separated = i === 0 && page.length > 0;
      if (page.length + (separated ? 2 : 1) > rows) newPage();
      if (i === 0 && page.length > 0) page.push("");
      page.push(line);
    });
  });
  newPage();
  return pages;
}
