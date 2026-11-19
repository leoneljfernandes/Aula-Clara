import { describe, expect, it } from "vitest";

import { type ApiError, ApiRequestError, type ProblemDetails } from "@/lib/http";

import {
  describeApiError,
  formatWait,
  ImageUnavailableError,
  LIMITS,
  MissingCredentialsError,
  needsAISetup,
} from "./errors";

function problem(code: string, extra: Record<string, unknown> = {}, status = 422): ProblemDetails {
  return { title: "x", status, code, provider: "gemini", model: "gemini-3.5-flash-lite", ...extra };
}

function api(code: string, extra: Record<string, unknown> = {}, status = 422): ApiRequestError {
  const p = problem(code, extra, status);
  if (status === 429) return new ApiRequestError({ kind: "rate_limited", retryAfterMs: null, problem: p });
  if (status === 401) return new ApiRequestError({ kind: "unauthorized", problem: p });
  if (status === 403) return new ApiRequestError({ kind: "forbidden", problem: p });
  if (status >= 500) return new ApiRequestError({ kind: "server", status, problem: p });
  if (status === 422) return new ApiRequestError({ kind: "validation", problem: p, fieldErrors: {} });
  return new ApiRequestError({ kind: "unknown", status, problem: p });
}

describe("mensajes de error de la IA", () => {
  // [código, HTTP, extras, lo que tiene que decir el mensaje, ¿se arregla en «Configurar IA»?]
  it.each<[string, number, Record<string, unknown>, string, boolean]>([
    ["ai_credentials_required", 401, {}, "cargá tu API key", true],
    ["ai_credentials_required", 401, { reason: "session_expired" }, "Tu sesión de IA venció", true],
    ["ai_key_invalid", 401, {}, "Google Gemini rechazó tu API key", true],
    ["forbidden", 403, {}, "rechazó la consulta por seguridad", false],
    ["ai_quota_exceeded", 429, { reason: "rate" }, "límite de consultas por minuto de Google Gemini", true],
    ["ai_quota_exceeded", 429, { reason: "daily" }, "límite diario de Google Gemini", true],
    ["ai_quota_exceeded", 429, { reason: "credit" }, "no tiene saldo", true],
    ["ai_input_too_large", 413, { reason: "context" }, "demasiado grande para este modelo", false],
    ["ai_content_blocked", 422, {}, "filtro de seguridad de Google Gemini", false],
    ["ai_response_empty", 502, { reason: "length" }, "gastó todo su límite de respuesta", true],
    ["ai_response_empty", 502, { reason: "empty" }, "no devolvió ninguna respuesta", true],
    ["ai_permission_denied", 403, { reason: "region" }, "no está disponible en tu región", true],
    ["ai_permission_denied", 403, { reason: "access" }, "no tiene acceso a este modelo", true],
    ["ai_model_not_found", 422, {}, "«gemini-3.5-flash-lite» no existe", true],
    ["ai_image_rejected", 422, {}, "no pudo leer la imagen", true],
    ["ai_model_rejected", 422, {}, "no aceptó la consulta", true],
    ["ai_unavailable", 503, { reason: "timeout" }, "tardó demasiado", false],
    ["ai_unavailable", 503, { reason: "overloaded" }, "está saturado", false],
    ["ai_unavailable", 503, { reason: "unreachable" }, "No pudimos comunicarnos con Google Gemini", false],
    ["ai_unavailable", 503, { reason: "provider_error" }, "no respondió", false],
    ["ai_unavailable", 503, {}, "no respondió", false],
    ["rate_limited", 429, {}, "muchas consultas seguidas", false],
    ["http_413", 413, {}, "máximo 4 MB", false],
    ["http_415", 415, {}, "JPEG, PNG, WebP y GIF", false],
    ["http_422", 422, {}, "La imagen está vacía", false],
    ["internal_error", 500, {}, "error interno", false],
  ])("%s (%i, %j) → «%s»", (code, status, extra, text, setup) => {
    const error = api(code, extra, status);
    expect(describeApiError(error)).toContain(text);
    expect(needsAISetup(error)).toBe(setup);
  });

  it("dice cuánto esperar cuando el proveedor lo informa", () => {
    const quota = api("ai_quota_exceeded", { reason: "rate", retry_after_seconds: 34 }, 429);
    expect(describeApiError(quota)).toContain("Probá de nuevo en 34 segundos");
    const daily = api("ai_quota_exceeded", { reason: "daily", retry_after_seconds: 7_200 }, 429);
    expect(describeApiError(daily)).toContain("más de una hora");
  });

  it("agrega lo que dijo el proveedor para los errores donde explica el motivo exacto", () => {
    const error = api("ai_model_rejected", { provider_message: "Invalid value for temperature" });
    expect(describeApiError(error)).toContain("Detalle del proveedor: «Invalid value for temperature»");
    // El rechazo de la key nunca lleva mensaje del proveedor: se explica con texto propio.
    const key = api("ai_key_invalid", { provider_message: "Incorrect key sk-abc" }, 401);
    expect(describeApiError(key)).not.toContain("sk-abc");
  });

  it("nombra al proveedor correcto y cae a «el proveedor» si no lo conoce", () => {
    expect(describeApiError(api("ai_content_blocked", { provider: "mistral" }))).toContain("Mistral AI");
    expect(describeApiError(api("ai_content_blocked", { provider: undefined }))).toContain("el proveedor");
  });

  describe("pedido inválido (422 de validación)", () => {
    const withField = (field: string): ApiRequestError =>
      new ApiRequestError({
        kind: "validation",
        fieldErrors: {},
        problem: {
          ...problem("validation_error"),
          errors: [{ type: "string_too_long", loc: ["body", field], msg: "too long" }],
        },
      });

    it("pregunta demasiado larga", () => {
      expect(describeApiError(withField("message"))).toContain(
        `máximo ${LIMITS.message.toLocaleString("es-AR")}`,
      );
    });
    it("texto seleccionado o documento demasiado largos", () => {
      expect(describeApiError(withField("selection"))).toContain("demasiado largo");
      expect(describeApiError(withField("document_text"))).toContain("demasiado largo");
    });
    it("cualquier otro campo", () => {
      expect(describeApiError(withField("action"))).toContain("No pudimos procesar");
    });
  });

  describe("errores sin código del backend (red, Vercel, otro servidor)", () => {
    const cases: Array<[string, ApiError, string]> = [
      ["sin conexión o CORS", { kind: "network" }, "No pudimos conectar"],
      ["timeout del cliente", { kind: "timeout" }, "tardó demasiado"],
      ["504 de Vercel (límite de 30 s)", { kind: "server", status: 504, problem: null }, "30 segundos"],
      ["502 o 503", { kind: "server", status: 503, problem: null }, "no está disponible"],
      ["500 sin cuerpo", { kind: "server", status: 500, problem: null }, "error en el servidor"],
      [
        "413 de Vercel (pedido muy grande)",
        { kind: "unknown", status: 413, problem: null },
        "demasiado grande para el servidor",
      ],
      ["404: no hay backend (GitHub Pages)", { kind: "not_found", problem: null }, "VITE_API_URL"],
      ["405: Pages no acepta POST", { kind: "unknown", status: 405, problem: null }, "VITE_API_URL"],
      ["403 sin cuerpo", { kind: "forbidden", problem: null }, "No tenés permiso"],
      [
        "límite por IP sin cuerpo",
        { kind: "rate_limited", retryAfterMs: 42_000, problem: null },
        "42 segundos",
      ],
      ["consulta cancelada", { kind: "canceled" }, "Se canceló"],
      ["algo que no se esperaba", { kind: "unknown", status: null, problem: null }, "Algo salió mal"],
    ];
    it.each(cases)("%s", (_name, error, text) => {
      expect(describeApiError(new ApiRequestError(error))).toContain(text);
    });
  });

  it("errores que no son de la API", () => {
    expect(describeApiError(new MissingCredentialsError())).toContain("Configurar IA");
    expect(describeApiError(new ImageUnavailableError())).toContain("preparar la imagen");
    expect(describeApiError(new TypeError("boom"))).toContain("Algo salió mal");
    expect(describeApiError(undefined)).toContain("Algo salió mal");
    expect(needsAISetup(new MissingCredentialsError())).toBe(true);
    expect(needsAISetup(new TypeError("boom"))).toBe(false);
  });

  it("ningún mensaje queda vacío ni exagerado de largo, ni con un proveedor que escribe de más", () => {
    const long = "x".repeat(300);
    const text = describeApiError(api("ai_model_rejected", { provider_message: long }));
    expect(text.length).toBeLessThan(700);
  });

  it("formatea las esperas", () => {
    expect([1, 34.2, 89, 90, 600, 3_599, 3_600].map(formatWait)).toEqual([
      "1 segundo",
      "35 segundos",
      "89 segundos",
      "unos 2 minutos",
      "unos 10 minutos",
      "unos 60 minutos",
      "más de una hora",
    ]);
  });

  it("sin saldo en un proveedor de pago, manda a cargar crédito y no a «un modelo gratuito»", () => {
    for (const provider of ["openai", "anthropic"]) {
      const text = describeApiError(api("ai_quota_exceeded", { reason: "credit", provider }, 429));
      expect(text).toContain("no tiene saldo");
      expect(text).toContain("Cargá saldo");
      expect(text).not.toContain("Elegí uno gratuito");
    }
  });

  it("sin saldo en un proveedor con uso gratuito, sigue ofreciendo un modelo gratuito", () => {
    const text = describeApiError(
      api("ai_quota_exceeded", { reason: "credit", provider: "openrouter" }, 429),
    );
    expect(text).toContain("Elegí uno gratuito");
  });

  it("nombra a OpenAI y a Anthropic con el nombre que reconoce la gente", () => {
    expect(describeApiError(api("ai_content_blocked", { provider: "openai" }))).toContain("OpenAI (ChatGPT)");
    expect(describeApiError(api("ai_content_blocked", { provider: "anthropic" }))).toContain(
      "Anthropic (Claude)",
    );
  });
});
