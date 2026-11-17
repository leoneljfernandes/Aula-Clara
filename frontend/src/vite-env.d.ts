/// <reference types="vite/client" />

// Solo variables VITE_*: terminan en el bundle público. Nunca un secreto acá.
interface ImportMetaEnv {
  /** Base de la API. Vacía = mismo origen (/api/v1). */
  readonly VITE_API_URL?: string;
  /** "mock" = sitio 100 % estático, sin backend (GitHub Pages). */
  readonly VITE_AI_MODE?: "api" | "mock";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
