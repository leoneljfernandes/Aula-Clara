import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "@/lib/http";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/http", async (original) => ({ ...(await original<typeof import("@/lib/http")>()), request }));

import { dropSession, sealKey } from "./session";

const fail = (status: number, code: string): ApiRequestError =>
  new ApiRequestError({ kind: "server", status, problem: { title: "x", status, code } });

describe("key sellada: sellar y comprobar", () => {
  beforeEach(() => {
    request.mockReset();
  });

  it("manda la key una vez, comprueba que la cookie vuelve y devuelve «sealed»", async () => {
    request.mockResolvedValue({});
    expect(await sealKey("groq", "gsk_abc", true)).toBe("sealed");
    const [post, get] = request.mock.calls.map(([c]) => c);
    expect(post).toMatchObject({
      method: "POST",
      url: "/ai/session",
      retry: false,
      headers: { "X-Aula-Clara": "1" },
      data: { provider: "groq", api_key: "gsk_abc", remember: true },
    });
    expect(get).toMatchObject({ method: "GET", url: "/ai/session" });
    expect(get).not.toHaveProperty("data"); // la comprobación no lleva la key
  });

  it("si el servidor no lo admite devuelve «unavailable» sin lanzar", async () => {
    request.mockImplementation(({ method }: { method: string }) =>
      method === "POST" ? Promise.reject(fail(503, "ai_sessions_disabled")) : Promise.resolve(),
    );
    expect(await sealKey("groq", "gsk_abc", false)).toBe("unavailable");
  });

  it("si la cookie no vuelve, deja limpio: borra lo que pudo haber quedado", async () => {
    request.mockImplementation(({ method }: { method: string }) =>
      method === "GET" ? Promise.reject(fail(401, "ai_credentials_required")) : Promise.resolve(),
    );
    expect(await sealKey("groq", "gsk_abc", false)).toBe("unavailable");
    expect(request.mock.calls.map(([c]) => (c as { method: string }).method)).toEqual([
      "POST",
      "GET",
      "DELETE",
    ]);
  });

  it("sin red tampoco lanza", async () => {
    request.mockRejectedValue(new ApiRequestError({ kind: "network" }));
    expect(await sealKey("groq", "gsk_abc", false)).toBe("unavailable");
  });

  it("borrar la sesión nunca lanza", async () => {
    request.mockRejectedValue(new ApiRequestError({ kind: "network" }));
    await expect(dropSession()).resolves.toBeUndefined();
  });
});
