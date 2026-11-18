import { type LoaderFunction, type MiddlewareFunction, redirect } from "react-router";

import { isOnboarded } from "./storage";

/** Solo rutas internas: `?next=//sitio-malo.com` sería un open redirect. */
export function safeNext(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

/** El router sirve la app bajo BASE_URL (p. ej. /aula-clara/ en Pages); `next` va sin ese prefijo. */
function appPath(url: URL): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const path = base && url.pathname.startsWith(base) ? url.pathname.slice(base.length) : url.pathname;
  return (path || "/") + url.search;
}

/** Protege biblioteca y lector: sin terminar el onboarding se pasa primero por él. */
export const requireOnboarding: MiddlewareFunction = ({ request }) => {
  if (isOnboarded()) return;
  throw redirect(`/perfil?next=${encodeURIComponent(appPath(new URL(request.url)))}`);
};

export const homeLoader: LoaderFunction = () => redirect(isOnboarded() ? "/biblioteca" : "/perfil");
