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
  type ReadingSettings,
  THEME_ORDER,
  THEMES,
  type ThemeId,
} from "./config";
export { homeLoader, requireProfile, safeNext } from "./guards";
export { OnboardingWizard } from "./OnboardingWizard";
export { PreferencesProvider, ThemeScope, usePreferences } from "./PreferencesProvider";
export { loadProfileId } from "./storage";
export { ThemeButtons } from "./ThemeButtons";
