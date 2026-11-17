import { extractFile, ImportError } from "@/lib/extractors";
import { idb } from "@/lib/idb";
import { storage } from "@/lib/storage";

import { SAMPLE_ARTICLE, SEED_DOCUMENTS } from "./sample";
import type { Article, DocType, LibraryDocument } from "./types";

const DOCS_KEY = "aulaclara.docs";
const contentKey = (id: string): string => `article:${id}`;

export const IMPORT_STEPS = [
  "Subiendo archivo…",
  "Extrayendo texto y estructura…",
  "Aplicando tu perfil de accesibilidad…",
] as const;
export type StepCallback = (step: number) => void;

function readAll(): LibraryDocument[] {
  return storage.get<LibraryDocument[]>(DOCS_KEY) ?? [...SEED_DOCUMENTS];
}

function writeAll(docs: LibraryDocument[]): void {
  storage.set(DOCS_KEY, docs);
}

export const libraryApi = {
  list(): LibraryDocument[] {
    return readAll();
  },

  get(id: string): LibraryDocument | undefined {
    return readAll().find((d) => d.id === id);
  },

  /** Los documentos semilla no tienen contenido propio: abren el texto de ejemplo (como en el prototipo). */
  async loadArticle(id: string): Promise<Article> {
    try {
      return (await idb.get<Article>(contentKey(id))) ?? SAMPLE_ARTICLE;
    } catch {
      return SAMPLE_ARTICLE; // IndexedDB bloqueado (modo privado): se sigue con el ejemplo
    }
  },

  /** Guarda el avance sin pasar por una action: se llama muchas veces mientras se hace scroll. */
  saveProgress(id: string, progress: number): void {
    writeAll(readAll().map((d) => (d.id === id && progress > d.progress ? { ...d, progress } : d)));
  },

  async importFile(file: File, onStep: StepCallback): Promise<string> {
    onStep(0);
    onStep(1);
    const { kind, doc } = await extractFile(file);
    onStep(2);
    return add(
      { title: doc.title, type: kind },
      { title: doc.title, meta: `${kind} · ${file.name}`, blocks: doc.blocks },
    );
  },

  /** «Probar con un archivo de ejemplo»: simula el procesamiento con el texto del prototipo. */
  async importSample(onStep: StepCallback, stepMs = 650): Promise<string> {
    for (let i = 0; i < IMPORT_STEPS.length; i++) {
      onStep(i);
      await new Promise((resolve) => setTimeout(resolve, stepMs));
    }
    return add({ title: "Apunte_Unidad3_escaneado", type: "PDF" }, SAMPLE_ARTICLE);
  },
};

async function add(meta: { title: string; type: DocType }, article: Article): Promise<string> {
  const id = `u${Date.now().toString(36)}`;
  try {
    await idb.set(contentKey(id), article);
  } catch (cause) {
    throw new ImportError(
      "failed",
      "No pudimos guardar el documento en este navegador (¿modo privado o sin espacio?).",
      { cause },
    );
  }
  writeAll([
    {
      id,
      title: meta.title,
      subject: "Subido recién",
      type: meta.type,
      date: new Date().toISOString().slice(0, 10),
      progress: 0,
    },
    ...readAll(),
  ]);
  return id;
}
