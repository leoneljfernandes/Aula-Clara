import axios, { type AxiosRequestConfig } from "axios";

import { ApiRequestError, toApiError } from "./errors";

/** `VITE_API_URL` vacía = mismo origen (proxy de Vite en dev, Vercel en prod). */
const baseURL = `${import.meta.env.VITE_API_URL ?? ""}/api/v1`;

const http = axios.create({ baseURL, timeout: 45_000 });

const IDEMPOTENT = new Set(["get", "head", "options", "put", "delete"]);
const TRANSIENT_STATUS = new Set([408, 502, 503, 504]); // 429 no: respetamos el límite, no lo golpeamos
const MAX_RETRIES = 2;

interface RetryState {
  retries?: number;
}

/** `retry: false` desactiva los reintentos automáticos (por ejemplo, pedidos que gastan cuota de IA). */
export type RequestConfig = AxiosRequestConfig & { retry?: boolean };

/** Reintenta solo errores transitorios y solo métodos idempotentes (un POST de IA no se repite). */
http.interceptors.response.use(undefined, async (error: unknown) => {
  if (!axios.isAxiosError(error) || !error.config) throw error;
  const config = error.config as RequestConfig & { __retry?: RetryState };
  const state = (config.__retry ??= { retries: 0 });
  const attempt = state.retries ?? 0;
  const transient = !error.response || TRANSIENT_STATUS.has(error.response.status);
  if (
    config.retry === false ||
    !IDEMPOTENT.has((config.method ?? "get").toLowerCase()) ||
    !transient ||
    attempt >= MAX_RETRIES ||
    axios.isCancel(error)
  ) {
    throw error;
  }
  state.retries = attempt + 1;
  const delay = Math.random() * Math.min(4_000, 400 * 2 ** attempt); // backoff exponencial con full jitter
  await new Promise((resolve) => setTimeout(resolve, delay));
  return http.request(config);
});

/** Headers que llevan credenciales: nunca deben quedar en un error que se loguea o se reporta. */
const SECRET_HEADERS = /^(x-ai-key|authorization)$/i;

/**
 * El AxiosError trae la configuración del pedido, headers incluidos: sin esto, la API key de la persona
 * viajaría en `cause` a la consola, a un reporte de errores o a cualquier `JSON.stringify(error)`.
 */
export function redactCredentials(error: unknown): void {
  if (!axios.isAxiosError(error)) return;
  const headers = error.config?.headers;
  if (!headers) return;
  for (const name of Object.keys(headers)) {
    if (SECRET_HEADERS.test(name)) headers.set(name, "[redacted]");
  }
}

/** Todas las llamadas pasan por acá: el resto de la app nunca ve un AxiosError. */
export async function request<T>(config: RequestConfig): Promise<T> {
  try {
    return (await http.request<T>(config)).data;
  } catch (error) {
    redactCredentials(error);
    throw new ApiRequestError(toApiError(error), { cause: error });
  }
}
