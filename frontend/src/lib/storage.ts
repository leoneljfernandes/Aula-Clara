/** localStorage con try/catch: en modo privado o con el almacenamiento bloqueado, la app sigue andando. */
export const storage = {
  get<T>(key: string): T | null {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  /** Si hay algo guardado en `key`, sea o no JSON válido. */
  has(key: string): boolean {
    try {
      return window.localStorage.getItem(key) !== null;
    } catch {
      return false;
    }
  },
  set(key: string, value: unknown): void {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // sin espacio o bloqueado: se pierde la persistencia, no la funcionalidad
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // idem
    }
  },
};
