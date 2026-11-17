import type { Block } from "@/lib/extractors";

export type DocType = "PDF" | "Word" | "PowerPoint";

/** Metadatos: viven en localStorage (la fuente de verdad del usuario en el MVP). */
export interface LibraryDocument {
  id: string;
  title: string;
  subject: string;
  type: DocType;
  /** ISO 8601 (YYYY-MM-DD). */
  date: string;
  /** 0..1 */
  progress: number;
}

/** Contenido: vive en IndexedDB (puede pesar varios MB por las imágenes). */
export interface Article {
  title: string;
  meta: string;
  blocks: Block[];
}
