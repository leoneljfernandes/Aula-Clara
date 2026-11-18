import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { Button } from "@/components/Button";
import { VoiceConsentDialog } from "@/components/VoiceConsentDialog";
import { hasTTS, speakOnce, withNotice } from "@/lib/speech";

import { AISettingsDialog } from "./AISettingsDialog";
import { useAICredentials } from "./credentials";
import { LIMITS } from "./errors";
import { providerLabel } from "./providers";
import { ProviderBadge } from "./ProviderBadge";
import { QUICK_ACTIONS } from "./quickActions";
import type { Chat } from "./useChat";
import { useDictation } from "./useDictation";

const TRUNCATED_NOTICE = "La respuesta se cortó porque el modelo llegó a su límite de largo.";

interface AssistantPanelProps {
  chat: Chat;
  inputRef: RefObject<HTMLInputElement | null>;
  selection: string;
  rate: number;
  /** Guía por voz: lee en voz alta cada respuesta nueva de la IA al llegar. */
  autoSpeak: boolean;
  /** Con los comandos por voz activos, se ofrece dictar la pregunta (si el navegador sabe reconocer voz). */
  dictation: boolean;
}

export function AssistantPanel({
  chat,
  inputRef,
  selection,
  rate,
  autoSpeak,
  dictation,
}: AssistantPanelProps): ReactNode {
  const [draft, setDraft] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const credentials = useAICredentials();
  const logRef = useRef<HTMLDivElement>(null);
  const { messages, typing, send } = chat;

  const submit = (): void => {
    const text = draft.trim();
    if (!text || typing) return;
    void send(text, "free");
    setDraft("");
  };
  const dictate = useDictation({
    onText: (text) => setDraft((d) => (d.trim() ? `${d.trim()} ${text}` : text)),
    onSend: submit,
  });

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  // «Respuesta nueva» = la lista creció desde el render anterior. Así volver a renderizar no relee, y
  // el saludo (que ya está en la lista al montar) no cuenta. La referencia se actualiza siempre, también
  // con la guía apagada: si se prende después, no se lee lo que ya estaba.
  const seenCount = useRef(messages.length);
  useEffect(() => {
    const grew = messages.length > seenCount.current;
    seenCount.current = messages.length;
    const last = messages[messages.length - 1];
    // También los errores: quien se guía por voz tiene que enterarse de que el pedido falló.
    if (autoSpeak && grew && last?.role === "ai") {
      speakOnce(last.truncated ? withNotice(last.text, TRUNCATED_NOTICE) : last.text, rate);
    }
  }, [messages, autoSpeak, rate]);

  const explain = (): void =>
    void send(`Explicame este párrafo con palabras más simples: «${selection}»`, "simplify", { selection });

  return (
    <section aria-labelledby="asist-title" className="flex h-full min-h-[560px] flex-col lg:min-h-0">
      <div className="border-b-2 border-[var(--border)] px-5 pt-5 pb-3">
        <h2 id="asist-title" className="flex items-center gap-2 text-xl font-bold">
          <span aria-hidden="true">✦</span> Asistente inteligente
        </h2>
        <p className="text-base text-[var(--muted)]">Preguntá sobre este documento</p>
        {credentials ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="min-w-0 text-base break-words">
              <span className="text-[var(--muted)]">IA: </span>
              {providerLabel(credentials.provider)} · {credentials.model}
            </p>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="min-h-10 text-base font-bold underline underline-offset-4"
            >
              Cambiar<span className="sr-only"> proveedor o modelo de IA</span>
            </button>
          </div>
        ) : (
          <div className="mt-3 rounded-xl border-2 border-[var(--accent)] p-3">
            <p className="mb-2 text-base">
              Para usar el asistente, cargá tu API key gratuita de Gemini, Groq, OpenRouter, Mistral o NVIDIA.{" "}
              <Link to="/ayuda/ia" target="_blank" className="font-bold underline">
                ¿Cómo consigo una? <span className="sr-only">(se abre en una pestaña nueva)</span>
              </Link>
            </p>
            <Button variant="primary" className="w-full" onClick={() => setSettingsOpen(true)}>
              Configurar IA
            </Button>
          </div>
        )}
      </div>
      {settingsOpen && <AISettingsDialog onClose={() => setSettingsOpen(false)} />}

      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-label="Conversación con el asistente"
        tabIndex={0}
        className="flex-1 space-y-4 overflow-y-auto p-5"
      >
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[92%] rounded-2xl border-2 px-4 py-3 text-[17px] leading-relaxed whitespace-pre-line ${m.role === "user" ? "rounded-br-md border-[var(--accent)] bg-[var(--accent)] text-[var(--onAccent)]" : "rounded-bl-md border-[var(--border)] bg-[var(--bg)]"}`}
            >
              <span className="sr-only">{m.role === "user" ? "Vos dijiste: " : "Asistente: "}</span>
              {m.text}
              {m.role === "ai" && m.provider && m.model && (
                <ProviderBadge provider={m.provider} model={m.model} />
              )}
              {m.truncated && (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  ⚠️ {TRUNCATED_NOTICE} Pedí algo más acotado, por ejemplo un fragmento más corto.
                </p>
              )}
              {m.needsSetup && (
                <div className="mt-2">
                  <Button onClick={() => setSettingsOpen(true)}>Configurar IA</Button>
                </div>
              )}
              {m.role === "ai" && i > 0 && hasTTS && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => speakOnce(m.text, rate)}
                    className="min-h-10 text-base font-bold underline underline-offset-4"
                  >
                    🔊 Escuchar respuesta
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start" aria-label="El asistente está escribiendo">
            <div className="flex gap-1 rounded-2xl rounded-bl-md border-2 border-[var(--border)] px-4 py-3 text-2xl leading-none">
              <span className="dot">•</span>
              <span className="dot">•</span>
              <span className="dot">•</span>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3 border-t-2 border-[var(--border)] p-4">
        {selection && (
          <div className="rounded-xl border-2 border-[var(--accent)] p-3">
            <p className="mb-1 text-sm font-bold text-[var(--muted)]">Texto seleccionado</p>
            <p className="mb-2 line-clamp-2 text-base italic">
              «{selection.length > 110 ? `${selection.slice(0, 110)}…` : selection}»
            </p>
            <Button variant="primary" className="w-full" onClick={explain}>
              Explicar con palabras más simples
            </Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Atajos de consulta">
          {QUICK_ACTIONS.map(([label, action]) => (
            <button
              key={action}
              type="button"
              disabled={typing}
              onClick={() => void send(label, action)}
              className="min-h-11 rounded-full border-2 border-[var(--border)] px-3 text-[15px] font-bold hover:bg-[var(--soft)] disabled:opacity-50"
            >
              {label}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex flex-wrap gap-2"
        >
          <label htmlFor="chat-input" className="sr-only">
            Escribí tu pregunta
          </label>
          <input
            id="chat-input"
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoComplete="off"
            maxLength={LIMITS.message}
            placeholder="Escribí tu pregunta y presioná Enter"
            className="min-h-[52px] min-w-0 flex-1 rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-4 text-[var(--fg)] placeholder:text-[var(--muted)]"
          />
          <Button
            type="submit"
            variant="primary"
            className="min-h-[52px]"
            disabled={!draft.trim() || typing}
            aria-label="Enviar pregunta"
          >
            Enviar
          </Button>
          {dictation && dictate.available && (
            <Button
              type="button"
              className="min-h-[52px] aria-pressed:border-[var(--accent)] aria-pressed:bg-[var(--accent)] aria-pressed:text-[var(--onAccent)]"
              aria-pressed={dictate.listening}
              onClick={dictate.start}
            >
              🎙 Dictar pregunta
            </Button>
          )}
        </form>
        {dictation && dictate.error && (
          <p role="status" className="text-base">
            {dictate.error}
          </p>
        )}
        {dictate.consentOpen && (
          <VoiceConsentDialog
            kind="commands"
            onAccept={dictate.acceptConsent}
            onCancel={dictate.cancelConsent}
          />
        )}
      </div>
    </section>
  );
}
