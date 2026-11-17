import { createBrowserRouter, type RouteObject } from "react-router";

import { homeLoader, requireProfile } from "@/features/preferences";
import { RootLayout } from "@/routes/root-layout";
import { NotFound, RouteError } from "@/routes/route-error";

// Árbol de rutas (docs/arquitectura.md §5.1). Cada vista es lazy: un chunk por ruta, así
// pdf.js y mammoth no entran en el bundle inicial.
export const routes: RouteObject[] = [
  {
    path: "/",
    Component: RootLayout,
    ErrorBoundary: RouteError,
    children: [
      // Con perfil guardado → /biblioteca; sin perfil → /perfil.
      { index: true, loader: homeLoader },
      { path: "perfil", lazy: () => import("@/routes/profile") },
      {
        // Sin perfil guardado, biblioteca y lector pasan antes por el onboarding.
        middleware: [requireProfile],
        ErrorBoundary: RouteError,
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
