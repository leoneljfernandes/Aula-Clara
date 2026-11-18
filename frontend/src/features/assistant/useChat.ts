import { useState } from "react";

import { type ChatAction, chat, type Provider } from "./api";
import { describeApiError, LIMITS, needsAISetup } from "./errors";

export interface ChatMessage {
  role: "user" | "ai";
  text: string;
  provider?: Provider;
  model?: string;
  /** El modelo cortó la respuesta por su límite de largo. */
  truncated?: boolean;
  /** El error se resuelve en «Configurar IA»: el panel muestra el botón junto al mensaje. */
  needsSetup?: boolean;
}

const GREETING: ChatMessage = {
  role: "ai",
  text: "Hola, soy tu asistente de estudio. ¿Qué dudas tenés sobre este documento?",
};

/** Se manda como máximo esta porción del documento: la API recorta de nuevo, pero no hace falta subirlo entero. */
const MAX_CONTEXT_CHARS = 30_000;

export interface Chat {
  messages: ChatMessage[];
  typing: boolean;
  send: (
    shown: string,
    action: ChatAction,
    extra?: { message?: string; selection?: string },
  ) => Promise<void>;
}

export function useChat(documentText: string): Chat {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [typing, setTyping] = useState(false);

  const send: Chat["send"] = async (shown, action, extra) => {
    if (typing) return;
    setMessages((m) => [...m, { role: "user", text: shown }]);
    setTyping(true);
    try {
      const answer = await chat({
        action,
        message: (extra?.message ?? (action === "free" ? shown : undefined))?.slice(0, LIMITS.message),
        documentText: documentText.slice(0, MAX_CONTEXT_CHARS),
        selection: extra?.selection?.slice(0, LIMITS.selection),
      });
      setMessages((m) => [
        ...m,
        {
          role: "ai",
          text: answer.text,
          provider: answer.provider,
          model: answer.model,
          truncated: answer.truncated,
        },
      ]);
    } catch (error) {
      setMessages((m) => [
        ...m,
        { role: "ai", text: describeApiError(error), needsSetup: needsAISetup(error) },
      ]);
    } finally {
      setTyping(false);
    }
  };

  return { messages, typing, send };
}
