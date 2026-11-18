import type { ReactNode } from "react";
import { useLoaderData } from "react-router";

import { loadPresetCatalog, OnboardingWizard, type PresetCatalog } from "@/features/preferences";

/** El catálogo nunca falla: sin backend usa la caché y, sin caché, queda solo «Personalizado». */
export function loader(): Promise<PresetCatalog> {
  return loadPresetCatalog();
}

export function Component(): ReactNode {
  const catalog = useLoaderData<typeof loader>();
  return (
    <>
      <title>Tu perfil de lectura · Aula Clara</title>
      <OnboardingWizard catalog={catalog} />
    </>
  );
}
