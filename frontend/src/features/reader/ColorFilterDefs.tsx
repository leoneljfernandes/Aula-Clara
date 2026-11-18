import type { ReactNode } from "react";

import { daltonizeMatrix, feColorMatrixValues } from "@/lib/color/cvd";

/**
 * El filtro SVG de realce de colores (`#cvd-enhance`), que las figuras aplican con `filter: url(#cvd-enhance)`.
 * Trabaja en RGB lineal, igual que la matriz que lo arma.
 */
export function ColorFilterDefs({ kind }: { kind: "protan" | "deutan" | "tritan" }): ReactNode {
  return (
    <svg aria-hidden="true" width="0" height="0" style={{ position: "absolute" }}>
      <filter id="cvd-enhance" colorInterpolationFilters="linearRGB">
        <feColorMatrix type="matrix" values={feColorMatrixValues(daltonizeMatrix(kind))} />
      </filter>
    </svg>
  );
}
