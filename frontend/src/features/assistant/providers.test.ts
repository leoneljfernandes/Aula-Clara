import { describe, expect, it } from "vitest";

import { PROVIDERS, providerInfo, providerLabel } from "./providers";

describe("catálogo de proveedores", () => {
  it("tiene los siete, sin ids repetidos", () => {
    expect(PROVIDERS.map((p) => p.id)).toEqual([
      "gemini",
      "anthropic",
      "openai",
      "groq",
      "openrouter",
      "mistral",
      "nvidia",
    ]);
    expect(new Set(PROVIDERS.map((p) => p.id)).size).toBe(PROVIDERS.length);
  });

  it("todos mandan a páginas https y terminan el paso a paso pegando la key en la app", () => {
    for (const p of PROVIDERS) {
      expect(p.keyUrl).toMatch(/^https:\/\//);
      expect(p.signupUrl).toMatch(/^https:\/\//);
      expect(p.steps.at(-1) ?? p.steps[p.steps.length - 1]).toBeTruthy();
      expect(p.steps.some((step) => step.includes("Configurar IA"))).toBe(true);
    }
  });

  it("OpenAI y Anthropic están marcados de pago y dicen que no hay uso gratuito", () => {
    for (const id of ["openai", "anthropic"]) {
      const info = providerInfo(id)!;
      expect(info.paid).toBe(true);
      expect(info.free).toContain("No tiene");
      expect(info.needs).toContain("tarjeta");
      expect(info.warnings.join(" ")).toContain("límite de gasto");
    }
    expect(PROVIDERS.filter((p) => !p.paid).map((p) => p.id)).toEqual([
      "gemini",
      "groq",
      "openrouter",
      "mistral",
      "nvidia",
    ]);
  });

  it("cada proveedor dice cómo se reconoce su key", () => {
    expect(providerInfo("openai")!.keyHint).toContain("sk-");
    expect(providerInfo("anthropic")!.keyHint).toContain("sk-ant-");
  });

  it("los nombres que se muestran", () => {
    expect(providerLabel("openai")).toBe("OpenAI (ChatGPT)");
    expect(providerLabel("anthropic")).toBe("Anthropic (Claude)");
    expect(providerLabel("desconocido")).toBe("desconocido");
  });
});
