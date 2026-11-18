import type { ReactNode } from "react";

import logoUrl from "@/assets/logo.png";

export function Logo(): ReactNode {
  return (
    <div className="flex items-center gap-3">
      {/* Decorativo: el nombre de la app va escrito al lado. */}
      <img src={logoUrl} alt="" width={44} height={44} className="h-11 w-11" />
      <span className="text-xl font-bold tracking-tight">Aula Clara</span>
    </div>
  );
}
