import type { ReactNode } from "react";

import { Button } from "@/components/Button";
import { Dialog } from "@/components/Dialog";
import { commandCatalog } from "@/lib/voice/commands";

/** Lista de todo lo que se reconoce por voz. Las frases salen de `commandCatalog()`, no se escriben a mano acá. */
export function VoiceHelpDialog({
  mode,
  onClose,
}: {
  mode: "push" | "continuous";
  onClose: () => void;
}): ReactNode {
  return (
    <Dialog title="Comandos de voz" onClose={onClose} labelId="voice-help-title">
      <p className="mb-4 text-lg">
        Decí la frase completa, sola y sin agregar palabras. Si el micrófono no entiende, probá de nuevo más
        despacio.
      </p>
      {mode === "continuous" && (
        <p className="mb-4 rounded-xl border-2 border-[var(--border)] p-3 text-base">
          <strong>Manos libres:</strong> las acciones del asistente de IA gastan consultas de tu cuota. Decí
          antes «asistente» («asistente resumir»); la lectura y la navegación van sin prefijo. Una pregunta
          necesita al menos 3 palabras.
        </p>
      )}
      {commandCatalog().map((group) => (
        <section key={group.title} aria-labelledby={`vh-${group.title}`} className="mb-5">
          <h3 id={`vh-${group.title}`} className="mb-2 text-xl font-bold">
            {group.title}
          </h3>
          <dl className="divide-y-2 divide-[var(--soft)]">
            {group.entries.map((entry) => (
              <div key={entry.kind} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2 text-lg">
                <dt>{entry.label}</dt>
                <dd className="font-bold">{entry.phrases.map((phrase) => `«${phrase}»`).join(" · ")}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <section aria-labelledby="vh-ask" className="mb-5">
        <h3 id="vh-ask" className="mb-2 text-xl font-bold">
          Preguntas
        </h3>
        <p className="text-lg">
          Decí «preguntar» o «asistente» y a continuación tu pregunta: «preguntar qué dice la ley».
        </p>
      </section>
      <section aria-labelledby="vh-dictation" className="mb-5">
        <h3 id="vh-dictation" className="mb-2 text-xl font-bold">
          Dictar una pregunta
        </h3>
        <p className="text-lg">
          Con «Dictar pregunta» hablás y la pregunta se escribe en el campo. No se envía sola: decí «enviar»
          (o tocá «Enviar») para mandarla.
        </p>
      </section>
      <p className="mb-5 text-base text-[var(--muted)]">
        Necesita Chrome, Edge o Safari: Firefox no tiene reconocimiento de voz.
      </p>
      <Button onClick={onClose}>Cerrar</Button>
    </Dialog>
  );
}
