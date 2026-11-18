import type { ReactNode } from "react";

import { Dialog } from "@/components/Dialog";
import { describeKeys, KEYMAP } from "@/lib/keymap";

const FIXED_ROWS: ReadonlyArray<readonly [string, string]> = [
  ["Esc", "Cerrar ventanas"],
  ["Tab / Shift + Tab", "Moverse entre controles"],
];

const ROWS: ReadonlyArray<readonly [string, string]> = [
  ...KEYMAP.map((s) => [describeKeys(s, { singleKey: true }), s.label] as const),
  ...FIXED_ROWS,
];

export function KeysDialog({ onClose }: { onClose: () => void }): ReactNode {
  return (
    <Dialog title="Atajos de teclado" onClose={onClose} labelId="keys-title">
      <p className="mb-4 text-lg text-[var(--muted)]">
        Funcionan dentro del lector. Las de una sola tecla se activan en los ajustes, con «Atajos de una sola
        tecla».
      </p>
      <dl className="divide-y-2 divide-[var(--soft)]">
        {ROWS.map(([key, action]) => (
          <div key={`${key}-${action}`} className="flex justify-between gap-4 py-3 text-lg">
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
