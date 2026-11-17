/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";

import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// Un único .env en la raíz del repo (lo comparte con el backend). Vite solo expone al bundle
// las variables VITE_*; las keys de IA del backend nunca llegan al navegador.
const envDir = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig(({ mode }) => {
  // Prefijo "" para leer también las variables que solo usa esta config (no van al bundle).
  const env = loadEnv(mode, envDir, "");

  return {
    envDir,
    // GitHub Pages sirve el sitio bajo /<repo>/: el workflow fija BASE_PATH.
    base: env.BASE_PATH || "/",
    // React Compiler (optimizing-react-renders): sin useMemo/useCallback manuales.
    plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    server: {
      // Mismo origen en desarrollo: /api va a FastAPI, sin CORS.
      proxy: { "/api": env.FRONTEND_API_PROXY_TARGET || "http://localhost:8000" },
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      css: false,
    },
  };
});
