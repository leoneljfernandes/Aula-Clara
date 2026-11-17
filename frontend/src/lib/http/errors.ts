import { isAxiosError, isCancel } from "axios";

/** RFC 9457 problem+json, tal como lo emite el backend FastAPI. */
export interface ProblemDetails {
  type?: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  instance?: string;
  trace_id?: string;
  errors?: ReadonlyArray<{ type: string; loc: ReadonlyArray<string | number>; msg: string }>;
  [extension: string]: unknown;
}

export type ApiError =
  | { kind: "canceled" }
  | { kind: "timeout" }
  | { kind: "network" }
  | { kind: "unauthorized"; problem: ProblemDetails | null }
  | { kind: "forbidden"; problem: ProblemDetails | null }
  | { kind: "not_found"; problem: ProblemDetails | null }
  | { kind: "conflict"; problem: ProblemDetails | null }
  | { kind: "validation"; problem: ProblemDetails | null; fieldErrors: Record<string, string> }
  | { kind: "rate_limited"; retryAfterMs: number | null; problem: ProblemDetails | null }
  | { kind: "server"; status: number; problem: ProblemDetails | null }
  | { kind: "unknown"; status: number | null; problem: ProblemDetails | null };

export class ApiRequestError extends Error {
  override readonly name = "ApiRequestError";
  // Campo declarado y asignado a mano: `constructor(readonly error)` no compila con
  // `erasableSyntaxOnly`, que activa la plantilla de `npm create vite` (y rompe `npm run build`).
  readonly error: ApiError;

  constructor(error: ApiError, options?: { cause?: unknown }) {
    super(`API request failed: ${error.kind}`, options);
    this.error = error;
  }

  get traceId(): string | undefined {
    return "problem" in this.error ? this.error.problem?.trace_id : undefined;
  }
}

export function isApiRequestError(value: unknown): value is ApiRequestError {
  return value instanceof ApiRequestError;
}

function asProblem(data: unknown): ProblemDetails | null {
  if (typeof data === "object" && data !== null && "status" in data && "code" in data) {
    return data as ProblemDetails;
  }
  return null;
}

function toFieldErrors(problem: ProblemDetails | null): Record<string, string> {
  const result: Record<string, string> = {};
  for (const err of problem?.errors ?? []) {
    const field = err.loc.filter((part) => part !== "body").join(".");
    result[field] ??= err.msg;
  }
  return result;
}

export function parseRetryAfter(header: unknown, now: number = Date.now()): number | null {
  if (typeof header !== "string" || header === "") return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}

/** Traduce cualquier error de axios a la unión tipada. Único lugar que conoce AxiosError. */
export function toApiError(error: unknown): ApiError {
  if (isCancel(error)) return { kind: "canceled" };
  if (!isAxiosError(error)) return { kind: "unknown", status: null, problem: null };
  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") return { kind: "timeout" };
  if (!error.response) return { kind: "network" };

  const { status, data, headers } = error.response;
  const problem = asProblem(data);
  switch (status) {
    case 401:
      return { kind: "unauthorized", problem };
    case 403:
      return { kind: "forbidden", problem };
    case 404:
      return { kind: "not_found", problem };
    case 409:
      return { kind: "conflict", problem };
    case 422:
      return { kind: "validation", problem, fieldErrors: toFieldErrors(problem) };
    case 429:
      return { kind: "rate_limited", retryAfterMs: parseRetryAfter(headers["retry-after"]), problem };
    default:
      return status >= 500 ? { kind: "server", status, problem } : { kind: "unknown", status, problem };
  }
}
