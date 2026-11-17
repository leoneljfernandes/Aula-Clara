// Flat config. Hace cumplir la dirección de dependencias de architecting-react-apps:
// routes → features → components/lib, features solo por su index.ts y axios solo en lib/http.
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const axiosOnlyInLibHttp = { group: ["axios"], message: "Solo lib/http habla con axios." };
const noRelativeUp = {
  group: ["../*"],
  message: "Importar con el alias @/ (o ./ dentro de la misma carpeta).",
};
const featureByIndexOnly = {
  group: ["@/features/*/*"],
  message: "Importar la feature por su index.ts (@/features/x).",
};
const noFeatures = {
  group: ["@/features", "@/features/*"],
  message: "components/ y lib/ no dependen de features/.",
};
const noRoutes = {
  group: ["@/routes", "@/routes/*"],
  message: "Solo routes/ y router.tsx importan routes/.",
};

// En flat config una regla se REEMPLAZA, no se mezcla: cada grupo repite la lista completa.
const restrict = (...patterns) => ({ "no-restricted-imports": ["error", { patterns }] });
const sources = ["src/**/*.{ts,tsx}"];

export default tseslint.config(
  { ignores: ["dist", "coverage"] },
  {
    files: sources,
    extends: [js.configs.recommended, ...tseslint.configs.recommended, reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
  },
  { files: sources, rules: restrict(axiosOnlyInLibHttp, noRelativeUp, featureByIndexOnly) },
  {
    files: ["src/components/**", "src/lib/**"],
    rules: restrict(axiosOnlyInLibHttp, noRelativeUp, featureByIndexOnly, noFeatures, noRoutes),
  },
  {
    files: ["src/features/**"],
    rules: restrict(axiosOnlyInLibHttp, noRelativeUp, featureByIndexOnly, noRoutes),
  },
  // Al final: la excepción de lib/http (el único lugar que importa axios).
  { files: ["src/lib/http/**"], rules: restrict(noRelativeUp, featureByIndexOnly, noFeatures, noRoutes) },
);
