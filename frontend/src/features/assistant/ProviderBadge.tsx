import type { ReactNode } from "react";

import type { Provider } from "./api";

/** Indicador discreto de qué respondió: simulado, o el proveedor real. */
export function ProviderBadge({ provider }: { provider: Provider }): ReactNode {
  const simulated = provider === "mock";
  return (
    <span className="mt-2 block text-sm text-[var(--muted)]">
      {simulated ? "Respuesta simulada" : `Respuesta de IA (${provider === "gemini" ? "Gemini" : "Groq"})`}
    </span>
  );
}
