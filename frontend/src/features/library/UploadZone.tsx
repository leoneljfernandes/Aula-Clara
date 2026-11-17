import { type ReactNode, useRef, useState } from "react";

import { Button } from "@/components/Button";

import { IMPORT_STEPS } from "./api";
import type { ImportState } from "./useImport";

export function UploadZone({ state }: { state: ImportState }): ReactNode {
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { processing, error, importFile, importSample } = state;

  if (processing) {
    return (
      <div className="rounded-3xl border-4 border-[var(--accent)] p-8" aria-busy="true">
        <p className="mb-1 text-xl font-bold">Procesando «{processing.name}»</p>
        <p className="mb-5 text-lg text-[var(--muted)]">
          Esto lo hacías a mano antes. Ahora tarda unos segundos.
        </p>
        <ol className="space-y-3">
          {IMPORT_STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-3 text-lg">
              <span
                aria-hidden="true"
                className={`grid h-8 w-8 place-items-center rounded-full border-2 border-[var(--accent)] ${i < processing.step ? "bg-[var(--accent)] text-[var(--onAccent)]" : ""}`}
              >
                {i < processing.step ? (
                  "✓"
                ) : i === processing.step ? (
                  <span className="spin block h-4 w-4 rounded-full border-2 border-[var(--accent)] border-t-transparent" />
                ) : (
                  ""
                )}
              </span>
              <span
                className={
                  i === processing.step ? "font-bold" : i < processing.step ? "" : "text-[var(--muted)]"
                }
              >
                {label}
              </span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const file = e.dataTransfer.files[0];
          if (file) importFile(file);
        }}
        className={`rounded-3xl border-4 border-dashed p-10 text-center transition-colors ${drag ? "border-[var(--accent)] bg-[var(--soft)]" : "border-[var(--border)]"}`}
      >
        <div aria-hidden="true" className="mb-3 text-5xl">
          ⇪
        </div>
        <p className="mb-2 text-2xl font-bold">Arrastrá tu PDF o Word aquí</p>
        <p className="mb-5 text-lg text-[var(--muted)]">o hacé clic para explorar tus archivos</p>
        <label htmlFor="file" className="sr-only">
          Elegir un archivo PDF o Word
        </label>
        <input
          ref={fileRef}
          id="file"
          type="file"
          className="sr-only"
          accept=".pdf,.doc,.docx,.ppt,.pptx"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importFile(file);
            e.target.value = ""; // permite volver a elegir el mismo archivo
          }}
        />
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            variant="primary"
            className="min-h-14 px-8 text-lg"
            onClick={() => fileRef.current?.click()}
          >
            Elegir archivo
          </Button>
          <Button className="min-h-14" onClick={importSample}>
            Probar con un archivo de ejemplo
          </Button>
        </div>
      </div>
      {error && (
        <div role="alert" className="mt-4 rounded-2xl border-2 border-[var(--accent)] p-4 text-lg">
          <p className="mb-3 font-bold">{error}</p>
          <Button onClick={importSample}>Abrir el documento de ejemplo</Button>
        </div>
      )}
    </div>
  );
}
