import type { ReactNode } from "react";

import type { VoiceCommands } from "./useVoiceCommands";

type BarState = Pick<VoiceCommands, "available" | "listening" | "paused" | "heard" | "error">;

const Mic = (): ReactNode => <span aria-hidden="true">🎙</span>;

/**
 * Estado del micrófono (solo visual) y región anunciada con el resultado de lo dicho. El estado no se anuncia:
 * un lector de pantalla con parlantes diría «Escuchando…» justo ante el micrófono recién abierto, y esa sería la
 * única frase que se oiría. Los sonidos de encendido y apagado ya avisan del estado.
 */
export function VoiceCommandBar({ available, listening, paused, heard, error }: BarState): ReactNode {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b-2 border-[var(--border)] bg-[var(--soft)] px-4 py-2 text-base lg:px-5">
      {available && (
        <span aria-hidden="true" className="font-bold">
          <Mic /> {listening ? "Escuchando…" : "Micrófono apagado"}
        </span>
      )}
      {/* Solo resultados y errores: cambia con lo que la persona hace o dice, no con la voz de la app. */}
      <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {available ? (
          <>
            {heard && (
              <span>
                {heard.understood
                  ? `"${heard.text}" ✓`
                  : `"${heard.text}" ✗ ${heard.note ?? "No entendí ese comando"}`}
              </span>
            )}
            {error && <span>{error}</span>}
          </>
        ) : (
          <span>Tu navegador no permite comandos por voz. Probá Chrome, Edge o Safari.</span>
        )}
      </div>
      {paused && (
        <span aria-hidden="true" className="text-[var(--muted)]">
          En pausa mientras habla la app
        </span>
      )}
    </div>
  );
}
