import { BLANK, CAPITAL, DIGITS, LATIN_LOWERCASE, LETTERS, NUMBER, SIGNS } from "./table";

export interface BrailleText {
  braille: string;
  /** Caracteres sin signo en la tabla, sin repetir y en orden de aparición. */
  unsupported: readonly string[];
}

const DECIMAL_MARKS = new Set([",", ".", "’", "'"]);
const isDigit = (ch: string | undefined): boolean => ch !== undefined && DIGITS[ch] !== undefined;
const isLetter = (ch: string): boolean => LETTERS[ch.toLowerCase()] !== undefined;
const isUpper = (ch: string): boolean => ch !== ch.toLowerCase();

/** Letras `a`–`j` sin tilde: las que se confunden con cifras (B 2 v3, §8.2). */
const DIGIT_LETTERS = new Set("abcdefghij");

/** `true` si desde `index` hay exactamente tres cifras seguidas (un grupo de miles, B 2 v3, §8.1). */
function isThousandsGroup(chars: readonly string[], index: number): boolean {
  return (
    isDigit(chars[index]) &&
    isDigit(chars[index + 1]) &&
    isDigit(chars[index + 2]) &&
    !isDigit(chars[index + 3])
  );
}

function translateWord(word: string): { braille: string; unsupported: string[] } {
  const chars = [...word.normalize("NFC")];
  const letters = chars.filter(isLetter);
  // B 2 v3, §7.1, recurso 2: una sigla lleva dos signos de mayúscula al inicio.
  const acronym = letters.length >= 2 && letters.every(isUpper);
  let braille = "";
  let inNumber = false;
  let acronymOpen = false;
  const unsupported: string[] = [];
  chars.forEach((ch, i) => {
    const digit = DIGITS[ch];
    if (digit) {
      if (!inNumber) braille += NUMBER;
      inNumber = true;
      braille += digit;
      return;
    }
    // B 2 v3, §8.1: «,» «.» «’» entre cifras son el decimal (punto 2) o, con tres cifras detrás de un «.», el punto de miles (punto 3); el número sigue sin repetir el signo.
    if (inNumber && DECIMAL_MARKS.has(ch) && isDigit(chars[i + 1])) {
      braille += ch === "." && isThousandsGroup(chars, i + 1) ? SIGNS["."]! : SIGNS[","]!;
      return;
    }
    const afterNumber = inNumber;
    inNumber = false;
    const lower = ch.toLowerCase();
    const letter = LETTERS[lower];
    if (letter) {
      if (acronym) {
        if (!acronymOpen) braille += CAPITAL + CAPITAL;
        acronymOpen = true;
      } else if (lower !== ch) {
        braille += CAPITAL;
      }
      // B 2 v3, §8.2: prefijo de latina minúscula (punto 5) entre un número y una letra a–j.
      if (afterNumber && DIGIT_LETTERS.has(ch)) braille += LATIN_LOWERCASE;
      braille += letter;
      return;
    }
    const sign = SIGNS[ch];
    if (sign) braille += sign;
    else unsupported.push(ch);
  });
  return { braille, unsupported };
}

function words(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/** Transcribe a Braille español grado 1. Nunca inventa signos: lo que no está en la tabla se omite y se informa. */
export function toBraille(text: string): BrailleText {
  const translated = words(text).map(translateWord);
  const unsupported = [...new Set(translated.flatMap((w) => w.unsupported))];
  const braille = translated
    .map((w) => w.braille)
    .filter(Boolean)
    .join(BLANK);
  return { braille, unsupported };
}

/** Cada palabra con su transcripción, para la vista espejo (tinta y Braille). */
export function toBrailleWords(text: string): { ink: string; braille: string }[] {
  return words(text)
    .map((ink) => ({ ink, braille: translateWord(ink).braille }))
    .filter((w) => w.braille);
}
