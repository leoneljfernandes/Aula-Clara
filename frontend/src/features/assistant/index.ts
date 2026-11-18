// API pública de la feature del asistente.
export { AssistantPanel } from "./AssistantPanel";
export { AIKeysGuide } from "./AIKeysGuide";
export { AISettingsDialog } from "./AISettingsDialog";
export { type AnswerLanguage, describeImage, type Provider } from "./api";
export { describeApiError, ImageUnavailableError, needsAISetup } from "./errors";
export { useAICredentials } from "./credentials";
export { LiveCaptions } from "./LiveCaptions";
export { ProviderBadge } from "./ProviderBadge";
export { type Chat, useChat } from "./useChat";
export { definePrompt, explainPrompt, quickActionLabel } from "./quickActions";
