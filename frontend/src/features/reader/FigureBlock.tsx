import { type ReactNode, useState } from "react";

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
import type { Block } from "@/lib/extractors";
import { hasTTS, speakOnce, withNotice } from "@/lib/speech";

import { BarChart } from "./BarChart";
import { figureImageBlob } from "./figureImage";

interface FigureBlockProps {
  block: Extract<Block, { type: "figure" }>;
  /** Posición del bloque en el artículo (para encontrar el gráfico dibujado en `#blk-{index}`). */
  index: number;
  /** Descripción guardada de la figura: con ella, «Interpretar con IA» no vuelve a pedir nada a la API. */
  alt?: string | undefined;
  /** Avisa la descripción nueva para que se guarde. */
  onDescribed(text: string): void;
  caption: string;
  /** Párrafo que rodea a la figura: le da contexto a la IA. */
  context: string;
  /** id del botón «Interpretar con IA»: el cursor de bloque lo enfoca al llegar a la figura. */
  buttonId?: string;
  /** Guía por voz: lee la descripción en voz alta apenas llega. */
  autoSpeak: boolean;
  /** Velocidad de la voz elegida en los ajustes. */
  rate: number;
  onAskAssistant: () => void;
}

const TRUNCATED_NOTICE = "La descripción se cortó porque el modelo llegó a su límite de largo.";

interface Result {
  text: string;
  provider: Provider;
  model: string;
  truncated: boolean;
}

export function FigureBlock({
  block,
  index,
  alt,
  onDescribed,
  caption,
  context,
  buttonId,
  autoSpeak,
  rate,
  onAskAssistant,
}: FigureBlockProps): ReactNode {
  const { dataUrl } = block;
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [failure, setFailure] = useState<{ message: string; needsSetup: boolean } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // `true` mientras el diálogo muestra una consulta recién hecha; si no, muestra la descripción guardada.
  const [fresh, setFresh] = useState(false);

  const closeDialog = (): void => {
    setOpen(false);
    setFresh(false);
  };

  const analyze = async (again = false): Promise<void> => {
    if (loading) return;
    if (!again && (alt || result)) {
      if (alt && autoSpeak) speakOnce(alt, rate);
      return setOpen(true);
    }
    setLoading(true);
    setFailure(null);
    setFresh(true);
    try {
      const blob = await figureImageBlob(block, index);
      if (!blob) throw new ImageUnavailableError();
      const described = await describeImage(blob, context);
      setResult(described);
      onDescribed(described.text);
      if (autoSpeak) {
        speakOnce(described.truncated ? withNotice(described.text, TRUNCATED_NOTICE) : described.text, rate);
      }
    } catch (error) {
      const message = describeApiError(error);
      setFailure({ message, needsSetup: needsAISetup(error) });
      // Quien se guía por voz tiene que enterarse de que falló, no esperar una descripción que no llega.
      if (autoSpeak) speakOnce(message, rate);
    } finally {
      setLoading(false);
      setOpen(true);
    }
  };

  /** El texto que muestra el diálogo: la descripción guardada o la consulta recién hecha. */
  const shownText = alt && !fresh ? alt : failure ? undefined : result?.text;

  return (
    <figure className="my-10">
      <div className="relative rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] p-4">
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={
              alt ??
              "Imagen del documento original sin descripción alternativa. Usá el botón Interpretar con IA para escuchar o leer su contenido."
            }
            className="mx-auto h-auto max-h-[420px] max-w-full"
          />
        ) : (
          <BarChart />
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
        <Dialog title="Interpretación de la imagen" onClose={closeDialog} labelId="img-title">
          {alt && !fresh ? (
            <>
              <p className="mb-2 leading-relaxed" style={{ fontSize: "max(18px, 0.9em)" }}>
                {alt}
              </p>
              <p className="mb-6 text-sm text-[var(--muted)]">Descripción guardada</p>
            </>
          ) : failure || !result ? (
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
                  <p className="mt-2 text-sm text-[var(--muted)]">⚠️ {TRUNCATED_NOTICE}</p>
                )}
              </div>
            </>
          )}
          <div className="flex flex-wrap gap-3">
            {shownText && hasTTS && (
              <Button variant="primary" onClick={() => speakOnce(shownText, rate)}>
                🔊 Escuchar descripción
              </Button>
            )}
            {shownText && (
              <Button
                onClick={() => {
                  closeDialog();
                  onAskAssistant();
                }}
              >
                Preguntarle al asistente
              </Button>
            )}
            {alt && !fresh && (
              <Button
                onClick={() => {
                  closeDialog();
                  void analyze(true);
                }}
              >
                Volver a interpretar con IA
              </Button>
            )}
            {failure?.needsSetup && (
              <Button
                variant="primary"
                onClick={() => {
                  closeDialog();
                  setSettingsOpen(true);
                }}
              >
                Configurar IA
              </Button>
            )}
            <Button onClick={closeDialog}>Cerrar</Button>
          </div>
        </Dialog>
      )}
      {settingsOpen && <AISettingsDialog onClose={() => setSettingsOpen(false)} />}
    </figure>
  );
}
