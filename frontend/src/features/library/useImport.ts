import { useState } from "react";
import { useNavigate } from "react-router";

import { ImportError } from "@/lib/extractors";
import { useAnnounce } from "@/lib/announcer";
import { reportError } from "@/lib/telemetry";

import { IMPORT_STEPS, libraryApi } from "./api";

export interface ImportState {
  processing: { name: string; step: number } | null;
  error: string | null;
  importFile: (file: File) => void;
  importSample: () => void;
}

/** Procesa un archivo (o el de ejemplo), muestra el avance por pasos y abre el lector al terminar. */
export function useImport(): ImportState {
  const navigate = useNavigate();
  const announce = useAnnounce();
  const [processing, setProcessing] = useState<ImportState["processing"]>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (name: string, job: (onStep: (s: number) => void) => Promise<string>): Promise<void> => {
    if (processing) return;
    setError(null);
    setProcessing({ name, step: 0 });
    announce(`Procesando ${name}`);
    try {
      const id = await job((step) => setProcessing({ name, step }));
      announce("Documento listo");
      void navigate(`/leer/${id}`);
    } catch (e) {
      const message =
        e instanceof ImportError
          ? e.message
          : "No pudimos procesar este archivo. Probá con otro o con el documento de ejemplo.";
      if (!(e instanceof ImportError)) reportError(e, { scope: "library-import" });
      setError(message);
      announce(message);
    } finally {
      setProcessing(null);
    }
  };

  return {
    processing,
    error,
    importFile: (file) => void run(file.name, (onStep) => libraryApi.importFile(file, onStep)),
    importSample: () => void run("Apunte_Unidad3_escaneado.pdf", (onStep) => libraryApi.importSample(onStep)),
  };
}

export { IMPORT_STEPS };
