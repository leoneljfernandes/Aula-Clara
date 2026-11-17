import type { ReactNode } from "react";
import { Outlet } from "react-router";

import { SkipLink } from "@/components/SkipLink";
import { PreferencesProvider, ThemeScope } from "@/features/preferences";
import { AnnouncerProvider } from "@/lib/announcer";

/** Layout raíz: preferencias, avisos para lectores de pantalla, tema y enlace «Saltar al contenido». */
export function RootLayout(): ReactNode {
  return (
    <PreferencesProvider>
      <AnnouncerProvider>
        <ThemeScope>
          <SkipLink />
          <Outlet />
        </ThemeScope>
      </AnnouncerProvider>
    </PreferencesProvider>
  );
}
