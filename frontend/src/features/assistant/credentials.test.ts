import { describe, expect, it, vi } from "vitest";

import { aiCredentials, type AICredentials } from "./credentials";

const BASE: AICredentials = { provider: "gemini", apiKey: "key-123", model: "m", remember: false };
const SEALED: AICredentials = { provider: "gemini", model: "m", remember: false, sealed: true };

describe("credenciales de IA en el navegador", () => {
  it("por defecto se guardan solo en la sesión (se borran al cerrar la pestaña)", () => {
    aiCredentials.save(BASE);
    expect(window.sessionStorage.getItem("aulaclara.ai")).not.toBeNull();
    expect(window.localStorage.getItem("aulaclara.ai")).toBeNull();
    expect(aiCredentials.get()).toEqual(BASE);
  });

  it("con «recordar» pasan a localStorage y no quedan copias en la sesión", () => {
    aiCredentials.save(BASE);
    aiCredentials.save({ ...BASE, remember: true });
    expect(window.sessionStorage.getItem("aulaclara.ai")).toBeNull();
    expect(aiCredentials.get()?.remember).toBe(true);
  });

  it("borrar quita la key de los dos almacenamientos y avisa a quien escucha", () => {
    const listener = vi.fn();
    const unsubscribe = aiCredentials.subscribe(listener);
    aiCredentials.save({ ...BASE, remember: true });
    aiCredentials.clear();
    expect(aiCredentials.get()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("la instantánea es estable mientras no cambie lo guardado", () => {
    aiCredentials.save(BASE);
    expect(aiCredentials.get()).toBe(aiCredentials.get());
  });

  it.each([
    "no-es-json",
    JSON.stringify({ ...BASE, provider: "otro" }),
    JSON.stringify({ ...BASE, apiKey: "" }),
    JSON.stringify({ ...BASE, model: 3 }),
  ])("ignora datos guardados inválidos: %s", (raw) => {
    window.sessionStorage.setItem("aulaclara.ai", raw);
    expect(aiCredentials.get()).toBeNull();
  });

  it("se entera de los cambios hechos en otra pestaña (evento storage)", () => {
    const listener = vi.fn();
    const unsubscribe = aiCredentials.subscribe(listener);
    window.localStorage.setItem("aulaclara.ai", JSON.stringify({ ...BASE, remember: true }));
    window.dispatchEvent(new StorageEvent("storage", { key: "aulaclara.ai" }));
    window.dispatchEvent(new StorageEvent("storage", { key: "otra-cosa" }));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(aiCredentials.get()?.remember).toBe(true);
    unsubscribe();
    window.dispatchEvent(new StorageEvent("storage", { key: "aulaclara.ai" }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("en modo de cookie no hay ninguna key: ni se guarda ni se lee una que viniera de afuera", () => {
    aiCredentials.save(SEALED);
    expect(aiCredentials.get()).toEqual(SEALED);
    // Aunque alguien deje una key junto al aviso, la lectura la descarta.
    window.sessionStorage.setItem("aulaclara.ai", JSON.stringify({ ...SEALED, apiKey: "intrusa-123" }));
    expect(aiCredentials.get()).toEqual(SEALED);
    expect(aiCredentials.get()).not.toHaveProperty("apiKey");
  });

  it("pasar de headers a cookie deja el almacenamiento sin la key", () => {
    aiCredentials.save(BASE);
    aiCredentials.save(SEALED);
    expect(window.sessionStorage.getItem("aulaclara.ai")).not.toContain("key-123");
  });

  it.each([
    JSON.stringify({ provider: "gemini", model: "m", remember: false }), // ni key ni sellada
    JSON.stringify({ provider: "gemini", model: "m", remember: false, sealed: false }),
    JSON.stringify({ provider: "gemini", model: "", remember: false, sealed: true }),
  ])("ignora una configuración sin key ni sello válido: %s", (raw) => {
    window.sessionStorage.setItem("aulaclara.ai", raw);
    expect(aiCredentials.get()).toBeNull();
  });
});
