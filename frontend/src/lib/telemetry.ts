/** Punto único de reporte de errores del frontend (Sentry, OTel web, endpoint propio...). */
export interface ErrorContext {
  scope: string;
  componentStack?: string | undefined;
  route?: string | undefined;
  /** Trace del backend: lo completa reportError si el error lo trae (ApiRequestError). */
  traceId?: string | undefined;
  extra?: Record<string, unknown>;
}

export type ErrorReporter = (error: unknown, context: ErrorContext) => void;

let reporter: ErrorReporter = (error, context) => {
  console.error(`[${context.scope}]`, error, context);
};

export function setErrorReporter(next: ErrorReporter): void {
  reporter = next;
}

function traceIdOf(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "traceId" in error) {
    return typeof error.traceId === "string" ? error.traceId : undefined;
  }
  return undefined;
}

export function reportError(error: unknown, context: ErrorContext): void {
  try {
    reporter(error, { ...context, traceId: context.traceId ?? traceIdOf(error) });
  } catch {
    // reportar nunca debe romper la app
  }
}
