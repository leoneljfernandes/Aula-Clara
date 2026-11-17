/** Almacén clave-valor mínimo sobre IndexedDB: guarda el texto extraído (localStorage tiene ~5 MB). */
const DB_NAME = "aulaclara";
const STORE = "content";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexedDB open failed"));
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("indexedDB request failed"));
    });
  } finally {
    db.close();
  }
}

export const idb = {
  get: <T>(key: string): Promise<T | undefined> => run<T | undefined>("readonly", (s) => s.get(key)),
  set: (key: string, value: unknown): Promise<IDBValidKey> => run("readwrite", (s) => s.put(value, key)),
  remove: (key: string): Promise<undefined> => run("readwrite", (s) => s.delete(key)),
};
