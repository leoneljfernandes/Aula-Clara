import type { ReactNode } from "react";

import { OnboardingWizard } from "@/features/preferences";

export function Component(): ReactNode {
  return (
    <>
      <title>Tu perfil de lectura · Aula Clara</title>
      <OnboardingWizard />
    </>
  );
}
