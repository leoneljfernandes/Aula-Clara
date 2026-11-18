import { afterEach, describe, expect, it, vi } from "vitest";

import { dataUrlToBlob } from "./image";

describe("dataUrlToBlob", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("decodifica base64 sin usar fetch (la CSP de producción bloquea fetch de data: URLs)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const blob = await dataUrlToBlob("data:image/png;base64,iVBORw0KGgo=");
    expect(blob.type).toBe("image/png");
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("acepta data: URLs sin base64 y rechaza lo que no es un data: URL", async () => {
    expect(await (await dataUrlToBlob("data:text/plain,hola%20mundo")).text()).toBe("hola mundo");
    await expect(dataUrlToBlob("https://example.com/a.png")).rejects.toThrow("not a data URL");
  });
});
