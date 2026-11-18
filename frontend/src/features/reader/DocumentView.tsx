import type { ReactNode, Ref } from "react";

import type { Article } from "@/features/library";

import { FigureBlock } from "./FigureBlock";

interface DocumentViewProps {
  article: Article;
  /** Índice (en article.blocks) del bloque que se está leyendo en voz alta, o -1. */
  activeBlock: number;
  showListenButton: boolean;
  onListen: () => void;
  onAskAboutFigure: () => void;
  style: React.CSSProperties;
  articleRef: Ref<HTMLElement>;
  titleRef: Ref<HTMLHeadingElement>;
}

export function DocumentView({
  article,
  activeBlock,
  showListenButton,
  onListen,
  onAskAboutFigure,
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
                dataUrl={block.dataUrl}
                caption={`Gráfico ${figureNumberAt(i)}`}
                context={before?.type === "p" ? before.text : ""}
                buttonId={`fig-btn-${i}`}
                onAskAssistant={onAskAboutFigure}
              />
            </div>
          );
        }
        const active = i === activeBlock;
        const cls = `reading-block rounded-lg ${active ? "-mx-2 px-2" : ""}`;
        const highlight = active ? { background: "var(--hl)", color: "var(--hlFg)" } : undefined;
        return block.type === "h2" ? (
          <h2
            key={i}
            id={`blk-${i}`}
            tabIndex={-1}
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
