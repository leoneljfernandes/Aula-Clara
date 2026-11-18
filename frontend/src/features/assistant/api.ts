import { isApiRequestError, request } from "@/lib/http";

import { aiCredentials } from "./credentials";
import { MissingCredentialsError } from "./errors";
import { COOKIE_MODE_HEADER } from "./session";
import type { ProviderId } from "./providers";

export type ChatAction =
  "free" | "summarize" | "key_concepts" | "quiz" | "simplify" | "glossary" | "visual_outline";
/** Nivel de lenguaje de las respuestas: estándar, lenguaje claro o Lectura Fácil. */
export type AnswerLanguage = "standard" | "plain" | "easy";
export type Provider = ProviderId;

export interface AIAnswer {
  text: string;
  provider: Provider;
  model: string;
  /** El modelo cortó la respuesta por su límite de largo: la interfaz lo avisa. */
  truncated: boolean;
}

export interface ModelOption {
  id: string;
  name: string;
  supportsImages: boolean | null;
  free: boolean | null;
}

/** Headers de la consulta: en modo de cookie la key no va (la pone el servidor al abrir la cookie). */
function credentialHeaders(): Record<string, string> {
  const c = aiCredentials.get();
  if (!c) throw new MissingCredentialsError();
  if (c.sealed) return { ...COOKIE_MODE_HEADER, "X-AI-Model": c.model };
  return { "X-AI-Provider": c.provider, "X-AI-Model": c.model, "X-AI-Key": c.apiKey ?? "" };
}

/**
 * Si el servidor dice que la sesión de la cookie venció o no es válida, lo guardado acá ya no sirve: se
 * borra, así el panel vuelve a pedir la key en vez de seguir mostrando una configuración que no anda.
 */
async function withSessionCheck<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    const lost =
      isApiRequestError(error) &&
      "problem" in error.error &&
      error.error.problem?.code === "ai_credentials_required";
    if (lost && aiCredentials.get()?.sealed) aiCredentials.clear();
    throw error;
  }
}

interface ChatInput {
  action: ChatAction;
  message?: string | undefined;
  documentText: string;
  selection?: string | undefined;
  language: AnswerLanguage;
}

export function chat(input: ChatInput, signal?: AbortSignal): Promise<AIAnswer> {
  return withSessionCheck(() => doChat(input, signal));
}

async function doChat(input: ChatInput, signal?: AbortSignal): Promise<AIAnswer> {
  const headers = credentialHeaders();
  const data = await request<{
    answer: string;
    provider: Provider;
    model: string;
    truncated?: boolean;
  }>({
    method: "POST",
    url: "/ai/chat",
    headers,
    data: {
      action: input.action,
      message: input.message,
      document_text: input.documentText,
      selection: input.selection,
      language: input.language,
    },
    ...(signal ? { signal } : {}),
  });
  return {
    text: data.answer,
    provider: data.provider,
    model: data.model,
    truncated: data.truncated === true,
  };
}

export interface DescribeImageOptions {
  /** Pide que la descripción nombre cada color junto a su posición o su forma (para quien no los distingue). */
  colorGuide?: boolean;
  signal?: AbortSignal;
}

export function describeImage(
  image: Blob,
  context: string,
  options: DescribeImageOptions = {},
): Promise<AIAnswer> {
  return withSessionCheck(() => doDescribeImage(image, context, options));
}

async function doDescribeImage(
  image: Blob,
  context: string,
  { colorGuide = false, signal }: DescribeImageOptions,
): Promise<AIAnswer> {
  const headers = credentialHeaders();
  const form = new FormData();
  form.append("image", image, "imagen.jpg");
  form.append("context", context);
  if (colorGuide) form.append("color_guide", "true");
  const data = await request<{
    description: string;
    provider: Provider;
    model: string;
    truncated?: boolean;
  }>({
    method: "POST",
    url: "/ai/describe-image",
    headers,
    data: form,
    ...(signal ? { signal } : {}),
  });
  return {
    text: data.description,
    provider: data.provider,
    model: data.model,
    truncated: data.truncated === true,
  };
}

export interface ModelCatalog {
  models: ModelOption[];
  /** false: el proveedor no permite comprobar la key de antemano (NVIDIA Build). */
  keyVerified: boolean;
}

/**
 * Valida la key (si el proveedor lo permite) y trae los modelos que puede usar, sin guardarla.
 * Sin `apiKey` usa la key sellada en la cookie (la persona ya la guardó y la página no puede leerla).
 */
export async function listModels(
  provider: Provider,
  apiKey?: string,
  signal?: AbortSignal,
): Promise<ModelCatalog> {
  const data = await request<{
    key_verified: boolean;
    models: Array<{ id: string; name: string; supports_images: boolean | null; free: boolean | null }>;
  }>({
    method: "GET",
    url: "/ai/models",
    // Cada intento consulta al proveedor (y cuenta para el límite por IP): un timeout no se repite solo.
    retry: false,
    headers: apiKey
      ? { "X-AI-Provider": provider, "X-AI-Key": apiKey.trim() }
      : { ...COOKIE_MODE_HEADER, "X-AI-Provider": provider },
    ...(signal ? { signal } : {}),
  });
  return {
    keyVerified: data.key_verified,
    models: data.models.map((m) => ({
      id: m.id,
      name: m.name,
      supportsImages: m.supports_images,
      free: m.free,
    })),
  };
}
