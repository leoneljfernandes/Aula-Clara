import { type ReactNode, useState } from "react";
import { Link } from "react-router";

import { KeysDialog } from "@/components/KeysDialog";
import { Logo } from "@/components/Logo";
import { PROFILES, usePreferences } from "@/features/preferences";

import { RecentDocuments } from "./RecentDocuments";
import type { LibraryDocument } from "./types";
import { UploadZone } from "./UploadZone";
import { useImport } from "./useImport";

const NAV_ITEM =
  "flex min-h-12 items-center gap-3 rounded-xl px-4 text-left font-bold hover:bg-[var(--soft)]";

export function LibraryScreen({ documents }: { documents: readonly LibraryDocument[] }): ReactNode {
  const { profile } = usePreferences();
  const [query, setQuery] = useState("");
  const [showKeys, setShowKeys] = useState(false);
  const importState = useImport();
  const profileName = PROFILES.find((p) => p.id === profile)?.title;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="flex items-center justify-between gap-6 border-b-2 border-[var(--border)] bg-[var(--panel)] p-5 lg:flex-col lg:items-stretch lg:border-r-2 lg:border-b-0">
        <Logo />
        <nav aria-label="Principal" className="flex gap-2 lg:flex-col">
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
        {profileName && (
          <div className="mt-auto hidden rounded-xl border-2 border-[var(--border)] p-4 text-base lg:block">
            <span className="block text-[var(--muted)]">Perfil activo</span>
            <span className="font-bold">{profileName}</span>
          </div>
        )}
      </aside>

      <div className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-[var(--border)] px-6 py-5 lg:px-10">
          <h1 className="text-3xl font-bold">
            Hola <span aria-hidden="true">👋</span>
          </h1>
          <div className="flex flex-1 items-center gap-3 sm:flex-none">
            <label htmlFor="buscar" className="sr-only">
              Buscar documentos
            </label>
            <input
              id="buscar"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar documentos…"
              className="min-h-12 flex-1 rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-4 text-[var(--fg)] placeholder:text-[var(--muted)] sm:w-72"
            />
            <Link
              to="/perfil"
              aria-label="Abrir perfil de accesibilidad"
              className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-[var(--border)] px-4 font-bold hover:bg-[var(--soft)]"
            >
              <span aria-hidden="true">👤</span>
              <span className="hidden sm:inline">Perfil</span>
            </Link>
          </div>
        </header>

        <main id="contenido" tabIndex={-1} className="max-w-5xl px-6 py-8 lg:px-10">
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
