import { useEffect, useRef, useState } from "react";

import { speechBus } from "@/lib/speech";
import { normalizeSpeech } from "@/lib/voice/commands";
import { grantVoiceConsent, hasVoiceConsent } from "@/lib/voice/consent";
import { type MicOwner, micLock } from "@/lib/voice/micLock";
import { createRecognizer, type Recognizer, speechRecognitionAvailable } from "@/lib/voice/recognizer";

interface Options {
  onText: (text: string) => void;
  onSend: () => void;
}

export interface Dictation {
  available: boolean;
  listening: boolean;
  start: () => void;
  /** Corta el dictado en curso. */
  stop: () => void;
  /** Por qué no se pudo dictar, en una frase corta. */
  error: string | null;
  consentOpen: boolean;
  acceptConsent: () => void;
  cancelConsent: () => void;
}

/**
 * Dictado de una pregunta: una frase por vez («push»). Decir «enviar» manda lo que ya se escribió.
 * Lo dictado nunca se toma por un comando: va solo a `onText` y `onSend`.
 */
export function useDictation({ onText, onSend }: Options): Dictation {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const recognizer = useRef<Recognizer | null>(null);
  const handlers = useRef({ onText, onSend });
  useEffect(() => {
    handlers.current = { onText, onSend };
  });

  const owner = useRef<MicOwner>({
    // Los comandos de voz pidieron el micrófono: este dictado se cierra.
    onPreempted: () => {
      recognizer.current?.dispose();
      recognizer.current = null;
      setListening(false);
    },
  });

  useEffect(() => {
    const lock = owner.current;
    return () => {
      recognizer.current?.dispose();
      recognizer.current = null;
      micLock.release(lock);
    };
  }, []);

  const begin = (): void => {
    setError(null);
    // Cada dictado arma su propio reconocedor: así nunca queda uno a medio cerrar de la vez anterior.
    recognizer.current?.dispose();
    recognizer.current = createRecognizer({
      continuous: false,
      interim: false,
      onListeningChange: (value) => {
        setListening(value);
        if (!value) micLock.release(owner.current);
      },
      onFinal: (text) => {
        if (normalizeSpeech(text) === "enviar") handlers.current.onSend();
        else handlers.current.onText(text);
        // Con una sola frase el dictado terminó: los comandos (si estaban en manos libres) vuelven a escuchar.
        micLock.release(owner.current);
      },
      onError: (kind) => {
        if (kind === "no-speech") setError("No te escuché");
        else
          setError(
            kind === "not-allowed"
              ? "No tenemos permiso para usar el micrófono."
              : "No pudimos usar el micrófono para dictar.",
          );
      },
    });
    micLock.acquire(owner.current); // corta los comandos de voz, si estaban escuchando
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
    stop: () => recognizer.current?.stop(),
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
