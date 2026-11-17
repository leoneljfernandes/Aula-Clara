import { extractDocx } from "./docx";
import { extractPdf } from "./pdf";
import { type ExtractedDocument, ImportError } from "./types";

export { type Block, type ExtractedDocument, ImportError } from "./types";
export { blobToDataUrl, dataUrlToBlob, resizeImage, svgToJpeg } from "./image";

export type FileKind = "PDF" | "Word";

const MAX_FILE_BYTES = 30 * 1024 * 1024;

const extension = (name: string): string => name.split(".").pop()?.toLowerCase() ?? "";

/** PDF y DOCX se procesan en el navegador. PPTX y Word antiguo quedan fuera del MVP, con un mensaje claro. */
export function detectKind(file: File): FileKind {
  switch (extension(file.name)) {
    case "pdf":
      return "PDF";
    case "docx":
      return "Word";
    case "ppt":
    case "pptx":
      throw new ImportError(
        "unsupported",
        "Las presentaciones de PowerPoint todavía no se pueden leer. Guardalas como PDF y subilas de nuevo.",
      );
    case "doc":
      throw new ImportError(
        "unsupported",
        "El formato Word antiguo (.doc) no es compatible. Abrilo en Word y guardalo como .docx.",
      );
    default:
      throw new ImportError(
        "unsupported",
        "Este tipo de archivo no es compatible. Subí un PDF o un Word (.docx).",
      );
  }
}

export async function extractFile(file: File): Promise<{ kind: FileKind; doc: ExtractedDocument }> {
  const kind = detectKind(file);
  if (file.size > MAX_FILE_BYTES) {
    throw new ImportError("too_large", "El archivo pesa más de 30 MB. Probá con uno más liviano.");
  }
  const title = file.name.replace(/\.[^.]+$/, "");
  const doc = kind === "PDF" ? await extractPdf(file, title) : await extractDocx(file, title);
  return { kind, doc: { ...doc, title: title || doc.title } };
}
