import { createContext, type ReactNode, use, useEffect, useState } from "react";

import { type Profile, THEMES } from "./config";
import { DEFAULT_SETTINGS, type ReadingSettings } from "./settings";
import { loadProfileId, loadSettings, saveProfileId, saveSettings } from "./storage";

interface Preferences {
  settings: ReadingSettings;
  profile: Profile["id"] | null;
  updateSettings: (patch: Partial<ReadingSettings>) => void;
  saveProfile: (id: Profile["id"]) => void;
}

const PreferencesContext = createContext<Preferences | null>(null);

/** Perfil y ajustes de lectura: cambian poco y los lee casi toda la app. Se persisten en localStorage. */
export function PreferencesProvider({ children }: { children: ReactNode }): ReactNode {
  const [settings, setSettings] = useState<ReadingSettings>(loadSettings);
  const [profile, setProfile] = useState<Profile["id"] | null>(loadProfileId);

  // El perfil guardado es lo que "activa" la persistencia de ajustes (como en el prototipo).
  useEffect(() => {
    if (profile) saveSettings(settings);
  }, [settings, profile]);

  const value: Preferences = {
    settings,
    profile,
    updateSettings: (patch) => setSettings((s) => ({ ...s, ...patch })),
    saveProfile: (id) => {
      setProfile(id);
      saveProfileId(id);
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
