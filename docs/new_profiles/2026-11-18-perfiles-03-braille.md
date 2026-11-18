# Perfiles 03 · Braille — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transcribir el documento abierto a Braille español (Grado 1), mostrarlo en pantalla para quien ve, descargarlo como `.BRF` para impresoras Braille e imprimirlo en relieve sobre papel microcápsula con medidas reales. Las descripciones de las figuras quedan guardadas para no gastar cuota dos veces.

**Architecture:**
- El motor es puro y no tiene dependencias. Vive en `lib/braille/`:
  - `table.ts`: los signos;
  - `translate.ts`: texto a Braille Unicode;
  - `layout.ts`: líneas y páginas;
  - `brf.ts`: Braille ASCII norteamericano.
- La feature `reader/braille/` convierte un `Article` en párrafos Braille y tiene el diálogo y la hoja de impresión en SVG con milímetros.
- Las descripciones de figuras se guardan en el campo `alt` que ya existe en el bloque `figure`, en IndexedDB.

**Tech Stack:** TypeScript puro, SVG, CSS `@media print`, IndexedDB (`fake-indexeddb` en los tests).

**Spec:** [docs/new_profiles/01-perfil-ceguera.md](./01-perfil-ceguera.md) §2.3 y §3 pasos 2, 3 y 5; [hoja de ruta](2026-11-18-perfiles-00-hoja-de-ruta.md) §7; Comisión Braille Española, *Documento técnico B 2: Signografía básica*, versión 3 (junio de 2023).

## Global Constraints

- Incluye las restricciones globales de la hoja de ruta (§6). Depende de los planes 01 y 02 (`KEYMAP.openBraille`, `controls.ts`, cursor de bloque).
- **Tabla de signos (fija):**
  - Letras `a`–`z` del Braille internacional, con `w` = `⠺`.
  - `á` ⠷ · `é` ⠮ · `í` ⠌ · `ó` ⠬ · `ú` ⠾ · `ü` ⠳ · `ñ` ⠻.
  - Mayúscula ⠨ (4-6). Número ⠼ (3-4-5-6). Dígitos `1`–`9` y `0` = letras `a`–`j`.
  - `.` ⠄ (3) · `,` ⠂ (2) · `;` ⠆ (2-3) · `:` ⠒ (2-5) · `¿` y `?` ⠢ (2-6) · `¡` y `!` ⠖ (2-3-5) · `(` ⠣ (1-2-6) · `)` ⠜ (3-4-5) · `-` ⠤ (3-6) · `"`, `«` y `»` ⠦ (2-3-6).
  - Espacio = celda vacía `⠀` (U+2800).
- **Reglas que hay que confirmar en el documento B 2 antes de fijar sus tests.** Se cita la sección en un comentario del test. Si el documento dice otra cosa, se corrige el test y la tabla de la hoja de ruta §7:
  1. palabra entera en mayúsculas = ⠨⠨ al inicio;
  2. coma decimal (⠂) y punto de miles (⠄) dentro de un número, sin repetir ⠼;
  3. letra `a`–`j` justo después de un número (lleva un signo intermedio);
  4. palabras con mayúsculas parciales, como «PDFs».
- **Caracteres sin signo en la tabla** (matemática, química, emoji, `@`, `%`…): no se transcriben y se listan a la persona. Nunca se inventa un signo.
- **BRF:**
  - Tabla NABCC: `" A1B'K2L@CIF/MSP\"E3H9O6R^DJG>NTQ,*5<-U8V.%[$+X!&;:4\\0Z7(_?W]#Y)="`, donde el índice es `codepoint − 0x2800`.
  - Líneas separadas por `\r\n` y páginas por `\f`. Solo ASCII 0x20–0x5F y esos separadores.
  - Formato por defecto: 40 celdas × 25 líneas. Columnas de 28 a 42 y líneas de 20 a 30. Se guarda en `aulaclara.braille` = `{ "cols": n, "rows": n }`.
  - MIME `text/plain;charset=us-ascii`. Nombre de archivo: `slugify(title) + ".brf"`, donde `slugify` pasa a minúsculas, quita tildes, cambia lo que no es `[a-z0-9]` por `-`, colapsa guiones repetidos, quita los de los extremos y corta a 60 caracteres.
- **Impresión en relieve:**
  - Medidas: A4 (210 × 297 mm), margen de 15 mm, 2,5 mm entre puntos, 6,0 mm entre celdas, 10,0 mm entre líneas y puntos de 1,5 mm de diámetro. Son los valores usuales (Marburg Medium); hay que confirmarlos con el papel o la impresora de la institución.
  - Resultado: **30 celdas × 27 líneas**.
  - Aviso fijo junto al botón: **«Imprimí al 100 % (sin «Ajustar a la página») para que los puntos tengan la medida correcta.»**
- **Vista en pantalla** con `aria-hidden="true"`, y antes un texto solo para lectores de pantalla: **«La vista en Braille es para quien ve la pantalla. Para leer en Braille, descargá el archivo .BRF para tu impresora o usá tu línea Braille con tu lector de pantalla.»**
- **Figuras:** se transcriben como un párrafo **«Gráfico {n}: {descripción}.»** o **«Gráfico {n}: sin descripción.»**.
- **Ajuste nuevo:** `brailleTools: boolean = false`.

## Review Focus

1. **Texto con símbolos fuera de la tabla** (∑, π, @, emoji): el `.BRF` se genera igual y el diálogo lista los símbolos omitidos. Lo cubren las tareas 1 y 5.
2. **Una palabra más larga que la línea** (una URL): se corta con ⠤ y ninguna línea supera el ancho. Lo cubre la tarea 2.
3. **Un título que cae en la última línea de una página:** pasa a la página siguiente. Lo cubre la tarea 2.
4. **Un documento con figuras nunca descritas:** el diálogo ofrece describirlas y el `.BRF` dice «sin descripción». Lo cubren las tareas 4 y 5.
5. **Una persona con lector de pantalla abre el diálogo:** oye la explicación y los botones, no «puntos braille 1 2 4…». Lo cubre la tarea 5.

---

### Task 1: Tabla y traductor

**Files:**
- Create: `frontend/src/lib/braille/table.ts`, `frontend/src/lib/braille/translate.ts`, `frontend/src/lib/braille/translate.test.ts`

**Interfaces:**
- Produces (`table.ts`):
  - `cell(...dots: number[]): string`, el carácter U+2800 + Σ 2^(punto−1).
  - `const CAPITAL: string` (⠨), `const NUMBER: string` (⠼), `const BLANK = "⠀"`.
  - `const LETTERS: Readonly<Record<string, string>>`, de `a` a `z` más las vocales con tilde, `ü` y `ñ`.
  - `const SIGNS: Readonly<Record<string, string>>`, la puntuación.
  - `const DIGITS: Readonly<Record<string, string>>`
- Produces (`translate.ts`):
  - `interface BrailleText { braille: string; unsupported: readonly string[] }`
  - `toBraille(text: string): BrailleText`. `unsupported` no repite caracteres y conserva el orden de aparición.
  - `toBrailleWords(text: string): { ink: string; braille: string }[]`, para la vista espejo.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// translate.test.ts
import { describe, expect, it } from "vitest";
import { cell } from "./table";
import { toBraille, toBrailleWords } from "./translate";

const b = (text: string) => toBraille(text).braille;

it("cell arma el carácter Unicode desde los puntos", () => {
  expect(cell(1)).toBe("⠁");
  expect(cell(4, 6)).toBe("⠨");
  expect(cell(1, 2, 3, 4, 5, 6)).toBe("⠿");
});

describe("Braille español, signografía básica (CBE, B 2 v3)", () => {
  it.each([
    ["hola", "⠓⠕⠇⠁"],
    ["educación", "⠑⠙⠥⠉⠁⠉⠊⠬⠝"],
    ["español", "⠑⠎⠏⠁⠻⠕⠇"],
    ["pingüino", "⠏⠊⠝⠛⠳⠊⠝⠕"],
    ["Aula", "⠨⠁⠥⠇⠁"],
    ["2026", "⠼⠃⠚⠃⠋"],
    ["Fin.", "⠨⠋⠊⠝⠄"],
    ["(sí)", "⠣⠎⠌⠜"],
    ["¿Qué?", "⠢⠨⠟⠥⠮⠢"],
    ["¡ya!", "⠖⠽⠁⠖"],
    ["a, b; c: d", "⠁⠂⠀⠃⠆⠀⠉⠒⠀⠙"],
    ["«web»", "⠦⠺⠑⠃⠦"],
    ["pre-test", "⠏⠗⠑⠤⠞⠑⠎⠞"],
  ])("«%s»", (ink, braille) => expect(b(ink)).toBe(braille));

  // Confirmar cada caso en B 2 v3 y citar la sección antes de quitar el .todo.
  it.todo("«IA» (palabra en mayúsculas) → ⠨⠨⠊⠁");
  it.todo("«3,5» (coma decimal) → ⠼⠉⠂⠑");
  it.todo("«26.653» (punto de miles) → ⠼⠃⠋⠄⠋⠑⠉");
  it.todo("«3a» (letra a–j después de un número) lleva signo intermedio");
});

it("los caracteres sin signo se omiten, una palabra que queda vacía no deja espacios, y se informan una sola vez", () => {
  expect(toBraille("x ∑ y ∑ @")).toEqual({ braille: "⠭⠀⠽", unsupported: ["∑", "@"] });
});

it("toBrailleWords alinea cada palabra con su transcripción", () => {
  expect(toBrailleWords("Aula clara")).toEqual([
    { ink: "Aula", braille: "⠨⠁⠥⠇⠁" },
    { ink: "clara", braille: "⠉⠇⠁⠗⠁" },
  ]);
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd frontend && npx vitest run src/lib/braille/translate.test.ts`
Expected: FAIL (`Failed to resolve import "./table"`).

- [ ] **Step 3: Implementar.**
  - Se procesa palabra por palabra, separando por espacios; los espacios seguidos se reducen a uno.
  - Una racha de dígitos lleva ⠼ al inicio.
  - Cada mayúscula lleva ⠨ adelante.
  - Las reglas 1 a 4 de las Global Constraints se implementan después de confirmarlas, convirtiendo cada `it.todo` en un test.
- [ ] **Step 4: Correr**

Run: `cd frontend && npx vitest run src/lib/braille/translate.test.ts`
Expected: PASS (con los `todo` pendientes hasta confirmarlos en el documento de la CBE).

- [ ] **Step 5: Confirmar las cuatro reglas en el documento B 2** (descargarlo desde la página de documentos técnicos de la ONCE). Convertir los `it.todo` en tests con la sección citada, implementar y volver a correr.
- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/braille/
git commit -m "feat(braille): tabla y traductor de Braille español grado 1"
```

---

### Task 2: Líneas y páginas

**Files:**
- Create: `frontend/src/lib/braille/layout.ts`, `frontend/src/lib/braille/layout.test.ts`

**Interfaces:**
- Produces:
  - `interface BrailleParagraph { braille: string; heading: boolean }`
  - `interface PageFormat { cols: number; rows: number }`
  - `wrap(braille: string, cols: number): string[]`. Corta en `BLANK` sin dejarlo al principio ni al final de una línea. Una palabra de más de `cols` celdas se parte en tramos de `cols − 1` celdas seguidos de ⠤, y el último tramo va sin ⠤.
  - `paginate(paragraphs: readonly BrailleParagraph[], format: PageFormat): string[][]`
    - Deja una línea en blanco entre párrafos, salvo al principio de una página.
    - Un título nunca termina una página: si después de ubicarlo la página queda llena, el título pasa a la página siguiente.
    - Quita las líneas en blanco al final de cada página.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// layout.test.ts
import { expect, it } from "vitest";
import { paginate, wrap } from "./layout";

const len = (s: string) => [...s].length;

it("wrap corta entre palabras y ninguna línea supera el ancho", () => {
  expect(wrap("⠁⠁⠀⠃⠃⠃⠀⠉", 6)).toEqual(["⠁⠁⠀⠃⠃⠃", "⠉"]);
});

it("una palabra más larga que la línea se parte con ⠤", () => {
  const lines = wrap("⠁⠁⠁⠁⠁⠁⠁⠁", 4);
  expect(lines).toEqual(["⠁⠁⠁⠤", "⠁⠁⠁⠤", "⠁⠁"]);
  expect(lines.every((l) => len(l) <= 4)).toBe(true);
});

it("paginate separa párrafos, respeta el alto y no deja un título al final de una página", () => {
  const pages = paginate(
    [
      { braille: "⠁⠁⠁", heading: false },
      { braille: "⠃⠃", heading: true },
      { braille: "⠉", heading: false },
    ],
    { cols: 10, rows: 3 },
  );
  expect(pages).toEqual([["⠁⠁⠁"], ["⠃⠃", "", "⠉"]]);
});

it("ninguna página supera las líneas pedidas", () => {
  const paragraphs = Array.from({ length: 40 }, () => ({ braille: "⠁⠀".repeat(30), heading: false }));
  for (const page of paginate(paragraphs, { cols: 40, rows: 25 })) {
    expect(page.length).toBeLessThanOrEqual(25);
    expect(page.every((l) => len(l) <= 40)).toBe(true);
  }
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd frontend && npx vitest run src/lib/braille/layout.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `wrap` y `paginate`.**
- [ ] **Step 4: Correr**

Run: `cd frontend && npx vitest run src/lib/braille/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/braille/
git commit -m "feat(braille): maquetado en líneas y páginas"
```

---

### Task 3: Archivo `.BRF` y descarga

**Files:**
- Create: `frontend/src/lib/braille/brf.ts`, `frontend/src/lib/braille/brf.test.ts`, `frontend/src/lib/download.ts`, `frontend/src/lib/slugify.ts`, `frontend/src/lib/slugify.test.ts`

**Interfaces:**
- Produces:
  - `const NABCC: string` (la cadena de las Global Constraints).
  - `toBrfLine(braille: string): string`. Mapea U+2800–U+283F con `NABCC`; cualquier otro carácter lanza `RangeError`.
  - `toBrfDocument(pages: readonly (readonly string[])[]): string` = `pages.map((p) => p.map(toBrfLine).join("\r\n")).join("\f")`.
  - `downloadText(filename: string, content: string, mime: string): void` (`lib/download.ts`): un `Blob`, `URL.createObjectURL`, un `<a download>`, un clic y `revokeObjectURL`.
  - `slugify(text: string, max = 60): string` (`lib/slugify.ts`).

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// brf.test.ts
import { expect, it } from "vitest";
import { NABCC, toBrfDocument, toBrfLine } from "./brf";

it("la tabla NABCC tiene los 64 patrones de 6 puntos", () => {
  expect(NABCC).toHaveLength(64);
});

it.each([
  ["⠀", " "], ["⠁", "A"], ["⠂", "1"], ["⠄", "'"], ["⠨", "."], ["⠼", "#"], ["⠿", "="], ["⠷", "("], ["⠾", ")"],
])("%s → %s", (cell, ascii) => expect(toBrfLine(cell)).toBe(ascii));

it("rechaza caracteres que no son Braille de 6 puntos", () => {
  expect(() => toBrfLine("a")).toThrow(RangeError);
});

it("separa líneas con CRLF y páginas con salto de página", () => {
  expect(toBrfDocument([["⠁", "⠃"], ["⠉"]])).toBe("A\r\nB\fC");
});
```

```ts
// slugify.test.ts
import { expect, it } from "vitest";
import { slugify } from "./slugify";

it("arma un nombre de archivo seguro", () => {
  expect(slugify("Accesibilidad digital: ¿barreras y oportunidades?")).toBe("accesibilidad-digital-barreras-y-oportunidades");
  expect(slugify("a".repeat(100))).toHaveLength(60);
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd frontend && npx vitest run src/lib/braille/brf.test.ts src/lib/slugify.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr**

Run: `cd frontend && npx vitest run src/lib/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/
git commit -m "feat(braille): exportación a .BRF (Braille ASCII norteamericano)"
```

---

### Task 4: Descripciones de figuras guardadas

**Files:**
- Create: `frontend/src/features/reader/figureImage.ts`
- Modify: `frontend/src/features/library/api.ts` (`saveFigureAlt` y `withFigureAlt`), `frontend/src/features/library/index.ts`, `frontend/src/features/library/api.test.ts`, `frontend/src/features/reader/FigureBlock.tsx`, `frontend/src/features/reader/DocumentView.tsx`, `frontend/src/features/reader/ReaderScreen.tsx`, `frontend/src/app.test.tsx`

**Interfaces:**
- Produces (`features/library`):
  - `withFigureAlt(article: Article, figureId: string, alt: string): Article`, una función pura.
  - `libraryApi.saveFigureAlt(docId: string, figureId: string, alt: string): Promise<void>`. Lee el artículo (o `SAMPLE_ARTICLE` si es un documento semilla sin contenido propio) y lo guarda con `withFigureAlt` en `article:{docId}`.
- Produces (`figureImage.ts`): `figureImageBlob(block: Extract<Block, { type: "figure" }>, index: number): Promise<Blob | null>`. Si hay `dataUrl`, `dataUrlToBlob`. Si no, `svgToJpeg(document.querySelector("#blk-{index} svg"))`. Ante un error, `null`. `FigureBlock` usa esta función en lugar de su `prepareImage`.
- Produces: `FigureBlock` recibe `block: Extract<Block, { type: "figure" }>` e `index: number` en lugar de `dataUrl`, y suma las props `alt?: string` y `onDescribed(text: string): void`.
  - Con `alt`, «Interpretar con IA» abre el diálogo con esa descripción, la etiqueta «Descripción guardada» y el botón «Volver a interpretar con IA», **sin pedir nada a la API**.
  - `<img alt>` usa `alt` si existe.
- Produces (`ReaderScreen`):
  - `figureAlts: Record<string, string>` en el estado. Es un mapa aparte para no cambiar la identidad de `article`, porque eso reiniciaría el motor de lectura.
  - El alt efectivo de una figura es `figureAlts[id] ?? block.alt`.
  - `onDescribed` actualiza el mapa y llama a `saveFigureAlt`.

- [ ] **Step 1: Escribir los tests que fallan**

En `features/library/api.test.ts`:

```ts
it("saveFigureAlt guarda la descripción en el bloque de la figura, también en un documento semilla", async () => {
  await libraryApi.saveFigureAlt("d1", "sample-chart", "Barras que crecen de 2019 a 2024.");
  const article = await libraryApi.loadArticle("d1");
  expect(article.blocks.find((b) => b.type === "figure")).toMatchObject({ alt: "Barras que crecen de 2019 a 2024." });
});
```

En `app.test.tsx` (`describe("lector")`):

```ts
it("una figura ya descrita no vuelve a gastar cuota", async () => {
  const user = userEvent.setup();
  renderAt("/leer/d1");
  const trigger = await screen.findByRole("button", { name: /Interpretar con IA/ });
  await user.click(trigger);
  await screen.findByRole("dialog", { name: "Interpretación de la imagen" });
  await user.keyboard("{Escape}");
  await user.click(trigger);
  const dialog = await screen.findByRole("dialog", { name: "Interpretación de la imagen" });
  expect(dialog).toHaveTextContent("Descripción guardada");
  expect(calls("/ai/describe-image")).toHaveLength(1);
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd frontend && npx vitest run src/features/library/api.test.ts src/app.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr**

Run: `cd frontend && npm run typecheck && npm test`
Expected: PASS (incluido el test existente «"Interpretar con IA" abre un diálogo…»).

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(lector): las descripciones de figuras se guardan y no se vuelven a pedir"
```

---

### Task 5: Documento a Braille y diálogo Braille

**Files:**
- Create: `frontend/src/features/reader/braille/articleToBraille.ts`, `frontend/src/features/reader/braille/articleToBraille.test.ts`, `frontend/src/features/reader/braille/format.ts`, `frontend/src/features/reader/braille/BrailleDialog.tsx`
- Modify: `frontend/src/features/reader/ReaderScreen.tsx` (botón en el encabezado y handler `openBraille`), `frontend/src/features/reader/useVoiceCommands.ts` (comando `openBraille`), `frontend/src/features/preferences/settings.ts`, `frontend/src/features/preferences/controls.ts`, `frontend/src/app.test.tsx`

**Interfaces:**
- Consumes: `toBraille`, `toBrailleWords`, `paginate`, `toBrfDocument`, `downloadText` y `slugify` (tareas 1 a 3); `figureImageBlob`, `describeImage` y `withFigureAlt` (tarea 4).
- Produces:
  - `articleToParagraphs(article: Article, figureAlts: Record<string, string>): { paragraphs: BrailleParagraph[]; unsupported: string[]; undescribedFigures: number }`. El título del artículo va primero como título; los `h2` son títulos; las figuras siguen el formato de las Global Constraints.
  - `loadBrailleFormat(): PageFormat` y `saveBrailleFormat(f: PageFormat): void` (`format.ts`, en `aulaclara.braille`, validado contra los rangos).
  - `BrailleDialog(props: { article: Article; figureAlts: Record<string, string>; onFigureDescribed(figureId: string, text: string): void; onClose(): void }): ReactNode`
  - `brailleTools: boolean`, por defecto `false`, con el control `{ key: "brailleTools", kind: "toggle", label: "Herramientas de Braille", help: "Muestra el botón «Braille» en el lector para ver el documento en Braille, descargarlo como .BRF o imprimirlo en relieve.", group: "lectura", inReader: true }`.

**Contenido del diálogo** (título «Braille»):
1. El texto solo para lectores de pantalla (Global Constraints).
2. Un grupo de radios «Vista»: «Espejo (tinta y Braille)» o «Plancha».
   - La vista espejo muestra cada palabra con su Braille de 28 px arriba y la tinta abajo.
   - La plancha muestra cada página como una grilla de `cols` × `rows`, con «Página N de M» y botones «Anterior» y «Siguiente».
   - Las dos vistas van dentro de un contenedor `aria-hidden="true"`.
3. «Formato de la impresora»: dos `select`, «Celdas por línea» (28–42) y «Líneas por página» (20–30).
4. **«Descargar archivo .BRF»**.
5. **«Imprimir en relieve»**, que se habilita en la tarea 6, con el aviso del 100 %.
6. Si `unsupported` no está vacío: **«No se transcribieron estos símbolos: {lista}.»**
7. Si `undescribedFigures > 0`: **«Describir {n} gráficos con IA»**. Los describe uno por uno; un error se muestra y corta la serie. Avisa: «Cada gráfico usa una consulta de tu cuota de IA.»

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// articleToBraille.test.ts
import { expect, it } from "vitest";
import { articleToParagraphs } from "./articleToBraille";

const article = {
  title: "Hola", meta: "x",
  blocks: [
    { type: "h2" as const, text: "Uno" },
    { type: "p" as const, text: "a ∑" },
    { type: "figure" as const, id: "f1" },
    { type: "figure" as const, id: "f2", alt: "barras" },
  ],
};

it("transcribe título, secciones, párrafos y figuras, y cuenta lo pendiente", () => {
  const out = articleToParagraphs(article, {});
  expect(out.paragraphs.map((p) => p.heading)).toEqual([true, true, false, false, false]);
  expect(out.unsupported).toEqual(["∑"]);
  expect(out.undescribedFigures).toBe(1);
});

it("una descripción recién hecha cuenta como descrita", () => {
  expect(articleToParagraphs(article, { f1: "torta" }).undescribedFigures).toBe(0);
});
```

En `app.test.tsx`:

```ts
describe("Braille", () => {
  beforeEach(() => {
    withOnboarding();
    window.localStorage.setItem("aulaclara.settings", JSON.stringify({ schemaVersion: 2, settings: { brailleTools: true } }));
  });

  it("Alt+B abre el diálogo; la vista está oculta para lectores de pantalla y se descarga un .BRF en ASCII", async () => {
    const created: Blob[] = [];
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: (b: Blob) => (created.push(b), "blob:x"), revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("accesibilidad-digital-en-la-educacion-superior-barreras-y-op.brf");
    });
    const user = userEvent.setup();
    renderAt("/leer/d1");
    await h1();
    await user.keyboard("{Alt>}b{/Alt}");
    const dialog = await screen.findByRole("dialog", { name: "Braille" });
    expect(dialog).toHaveTextContent("La vista en Braille es para quien ve la pantalla");
    expect(dialog.querySelector("[aria-hidden='true']")).toHaveTextContent("⠨");
    await user.click(within(dialog).getByRole("button", { name: "Descargar archivo .BRF" }));
    expect(click).toHaveBeenCalledOnce();
    expect(await created[0]!.text()).toMatch(/^[\x20-\x5F\r\n\f]+$/);
  });
});
```

(El nombre esperado es el título del documento de ejemplo pasado por `slugify` y cortado a 60 caracteres; si el corte cae distinto, se ajusta al resultado de `slugify`, que tiene su propio test.)

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd frontend && npx vitest run src/features/reader/braille/ src/app.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar.** El botón «⠿ Braille» (con el icono `aria-hidden`) se agrega al encabezado del lector cuando `brailleTools` está activo. El handler `openBraille` y el comando de voz abren el diálogo.
- [ ] **Step 4: Correr**

Run: `cd frontend && npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(braille): diálogo con vista espejo, plancha y descarga .BRF"
```

---

### Task 6: Hoja de impresión en relieve

**Files:**
- Create: `frontend/src/features/reader/braille/printGeometry.ts`, `frontend/src/features/reader/braille/printGeometry.test.ts`, `frontend/src/features/reader/braille/BraillePrintSheet.tsx`
- Modify: `frontend/src/features/reader/braille/BrailleDialog.tsx`, `frontend/src/index.css`

**Interfaces:**
- Produces:
  - `const GEOMETRY = { pageMm: { w: 210, h: 297 }, marginMm: 15, dotSpacingMm: 2.5, cellPitchMm: 6, linePitchMm: 10, dotDiameterMm: 1.5 } as const`
  - `printGrid(g = GEOMETRY): PageFormat`. Cabe una celda más si `(n − 1) · cellPitch + dotSpacing + dotDiameter ≤ ancho útil`, y lo mismo con las líneas usando `2 · dotSpacing`.
  - `dotCenters(cellChar: string): { x: number; y: number }[]`, en milímetros desde el centro del punto 1. Los puntos 1, 2 y 3 están en x = 0; los 4, 5 y 6 en x = 2,5; y en {0; 2,5; 5}.
  - `BraillePrintSheet({ pages }: { pages: string[][] }): ReactNode`. Con un portal en `document.body`, `<div id="braille-print-sheet">` dibuja un `<svg width="210mm" height="297mm" viewBox="0 0 210 297">` por página, con un `<circle r={0.75}>` por punto, en negro sobre blanco.
- CSS en `index.css`:

```css
#braille-print-sheet { display: none; }
@media print {
  body.printing-braille > :not(#braille-print-sheet) { display: none !important; }
  body.printing-braille #braille-print-sheet { display: block; }
  #braille-print-sheet svg { break-after: page; }
  @page { size: A4 portrait; margin: 0; }
}
```

**Al tocar «Imprimir en relieve»:**
1. Pagina con `printGrid()` (no con el formato del `.BRF`).
2. Monta `BraillePrintSheet`.
3. Agrega `printing-braille` a `body`.
4. Llama a `window.print()`.
5. En `afterprint`, desmonta la hoja y saca la clase.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// printGeometry.test.ts
import { expect, it } from "vitest";
import { dotCenters, printGrid } from "./printGeometry";

it("en A4 con margen de 15 mm entran 30 celdas por 27 líneas", () => {
  expect(printGrid()).toEqual({ cols: 30, rows: 27 });
});

it("ubica los puntos de una celda en milímetros", () => {
  expect(dotCenters("⠁")).toEqual([{ x: 0, y: 0 }]);
  expect(dotCenters("⠿")).toEqual([
    { x: 0, y: 0 }, { x: 0, y: 2.5 }, { x: 0, y: 5 }, { x: 2.5, y: 0 }, { x: 2.5, y: 2.5 }, { x: 2.5, y: 5 },
  ]);
  expect(dotCenters("⠀")).toEqual([]);
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd frontend && npx vitest run src/features/reader/braille/printGeometry.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr**

Run: `cd frontend && npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 5: Verificación manual en Chrome.** En la vista previa de impresión, A4 al 100 %, medir sobre la pantalla con una regla o exportar a PDF y medir: 6 mm entre celdas y 10 mm entre líneas.
- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "feat(braille): impresión en relieve con medidas reales en milímetros"
```

---

### Task 7: Preset Ceguera con Braille y documentación

**Files:**
- Modify: `backend/app/seed/presets.json` (preset `ceguera`), `backend/tests/api/test_presets.py`, `docs/new_profiles/01-perfil-ceguera.md` §2.3 y §3, `docs/accesibilidad.md`

- [ ] **Step 1: Test que falla.** En `test_presets_catalog_lists_the_seed_presets`, agregar `assert presets["ceguera"]["settings"]["braille_tools"] is True`.
- [ ] **Step 2: Correr y ver que falla:** `cd backend && uv run pytest tests/api/test_presets.py`.
- [ ] **Step 3: En el preset `ceguera`,** agregar `"braille_tools": true` a `settings` y cambiar `tags` a `["Teclado y voz", "Lectura en voz alta", "Braille (.BRF e impresión)"]`.
- [ ] **Step 4: Correr el backend y el test de contrato del frontend.** Expected: PASS.
- [ ] **Step 5: Documentar en `01-perfil-ceguera.md`:**
  - la tabla de signos corregida;
  - las reglas confirmadas en B 2, con su sección;
  - el formato `.BRF`;
  - las medidas de impresión;
  - qué queda fuera (matemática y química).
- [ ] **Step 6: Chequeos completos (hoja de ruta §6), `graphify update .` y commit**

```bash
git add backend/ frontend/ docs/ graphify-out/
git commit -m "feat(perfiles): Braille en el preset Ceguera"
```
