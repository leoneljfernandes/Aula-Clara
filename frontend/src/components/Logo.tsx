import type { ReactNode } from "react";

export function Logo(): ReactNode {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--accent)] text-xl font-bold text-[var(--onAccent)]"
      >
        A
      </span>
      <span className="text-xl font-bold tracking-tight">Aula Clara</span>
    </div>
  );
}
