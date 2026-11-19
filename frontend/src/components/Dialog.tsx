import { type ReactNode, useEffect, useEffectEvent, useRef } from "react";

import { Button } from "@/components/Button";

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  labelId: string;
}

/** Diálogo modal accesible: foco adentro, trampa de foco con Tab, cierre con Esc y foco de vuelta al cerrar. */
export function Dialog({ title, onClose, children, labelId }: DialogProps): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const close = useEffectEvent(onClose);

  useEffect(() => {
    const el = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    el?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
      if (e.key === "Tab" && el) {
        const items = el.querySelectorAll<HTMLElement>(FOCUSABLE);
        const first = items[0];
        const last = items[items.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-2 sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        className="max-h-[94dvh] w-full max-w-xl overflow-auto rounded-3xl border-4 border-[var(--accent)] bg-[var(--bg)] p-4 text-[var(--fg)] shadow-2xl sm:max-h-[90dvh] sm:p-7"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={labelId} className="min-w-0 text-xl font-bold break-words sm:text-2xl">
            {title}
          </h2>
          <Button onClick={onClose} aria-label="Cerrar">
            ✕
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
