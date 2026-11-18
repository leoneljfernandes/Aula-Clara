import type { KeyboardEvent, ReactNode, Ref } from "react";

import type { Article } from "@/features/library";

import { FigureBlock } from "./FigureBlock";

interface DocumentViewProps {
  article: Article;
  /** Índice (en article.blocks) del bloque que se está leyendo en voz alta, o -1. */
  activeBlock: number;
  showListenButton: boolean;
  /** Guía por voz: las figuras leen su descripción al recibirla. */
  autoSpeak: boolean;
  /** Si es falso (audio oculto), las figuras no ofrecen escuchar su descripción. */
  canListen: boolean;
  /** Velocidad de la voz elegida en los ajustes. */
  rate: number;
  onListen: () => void;
  onAskAboutFigure: () => void;
  /** Índice (en article.blocks) del párrafo elegido con un clic, o null. */
  selectedBlock: number | null;
  /** Si existe, un clic o Enter sobre un párrafo o título lo elige (sin arrastrar el mouse). */
  onSelectBlock?: (index: number) => void;
  /** Descripciones hechas en esta sesión, por id de figura (aparte del artículo para no reiniciar el motor de lectura). */
  figureAlts: Readonly<Record<string, string>>;
  onFigureDescribed(figureId: string, text: string): void;
  style: React.CSSProperties;
  articleRef: Ref<HTMLElement>;
  titleRef: Ref<HTMLHeadingElement>;
}

export function DocumentView({
  article,
  activeBlock,
  showListenButton,
  autoSpeak,
  canListen,
  rate,
  onListen,
  onAskAboutFigure,
  selectedBlock,
  onSelectBlock,
  figureAlts,
  onFigureDescribed,
  style,
  articleRef,
  titleRef,
}: DocumentViewProps): ReactNode {
  // Número de figura = cuántas figuras hay hasta ese bloque (derivado, sin variable mutable en el render).
  const figureNumberAt = (index: number): number =>
    article.blocks.slice(0, index + 1).filter((b) => b.type === "figure").length;
  return (
    <article ref={articleRef} className="mx-auto max-w-[72ch] px-5 py-10 sm:px-8" style={style} lang="es">
      <p className="mb-2 text-[0.75em] font-bold tracking-wide text-[var(--muted)] uppercase">
        {article.meta}
      </p>
      <h1
        ref={titleRef}
        tabIndex={-1}
        className="mb-6 font-bold"
        style={{ fontSize: "1.6em", lineHeight: 1.25 }}
      >
        {article.title}
      </h1>
      {showListenButton && (
        <button
          type="button"
          onClick={onListen}
          className="mb-8 inline-flex min-h-14 items-center gap-3 rounded-2xl bg-[var(--accent)] px-6 font-bold text-[var(--onAccent)]"
          style={{ fontSize: "max(18px, 0.85em)" }}
        >
          <span aria-hidden="true">▶</span> Escuchar este documento
        </button>
      )}
      {article.blocks.map((block, i) => {
        if (block.type === "figure") {
          const before = article.blocks[i - 1];
          return (
            <div key={block.id} id={`blk-${i}`}>
              <FigureBlock
                block={block}
                index={i}
                alt={figureAlts[block.id] || block.alt || undefined}
                onDescribed={(text) => onFigureDescribed(block.id, text)}
                caption={`Gráfico ${figureNumberAt(i)}`}
                context={before?.type === "p" ? before.text : ""}
                buttonId={`fig-btn-${i}`}
                autoSpeak={autoSpeak}
                canListen={canListen}
                rate={rate}
                onAskAssistant={onAskAboutFigure}
              />
            </div>
          );
        }
        const active = i === activeBlock;
        const selected = i === selectedBlock;
        const cls = `reading-block rounded-lg ${active || selected ? "-mx-2 px-2" : ""} ${selected ? "outline-4 outline-[var(--accent)]" : ""}`;
        const select = onSelectBlock && {
          // Arrastrar para seleccionar texto deja una selección: ahí el clic no elige el bloque.
          onClick: () => {
            if (window.getSelection()?.isCollapsed !== false) onSelectBlock(i);
          },
          onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
            if (e.key === "Enter" && e.target === e.currentTarget) {
              e.preventDefault();
              onSelectBlock(i);
            }
          },
        };
        const highlight = active ? { background: "var(--hl)", color: "var(--hlFg)" } : undefined;
        return block.type === "h2" ? (
          <h2
            key={i}
            id={`blk-${i}`}
            tabIndex={-1}
            data-selected={selected ? "true" : undefined}
            {...select}
            className={`${cls} mt-10 mb-3 font-bold`}
            style={{ ...highlight, fontSize: "1.25em", lineHeight: 1.3 }}
          >
            {block.text}
          </h2>
        ) : (
          <p
            key={i}
            id={`blk-${i}`}
            tabIndex={-1}
            data-selected={selected ? "true" : undefined}
            {...select}
            className={`${cls} mb-5`}
            style={highlight}
            aria-current={active ? "true" : undefined}
          >
            {block.text}
          </p>
        );
      })}
      <hr className="my-10 border-[var(--border)]" />
      <p className="text-[0.8em] text-[var(--muted)]">
        Fin del documento · Seleccioná cualquier fragmento para pedir una explicación más simple.
      </p>
    </article>
  );
}
