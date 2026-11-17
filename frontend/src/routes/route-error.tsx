import type { ReactNode } from "react";
import { isRouteErrorResponse, Link, useRouteError } from "react-router";

function Page({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <main id="contenido" tabIndex={-1} className="mx-auto max-w-3xl px-5 py-10">
      <title>{`${title} · Aula Clara`}</title>
      <h1 className="mb-4 text-3xl font-bold">{title}</h1>
      {children}
      <p className="mt-6">
        <Link to="/biblioteca" className="text-lg font-bold underline">
          Volver a mi biblioteca
        </Link>
      </p>
    </main>
  );
}

/** ErrorBoundary de rama: distingue respuestas de ruta (404) de errores inesperados. */
export function RouteError(): ReactNode {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />;
  return (
    <Page title="Algo salió mal">
      <p role="alert" className="text-lg">
        No pudimos mostrar esta pantalla. Probá de nuevo en unos segundos.
      </p>
    </Page>
  );
}

export function NotFound(): ReactNode {
  return (
    <Page title="No encontramos esta página">
      <p className="text-lg">Revisá la dirección o volvé a tu biblioteca.</p>
    </Page>
  );
}
