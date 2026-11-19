import type { CSSProperties, ReactNode } from "react";

import { Button } from "@/components/Button";
import { VoiceConsentDialog } from "@/components/VoiceConsentDialog";

import { useLiveCaptions } from "./useLiveCaptions";

/** Cuántos caracteres de lo último que se dijo se mandan al asistente para explicarlos. */
const EXPLAIN_CHARS = 1500;

/** Subtítulos en vivo de la clase: se empiezan y se detienen a mano, y no se guardan en ningún lado. */
export function LiveCaptions({
  onExplain,
  style,
}: {
  onExplain: (fragment: string) => void;
  style: CSSProperties;
}): ReactNode {
  const captions = useLiveCaptions();

  return (
    <section
      aria-labelledby="live-captions-title"
      className="shrink-0 space-y-3 border-b-2 border-[var(--border)] p-4 lg:max-h-[40vh] lg:overflow-y-auto"
    >
      {captions.available ? (
        <>
          {/* Una sola fila hasta que haya subtítulos: el chat conserva el alto que necesita. */}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <h2 id="live-captions-title" className="text-lg font-bold">
              <span aria-hidden="true">💬</span> Subtítulos en vivo (clase)
            </h2>
            <Button
              variant="primary"
              className="min-h-11 grow sm:grow-0"
              onClick={captions.active ? captions.stop : captions.start}
            >
              {captions.active ? "Detener subtítulos" : "Empezar subtítulos"}
            </Button>
          </div>
          {(captions.lines.length > 0 || captions.interim) && (
            <>
              <div style={style} className="max-h-48 space-y-2 overflow-y-auto">
                {captions.lines.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
                {captions.interim && <p className="text-[var(--muted)]">{captions.interim}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button className="grow" onClick={() => onExplain(captions.lastText(EXPLAIN_CHARS))}>
                  <span aria-hidden="true">✦</span> Explicar en lenguaje claro lo último
                </Button>
                <Button onClick={captions.clear}>Borrar</Button>
              </div>
            </>
          )}
          <p role="status" className="text-base empty:hidden">
            {captions.error}
          </p>
          {captions.consented && !captions.active && (
            <Button onClick={captions.revokeConsent}>Revocar permiso del micrófono</Button>
          )}
        </>
      ) : (
        <>
          <h2 id="live-captions-title" className="text-lg font-bold">
            <span aria-hidden="true">💬</span> Subtítulos en vivo (clase)
          </h2>
          <p>
            Tu navegador no permite subtítulos en vivo. Probá Chrome o Edge, o usá los subtítulos del sistema
            (Transcripción Instantánea en Android, subtítulos en vivo de Windows 11).
          </p>
        </>
      )}
      {captions.consentOpen && (
        <VoiceConsentDialog
          kind="captions"
          onAccept={captions.acceptConsent}
          onCancel={captions.cancelConsent}
        />
      )}
    </section>
  );
}
