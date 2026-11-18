import { request } from "@/lib/http";

import type { ProviderId } from "./providers";

/** Los pedidos que usan la cookie llevan este header: el servidor lo exige (protección contra CSRF). */
export const COOKIE_MODE_HEADER = { "X-Aula-Clara": "1" } as const;

export type SealResult =
  /** La key quedó sellada en una cookie `HttpOnly`: la página ya no la tiene. */
  | "sealed"
  /** El servidor no la admite o el navegador no aceptó la cookie: la key se guarda en este navegador. */
  | "unavailable";

/** Borra la cookie en el servidor. Si falla no pasa nada grave: la cookie vence sola. */
export async function dropSession(): Promise<void> {
  try {
    await request({ method: "DELETE", url: "/ai/session", headers: COOKIE_MODE_HEADER, retry: false });
  } catch {
    // vence sola (sesión del navegador o AI_SESSION_*)
  }
}

/**
 * Sella la key en el servidor y comprueba que la cookie vuelva (`GET`): un navegador puede ignorarla, por
 * ejemplo cuando la web y el backend están en sitios distintos. Nunca lanza: cualquier falla es «unavailable»
 * y la app usa el modo de headers.
 */
export async function sealKey(provider: ProviderId, apiKey: string, remember: boolean): Promise<SealResult> {
  try {
    await request({
      method: "POST",
      url: "/ai/session",
      headers: COOKIE_MODE_HEADER,
      data: { provider, api_key: apiKey, remember },
      retry: false,
    });
    await request({ method: "GET", url: "/ai/session", headers: COOKIE_MODE_HEADER, retry: false });
    return "sealed";
  } catch {
    await dropSession(); // si la cookie se creó pero no vuelve, no dejar restos
    return "unavailable";
  }
}
