import type { ReactNode } from "react";

import { useAnnounce } from "@/lib/announcer";

import { THEME_ORDER, THEMES } from "./config";
import { usePreferences } from "./PreferencesProvider";

export function ThemeButtons({ compact = false }: { compact?: boolean }): ReactNode {
  const { settings, updateSettings } = usePreferences();
  const announce = useAnnounce();
  return (
    <div
      className={`grid gap-2 ${compact ? "grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-1" : "grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3"}`}
      role="group"
      aria-label="Tema de color"
    >
      {THEME_ORDER.map((id) => {
        const theme = THEMES[id];
        const active = settings.theme === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => {
              updateSettings({ theme: id });
              announce(`Tema ${theme.label}`);
            }}
            className={`flex min-h-[52px] min-w-0 items-center gap-2 rounded-xl border-2 py-1 text-left font-bold ${compact ? "px-2 text-[15px]" : "px-3 text-[16px]"} ${active ? "border-[var(--accent)] bg-[var(--soft)]" : "border-[var(--border)] hover:bg-[var(--soft)]"}`}
            style={active ? { boxShadow: "inset 0 0 0 2px var(--accent)" } : undefined}
          >
            <span
              aria-hidden="true"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 text-sm font-bold"
              style={{ background: theme.swatch[0], color: theme.swatch[1], borderColor: theme.swatch[1] }}
            >
              Aa
            </span>
            <span className="min-w-0 leading-tight break-words">{theme.label}</span>
          </button>
        );
      })}
    </div>
  );
}
