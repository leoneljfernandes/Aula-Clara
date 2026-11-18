import type { ReactNode } from "react";

import type { VoiceCommands } from "./useVoiceCommands";

type BarState = Pick<VoiceCommands, "available" | "listening" | "paused" | "heard" | "error">;

const Mic = (): ReactNode => <span aria-hidden="true">🎙</span>;

/** Estado del micrófono y de la última frase, para quien no ve la pantalla y para quien sí. */
export function VoiceCommandBar({ available, listening, paused, heard, error }: BarState): ReactNode {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b-2 border-[var(--border)] bg-[var(--soft)] px-4 py-2 text-base lg:px-5">
      {/* El texto anunciado es estable: solo cambia con lo que la persona hace o dice, no con la voz de la app. */}
      <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {available ? (
          <>
            <span className="font-bold">
              <Mic /> {listening ? "Escuchando…" : "Micrófono apagado"}
            </span>
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
