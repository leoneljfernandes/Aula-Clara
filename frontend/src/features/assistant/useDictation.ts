import { useEffect, useRef, useState } from "react";

import { speechBus } from "@/lib/speech";
import { normalizeSpeech } from "@/lib/voice/commands";
import { grantVoiceConsent, hasVoiceConsent } from "@/lib/voice/consent";
import { createRecognizer, type Recognizer, speechRecognitionAvailable } from "@/lib/voice/recognizer";

interface Options {
  onText: (text: string) => void;
  onSend: () => void;
}

export interface Dictation {
  available: boolean;
  listening: boolean;
  start: () => void;
  /** Por qué no se pudo dictar, en una frase corta. */
  error: string | null;
  consentOpen: boolean;
  acceptConsent: () => void;
  cancelConsent: () => void;
}

/** Dictado de una pregunta: una frase por vez («push»). Decir «enviar» manda lo que ya se escribió. */
export function useDictation({ onText, onSend }: Options): Dictation {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const recognizer = useRef<Recognizer | null>(null);
  const handlers = useRef({ onText, onSend });
  useEffect(() => {
    handlers.current = { onText, onSend };
  });

  useEffect(
    () => () => {
      recognizer.current?.dispose();
      recognizer.current = null;
    },
    [],
  );

  const begin = (): void => {
    setError(null);
    // Cada dictado arma su propio reconocedor: así nunca queda uno a medio cerrar de la vez anterior.
    recognizer.current?.dispose();
    recognizer.current = createRecognizer({
      continuous: false,
      interim: false,
      onListeningChange: setListening,
      onFinal: (text) => {
        if (normalizeSpeech(text) === "enviar") handlers.current.onSend();
        else handlers.current.onText(text);
      },
      onError: (kind) => {
        if (kind === "no-speech") return;
        setError(
          kind === "not-allowed"
            ? "No tenemos permiso para usar el micrófono."
            : "No pudimos usar el micrófono para dictar.",
        );
      },
    });
    // Para no oírse a sí misma, la app se calla antes de abrir el micrófono.
    speechBus.silence();
    recognizer.current?.start();
  };

  return {
    available: speechRecognitionAvailable(),
    listening,
    start: () => {
      if (!speechRecognitionAvailable()) return;
      if (!hasVoiceConsent("commands")) {
        setConsentOpen(true);
        return;
      }
      begin();
    },
    error,
    consentOpen,
    acceptConsent: () => {
      grantVoiceConsent("commands");
      setConsentOpen(false);
      begin();
    },
    cancelConsent: () => setConsentOpen(false),
  };
}
