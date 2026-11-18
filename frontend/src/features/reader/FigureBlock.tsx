import { type ReactNode, useRef, useState } from "react";

import { Button } from "@/components/Button";
import { Dialog } from "@/components/Dialog";
import {
  AISettingsDialog,
  describeApiError,
  describeImage,
  ImageUnavailableError,
  needsAISetup,
  ProviderBadge,
  type Provider,
} from "@/features/assistant";
import { dataUrlToBlob, svgToJpeg } from "@/lib/extractors";
import { hasTTS, speakOnce } from "@/lib/speech";

import { BarChart } from "./BarChart";

interface FigureBlockProps {
  dataUrl: string | undefined;
  caption: string;
  /** Párrafo que rodea a la figura: le da contexto a la IA. */
  context: string;
  /** id del botón «Interpretar con IA»: el cursor de bloque lo enfoca al llegar a la figura. */
  buttonId?: string;
  onAskAssistant: () => void;
}

interface Result {
  text: string;
  provider: Provider;
  model: string;
  truncated: boolean;
}

export function FigureBlock({
  dataUrl,
  caption,
  context,
  buttonId,
  onAskAssistant,
}: FigureBlockProps): ReactNode {
  const svgRef = useRef<SVGSVGElement>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [failure, setFailure] = useState<{ message: string; needsSetup: boolean } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  /** La imagen a enviar, o null si no se pudo armar (distinto de un error de la IA). */
  const prepareImage = async (): Promise<Blob | null> => {
    try {
      if (dataUrl) return await dataUrlToBlob(dataUrl);
      return svgRef.current ? await svgToJpeg(svgRef.current) : null;
    } catch {
      return null;
    }
  };

  const analyze = async (): Promise<void> => {
    if (loading) return;
    if (result) return setOpen(true);
    setLoading(true);
    setFailure(null);
    try {
      const blob = await prepareImage();
      if (!blob) throw new ImageUnavailableError();
      setResult(await describeImage(blob, context));
    } catch (error) {
      setFailure({ message: describeApiError(error), needsSetup: needsAISetup(error) });
    } finally {
      setLoading(false);
      setOpen(true);
    }
  };

  return (
    <figure className="my-10">
      <div className="relative rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] p-4">
        {dataUrl ? (
          <img
            src={dataUrl}
            alt="Imagen del documento original sin descripción alternativa. Usá el botón Interpretar con IA para escuchar o leer su contenido."
            className="mx-auto h-auto max-h-[420px] max-w-full"
          />
        ) : (
          <BarChart svgRef={svgRef} />
        )}
        <div className="absolute top-3 right-3">
          {/* aria-disabled y no disabled: un botón deshabilitado pierde el foco (va a <body>) y el
              diálogo no podría devolverlo al cerrarse. */}
          <button
            id={buttonId}
            type="button"
            onClick={() => void analyze()}
            aria-disabled={loading}
            aria-busy={loading}
            className="inline-flex min-h-[52px] items-center gap-2 rounded-xl border-2 border-[var(--onAccent)] bg-[var(--accent)] px-5 text-[17px] font-bold text-[var(--onAccent)] shadow-lg aria-disabled:cursor-wait"
            style={{ fontFamily: "'Atkinson Hyperlegible', sans-serif", letterSpacing: 0, wordSpacing: 0 }}
          >
            {loading ? (
              <>
                <span
                  className="spin block h-5 w-5 rounded-full border-[3px] border-[var(--onAccent)] border-t-transparent"
                  aria-hidden="true"
                />{" "}
                Analizando imagen…
              </>
            ) : (
              <>
                <span aria-hidden="true">👁️</span> Interpretar con IA
              </>
            )}
          </button>
        </div>
      </div>
      <figcaption className="mt-2 text-[0.8em] text-[var(--muted)]">
        {caption} <span className="italic">(imagen original sin texto alternativo)</span>
      </figcaption>
      {open && (
        <Dialog title="Interpretación de la imagen" onClose={() => setOpen(false)} labelId="img-title">
          {failure || !result ? (
            <p role="alert" className="mb-6 text-lg">
              {failure?.message ?? "No pudimos analizar esta imagen. Probá de nuevo en unos segundos."}
            </p>
          ) : (
            <>
              <p className="mb-2 leading-relaxed" style={{ fontSize: "max(18px, 0.9em)" }}>
                {result.text}
              </p>
              <div className="mb-6">
                <ProviderBadge provider={result.provider} model={result.model} />
                {result.truncated && (
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    ⚠️ La descripción se cortó porque el modelo llegó a su límite de largo.
                  </p>
                )}
              </div>
            </>
          )}
          <div className="flex flex-wrap gap-3">
            {result && hasTTS && (
              <Button variant="primary" onClick={() => speakOnce(result.text)}>
                🔊 Escuchar descripción
              </Button>
            )}
            {result && (
              <Button
                onClick={() => {
                  setOpen(false);
                  onAskAssistant();
                }}
              >
                Preguntarle al asistente
              </Button>
            )}
            {failure?.needsSetup && (
              <Button
                variant="primary"
                onClick={() => {
                  setOpen(false);
                  setSettingsOpen(true);
                }}
              >
                Configurar IA
              </Button>
            )}
            <Button onClick={() => setOpen(false)}>Cerrar</Button>
          </div>
        </Dialog>
      )}
      {settingsOpen && <AISettingsDialog onClose={() => setSettingsOpen(false)} />}
    </figure>
  );
}
