import { type ReactNode, useState } from "react";

import { Button } from "@/components/Button";
import { useLastAnnouncement } from "@/lib/announcer";

import { usePreferences } from "./PreferencesProvider";

/**
 * Con «Mostrar los avisos en pantalla», el último anuncio queda visible arriba a la derecha hasta el siguiente o
 * hasta cerrarlo: no desaparece solo (criterio 2.2.1). No es una región `aria-live`: el `Announcer` ya lo anuncia.
 */
export function VisualStatus(): ReactNode {
  const { settings } = usePreferences();
  const last = useLastAnnouncement();
  const [closedId, setClosedId] = useState(0);
  if (!settings.visualAlerts || !last || last.id === closedId) return null;
  return (
    <div className="fixed top-4 right-4 z-50 flex max-w-sm items-center gap-3 rounded-2xl border-4 border-[var(--accent)] bg-[var(--panel)] p-4 text-lg shadow-2xl">
      <p className="font-bold">{last.message}</p>
      <Button onClick={() => setClosedId(last.id)}>Cerrar aviso</Button>
    </div>
  );
}
