import { useSyncExternalStore } from "react";

import { PROVIDERS, type ProviderId } from "./providers";

/**
 * Lo que la app recuerda de la configuración de IA, en uno de dos modos:
 * - **cookie** (`sealed: true`): la key está sellada en una cookie `HttpOnly` que solo el servidor puede
 *   abrir. Acá no hay ninguna key: solo proveedor y modelo, que no son secretos.
 * - **headers** (`apiKey`): la key vive en este navegador y viaja en cada consulta. Es el respaldo cuando
 *   el servidor no tiene la key sellada activada o el navegador no acepta la cookie.
 */
export interface AICredentials {
  provider: ProviderId;
  model: string;
  /** true = localStorage (sobrevive al cierre); false = sessionStorage (se borra al cerrar la pestaña). */
  remember: boolean;
  /** Modo de headers: la key de la persona. */
  apiKey?: string;
  /** Modo de cookie: la key está sellada en el servidor y no se puede leer desde la página. */
  sealed?: true;
}

const KEY = "aulaclara.ai";
const listeners = new Set<() => void>();
let cached: { raw: string | null; value: AICredentials | null } = { raw: null, value: null };

function readRaw(): string | null {
  try {
    return window.sessionStorage.getItem(KEY) ?? window.localStorage.getItem(KEY);
  } catch {
    return null; // almacenamiento bloqueado: se comporta como si no hubiera key
  }
}

function parse(raw: string | null): AICredentials | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<AICredentials>;
    const known = PROVIDERS.some((p) => p.id === v.provider);
    if (!known || typeof v.model !== "string" || !v.model) return null;
    const base = { provider: v.provider!, model: v.model, remember: v.remember === true };
    if (v.sealed === true) return { ...base, sealed: true }; // sin key: nunca se lee una de acá
    if (typeof v.apiKey === "string" && v.apiKey) return { ...base, apiKey: v.apiKey };
    return null;
  } catch {
    return null;
  }
}

function write(fn: () => void): void {
  try {
    fn();
  } catch {
    // sin espacio o bloqueado: la configuración vale solo mientras esté la página abierta
  }
}

function notify(): void {
  for (const listener of listeners) listener();
}

export const aiCredentials = {
  /** Instantánea estable (misma referencia mientras no cambie lo guardado), como pide useSyncExternalStore. */
  get(): AICredentials | null {
    const raw = readRaw();
    if (raw !== cached.raw) cached = { raw, value: parse(raw) };
    return cached.value;
  },
  save(credentials: AICredentials): void {
    const raw = JSON.stringify(credentials);
    write(() => {
      const [keep, drop] = credentials.remember
        ? [window.localStorage, window.sessionStorage]
        : [window.sessionStorage, window.localStorage];
      drop.removeItem(KEY);
      keep.setItem(KEY, raw);
    });
    notify();
  },
  clear(): void {
    write(() => {
      window.sessionStorage.removeItem(KEY);
      window.localStorage.removeItem(KEY);
    });
    notify();
  },
  /** Avisa los cambios de esta pestaña y, con `localStorage`, los de otras pestañas (evento `storage`). */
  subscribe(listener: () => void): () => void {
    const onStorage = (event: StorageEvent): void => {
      if (event.key === KEY || event.key === null) listener(); // null: se borró todo el almacenamiento
    };
    listeners.add(listener);
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  },
};

export function useAICredentials(): AICredentials | null {
  return useSyncExternalStore(aiCredentials.subscribe, aiCredentials.get, () => null);
}
