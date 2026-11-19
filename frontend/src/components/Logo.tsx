import type { ReactNode } from "react";

import logoUrl from "@/assets/logo.png";

export function Logo(): ReactNode {
  return (
    <div className="flex shrink-0 items-center gap-3">
      {/* Decorativo: el nombre de la app va escrito al lado. */}
      <img src={logoUrl} alt="" width={44} height={44} className="h-11 w-11 shrink-0" />
      <span className="text-xl font-bold tracking-tight whitespace-nowrap">Aula Clara</span>
    </div>
  );
}
