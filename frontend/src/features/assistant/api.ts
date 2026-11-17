import { isApiRequestError, request } from "@/lib/http";

import { type ChatAction, mockChat, mockDescription } from "./mock";

export type Provider = "gemini" | "groq" | "mock";

export interface AIAnswer {
  text: string;
  provider: Provider;
}

/** `mock` = sitio 100 % estático (GitHub Pages): ni siquiera se intenta llamar a la API. */
const forcedMock = (): boolean => import.meta.env.VITE_AI_MODE === "mock";

/** Si la API no responde (red, tiempo agotado, 5xx) se usa el mock local; el resto de errores sí se muestran. */
function shouldFallBack(error: unknown): boolean {
  if (!isApiRequestError(error)) return true;
  return ["network", "timeout", "server", "unknown"].includes(error.error.kind);
}

/** Mensaje claro para los errores que NO caen al mock (límite de uso, validación). */
export function describeApiError(error: unknown): string {
  if (isApiRequestError(error)) {
    if (error.error.kind === "rate_limited") {
      const wait = error.error.retryAfterMs
        ? ` Probá de nuevo en ${Math.ceil(error.error.retryAfterMs / 1000)} segundos.`
        : "";
      return `Hiciste muchas consultas seguidas.${wait}`;
    }
    if (error.error.kind === "validation")
      return "No pudimos procesar esa consulta. Probá con otra pregunta.";
  }
  return "Algo salió mal con el asistente. Probá de nuevo.";
}

interface ChatInput {
  action: ChatAction;
  message?: string | undefined;
  documentText: string;
  selection?: string | undefined;
}

export async function chat(input: ChatInput, signal?: AbortSignal): Promise<AIAnswer> {
  const fallback = (): AIAnswer => ({
    text: mockChat(input.action, input.selection ?? input.message ?? ""),
    provider: "mock",
  });
  if (forcedMock()) return fallback();
  try {
    const data = await request<{ answer: string; provider: Provider }>({
      method: "POST",
      url: "/ai/chat",
      data: {
        action: input.action,
        message: input.message,
        document_text: input.documentText,
        selection: input.selection,
      },
      ...(signal ? { signal } : {}),
    });
    return { text: data.answer, provider: data.provider };
  } catch (error) {
    if (shouldFallBack(error) && !(isApiRequestError(error) && error.error.kind === "canceled"))
      return fallback();
    throw error;
  }
}

export async function describeImage(
  image: Blob,
  context: string,
  isSampleChart: boolean,
  signal?: AbortSignal,
): Promise<AIAnswer> {
  const fallback = (): AIAnswer => ({ text: mockDescription(isSampleChart), provider: "mock" });
  if (forcedMock()) return fallback();
  const form = new FormData();
  form.append("image", image, "imagen.jpg");
  form.append("context", context);
  try {
    const data = await request<{ description: string; provider: Provider }>({
      method: "POST",
      url: "/ai/describe-image",
      data: form,
      ...(signal ? { signal } : {}),
    });
    return { text: data.description, provider: data.provider };
  } catch (error) {
    if (shouldFallBack(error)) return fallback();
    throw error;
  }
}
