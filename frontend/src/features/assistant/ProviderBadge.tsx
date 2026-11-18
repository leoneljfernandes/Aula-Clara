import type { ReactNode } from "react";

import type { Provider } from "./api";
import { providerLabel } from "./providers";

/** Indicador discreto de qué proveedor y modelo respondió. */
export function ProviderBadge({ provider, model }: { provider: Provider; model: string }): ReactNode {
  return (
    <span className="mt-2 block text-sm break-words text-[var(--muted)]">
      Respuesta de IA ({providerLabel(provider)} · {model})
    </span>
  );
}
