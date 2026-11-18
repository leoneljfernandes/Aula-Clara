import type { Article } from "@/features/library";
import type { BrailleParagraph } from "@/lib/braille/layout";
import { toBraille } from "@/lib/braille/translate";

/** El texto en tinta de cada párrafo del documento, en el orden en que se transcribe. */
export function articleTexts(
  article: Article,
  figureAlts: Readonly<Record<string, string>>,
): { text: string; heading: boolean; describedFigure?: boolean }[] {
  const out: { text: string; heading: boolean; describedFigure?: boolean }[] = [
    { text: article.title, heading: true },
  ];
  let figureNumber = 0;
  for (const block of article.blocks) {
    if (block.type === "figure") {
      figureNumber += 1;
      const alt = (figureAlts[block.id] || block.alt || "").trim();
      const label = `Gráfico ${figureNumber}: `;
      out.push({
        text: alt ? `${label}${alt}${/[.!?]$/.test(alt) ? "" : "."}` : `${label}sin descripción.`,
        heading: false,
        describedFigure: alt !== "",
      });
    } else {
      out.push({ text: block.text, heading: block.type === "h2" });
    }
  }
  return out;
}

/**
 * El documento listo para maquetar: el título va primero, los `h2` son títulos y las figuras llevan su descripción
 * (o «sin descripción»). `unsupported` reúne, sin repetir, los símbolos que no tienen signo en la tabla.
 */
export function articleToParagraphs(
  article: Article,
  figureAlts: Readonly<Record<string, string>>,
): { paragraphs: BrailleParagraph[]; unsupported: string[]; undescribedFigures: number } {
  const paragraphs: BrailleParagraph[] = [];
  const unsupported = new Set<string>();
  let undescribedFigures = 0;
  for (const item of articleTexts(article, figureAlts)) {
    const { braille, unsupported: skipped } = toBraille(item.text);
    skipped.forEach((ch) => unsupported.add(ch));
    if (item.describedFigure === false) undescribedFigures += 1;
    if (braille) paragraphs.push({ braille, heading: item.heading });
  }
  return { paragraphs, unsupported: [...unsupported], undescribedFigures };
}
