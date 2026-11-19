import { type ReactNode, useState } from "react";
import { Link } from "react-router";

import { KeysDialog } from "@/components/KeysDialog";
import { Logo } from "@/components/Logo";

import { RecentDocuments } from "./RecentDocuments";
import type { LibraryDocument } from "./types";
import { UploadZone } from "./UploadZone";
import { useImport } from "./useImport";

// Los textos no se parten dentro de un botón: si no entran, el botón pasa a la fila siguiente.
const NAV_ITEM =
  "flex min-h-12 items-center gap-3 rounded-xl px-4 text-left font-bold whitespace-nowrap hover:bg-[var(--soft)]";

export function LibraryScreen({ documents }: { documents: readonly LibraryDocument[] }): ReactNode {
  const [query, setQuery] = useState("");
  const [showKeys, setShowKeys] = useState(false);
  const importState = useImport();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      {/* Mobile primero: el logo arriba y el menú debajo, en filas que pueden envolver. En escritorio, columna lateral. */}
      <aside className="flex flex-col gap-3 border-b-2 border-[var(--border)] bg-[var(--panel)] p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-6 sm:p-5 lg:flex-col lg:items-stretch lg:justify-start lg:border-r-2 lg:border-b-0">
        <Logo />
        <nav aria-label="Principal" className="flex flex-wrap gap-2 lg:flex-col">
          <a
            href="#contenido"
            aria-current="page"
            className="flex min-h-12 items-center gap-3 rounded-xl bg-[var(--accent)] px-4 font-bold text-[var(--onAccent)]"
          >
            <span aria-hidden="true">▤</span> Mi biblioteca
          </a>
          <Link to="/perfil" className={NAV_ITEM}>
            <span aria-hidden="true">⚙</span> Perfil de accesibilidad
          </Link>
          <button type="button" onClick={() => setShowKeys(true)} className={`hidden sm:flex ${NAV_ITEM}`}>
            <span aria-hidden="true">⌨</span> Atajos de teclado
          </button>
        </nav>
      </aside>

      <div className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b-2 border-[var(--border)] px-4 py-4 sm:px-6 sm:py-5 lg:px-10">
          <h1 className="text-2xl font-bold sm:text-3xl">
            Hola <span aria-hidden="true">👋</span>
          </h1>
          <div className="flex min-w-0 basis-full items-center gap-3 sm:basis-auto">
            <label htmlFor="buscar" className="sr-only">
              Buscar documentos
            </label>
            <input
              id="buscar"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar documentos…"
              className="min-h-12 min-w-0 flex-1 rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-4 text-[var(--fg)] placeholder:text-[var(--muted)] sm:w-72 sm:flex-none"
            />
            <Link
              to="/perfil"
              aria-label="Abrir perfil de accesibilidad"
              className="hidden min-h-12 items-center gap-2 rounded-xl border-2 border-[var(--border)] px-4 font-bold hover:bg-[var(--soft)] sm:inline-flex"
            >
              <span aria-hidden="true">👤</span>
              <span>Perfil</span>
            </Link>
          </div>
        </header>

        <main id="contenido" tabIndex={-1} className="max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
          <h2 className="mb-4 text-2xl font-bold">Subir material</h2>
          <UploadZone state={importState} />
          <p className="mt-4 rounded-xl border-2 border-[var(--border)] p-3 text-base text-[var(--muted)]">
            <strong className="text-[var(--fg)]">Privacidad:</strong> no subas documentos con datos
            personales. Cuando usás el asistente, el texto que consultás se envía a un servicio de IA
            gratuito, que puede usarlo para mejorar sus productos.
          </p>
          <RecentDocuments docs={documents} query={query} />
        </main>
      </div>
      {showKeys && <KeysDialog onClose={() => setShowKeys(false)} />}
    </div>
  );
}
