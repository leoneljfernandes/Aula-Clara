import type { ReactNode } from "react";

export function ProgressBar({ value, label }: { value: number; label: string }): ReactNode {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-3 flex-1 overflow-hidden rounded-full border-2 border-[var(--border)]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className="h-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 text-right text-base font-bold">{pct}%</span>
    </div>
  );
}
