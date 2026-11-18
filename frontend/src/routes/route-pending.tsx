import type { ReactNode } from "react";

import { Logo } from "@/components/Logo";

/**
 * Lo que se ve en la primera carga mientras corren los loaders (p. ej. el catálogo de /perfil, que
 * puede tardar hasta 5 s). Va en el objeto de la ruta y no en su módulo lazy: React Router no vuelve
 * a renderizar cuando resuelve el `lazy`, así que un `HydrateFallback` exportado desde ahí no se vería.
 */
export function RoutePending({ message }: { message: string }): ReactNode {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b-2 border-[var(--border)] px-6 py-4">
        <Logo />
      </header>
      <main id="contenido" className="mx-auto w-full max-w-4xl flex-1 px-5 py-10">
        <p role="status" className="text-xl">
          {message}
        </p>
      </main>
    </div>
  );
}
