/** Braille ASCII norteamericano (NABCC): el índice es `codepoint − 0x2800`. */
export const NABCC = " A1B'K2L@CIF/MSP\"E3H9O6R^DJG>NTQ,*5<-U8V.%[$+X!&;:4\\0Z7(_?W]#Y)=";

const FIRST = 0x2800;

/** Pasa una línea de Braille Unicode (6 puntos) a ASCII. Cualquier otro carácter es un error de programación. */
export function toBrfLine(braille: string): string {
  let out = "";
  for (const ch of braille) {
    const index = ch.codePointAt(0)! - FIRST;
    if (index < 0 || index >= NABCC.length)
      throw new RangeError(
        `No es una celda Braille de 6 puntos: U+${ch.codePointAt(0)!.toString(16).toUpperCase()}`,
      );
    out += NABCC[index];
  }
  return out;
}

/** Líneas separadas por `\r\n` y páginas por `\f`. */
export function toBrfDocument(pages: readonly (readonly string[])[]): string {
  return pages.map((page) => page.map(toBrfLine).join("\r\n")).join("\f");
}
