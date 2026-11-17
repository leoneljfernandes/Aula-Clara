import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource/opendyslexic/400.css";
import "@fontsource/opendyslexic/700.css";
import "./index.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { type ClientOnErrorFunction, isRouteErrorResponse } from "react-router";
import { RouterProvider } from "react-router/dom";

import { reportError } from "@/lib/telemetry";
import { router } from "@/router";

// Errores de loaders/actions/render dentro de rutas (los atrapa el router).
const onRouterError: ClientOnErrorFunction = (error, { location, pattern }) => {
  // 404 y demás respuestas de ruta son esperables: se muestran, no se reportan.
  if (isRouteErrorResponse(error)) return;
  reportError(error, { scope: "router", route: pattern, extra: { path: location.pathname } });
};

const container = document.getElementById("root");
if (!container) throw new Error("#root not found");

createRoot(container, {
  onUncaughtError: (error, info) =>
    reportError(error, { scope: "react-uncaught", componentStack: info.componentStack }),
  onRecoverableError: (error, info) =>
    reportError(error, { scope: "react-recoverable", componentStack: info.componentStack }),
  // onCaughtError no se usa: cada boundary ya reporta en componentDidCatch (evita duplicados).
}).render(
  <StrictMode>
    <RouterProvider router={router} onError={onRouterError} />
  </StrictMode>,
);
