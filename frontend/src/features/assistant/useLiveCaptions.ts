import { useEffect, useRef, useState } from "react";

import { grantVoiceConsent, hasVoiceConsent, revokeVoiceConsent } from "@/lib/voice/consent";
import { UNRESPONSIVE_MESSAGE } from "@/lib/voice/messages";
import { type MicOwner, micLock } from "@/lib/voice/micLock";
import {
  createRecognizer,
  type RecognitionErrorKind,
  type Recognizer,
  speechRecognitionAvailable,
} from "@/lib/voice/recognizer";

/** Líneas finales que se guardan en memoria; nunca en localStorage, IndexedDB ni el servidor. */
const MAX_LINES = 200;

export interface LiveCaptions {
  available: boolean;
  active: boolean;
  /** Las últimas líneas ya reconocidas. */
  lines: readonly string[];
  /** Lo que se está diciendo ahora, todavía sin cerrar. */
  interim: string;
  start(): void;
  stop(): void;
  clear(): void;
  /** Por qué se apagó, en una frase corta. */
  error: string | null;
  /** La persona ya dio permiso para usar el micrófono en los subtítulos. */
  consented: boolean;
  /** Retira ese permiso. */
  revokeConsent(): void;
  consentOpen: boolean;
  acceptConsent(): void;
  cancelConsent(): void;
  /** Los últimos `maxChars` caracteres de la transcripción, sin cortar una palabra a la mitad. */
  lastText(maxChars: number): string;
}

const ERRORS: Partial<Record<RecognitionErrorKind, string>> = {
  "not-allowed": "No tenemos permiso para usar el micrófono. Habilitalo en el navegador y volvé a probar.",
  "no-microphone": "No encontramos un micrófono conectado.",
  language: "Tu navegador no reconoce voz en español.",
  network: "No hay conexión con el servicio de reconocimiento de voz.",
  unresponsive: UNRESPONSIVE_MESSAGE,
  other: "El micrófono dejó de funcionar.",
};

/**
 * Subtítulos en vivo de la clase: reconocimiento continuo con resultados parciales. No guardan nada: la
 * transcripción vive en el estado del componente y se borra al desmontarse (salir del lector). A diferencia de los
 * comandos, no se calla cuando la app habla: no puede perderse lo que dice el docente.
 */
export function useLiveCaptions(): LiveCaptions {
  const [active, setActive] = useState(false);
  const [lines, setLines] = useState<readonly string[]>([]);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  // Estado de React y no una lectura de localStorage en el render: el compilador la memorizaría para siempre.
  const [consented, setConsented] = useState(() => hasVoiceConsent("captions"));
  const recognizer = useRef<Recognizer | null>(null);

  const discard = (): void => {
    recognizer.current?.dispose();
    recognizer.current = null;
  };

  const owner = useRef<MicOwner>({
    // Los comandos de voz o el dictado pidieron el micrófono: los subtítulos se cierran.
    onPreempted: () => {
      discard();
      setActive(false);
      setInterim("");
    },
  });

  useEffect(() => {
    const lock = owner.current;
    return () => {
      discard();
      micLock.release(lock);
    };
  }, []);

  const begin = (): void => {
    setError(null);
    discard();
    recognizer.current = createRecognizer({
      continuous: true,
      interim: true,
      pauseWhileAppSpeaks: false,
      onFinal: (text) => {
        setLines((previous) => [...previous, text].slice(-MAX_LINES));
        setInterim("");
      },
      onInterim: setInterim,
      onListeningChange: (value) => {
        setActive(value);
        if (!value) {
          setInterim("");
          micLock.release(owner.current);
        }
      },
      onError: (kind) => {
        const message = ERRORS[kind];
        if (message !== undefined) setError(message);
      },
    });
    micLock.acquire(owner.current); // corta los comandos y el dictado, si estaban escuchando
    recognizer.current?.start();
  };

  return {
    available: speechRecognitionAvailable(),
    active,
    lines,
    interim,
    start: () => {
      if (!speechRecognitionAvailable()) return;
      if (!hasVoiceConsent("captions")) {
        setConsentOpen(true);
        return;
      }
      begin();
    },
    stop: () => recognizer.current?.stop(),
    clear: () => {
      setLines([]);
      setInterim("");
    },
    error,
    consented,
    revokeConsent: () => {
      revokeVoiceConsent("captions");
      setConsented(false);
    },
    consentOpen,
    acceptConsent: () => {
      grantVoiceConsent("captions");
      setConsented(true);
      setConsentOpen(false);
      begin();
    },
    cancelConsent: () => setConsentOpen(false),
    lastText: (maxChars) => {
      const text = lines.join(" ");
      if (text.length <= maxChars) return text;
      const tail = text.slice(-maxChars);
      // Si el corte cayó en medio de una palabra, se descarta ese pedazo.
      return text[text.length - maxChars - 1] === " " ? tail : tail.replace(/^\S*\s/, "");
    },
  };
}
