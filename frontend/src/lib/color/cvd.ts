import { linearToSrgb, type RGB, srgbToLinear } from "./convert";

export type CvdKind = "protan" | "deutan" | "tritan" | "achromat";
export type Mat3 = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
];

/**
 * Simulación de la visión con daltonismo en RGB lineal: Machado, Oliveira y Fernandes (2009), severidad 1,0.
 * La de tritanopía es una aproximación. Cada fila suma 1: un gris sigue siendo gris (lo comprueba un test).
 */
const SIMULATION: Record<Exclude<CvdKind, "achromat">, Mat3> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

/** Cuánto del error de color se traslada a los canales que la persona sí distingue (daltonización). */
const ERROR_SHIFT: Record<Exclude<CvdKind, "achromat" | "tritan">, Mat3> & { tritan: Mat3 } = {
  protan: [
    [0, 0, 0],
    [0.7, 1, 0],
    [0.7, 0, 1],
  ],
  deutan: [
    [0, 0, 0],
    [0.7, 1, 0],
    [0.7, 0, 1],
  ],
  tritan: [
    [1, 0, 0.7],
    [0, 1, 0.7],
    [0, 0, 0],
  ],
};

const IDENTITY: Mat3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
const toLinear = (rgb: RGB): [number, number, number] =>
  rgb.map((c) => srgbToLinear(c / 255)) as [number, number, number];
const toRgb = (linear: readonly [number, number, number]): RGB =>
  linear.map((c) => Math.round(linearToSrgb(clamp01(c)) * 255)) as unknown as RGB;
const multiply = (m: Mat3, v: readonly [number, number, number]): [number, number, number] =>
  m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]) as [number, number, number];

/** Cómo se ve un color con ese tipo de daltonismo. Redondea y limita a 0–255. */
export function simulate(rgb: RGB, kind: CvdKind): RGB {
  const linear = toLinear(rgb);
  if (kind === "achromat") {
    const y = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    return toRgb([y, y, y]);
  }
  return toRgb(multiply(SIMULATION[kind], linear));
}

/** Matriz de realce `M = I + E · (I − S)` en RGB lineal. Con acromatopsia no hay realce que ayude. */
export function daltonizeMatrix(kind: Exclude<CvdKind, "achromat">): Mat3 {
  const s = SIMULATION[kind];
  const e = ERROR_SHIFT[kind];
  const diff = IDENTITY.map((row, i) => row.map((v, j) => v - s[i]![j]!)) as unknown as Mat3;
  return IDENTITY.map((row, i) =>
    row.map((v, j) => v + e[i]![0]! * diff[0]![j]! + e[i]![1]! * diff[1]![j]! + e[i]![2]! * diff[2]![j]!),
  ) as unknown as Mat3;
}

/** Aplica una matriz 3 × 3 a un color, en RGB lineal. */
export function applyMatrix(rgb: RGB, m: Mat3): RGB {
  return toRgb(multiply(m, toLinear(rgb)));
}

/** Los 20 valores de un `<feColorMatrix type="matrix">` (3 filas de 5 más la de alfa), con 6 decimales. */
export function feColorMatrixValues(m: Mat3): string {
  const rows = [...m.map((row) => [...row, 0, 0]), [0, 0, 0, 1, 0]];
  return rows
    .flat()
    .map((n) => n.toFixed(6))
    .join(" ");
}

/** Promedio de una ventana de 3 × 3 píxeles centrada en (x, y), recortada en los bordes de la imagen. */
export function sampleAverage(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): RGB {
  const sum = [0, 0, 0];
  let count = 0;
  for (let j = Math.max(0, y - 1); j <= Math.min(height - 1, y + 1); j++) {
    for (let i = Math.max(0, x - 1); i <= Math.min(width - 1, x + 1); i++) {
      const at = (j * width + i) * 4;
      sum[0]! += data[at]!;
      sum[1]! += data[at + 1]!;
      sum[2]! += data[at + 2]!;
      count++;
    }
  }
  return sum.map((total) => Math.round(total / count)) as unknown as RGB;
}

/**
 * Qué realce corresponde a cada «Visión de los colores»: sin daltonismo y con acromatopsia no hay (no ayuda), y
 * quien no sabe de qué tipo es usa el de deuteranopía, el más frecuente.
 */
export function enhancementKind(
  type: "none" | "unsure" | "protan" | "deutan" | "tritan" | "achromat",
): Exclude<CvdKind, "achromat"> | null {
  if (type === "none" || type === "achromat") return null;
  return type === "unsure" ? "deutan" : type;
}
