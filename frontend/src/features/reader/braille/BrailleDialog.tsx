import { type ReactNode, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/Button";
import { Dialog } from "@/components/Dialog";
import { describeApiError, describeImage, ImageUnavailableError } from "@/features/assistant";
import type { Article } from "@/features/library";
import { toBrfDocument } from "@/lib/braille/brf";
import { paginate } from "@/lib/braille/layout";
import { toBrailleWords } from "@/lib/braille/translate";
import { downloadText } from "@/lib/download";
import { slugify } from "@/lib/slugify";

import { figureImageBlob } from "@/lib/figureImage";
import { articleTexts, articleToParagraphs } from "./articleToBraille";
import { BraillePrintSheet } from "./BraillePrintSheet";
import { COLS_RANGE, loadBrailleFormat, ROWS_RANGE, saveBrailleFormat } from "./format";
import { printGrid } from "./printGeometry";

interface BrailleDialogProps {
  article: Article;
  /** Descripciones de figuras hechas en esta sesión, por id de figura. */
  figureAlts: Readonly<Record<string, string>>;
  onFigureDescribed(figureId: string, text: string): void;
  onClose(): void;
}

type View = "mirror" | "sheet";

const SCREEN_READER_NOTE =
  "La vista en Braille es para quien ve la pantalla. Para leer en Braille, descargá el archivo .BRF para tu impresora o usá tu línea Braille con tu lector de pantalla.";

/** La vista espejo dibuja solo los primeros párrafos: un documento largo tendría miles de palabras en pantalla. */
const MIRROR_PARAGRAPHS = 40;

const range = (r: { min: number; max: number }): number[] =>
  Array.from({ length: r.max - r.min + 1 }, (_, i) => r.min + i);

const SELECT_CLASS =
  "min-h-12 rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-3 text-[17px] text-[var(--fg)]";

export function BrailleDialog({
  article,
  figureAlts,
  onFigureDescribed,
  onClose,
}: BrailleDialogProps): ReactNode {
  const [view, setView] = useState<View>("mirror");
  const [format, setFormat] = useState(loadBrailleFormat);
  const [pageIndex, setPageIndex] = useState(0);
  const [describing, setDescribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Las páginas que se están imprimiendo en relieve: mientras no sea null, la hoja está montada.
  const [printing, setPrinting] = useState<string[][] | null>(null);

  const { paragraphs, unsupported, undescribedFigures } = useMemo(
    () => articleToParagraphs(article, figureAlts),
    [article, figureAlts],
  );
  const pages = useMemo(() => paginate(paragraphs, format), [paragraphs, format]);
  const mirror = useMemo(
    () => articleTexts(article, figureAlts).slice(0, MIRROR_PARAGRAPHS),
    [article, figureAlts],
  );
  const lastPage = Math.max(0, pages.length - 1);
  const page = Math.min(pageIndex, lastPage);

  const changeFormat = (next: typeof format): void => {
    setFormat(next);
    saveBrailleFormat(next);
    setPageIndex(0);
  };

  // Imprimir: con la hoja ya montada se oculta todo lo demás y se abre la impresión; al terminar se desmonta.
  useEffect(() => {
    if (!printing) return;
    const done = (): void => setPrinting(null);
    document.body.classList.add("printing-braille");
    window.addEventListener("afterprint", done);
    window.print();
    return () => {
      window.removeEventListener("afterprint", done);
      document.body.classList.remove("printing-braille");
    };
  }, [printing]);

  /** La hoja se pagina con las medidas del papel, no con el formato de la impresora Braille del .BRF. */
  const printRaised = (): void => setPrinting(paginate(paragraphs, printGrid()));

  const download = (): void =>
    downloadText(
      `${slugify(article.title) || "documento"}.brf`,
      toBrfDocument(pages),
      "text/plain;charset=us-ascii",
    );

  /** Describe los gráficos pendientes uno por uno; un error corta la serie y se muestra. */
  const describePending = async (): Promise<void> => {
    if (describing) return;
    setError(null);
    setDescribing(true);
    try {
      for (const [index, block] of article.blocks.entries()) {
        if (block.type !== "figure" || figureAlts[block.id] || block.alt) continue;
        const blob = await figureImageBlob(block, index);
        if (!blob) throw new ImageUnavailableError();
        const before = article.blocks[index - 1];
        const answer = await describeImage(blob, before?.type === "p" ? before.text : "");
        onFigureDescribed(block.id, answer.text);
      }
    } catch (failure) {
      setError(describeApiError(failure));
    } finally {
      setDescribing(false);
    }
  };

  return (
    <Dialog title="Braille" onClose={onClose} labelId="braille-title">
      <p className="sr-only">{SCREEN_READER_NOTE}</p>

      <fieldset className="mb-4">
        <legend className="mb-2 font-bold">Vista</legend>
        <div className="flex flex-wrap gap-4">
          <label className="inline-flex min-h-12 items-center gap-2">
            <input
              type="radio"
              name="braille-view"
              checked={view === "mirror"}
              onChange={() => setView("mirror")}
            />
            Espejo (tinta y Braille)
          </label>
          <label className="inline-flex min-h-12 items-center gap-2">
            <input
              type="radio"
              name="braille-view"
              checked={view === "sheet"}
              onChange={() => setView("sheet")}
            />
            Plancha
          </label>
        </div>
      </fieldset>

      <div
        aria-hidden="true"
        className="mb-4 max-h-[40vh] overflow-auto rounded-xl border-2 border-[var(--border)] p-3"
      >
        {view === "mirror" ? (
          mirror.map((item, i) => (
            <p key={i} className={`mb-3 flex flex-wrap gap-x-3 gap-y-1 ${item.heading ? "font-bold" : ""}`}>
              {toBrailleWords(item.text).map((word, w) => (
                <span key={w} className="inline-flex flex-col items-start">
                  <span style={{ fontSize: 28, lineHeight: 1.1 }}>{word.braille}</span>
                  <span className="text-sm">{word.ink}</span>
                </span>
              ))}
            </p>
          ))
        ) : (
          <div style={{ fontSize: 20, lineHeight: 1.4, whiteSpace: "pre" }}>
            {(pages[page] ?? []).map((line, i) => (
              <div key={i} style={{ minHeight: "1.4em" }}>
                {line}
              </div>
            ))}
          </div>
        )}
      </div>
      {view === "mirror" && articleTexts(article, figureAlts).length > MIRROR_PARAGRAPHS && (
        <p className="mb-4 text-sm text-[var(--muted)]">
          Se muestran los primeros {MIRROR_PARAGRAPHS} párrafos. El archivo .BRF tiene el documento completo.
        </p>
      )}
      {view === "sheet" && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Button disabled={page === 0} onClick={() => setPageIndex(page - 1)}>
            Anterior
          </Button>
          <span>
            Página {page + 1} de {pages.length}
          </span>
          <Button disabled={page >= lastPage} onClick={() => setPageIndex(page + 1)}>
            Siguiente
          </Button>
        </div>
      )}

      <fieldset className="mb-4">
        <legend className="mb-2 font-bold">Formato de la impresora</legend>
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1" htmlFor="braille-cols">
            Celdas por línea
            <select
              id="braille-cols"
              className={SELECT_CLASS}
              value={format.cols}
              onChange={(e) => changeFormat({ ...format, cols: Number(e.target.value) })}
            >
              {range(COLS_RANGE).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1" htmlFor="braille-rows">
            Líneas por página
            <select
              id="braille-rows"
              className={SELECT_CLASS}
              value={format.rows}
              onChange={(e) => changeFormat({ ...format, rows: Number(e.target.value) })}
            >
              {range(ROWS_RANGE).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      {unsupported.length > 0 && (
        <p className="mb-4">No se transcribieron estos símbolos: {unsupported.join(", ")}.</p>
      )}

      {undescribedFigures > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-sm text-[var(--muted)]">Cada gráfico usa una consulta de tu cuota de IA.</p>
          <Button aria-busy={describing} aria-disabled={describing} onClick={() => void describePending()}>
            {undescribedFigures === 1
              ? "Describir 1 gráfico con IA"
              : `Describir ${undescribedFigures} gráficos con IA`}
          </Button>
          {describing && (
            <p role="status" className="mt-2">
              Describiendo gráficos…
            </p>
          )}
          {error && (
            <p role="alert" className="mt-2">
              {error}
            </p>
          )}
        </div>
      )}

      <p id="braille-print-note" className="mb-2 text-sm text-[var(--muted)]">
        Imprimí al 100 % (sin «Ajustar a la página») para que los puntos tengan la medida correcta.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" onClick={download}>
          Descargar archivo .BRF
        </Button>
        <Button aria-describedby="braille-print-note" onClick={printRaised}>
          Imprimir en relieve
        </Button>
        <Button onClick={onClose}>Cerrar</Button>
      </div>
      {printing && <BraillePrintSheet pages={printing} />}
    </Dialog>
  );
}
