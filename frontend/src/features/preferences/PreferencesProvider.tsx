import { createContext, type ReactNode, use, useCallback, useEffect, useState } from "react";

import { installClickGuard } from "@/lib/clickGuard";

import { THEMES } from "./config";
import { DEFAULT_SETTINGS, type ReadingSettings } from "./settings";
import { isOnboarded, loadSettings, markOnboarded, saveSettings } from "./storage";

interface Preferences {
  /** Lo que se ve: el borrador si hay uno abierto, si no los ajustes confirmados. */
  settings: ReadingSettings;
  onboarded: boolean;
  /** Cambia algunos campos y conserva el resto (los controles de ajuste). */
  updateSettings: (patch: Partial<ReadingSettings>) => void;
  /** Reemplaza todos los ajustes (elegir un preset no arrastra nada del anterior). */
  replaceSettings: (next: ReadingSettings) => void;
  /**
   * Marca el onboarding como hecho y guarda los ajustes (confirma el borrador si hay uno).
   * No guarda qué perfil se eligió.
   */
  completeOnboarding: () => void;
  /**
   * Abre un borrador con los ajustes actuales: los cambios se ven en vivo pero no se guardan hasta
   * `completeOnboarding()`. Si ya hay uno abierto, no hace nada. Es estable entre renders.
   */
  beginDraft: () => void;
  /** Cierra el borrador sin confirmarlo: vuelven los ajustes de antes de abrirlo. Es estable entre renders. */
  discardDraft: () => void;
}

interface SettingsState {
  /** Lo que usa la app y, con el onboarding hecho, lo que está guardado en localStorage. */
  committed: ReadingSettings;
  /** Ajustes en prueba mientras el wizard está abierto; `null` sin borrador. */
  draft: ReadingSettings | null;
}

const PreferencesContext = createContext<Preferences | null>(null);

/** Los cambios van al borrador si hay uno abierto; si no, a los ajustes confirmados. */
function withSettings(
  state: SettingsState,
  change: (current: ReadingSettings) => ReadingSettings,
): SettingsState {
  return state.draft
    ? { ...state, draft: change(state.draft) }
    : { ...state, committed: change(state.committed) };
}

/** Ajustes de lectura: cambian poco y los lee casi toda la app. Se persisten en localStorage. */
export function PreferencesProvider({ children }: { children: ReactNode }): ReactNode {
  const [state, setState] = useState<SettingsState>(() => ({ committed: loadSettings(), draft: null }));
  const [onboarded, setOnboarded] = useState<boolean>(isOnboarded);
  const { committed, draft } = state;

  // Terminar el onboarding es lo que "activa" la persistencia de ajustes (como en el prototipo).
  // Un borrador nunca se guarda: solo los ajustes confirmados. Es el único lugar que guarda ajustes.
  useEffect(() => {
    if (onboarded) saveSettings(committed);
  }, [committed, onboarded]);

  // useCallback por identidad (no por optimización): el efecto de useSettingsDraft depende de estas
  // funciones; si cambiaran en cada render, descartaría y reabriría el borrador a cada cambio.
  const beginDraft = useCallback(() => setState((s) => (s.draft ? s : { ...s, draft: s.committed })), []);
  const discardDraft = useCallback(() => setState((s) => (s.draft ? { ...s, draft: null } : s)), []);

  const value: Preferences = {
    settings: draft ?? committed,
    onboarded,
    updateSettings: (patch) => setState((s) => withSettings(s, (current) => ({ ...current, ...patch }))),
    replaceSettings: (next) => setState((s) => withSettings(s, () => next)),
    completeOnboarding: () => {
      // El efecto de arriba guarda los ajustes confirmados en cuanto se aplica este cambio.
      setState((s) => ({ committed: s.draft ?? s.committed, draft: null }));
      setOnboarded(true);
      markOnboarded();
    },
    beginDraft,
    discardDraft,
  };
  return <PreferencesContext value={value}>{children}</PreferencesContext>;
}

export function usePreferences(): Preferences {
  const prefs = use(PreferencesContext);
  if (!prefs) throw new Error("usePreferences must be used inside <PreferencesProvider>");
  return prefs;
}

/**
 * Mientras el componente que lo llama está montado, los ajustes son un borrador: se ven en vivo pero
 * no se guardan. `completeOnboarding()` lo confirma; desmontarse sin confirmar (salir del wizard sin
 * terminar) lo descarta y vuelven los ajustes de antes.
 */
export function useSettingsDraft(): void {
  const { beginDraft, discardDraft } = usePreferences();
  useEffect(() => {
    beginDraft();
    return discardDraft;
  }, [beginDraft, discardDraft]);
}

/** Aplica el tema elegido como variables CSS (--bg, --fg, --accent…) a todo lo que contiene. */
export function ThemeScope({ children }: { children: ReactNode }): ReactNode {
  const { settings } = usePreferences();
  const theme = THEMES[settings.theme] ?? THEMES[DEFAULT_SETTINGS.theme];
  const vars = Object.fromEntries(Object.entries(theme.vars).map(([k, v]) => [`--${k}`, v]));

  useEffect(() => {
    document.body.style.background = theme.vars.bg;
  }, [theme]);

  // Filtro de clics dobles involuntarios: 350 ms («normal») o 700 ms («strong»).
  const guard = settings.clickGuard;
  useEffect(() => {
    if (guard === "off") return;
    return installClickGuard(document, guard === "strong" ? 700 : 350);
  }, [guard]);

  return (
    <div
      style={vars}
      data-ui-scale={settings.uiScale}
      className="min-h-screen bg-[var(--bg)] text-[var(--fg)]"
    >
      {children}
    </div>
  );
}
