import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { speechBus } from "@/lib/speech";
import { parseCommand, type VoiceCommand } from "@/lib/voice/commands";
import { grantVoiceConsent, hasVoiceConsent } from "@/lib/voice/consent";
import { type MicOwner, micLock } from "@/lib/voice/micLock";
import {
  createRecognizer,
  type RecognitionErrorKind,
  type Recognizer,
  speechRecognitionAvailable,
} from "@/lib/voice/recognizer";

interface Options {
  mode: "off" | "push" | "continuous";
  /** Devuelve un texto si el comando se entendió pero no se pudo hacer: la barra lo muestra en vez de ✓. */
  onCommand: (command: VoiceCommand) => string | void;
}

export interface VoiceCommands {
  /** El navegador sabe reconocer voz. */
  available: boolean;
  /** Micrófono encendido por la persona. No promete que el navegador ya esté oyendo (puede faltar el permiso) ni que lo esté ahora mismo (en manos libres se calla mientras habla la app). */
  listening: boolean;
  toggle: () => void;
  /** Manos libres con el micrófono en pausa porque la app está hablando: vuelve solo al terminar. */
  paused: boolean;
  /** La última frase oída, solo en memoria: no se guarda ni se registra. `note`: se entendió pero no se hizo. */
  heard: { text: string; understood: boolean; note?: string } | null;
  /** Por qué se apagó el micrófono, en una frase corta. */
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
  const modeRef = useRef(mode);
  /** Un dictado nos cortó estando en manos libres: al terminar, volvemos a escuchar. */
  const resumeAfterDictation = useRef(false);
  const begin = useRef<() => void>(() => {});

  const discard = (): void => {
    recognizer.current?.dispose();
    recognizer.current = null;
    setListening(false);
  };

  const owner = useRef<MicOwner>({
    onPreempted: () => {
      resumeAfterDictation.current = modeRef.current === "continuous";
      discard();
    },
  });

  const start = (): void => {
    if (mode === "off") return;
    resumeAfterDictation.current = false;
    setError(null);
    setHeard(null);
    if (!recognizer.current) {
      const created = createRecognizer({
        continuous: mode === "continuous",
        interim: false,
        onListeningChange: (value) => {
          setListening(value);
          if (!value) micLock.release(owner.current);
        },
        onFinal: (text) => {
          const command = parseCommand(text, { continuous: mode === "continuous" });
          if (!command) {
            // En manos libres el micrófono oye voces ajenas (o a un lector de pantalla): se las calla en vez de
            // escribirlas en la región anunciada, donde la voz de la app las repetiría ante el micrófono abierto.
            if (mode !== "continuous") setHeard({ text, understood: false });
            return;
          }
          const note = handler.current(command);
          setHeard(note ? { text, understood: false, note } : { text, understood: true });
        },
        onError: (kind) => {
          if (kind === "no-speech") {
            // En manos libres cada ciclo sin hablar termina así (el reconocedor ni avisa); acá solo llega en `push`.
            setError("No te escuché");
            return;
          }
          const message = ERRORS[kind];
          if (message === undefined) return;
          setError(message);
          if (kind === "network" || kind === "other") {
            // El reconocedor no se apaga solo en estos casos: se descarta y el próximo intento arma otro.
            discard();
            micLock.release(owner.current);
          }
        },
      });
      if (!created) return;
      recognizer.current = created;
    }
    micLock.acquire(owner.current); // corta el dictado, si lo había
    // En `push` la app se calla antes de abrir el micrófono para no oírse a sí misma. En manos libres
    // el reconocedor ya se pausa mientras la app habla.
    if (mode === "push") speechBus.silence();
    recognizer.current.start();
  };

  useEffect(() => {
    handler.current = onCommand;
    modeRef.current = mode;
    begin.current = start;
  });

  // Cambiar de modo (o apagar los comandos) o salir del lector cierra el reconocimiento.
  useEffect(() => {
    const lock = owner.current;
    const unsubscribe = micLock.onFree(() => {
      if (resumeAfterDictation.current) begin.current();
    });
    return () => {
      unsubscribe();
      resumeAfterDictation.current = false;
      recognizer.current?.dispose();
      recognizer.current = null;
      micLock.release(lock);
    };
  }, [mode]);

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
    begin.current();
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
      begin.current();
    },
    cancelConsent: () => setConsentOpen(false),
  };
}
