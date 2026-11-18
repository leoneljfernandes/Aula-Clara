import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "@/lib/http";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/http", async (original) => ({ ...(await original<typeof import("@/lib/http")>()), request }));

import { chat, describeImage, listModels } from "./api";
import { aiCredentials } from "./credentials";
import { describeApiError, MissingCredentialsError, needsAISetup } from "./errors";

const input = { action: "summarize" as const, documentText: "texto del documento" };
const HEADERS = { "X-AI-Provider": "gemini", "X-AI-Model": "modelo-x", "X-AI-Key": "key-de-prueba" };

function problem(status: number, code: string): ApiRequestError {
  const p = { title: "x", status, code };
  if (status === 429) return new ApiRequestError({ kind: "rate_limited", retryAfterMs: null, problem: p });
  if (status === 422) return new ApiRequestError({ kind: "validation", problem: p, fieldErrors: {} });
  if (status === 401) return new ApiRequestError({ kind: "unauthorized", problem: p });
  return new ApiRequestError({ kind: "server", status, problem: p });
}

describe("asistente: cliente de IA", () => {
  beforeEach(() => {
    request.mockReset(); // bloque: un beforeEach que devuelve una función la ejecuta como teardown
    aiCredentials.save({ provider: "gemini", apiKey: "key-de-prueba", model: "modelo-x", remember: false });
  });

  it("manda la acción, el texto y las credenciales de la persona en headers", async () => {
    request.mockResolvedValue({ answer: "respuesta real", provider: "gemini", model: "modelo-x" });
    expect(await chat({ ...input, selection: "un párrafo" })).toEqual({
      text: "respuesta real",
      provider: "gemini",
      model: "modelo-x",
      truncated: false,
    });
    expect(request.mock.calls[0]?.[0]).toMatchObject({
      method: "POST",
      url: "/ai/chat",
      headers: HEADERS,
      data: { action: "summarize", document_text: "texto del documento", selection: "un párrafo" },
    });
  });

  it("sin credenciales no llama a la API y pide configurarlas", async () => {
    aiCredentials.clear();
    const error = await chat(input).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MissingCredentialsError);
    expect(needsAISetup(error)).toBe(true);
    expect(describeApiError(error)).toContain("Configurar IA");
    await expect(describeImage(new Blob(["x"]), "")).rejects.toBeInstanceOf(MissingCredentialsError);
    expect(request).not.toHaveBeenCalled();
  });

  it("los errores de la API se propagan tal cual: la pantalla decide cómo explicarlos", async () => {
    const error = problem(429, "ai_quota_exceeded");
    request.mockRejectedValue(error);
    await expect(chat(input)).rejects.toBe(error);
    expect(needsAISetup(error)).toBe(true);
    expect(describeApiError(error)).toContain("límite");
  });

  it("marca la respuesta cortada por el límite de largo del modelo", async () => {
    request.mockResolvedValue({
      answer: "1. Primera\n2. Segu",
      provider: "gemini",
      model: "m",
      truncated: true,
    });
    expect((await chat(input)).truncated).toBe(true);
    request.mockResolvedValue({ answer: "completa", provider: "gemini", model: "m" });
    expect((await chat(input)).truncated).toBe(false);
  });

  it("describir una imagen manda multipart con la imagen, el contexto y las credenciales", async () => {
    request.mockResolvedValue({ description: "un gráfico", provider: "gemini", model: "modelo-x" });
    const result = await describeImage(new Blob(["x"], { type: "image/jpeg" }), "Gráfico 1");
    expect(result).toEqual({ text: "un gráfico", provider: "gemini", model: "modelo-x", truncated: false });
    const config = request.mock.calls[0]?.[0] as { data: FormData; headers: Record<string, string> };
    expect(config.headers).toEqual(HEADERS);
    expect(config.data.get("context")).toBe("Gráfico 1");
    expect(config.data.get("image")).toBeInstanceOf(Blob);
  });

  it("listar modelos manda la key nueva sin modelo y adapta los nombres de campos", async () => {
    request.mockResolvedValue({
      provider: "openrouter",
      key_verified: true,
      models: [{ id: "a:free", name: "A", supports_images: true, free: true }],
    });
    expect(await listModels("openrouter", "  sk-or-nueva  ")).toEqual({
      keyVerified: true,
      models: [{ id: "a:free", name: "A", supportsImages: true, free: true }],
    });
    expect(request.mock.calls[0]?.[0]).toMatchObject({
      method: "GET",
      url: "/ai/models",
      retry: false,
      headers: { "X-AI-Provider": "openrouter", "X-AI-Key": "sk-or-nueva" },
    });
  });

  describe("modo de cookie", () => {
    beforeEach(() => {
      aiCredentials.save({ provider: "gemini", model: "modelo-x", remember: false, sealed: true });
    });

    it("la consulta no lleva la key: solo el modelo y el header anti-CSRF", async () => {
      request.mockResolvedValue({ answer: "ok", provider: "gemini", model: "modelo-x" });
      await chat(input);
      await describeImage(new Blob(["x"]), "");
      for (const [config] of request.mock.calls) {
        expect((config as { headers: Record<string, string> }).headers).toEqual({
          "X-Aula-Clara": "1",
          "X-AI-Model": "modelo-x",
        });
      }
    });

    it("listar modelos sin key usa la cookie", async () => {
      request.mockResolvedValue({ provider: "gemini", key_verified: true, models: [] });
      await listModels("gemini");
      expect(request.mock.calls[0]?.[0]).toMatchObject({
        headers: { "X-Aula-Clara": "1", "X-AI-Provider": "gemini" },
      });
    });

    it("si el servidor dice que la sesión ya no existe, se borra lo guardado y el error sigue su camino", async () => {
      const error = problem(401, "ai_credentials_required");
      request.mockRejectedValue(error);
      await expect(chat(input)).rejects.toBe(error);
      expect(aiCredentials.get()).toBeNull();
    });

    it("otros errores no borran la configuración", async () => {
      request.mockRejectedValue(problem(429, "ai_quota_exceeded"));
      await expect(chat(input)).rejects.toBeDefined();
      expect(aiCredentials.get()?.sealed).toBe(true);
    });
  });
});
