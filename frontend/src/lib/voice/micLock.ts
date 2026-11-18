/**
 * El micrófono tiene un solo dueño a la vez: quien lo pide corta al anterior y le avisa. Así los comandos
 * de voz y el dictado nunca escuchan juntos, y lo que se dicta no se interpreta como un comando.
 */
export interface MicOwner {
  /** Otro tomó el micrófono: hay que soltarlo ya (el reconocedor se cierra). */
  onPreempted(): void;
}

let current: MicOwner | null = null;
const freeListeners = new Set<() => void>();

export const micLock = {
  acquire(owner: MicOwner): void {
    const previous = current;
    current = owner;
    if (previous && previous !== owner) previous.onPreempted();
  },
  /** Suelta el micrófono (si todavía es de `owner`) y avisa a quienes esperaban que quede libre. */
  release(owner: MicOwner): void {
    if (current !== owner) return;
    current = null;
    for (const listener of [...freeListeners]) listener();
  },
  /** Se llama cada vez que el micrófono queda libre. */
  onFree(listener: () => void): () => void {
    freeListeners.add(listener);
    return () => void freeListeners.delete(listener);
  },
};
