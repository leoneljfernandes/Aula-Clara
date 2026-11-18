import type { Ref } from "react";

import { SAMPLE_CHART } from "@/features/library";

const W = 640;
const H = 340;
const PAD = { l: 64, r: 20, t: 30, b: 50 };
const MAX = 3500;

/** Gráfico del documento de ejemplo: una imagen SIN texto alternativo, a propósito (lo describe la IA). */
export function BarChart({ svgRef }: { svgRef?: Ref<SVGSVGElement> }) {
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const bw = iw / SAMPLE_CHART.length;
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label="Imagen del documento original: gráfico de barras sin descripción alternativa. Usá el botón Interpretar con IA para escuchar o leer su contenido."
    >
      <rect width={W} height={H} style={{ fill: "var(--bg)" }} />
      {[0, 1000, 2000, 3000].map((v) => {
        const y = PAD.t + ih - (v / MAX) * ih;
        return (
          <g key={v}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y}
              y2={y}
              style={{ stroke: "var(--border)" }}
              strokeDasharray="4 6"
            />
            <text
              x={PAD.l - 10}
              y={y + 5}
              textAnchor="end"
              style={{ fill: "var(--fg)", fontSize: 15, fontFamily: "Arial" }}
            >
              {v.toLocaleString("es-AR")}
            </text>
          </g>
        );
      })}
      {SAMPLE_CHART.map(([year, value], i) => {
        const h = (value / MAX) * ih;
        const x = PAD.l + i * bw + bw * 0.2;
        return (
          <g key={year}>
            <rect
              x={x}
              y={PAD.t + ih - h}
              width={bw * 0.6}
              height={h}
              rx="4"
              style={{ fill: "var(--accent)" }}
            />
            <text
              x={x + bw * 0.3}
              y={H - PAD.b + 26}
              textAnchor="middle"
              style={{ fill: "var(--fg)", fontSize: 16, fontFamily: "Arial", fontWeight: 700 }}
            >
              {year}
            </text>
          </g>
        );
      })}
      <line
        x1={PAD.l}
        x2={W - PAD.r}
        y1={PAD.t + ih}
        y2={PAD.t + ih}
        style={{ stroke: "var(--fg)" }}
        strokeWidth="2"
      />
    </svg>
  );
}
