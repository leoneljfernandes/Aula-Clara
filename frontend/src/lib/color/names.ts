import { deltaE2000, hexToRgb, type Lab, type RGB, rgbToHex, rgbToLab } from "./convert";

/** Los 18 nombres de color en español y su color de referencia. Si un test falla, se ajusta la referencia. */
export const COLOR_NAMES: readonly { name: string; hex: string }[] = [
  { name: "Negro", hex: "#000000" },
  { name: "Blanco", hex: "#FFFFFF" },
  { name: "Gris", hex: "#808080" },
  { name: "Gris claro", hex: "#C8C8C8" },
  { name: "Gris oscuro", hex: "#404040" },
  { name: "Rojo", hex: "#D62728" },
  { name: "Rojo oscuro", hex: "#8B1A1A" },
  { name: "Rosa", hex: "#F48FB1" },
  { name: "Naranja", hex: "#F58220" },
  { name: "Marrón", hex: "#8C564B" },
  { name: "Amarillo", hex: "#F0E030" },
  { name: "Verde claro", hex: "#98DF8A" },
  { name: "Verde", hex: "#2CA02C" },
  { name: "Verde oscuro", hex: "#1B5E20" },
  { name: "Celeste", hex: "#6EC6F0" },
  { name: "Azul", hex: "#1F57D0" },
  { name: "Azul marino", hex: "#1A2A6C" },
  { name: "Violeta", hex: "#8E44AD" },
];

const REFERENCES: readonly { name: string; lab: Lab }[] = COLOR_NAMES.map(({ name, hex }) => ({
  name,
  lab: rgbToLab(hexToRgb(hex)),
}));

/** El nombre de la referencia más cercana por CIEDE2000. `hex` es el color medido, no el de referencia. */
export function nameColor(rgb: RGB): { name: string; hex: string } {
  const lab = rgbToLab(rgb);
  let best = REFERENCES[0]!;
  let bestDistance = Infinity;
  for (const reference of REFERENCES) {
    const distance = deltaE2000(lab, reference.lab);
    if (distance < bestDistance) {
      best = reference;
      bestDistance = distance;
    }
  }
  return { name: best.name, hex: rgbToHex(rgb) };
}
