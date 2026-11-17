import type { ReactNode } from "react";
import { Link } from "react-router";

import { ProgressBar } from "@/components/ProgressBar";

import type { LibraryDocument } from "./types";

const BADGE: Record<LibraryDocument["type"], string> = { PDF: "PDF", Word: "DOC", PowerPoint: "PPT" };

const formatDate = (iso: string): string =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export function RecentDocuments({
  docs,
  query,
}: {
  docs: readonly LibraryDocument[];
  query: string;
}): ReactNode {
  const needle = query.toLowerCase();
  const filtered = docs.filter((d) => `${d.title} ${d.subject}`.toLowerCase().includes(needle));
  return (
    <>
      <div className="mt-12 mb-4 flex items-end justify-between">
        <h2 className="text-2xl font-bold">Documentos recientes</h2>
        <span className="text-[var(--muted)]">
          {filtered.length} {filtered.length === 1 ? "documento" : "documentos"}
        </span>
      </div>
      {filtered.length === 0 ? (
        <p className="rounded-2xl border-2 border-[var(--border)] p-6 text-lg">
          No hay documentos que coincidan con «{query}».
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {filtered.map((d) => {
            const label = `${d.progress > 0 ? "Continuar leyendo" : "Empezar a leer"}`;
            return (
              <li
                key={d.id}
                className="flex flex-col gap-4 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] p-5"
              >
                <div className="flex items-start gap-4">
                  <span
                    aria-hidden="true"
                    className="grid h-14 w-12 shrink-0 place-items-center rounded-lg border-2 border-[var(--border)] bg-[var(--panel)] text-xs font-bold"
                  >
                    {BADGE[d.type]}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-xl leading-snug font-bold">{d.title}</h3>
                    <p className="text-base text-[var(--muted)]">
                      {d.subject} · {d.type} · {formatDate(d.date)}
                    </p>
                  </div>
                </div>
                <ProgressBar value={d.progress} label={`Progreso de lectura de ${d.title}`} />
                <Link
                  to={`/leer/${d.id}`}
                  aria-label={`${label} ${d.title}`}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-[var(--accent)] bg-[var(--accent)] px-4 text-[17px] font-bold text-[var(--onAccent)] hover:brightness-110"
                >
                  {label} →
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
