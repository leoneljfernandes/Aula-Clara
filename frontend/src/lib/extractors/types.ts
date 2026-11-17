/** Contenido de un documento ya procesado: lo producen los extractores y lo guarda la biblioteca. */
export type Block =
  | { type: "h2"; text: string }
  | { type: "p"; text: string }
  /** `dataUrl` ausente = figura de ejemplo (gráfico SVG del documento de muestra). */
  | { type: "figure"; id: string; dataUrl?: string; alt?: string };

export interface ExtractedDocument {
  title: string;
  blocks: Block[];
}

/** Error con un mensaje apto para mostrar tal cual a la persona. */
export class ImportError extends Error {
  override readonly name = "ImportError";
  readonly reason: "unsupported" | "scanned" | "empty" | "too_large" | "failed";

  constructor(reason: ImportError["reason"], message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.reason = reason;
  }
}
