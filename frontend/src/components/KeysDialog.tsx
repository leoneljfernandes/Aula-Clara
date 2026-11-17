import type { ReactNode } from "react";

import { Dialog } from "@/components/Dialog";

const ROWS: ReadonlyArray<readonly [string, string]> = [
  ["Alt + P", "Reproducir / pausar lectura"],
  ["Alt + S", "Detener lectura"],
  ["Alt + =", "Agrandar texto"],
  ["Alt + −", "Achicar texto"],
  ["Alt + T", "Cambiar tema de color"],
  ["Alt + A", "Ir al asistente"],
  ["Esc", "Cerrar ventanas"],
  ["Tab / Shift + Tab", "Moverse entre controles"],
];

export function KeysDialog({ onClose }: { onClose: () => void }): ReactNode {
  return (
    <Dialog title="Atajos de teclado" onClose={onClose} labelId="keys-title">
      <p className="mb-4 text-lg text-[var(--muted)]">Funcionan dentro del lector.</p>
      <dl className="divide-y-2 divide-[var(--soft)]">
        {ROWS.map(([key, action]) => (
          <div key={key} className="flex justify-between gap-4 py-3 text-lg">
            <dt>
              <kbd className="rounded-lg border-2 border-[var(--border)] px-2 py-1 font-bold whitespace-nowrap">
                {key}
              </kbd>
            </dt>
            <dd>{action}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
