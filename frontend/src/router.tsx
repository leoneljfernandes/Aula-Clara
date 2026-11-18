import { createBrowserRouter, type RouteObject } from "react-router";

import { homeLoader, requireOnboarding } from "@/features/preferences";
import { RootLayout } from "@/routes/root-layout";
import { NotFound, RouteError } from "@/routes/route-error";
import { RoutePending } from "@/routes/route-pending";

// Primera carga: mientras corren los loaders (el catálogo de /perfil tarda hasta 5 s) se ve un
// aviso en vez de una página vacía. Durante una redirección (/ o /leer/… → /perfil) React Router
// sigue mostrando las rutas de origen, por eso el aviso también va en la raíz y en las protegidas.
const pending = <RoutePending message="Cargando…" />;

// Árbol de rutas (docs/arquitectura.md §5.1). Cada vista es lazy: un chunk por ruta, así
// pdf.js y mammoth no entran en el bundle inicial.
export const routes: RouteObject[] = [
  {
    path: "/",
    Component: RootLayout,
    ErrorBoundary: RouteError,
    children: [
      // Con el onboarding hecho → /biblioteca; sin hacer → /perfil.
      { index: true, loader: homeLoader, hydrateFallbackElement: pending },
      {
        path: "perfil",
        lazy: () => import("@/routes/profile"),
        hydrateFallbackElement: <RoutePending message="Cargando tu perfil de lectura…" />,
      },
      // La guía de API keys es pública: se puede leer antes de elegir un perfil.
      { path: "ayuda/ia", lazy: () => import("@/routes/ai-guide") },
      {
        // Sin el onboarding hecho, biblioteca y lector pasan antes por él.
        middleware: [requireOnboarding],
        ErrorBoundary: RouteError,
        hydrateFallbackElement: pending,
        children: [
          { path: "biblioteca", lazy: () => import("@/routes/library") },
          { path: "leer/:documentId", lazy: () => import("@/routes/reader"), ErrorBoundary: RouteError },
        ],
      },
      { path: "*", Component: NotFound },
    ],
  },
];

// basename = base de Vite: "/" en local y Vercel, "/<repo>/" en GitHub Pages.
export const router = createBrowserRouter(routes, { basename: import.meta.env.BASE_URL });
