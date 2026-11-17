import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "@/lib/http";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/http", async (original) => ({ ...(await original<typeof import("@/lib/http")>()), request }));

import { chat, describeApiError, describeImage } from "./api";

const input = { action: "summarize" as const, documentText: "texto del documento" };

describe("asistente: cliente de IA", () => {
  beforeEach(() => {
    request.mockReset(); // bloque: un beforeEach que devuelve una función la ejecuta como teardown
  });

  it("con VITE_AI_MODE=mock ni siquiera llama a la API", async () => {
    const answer = await chat(input);
    expect(request).not.toHaveBeenCalled();
    expect(answer.provider).toBe("mock");
    expect(answer.text).toContain("Resumen de esta página");
  });

  describe("modo api", () => {
    beforeEach(() => {
      vi.stubEnv("VITE_AI_MODE", "api");
    });

    it("manda la acción y el texto, y devuelve el proveedor que respondió", async () => {
      request.mockResolvedValue({ answer: "respuesta real", provider: "gemini" });
      expect(await chat({ ...input, selection: "un párrafo" })).toEqual({
        text: "respuesta real",
        provider: "gemini",
      });
      expect(request.mock.calls[0]?.[0]).toMatchObject({
        method: "POST",
        url: "/ai/chat",
        data: { action: "summarize", document_text: "texto del documento", selection: "un párrafo" },
      });
    });

    it.each(["network", "timeout", "server"] as const)(
      "si la API falla (%s) cae al mock en vez de romper",
      async (kind) => {
        request.mockRejectedValue(
          new ApiRequestError(kind === "server" ? { kind, status: 502, problem: null } : { kind }),
        );
        expect((await chat(input)).provider).toBe("mock");
      },
    );

    it("un 429 NO cae al mock: se le dice a la persona cuánto esperar", async () => {
      const error = new ApiRequestError({ kind: "rate_limited", retryAfterMs: 42_000, problem: null });
      request.mockRejectedValue(error);
      await expect(chat(input)).rejects.toBe(error);
      expect(describeApiError(error)).toContain("42 segundos");
    });

    it("describir una imagen manda multipart con la imagen y el contexto", async () => {
      request.mockResolvedValue({ description: "un gráfico", provider: "gemini" });
      const result = await describeImage(new Blob(["x"], { type: "image/jpeg" }), "Gráfico 1", true);
      expect(result).toEqual({ text: "un gráfico", provider: "gemini" });
      const form = request.mock.calls[0]?.[0].data as FormData;
      expect(form.get("context")).toBe("Gráfico 1");
      expect(form.get("image")).toBeInstanceOf(Blob);
    });

    it("sin conexión, la imagen de ejemplo tiene descripción simulada y las demás un aviso", async () => {
      request.mockRejectedValue(new ApiRequestError({ kind: "network" }));
      expect((await describeImage(new Blob(["x"]), "", true)).text).toContain("gráfico de barras");
      expect((await describeImage(new Blob(["x"]), "", false)).text).toContain("No pudimos conectarnos");
    });
  });
});
