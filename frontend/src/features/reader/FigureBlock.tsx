import { type ReactNode, useRef, useState } from "react";

import { Button } from "@/components/Button";
import { Dialog } from "@/components/Dialog";
import { describeImage, ProviderBadge, type Provider } from "@/features/assistant";
import { SAMPLE_FIGURE_ID } from "@/features/library";
import { dataUrlToBlob, svgToJpeg } from "@/lib/extractors";
import { hasTTS, speakOnce } from "@/lib/speech";

import { BarChart } from "./BarChart";

interface FigureBlockProps {
  id: string;
  dataUrl: string | undefined;
  caption: string;
  /** Párrafo que rodea a la figura: le da contexto a la IA. */
  context: string;
  onAskAssistant: () => void;
}

interface Result {
  text: string;
  provider: Provider;
}

export function FigureBlock({ id, dataUrl, caption, context, onAskAssistant }: FigureBlockProps): ReactNode {
  const svgRef = useRef<SVGSVGElement>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [failed, setFailed] = useState(false);

  const analyze = async (): Promise<void> => {
    if (result) return setOpen(true);
    setLoading(true);
    setFailed(false);
    try {
      const blob = dataUrl
        ? await dataUrlToBlob(dataUrl)
        : svgRef.current
          ? await svgToJpeg(svgRef.current)
          : null;
      if (!blob) throw new Error("no image");
      setResult(await describeImage(blob, context, id === SAMPLE_FIGURE_ID));
    } catch {
      setFailed(true);
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
          <button
            type="button"
            onClick={() => void analyze()}
            disabled={loading}
            aria-busy={loading}
            className="inline-flex min-h-[52px] items-center gap-2 rounded-xl border-2 border-[var(--onAccent)] bg-[var(--accent)] px-5 text-[17px] font-bold text-[var(--onAccent)] shadow-lg disabled:cursor-wait"
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
          {failed || !result ? (
            <p role="alert" className="mb-6 text-lg">
              No pudimos analizar esta imagen. Probá de nuevo en unos segundos.
            </p>
          ) : (
            <>
              <p className="mb-2 leading-relaxed" style={{ fontSize: "max(18px, 0.9em)" }}>
                {result.text}
              </p>
              <div className="mb-6">
                <ProviderBadge provider={result.provider} />
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
            <Button onClick={() => setOpen(false)}>Cerrar</Button>
          </div>
        </Dialog>
      )}
    </figure>
  );
}
