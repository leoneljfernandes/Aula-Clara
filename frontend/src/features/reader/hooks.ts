import { type RefObject, useEffect, useEffectEvent, useState } from "react";

import { clamp, MAX_FS, MIN_FS, THEME_ORDER, THEMES, type ReadingSettings } from "@/features/preferences";
import { useAnnounce } from "@/lib/announcer";
import type { ReadAloud } from "@/lib/useReadAloud";

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
  audio: ReadAloud;
  settings: ReadingSettings;
  updateSettings: (patch: Partial<ReadingSettings>) => void;
  focusChat: () => void;
}

/** Alt+P leer/pausar · Alt+S detener · Alt+= / Alt+− tamaño · Alt+T tema · Alt+A asistente. */
export function useReaderHotkeys(deps: HotkeyDeps): void {
  const announce = useAnnounce();
  const handle = useEffectEvent((e: KeyboardEvent) => {
    if (!e.altKey) return;
    const { audio, settings, updateSettings, focusChat } = deps;
    const key = e.code;
    if (key === "KeyP") {
      if (audio.status === "playing") audio.pause();
      else audio.play();
    } else if (key === "KeyS") audio.stop();
    else if (key === "Equal" || key === "NumpadAdd")
      updateSettings({ fontSize: clamp(settings.fontSize + 2, MIN_FS, MAX_FS) });
    else if (key === "Minus" || key === "NumpadSubtract")
      updateSettings({ fontSize: clamp(settings.fontSize - 2, MIN_FS, MAX_FS) });
    else if (key === "KeyT") {
      const next = THEME_ORDER[(THEME_ORDER.indexOf(settings.theme) + 1) % THEME_ORDER.length] ?? "claro";
      updateSettings({ theme: next });
      announce(`Tema ${THEMES[next].label}`);
    } else if (key === "KeyA") focusChat();
    else return;
    e.preventDefault();
  });

  useEffect(() => {
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, []);
}
