import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { speechBus } from "@/lib/speech";
import { parseCommand, type VoiceCommand } from "@/lib/voice/commands";
import { grantVoiceConsent, hasVoiceConsent } from "@/lib/voice/consent";
import {
  createRecognizer,
  type RecognitionErrorKind,
  type Recognizer,
  speechRecognitionAvailable,
} from "@/lib/voice/recognizer";

interface Options {
  mode: "off" | "push" | "continuous";
  onCommand: (command: VoiceCommand) => void;
}

export interface VoiceCommands {
  /** El navegador sabe reconocer voz. */
  available: boolean;
  /** Micrófono encendido por la persona. No promete que el navegador ya esté oyendo (puede faltar el permiso) ni que lo esté ahora mismo (en manos libres se calla mientras habla la app). */
  listening: boolean;
  toggle: () => void;
  /** Manos libres con el micrófono en pausa porque la app está hablando: vuelve solo al terminar. */
  paused: boolean;
  /** La última frase oída, solo en memoria: no se guarda ni se registra. */
  heard: { text: string; understood: boolean } | null;
  /** Por qué se apagó el micrófono, en una frase corta. `no-speech` no cuenta como error. */
  error: string | null;
  consentOpen: boolean;
  acceptConsent: () => void;
  cancelConsent: () => void;
}

const ERRORS: Partial<Record<RecognitionErrorKind, string>> = {
  "not-allowed": "No tenemos permiso para usar el micrófono. Habilitalo en el navegador y volvé a probar.",
  "no-microphone": "No encontramos un micrófono conectado.",
  language: "Tu navegador no reconoce voz en español.",
  network: "No hay conexión con el servicio de reconocimiento de voz.",
  other: "El micrófono dejó de funcionar.",
};

/** Comandos de voz del lector: modo `push` (una frase por vez) o `continuous` (manos libres). */
export function useVoiceCommands({ mode, onCommand }: Options): VoiceCommands {
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<VoiceCommands["heard"]>(null);
  const [error, setError] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const appSpeaking = useSyncExternalStore(speechBus.subscribe, speechBus.isSpeaking);
  const recognizer = useRef<Recognizer | null>(null);
  const handler = useRef(onCommand);
  useEffect(() => {
    handler.current = onCommand;
  });

  // Cambiar de modo (o apagar los comandos) o salir del lector cierra el reconocimiento.
  useEffect(
    () => () => {
      recognizer.current?.dispose();
      recognizer.current = null;
    },
    [mode],
  );

  const begin = (): void => {
    if (mode === "off") return;
    setError(null);
    setHeard(null);
    if (!recognizer.current) {
      const created = createRecognizer({
        continuous: mode === "continuous",
        interim: false,
        onListeningChange: setListening,
        onFinal: (text) => {
          const command = parseCommand(text);
          setHeard({ text, understood: command !== null });
          if (command) handler.current(command);
        },
        onError: (kind) => {
          const message = ERRORS[kind];
          if (message === undefined) return; // `no-speech`: no es un error para quien usa la voz
          setError(message);
          if (kind === "network" || kind === "other") {
            // El reconocedor no se apaga solo en estos casos: se descarta y el próximo intento arma otro.
            recognizer.current?.dispose();
            recognizer.current = null;
            setListening(false);
          }
        },
      });
      if (!created) return;
      recognizer.current = created;
    }
    // En `push` la app se calla antes de abrir el micrófono para no oírse a sí misma. En manos libres
    // el reconocedor ya se pausa mientras la app habla.
    if (mode === "push") speechBus.silence();
    recognizer.current.start();
  };

  const toggle = (): void => {
    if (mode === "off" || !speechRecognitionAvailable()) return;
    if (listening) {
      recognizer.current?.stop();
      return;
    }
    if (!hasVoiceConsent("commands")) {
      setConsentOpen(true);
      return;
    }
    begin();
  };

  return {
    available: speechRecognitionAvailable(),
    listening,
    toggle,
    paused: listening && mode === "continuous" && appSpeaking,
    heard,
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
