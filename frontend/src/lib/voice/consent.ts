import { storage } from "@/lib/storage";

export type VoiceConsentKind = "commands" | "captions";

const KEY = "aulaclara.voiceConsent";

type Consent = Partial<Record<VoiceConsentKind, true>>;

const read = (): Consent => {
  const raw = storage.get<unknown>(KEY);
  return typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Consent) : {};
};

/** Si la persona ya aceptó, para este tipo de uso, que el navegador envíe su voz a un servicio de reconocimiento. */
export function hasVoiceConsent(kind: VoiceConsentKind): boolean {
  return read()[kind] === true;
}

export function grantVoiceConsent(kind: VoiceConsentKind): void {
  storage.set(KEY, { ...read(), [kind]: true });
}

/**
 * Retira el permiso de un tipo de uso. `captions: true` sugiere una pérdida auditiva (dato sensible, Ley 25.326):
 * vive solo en este navegador, nunca se manda al servidor, y la persona puede borrarlo cuando quiera.
 */
export function revokeVoiceConsent(kind: VoiceConsentKind): void {
  const rest = { ...read() };
  delete rest[kind];
  if (Object.keys(rest).length === 0) storage.remove(KEY);
  else storage.set(KEY, rest);
}
