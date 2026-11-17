import type { ReactNode } from "react";

/** Primer elemento enfocable de cada página: salta la navegación hasta el contenido. */
export function SkipLink({ targetId = "contenido" }: { targetId?: string }): ReactNode {
  return (
    <a
      href={`#${targetId}`}
      className="skip-link rounded-xl bg-[var(--accent)] px-4 py-3 font-bold text-[var(--onAccent)]"
    >
      Saltar al contenido
    </a>
  );
}
