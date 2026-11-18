/** Carácter Braille Unicode (U+2800 + Σ 2^(punto−1)) a partir de los puntos 1–6. */
export function cell(...dots: number[]): string {
  return String.fromCodePoint(0x2800 + dots.reduce((sum, dot) => sum + 2 ** (dot - 1), 0));
}

/** Signo de mayúscula (puntos 4-6). */
export const CAPITAL = cell(4, 6);
/** Signo de número (puntos 3-4-5-6). */
export const NUMBER = cell(3, 4, 5, 6);
/** Prefijo de latina minúscula (punto 5): separa un número de una letra a–j (B 2 v3, §8.2). */
export const LATIN_LOWERCASE = cell(5);
/** Celda vacía (U+2800): el espacio entre palabras. */
export const BLANK = "⠀";

/** Letras `a`–`z` del Braille internacional, vocales con tilde, `ü` y `ñ`. */
export const LETTERS: Readonly<Record<string, string>> = {
  a: "⠁",
  b: "⠃",
  c: "⠉",
  d: "⠙",
  e: "⠑",
  f: "⠋",
  g: "⠛",
  h: "⠓",
  i: "⠊",
  j: "⠚",
  k: "⠅",
  l: "⠇",
  m: "⠍",
  n: "⠝",
  o: "⠕",
  p: "⠏",
  q: "⠟",
  r: "⠗",
  s: "⠎",
  t: "⠞",
  u: "⠥",
  v: "⠧",
  w: "⠺",
  x: "⠭",
  y: "⠽",
  z: "⠵",
  á: cell(1, 2, 3, 5, 6),
  é: cell(2, 3, 4, 6),
  í: cell(3, 4),
  ó: cell(3, 4, 6),
  ú: cell(2, 3, 4, 5, 6),
  ü: cell(1, 2, 5, 6),
  ñ: cell(1, 2, 4, 5, 6),
};

/** Puntuación. */
export const SIGNS: Readonly<Record<string, string>> = {
  ".": cell(3),
  ",": cell(2),
  ";": cell(2, 3),
  ":": cell(2, 5),
  "¿": cell(2, 6),
  "?": cell(2, 6),
  "¡": cell(2, 3, 5),
  "!": cell(2, 3, 5),
  "(": cell(1, 2, 6),
  ")": cell(3, 4, 5),
  "-": cell(3, 6),
  '"': cell(2, 3, 6),
  "«": cell(2, 3, 6),
  "»": cell(2, 3, 6),
};

/** Dígitos: `1`–`9` y `0` son las letras `a`–`j`. */
export const DIGITS: Readonly<Record<string, string>> = {
  "1": LETTERS["a"]!,
  "2": LETTERS["b"]!,
  "3": LETTERS["c"]!,
  "4": LETTERS["d"]!,
  "5": LETTERS["e"]!,
  "6": LETTERS["f"]!,
  "7": LETTERS["g"]!,
  "8": LETTERS["h"]!,
  "9": LETTERS["i"]!,
  "0": LETTERS["j"]!,
};
