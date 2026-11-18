/// <reference types="vite/client" />

// Solo variables VITE_*: terminan en el bundle público. Nunca un secreto acá.
interface ImportMetaEnv {
  /** Base de la API. Vacía = mismo origen (/api/v1). */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
