import { type RefObject, useEffect, useEffectEvent, useState } from "react";

import { clamp } from "@/features/preferences";
import { matchShortcut, type ShortcutId } from "@/lib/keymap";

export const prefersReducedMotion = (): boolean => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

interface SelectionState {
  text: string;
  pos: { top: number; left: number } | null;
}

/** Texto elegido dentro del artículo (mínimo 12 caracteres) y dónde mostrar el botón flotante. */
export function useTextSelection(
  articleRef: RefObject<HTMLElement | null>,
  scrollRef: RefObject<HTMLElement | null>,
): SelectionState & { hidePopover: () => void } {
  const [state, setState] = useState<SelectionState>({ text: "", pos: null });

  useEffect(() => {
    const onSelection = (): void => {
      const sel = window.getSelection();
      const article = articleRef.current;
      if (!sel || sel.isCollapsed || !article?.contains(sel.anchorNode))
        return setState({ text: "", pos: null });
      const text = sel.toString().trim();
      if (text.length < 12) return setState({ text: "", pos: null });
      try {
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        setState({
          text,
          pos: { top: rect.bottom + 10, left: clamp(rect.left, 12, window.innerWidth - 300) },
        });
      } catch {
        setState({ text, pos: null });
      }
    };
    const hide = (): void => setState((s) => (s.pos ? { ...s, pos: null } : s));
    document.addEventListener("selectionchange", onSelection);
    const scroller = scrollRef.current;
    scroller?.addEventListener("scroll", hide);
    window.addEventListener("scroll", hide);
    return () => {
      document.removeEventListener("selectionchange", onSelection);
      scroller?.removeEventListener("scroll", hide);
      window.removeEventListener("scroll", hide);
    };
  }, [articleRef, scrollRef]);

  return { ...state, hidePopover: () => setState((s) => ({ ...s, pos: null })) };
}

/** Progreso de lectura (0..1) según el scroll; solo avanza. `onChange` lo persiste con debounce. */
export function useReadingProgress(
  articleRef: RefObject<HTMLElement | null>,
  scrollRef: RefObject<HTMLElement | null>,
  initial: number,
  onChange: (p: number) => void,
): number {
  const [progress, setProgress] = useState(initial);
  const persist = useEffectEvent(onChange);

  useEffect(() => {
    const calc = (): void => {
      const article = articleRef.current;
      const scroller = scrollRef.current;
      if (!article || !scroller) return;
      const rect = article.getBoundingClientRect();
      const container =
        scroller.scrollHeight > scroller.clientHeight + 4
          ? scroller.getBoundingClientRect()
          : { bottom: window.innerHeight };
      const next = clamp((container.bottom - rect.top) / Math.max(rect.height, 1), 0, 1);
      setProgress((prev) => Math.max(prev, next));
    };
    const scroller = scrollRef.current;
    scroller?.addEventListener("scroll", calc);
    window.addEventListener("scroll", calc);
    calc();
    return () => {
      scroller?.removeEventListener("scroll", calc);
      window.removeEventListener("scroll", calc);
    };
  }, [articleRef, scrollRef]);

  useEffect(() => {
    const timer = setTimeout(() => persist(progress), 400);
    return () => clearTimeout(timer);
  }, [progress]);

  return progress;
}

interface HotkeyDeps {
  /** Qué hace cada atajo. Un id sin handler no hace nada y deja la tecla al navegador. */
  handlers: Partial<Record<ShortcutId, () => void>>;
  singleKey: boolean;
}

/** Despacha las teclas según la tabla de `lib/keymap`. */
export function useReaderHotkeys(deps: HotkeyDeps): void {
  const handle = useEffectEvent((e: KeyboardEvent) => {
    const id = matchShortcut(e, { singleKey: deps.singleKey });
    const run = id ? deps.handlers[id] : undefined;
    if (!id || !run) return;
    // Con un diálogo modal abierto el documento de atrás no se navega: solo Esc (silenciar) sigue vivo.
    if (id !== "silence" && document.querySelector('[aria-modal="true"]')) return;
    // Esc silencia la voz, pero también cierra diálogos y desplegables: no se le quita ese uso.
    if (id !== "silence") e.preventDefault();
    run();
  });

  useEffect(() => {
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, []);
}
