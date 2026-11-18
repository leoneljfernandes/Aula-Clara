/** Matemática de color pura: sRGB, RGB lineal, CIELAB (D65) y la distancia CIEDE2000. Sin navegador. */

/** Canales de 0 a 255. */
export type RGB = readonly [number, number, number];
/** L (0–100), a, b. */
export type Lab = readonly [number, number, number];

export function hexToRgb(hex: string): RGB {
  const value = hex.replace(/^#/, "");
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)) as unknown as RGB;
}

export function rgbToHex(rgb: RGB): string {
  return `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/** Un canal sRGB (0–1) a RGB lineal (0–1). */
export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Un canal en RGB lineal (0–1) a sRGB (0–1). */
export function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

const D65 = [0.95047, 1, 1.08883] as const;

export function rgbToLab(rgb: RGB): Lab {
  const [r, g, b] = rgb.map((c) => srgbToLinear(c / 255)) as [number, number, number];
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / D65[0];
  const y = (0.2126729 * r + 0.7151522 * g + 0.072175 * b) / D65[1];
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / D65[2];
  const f = (t: number): number => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)] as const;
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const rad = (deg: number): number => (deg * Math.PI) / 180;
const hueDeg = (b: number, a: number): number =>
  b === 0 && a === 0 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
const POW25_7 = 25 ** 7;

/** Distancia de color CIEDE2000 (Sharma, Wu y Dalal, 2005), con kL = kC = kH = 1. */
export function deltaE2000(lab1: Lab, lab2: Lab): number {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;
  const meanC = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(meanC ** 7 / (meanC ** 7 + POW25_7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h1p = hueDeg(b1, a1p);
  const h2p = hueDeg(b2, a2p);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  const noChroma = C1p * C2p === 0;
  let dhp = 0;
  if (!noChroma) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp / 2));

  const meanL = (L1 + L2) / 2;
  const meanCp = (C1p + C2p) / 2;
  let meanHp = h1p + h2p;
  if (!noChroma) {
    if (Math.abs(h1p - h2p) <= 180) meanHp = (h1p + h2p) / 2;
    else meanHp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
  }
  const T =
    1 -
    0.17 * Math.cos(rad(meanHp - 30)) +
    0.24 * Math.cos(rad(2 * meanHp)) +
    0.32 * Math.cos(rad(3 * meanHp + 6)) -
    0.2 * Math.cos(rad(4 * meanHp - 63));
  const dTheta = 30 * Math.exp(-(((meanHp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(meanCp ** 7 / (meanCp ** 7 + POW25_7));
  const Sl = 1 + (0.015 * (meanL - 50) ** 2) / Math.sqrt(20 + (meanL - 50) ** 2);
  const Sc = 1 + 0.045 * meanCp;
  const Sh = 1 + 0.015 * meanCp * T;
  const Rt = -Math.sin(rad(2 * dTheta)) * Rc;

  const l = dLp / Sl;
  const c = dCp / Sc;
  const h = dHp / Sh;
  return Math.sqrt(l * l + c * c + h * h + Rt * c * h);
}

/** Luminancia relativa de WCAG (0 = negro, 1 = blanco). */
export function relativeLuminance(rgb: RGB): number {
  const [r, g, b] = rgb.map((c) => srgbToLinear(c / 255)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste de WCAG entre dos colores: de 1 (iguales) a 21 (blanco y negro). */
export function contrastRatio(a: RGB, b: RGB): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
