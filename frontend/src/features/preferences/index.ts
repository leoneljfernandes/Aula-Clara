// API pública de la feature de preferencias.
export {
  clamp,
  FONTS,
  type FontId,
  MAX_FS,
  MIN_FS,
  PROFILES,
  type Profile,
  RATES,
  readingStyle,
  THEME_ORDER,
  THEMES,
  type ThemeId,
} from "./config";
export { homeLoader, requireProfile, safeNext } from "./guards";
export { OnboardingWizard } from "./OnboardingWizard";
export { applyPreset, loadPresetCatalog, matchPreset, type Preset, type PresetCatalog } from "./presets";
export { PreferencesProvider, ThemeScope, usePreferences } from "./PreferencesProvider";
export {
  DEFAULT_SETTINGS,
  LINE_HEIGHT,
  type ReadingSettings,
  sanitizePatch,
  sanitizeSettings,
  SETTINGS_SCHEMA_VERSION,
  snakeToCamelKeys,
} from "./settings";
export { isOnboarded, loadProfileId, loadSettings, markOnboarded, saveSettings } from "./storage";
export { ThemeButtons } from "./ThemeButtons";
