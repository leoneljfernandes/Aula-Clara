import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";

import { request } from "./client";
import { ApiRequestError } from "./errors";

function failingAdapter(): {
  adapter: (config: InternalAxiosRequestConfig) => Promise<never>;
  calls: () => number;
} {
  let calls = 0;
  return {
    adapter: (config) => {
      calls += 1;
      return Promise.reject(new AxiosError("Network Error", "ERR_NETWORK", config));
    },
    calls: () => calls,
  };
}

describe("cliente HTTP: reintentos", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reintenta un GET ante un error de red (2 reintentos)", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // sin espera entre intentos
    const { adapter, calls } = failingAdapter();
    await expect(request({ method: "GET", url: "/x", adapter })).rejects.toMatchObject({
      error: { kind: "network" },
    });
    expect(calls()).toBe(3);
  });

  it("con retry: false hace un solo intento (pedidos que gastan cuota de IA)", async () => {
    const { adapter, calls } = failingAdapter();
    await expect(request({ method: "GET", url: "/x", adapter, retry: false })).rejects.toMatchObject({
      error: { kind: "network" },
    });
    expect(calls()).toBe(1);
  });
});

describe("cliente HTTP: credenciales en los errores", () => {
  it("la API key no queda en el error que se reporta (cause) ni en su JSON", async () => {
    const secret = "AIza-clave-secreta-0123456789";
    const adapter = (config: InternalAxiosRequestConfig): Promise<never> =>
      Promise.reject(new AxiosError("Network Error", "ERR_NETWORK", config));
    const error = await request({
      method: "POST",
      url: "/x",
      adapter,
      retry: false,
      headers: { "X-AI-Key": secret, "X-AI-Provider": "gemini", Authorization: `Bearer ${secret}` },
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    const everything =
      JSON.stringify(error, Object.getOwnPropertyNames(error)) + JSON.stringify((error as Error).cause);
    expect(everything).not.toContain(secret);
    expect(everything).toContain("gemini"); // lo demás del pedido se conserva para depurar
  });
});
