import { createContext, type ReactNode, use, useEffect, useState } from "react";

import { THEMES } from "./config";
import { DEFAULT_SETTINGS, type ReadingSettings } from "./settings";
import { isOnboarded, loadSettings, markOnboarded, saveSettings } from "./storage";

interface Preferences {
  settings: ReadingSettings;
  onboarded: boolean;
  /** Cambia algunos campos y conserva el resto (los controles de ajuste). */
  updateSettings: (patch: Partial<ReadingSettings>) => void;
  /** Reemplaza todos los ajustes (elegir un preset no arrastra nada del anterior). */
  replaceSettings: (next: ReadingSettings) => void;
  /** Marca el onboarding como hecho y guarda los ajustes. No guarda qué perfil se eligió. */
  completeOnboarding: () => void;
}

const PreferencesContext = createContext<Preferences | null>(null);

/** Ajustes de lectura: cambian poco y los lee casi toda la app. Se persisten en localStorage. */
export function PreferencesProvider({ children }: { children: ReactNode }): ReactNode {
  const [settings, setSettings] = useState<ReadingSettings>(loadSettings);
  const [onboarded, setOnboarded] = useState<boolean>(isOnboarded);

  // Terminar el onboarding es lo que "activa" la persistencia de ajustes (como en el prototipo).
  useEffect(() => {
    if (onboarded) saveSettings(settings);
  }, [settings, onboarded]);

  const value: Preferences = {
    settings,
    onboarded,
    updateSettings: (patch) => setSettings((s) => ({ ...s, ...patch })),
    replaceSettings: (next) => setSettings(next),
    completeOnboarding: () => {
      setOnboarded(true);
      markOnboarded();
      saveSettings(settings);
    },
  };
  return <PreferencesContext value={value}>{children}</PreferencesContext>;
}

export function usePreferences(): Preferences {
  const prefs = use(PreferencesContext);
  if (!prefs) throw new Error("usePreferences must be used inside <PreferencesProvider>");
  return prefs;
}

/** Aplica el tema elegido como variables CSS (--bg, --fg, --accent…) a todo lo que contiene. */
export function ThemeScope({ children }: { children: ReactNode }): ReactNode {
  const { settings } = usePreferences();
  const theme = THEMES[settings.theme] ?? THEMES[DEFAULT_SETTINGS.theme];
  const vars = Object.fromEntries(Object.entries(theme.vars).map(([k, v]) => [`--${k}`, v]));

  useEffect(() => {
    document.body.style.background = theme.vars.bg;
  }, [theme]);

  return (
    <div style={vars} className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      {children}
    </div>
  );
}
