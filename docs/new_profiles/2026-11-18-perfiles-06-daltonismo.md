# Perfiles 06 · Daltonismo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Nombrar los colores de los gráficos con el mouse, el dedo o el teclado.
- Realzar los colores de un gráfico según el tipo de daltonismo.
- Descripciones de IA que vinculan cada color con su posición y su forma.
- Temas verificados bajo simulación.
- Indicadores que no dependen solo del color.
- El preset **Daltonismo**.

**Architecture:**
- La matemática de color es pura y vive en `lib/color/`:
  - `convert.ts`: sRGB ↔ lineal ↔ CIELAB y distancia CIEDE2000;
  - `names.ts`: nombres en español;
  - `cvd.ts`: simulación (Machado 2009), matriz de realce para un filtro SVG `feColorMatrix`, y muestreo de píxeles.
- `FigureBlock` suma un inspector (canvas en memoria, con puntero y teclado) y un botón de realce. Los dos se activan con `settings.cvdType`.
- El backend suma `color_guide` a `describe-image`, con un prompt aparte y su propia clave de caché.

**Tech Stack:** TypeScript puro, Canvas 2D, SVG `feColorMatrix`, FastAPI.

**Spec:** [docs/new_profiles/04-perfil-daltonismo.md](./04-perfil-daltonismo.md); [hoja de ruta](2026-11-18-perfiles-00-hoja-de-ruta.md) §1 (decisión 2) y §7.

## Global Constraints

- Incluye las restricciones globales de la hoja de ruta (§6). Depende del plan 01. Si el plan 03 está hecho, usa `figureImageBlob`; si no, esta misma tarea 4 lo crea con la firma del plan 03, tarea 4.
- `cvdType: "none" | "unsure" | "protan" | "deutan" | "tritan" | "achromat" = "none"`. Con `"unsure"`, el realce usa `"deutan"`, el tipo más frecuente.
- **Simulación** (Machado, Oliveira y Fernandes, 2009, severidad 1,0, en RGB lineal). Antes de usar las matrices, verificarlas contra la tabla del paper:
  - protan: `[[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]]`
  - deutan: `[[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]]`
  - tritan: `[[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]]`. Es aproximada: documentarlo.
  - achromat: Y = 0,2126 R + 0,7152 G + 0,0722 B (lineal), y el resultado es (Y, Y, Y).
- **Realce (daltonización):** `M = I + E · (I − S)`, en RGB lineal.
  - Para protan y deutan, `E = [[0, 0, 0], [0.7, 1, 0], [0.7, 0, 1]]`.
  - Para tritan, `E = [[1, 0, 0.7], [0, 1, 0.7], [0, 0, 0]]`.
  - Con achromat no hay realce: el botón se deshabilita con el texto **«Con acromatopsia, el realce de colores no ayuda. Usá «Identificar colores» o «Interpretar con IA».»**
  - El filtro lleva `color-interpolation-filters="linearRGB"`.
- **Nombres de color** (CIEDE2000 contra estas 18 referencias): Negro `#000000` · Blanco `#FFFFFF` · Gris `#808080` · Gris claro `#C8C8C8` · Gris oscuro `#404040` · Rojo `#D62728` · Rojo oscuro `#8B1A1A` · Rosa `#F48FB1` · Naranja `#F58220` · Marrón `#8C564B` · Amarillo `#F0E030` · Verde claro `#98DF8A` · Verde `#2CA02C` · Verde oscuro `#1B5E20` · Celeste `#6EC6F0` · Azul `#1F57D0` · Azul marino `#1A2A6C` · Violeta `#8E44AD`. Si un test del nombre falla, se ajusta la referencia, no el nombre.
- **Inspector:**
  - Promedia una ventana de 3 × 3 píxeles.
  - Las flechas mueven la mira un 2 % del ancho o del alto (un 10 % con Shift), y `Esc` lo cierra.
  - Anuncia **«{nombre} · {HEX}»** en un `aria-live="polite"`, esperando 300 ms desde el último movimiento.
  - El puntero y el toque usan la misma muestra.
- **`describe-image`:** campo de formulario `color_guide: bool = False`, con el prompt `app/prompts/image_color_guide.md` y este texto exacto: **«Además: nombrá cada color que aparezca junto a su posición (arriba, abajo, a la izquierda, primera barra…) o su forma (línea continua, punteada, barra más alta). Si hay valores, listalos uno por línea con el formato «Categoría (color, posición): valor». En este caso podés usar hasta 180 palabras.»**
- Ningún estado se comunica solo con color (criterio 1.4.1). El bloque que se lee en voz alta lleva un borde izquierdo de 4 px, además del fondo.

## Review Focus

1. **Una foto JPEG con ruido:** el nombre del color no salta entre píxeles vecinos (promedio de 3 × 3). Lo cubre la tarea 3.
2. **Inspector usado solo con teclado:** se puede recorrer toda la imagen con flechas y el nombre se anuncia. Lo cubre la tarea 4.
3. **Acromatopsia:** el realce no se ofrece como si ayudara; se explica y se ofrecen las alternativas. Lo cubre la tarea 5.
4. **La misma imagen descrita con y sin guía de color:** son dos respuestas distintas en la caché. Lo cubre la tarea 6.
5. **Los temas actuales bajo protanopía, deuteranopía y tritanopía:** el texto y el resaltado siguen distinguiéndose del fondo. Lo cubre la tarea 3.

---

### Task 1: Conversión de color y CIEDE2000

**Files:**
- Create: `frontend/src/lib/color/convert.ts`, `frontend/src/lib/color/convert.test.ts`

**Interfaces:**
- Produces:
  - `type RGB = readonly [number, number, number]` (0–255) y `type Lab = readonly [number, number, number]`.
  - `hexToRgb(hex: string): RGB`, `rgbToHex(rgb: RGB): string` (formato `"#RRGGBB"` en mayúsculas).
  - `srgbToLinear(c: number): number` y `linearToSrgb(c: number): number` (canales en 0–1).
  - `rgbToLab(rgb: RGB): Lab` (D65).
  - `deltaE2000(a: Lab, b: Lab): number`.
  - `relativeLuminance(rgb: RGB): number` (WCAG).

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// convert.test.ts
import { expect, it } from "vitest";
import { deltaE2000, hexToRgb, relativeLuminance, rgbToHex, rgbToLab } from "./convert";

it("CIEDE2000 coincide con los datos de prueba de Sharma, Wu y Dalal (2005)", () => {
  expect(deltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485])).toBeCloseTo(2.0425, 4);
  expect(deltaE2000([50, 0, 0], [50, -1, 2])).toBeCloseTo(2.3669, 4);
});

it("el blanco es L 100 y el negro L 0", () => {
  const [l, a, b] = rgbToLab([255, 255, 255]);
  expect(l).toBeCloseTo(100, 1);
  expect(a).toBeCloseTo(0, 1);
  expect(b).toBeCloseTo(0, 1);
  expect(rgbToLab([0, 0, 0])[0]).toBeCloseTo(0, 5);
});

it("hex ida y vuelta, y luminancia WCAG", () => {
  expect(rgbToHex(hexToRgb("#1b7837"))).toBe("#1B7837");
  expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 5);
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd frontend && npx vitest run src/lib/color/convert.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** con la fórmula de CIEDE2000 de Sharma y otros (2005) y kL = kC = kH = 1.
- [ ] **Step 4: Correr.** Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/color/
git commit -m "feat(color): conversión sRGB/Lab y distancia CIEDE2000"
```

---

### Task 2: Nombres de color en español

**Files:**
- Create: `frontend/src/lib/color/names.ts`, `frontend/src/lib/color/names.test.ts`

**Interfaces:**
- Consumes: `rgbToLab`, `deltaE2000`, `hexToRgb` y `rgbToHex` (tarea 1).
- Produces: `const COLOR_NAMES: readonly { name: string; hex: string }[]` (las 18 de las Global Constraints) y `nameColor(rgb: RGB): { name: string; hex: string }`, donde `hex` es el color medido, no el de referencia.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// names.test.ts
import { expect, it } from "vitest";
import { COLOR_NAMES, nameColor } from "./names";

it.each([
  [[220, 30, 30], "Rojo"],
  [[30, 180, 50], "Verde"],
  [[20, 80, 210], "Azul"],
  [[240, 220, 30], "Amarillo"],
  [[128, 128, 128], "Gris"],
  [[0, 0, 0], "Negro"],
  [[255, 255, 255], "Blanco"],
] as const)("%j se llama %s", (rgb, name) => {
  expect(nameColor(rgb).name).toBe(name);
});

it("devuelve el hex medido", () => {
  expect(nameColor([220, 30, 30]).hex).toBe("#DC1E1E");
});

it("son 18 nombres sin repetir", () => {
  expect(new Set(COLOR_NAMES.map((c) => c.name)).size).toBe(18);
});
```

- [ ] **Step 2: Correr y ver que fallan.**
- [ ] **Step 3: Implementar** (nombre de la referencia con menor ΔE2000).
- [ ] **Step 4: Correr.** Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/color/
git commit -m "feat(color): nombres de color en español por CIEDE2000"
```

---

### Task 3: Simulación, realce y verificación de los temas

**Files:**
- Create: `frontend/src/lib/color/cvd.ts`, `frontend/src/lib/color/cvd.test.ts`
- Modify: `frontend/src/features/preferences/config.test.ts` (bloque nuevo), y `frontend/src/features/preferences/config.ts` solo si un tema falla

**Interfaces:**
- Produces:
  - `type CvdKind = "protan" | "deutan" | "tritan" | "achromat"`
  - `type Mat3 = readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]]`
  - `simulate(rgb: RGB, kind: CvdKind): RGB`, que redondea y limita a 0–255.
  - `daltonizeMatrix(kind: Exclude<CvdKind, "achromat">): Mat3`
  - `applyMatrix(rgb: RGB, m: Mat3): RGB`, en RGB lineal.
  - `feColorMatrixValues(m: Mat3): string`: 20 números separados por espacios, con 6 decimales (filas 3 × 5 más `0 0 0 1 0`).
  - `sampleAverage(data: Uint8ClampedArray, width: number, height: number, x: number, y: number): RGB`, el promedio de 3 × 3 recortado en los bordes de la imagen.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// cvd.test.ts
import { expect, it } from "vitest";
import { deltaE2000, relativeLuminance, rgbToLab } from "./convert";
import { applyMatrix, daltonizeMatrix, feColorMatrixValues, sampleAverage, simulate } from "./cvd";

it.each(["protan", "deutan", "tritan", "achromat"] as const)("%s conserva el blanco y el negro", (kind) => {
  expect(simulate([255, 255, 255], kind)).toEqual([255, 255, 255]);
  expect(simulate([0, 0, 0], kind)).toEqual([0, 0, 0]);
});

it("con protanopía el rojo se ve más oscuro", () => {
  expect(relativeLuminance(simulate([255, 0, 0], "protan"))).toBeLessThan(relativeLuminance([255, 0, 0]));
});

it("el realce conserva el blanco y separa el rojo del verde para una persona con deuteranopía", () => {
  const m = daltonizeMatrix("deutan");
  expect(applyMatrix([255, 255, 255], m)).toEqual([255, 255, 255]);
  const seen = (rgb: readonly [number, number, number]) => rgbToLab(simulate(rgb, "deutan"));
  const before = deltaE2000(seen([200, 40, 40]), seen([40, 160, 40]));
  const after = deltaE2000(seen(applyMatrix([200, 40, 40], m)), seen(applyMatrix([40, 160, 40], m)));
  expect(after).toBeGreaterThan(before);
});

it("arma los 20 valores de feColorMatrix", () => {
  const values = feColorMatrixValues(daltonizeMatrix("protan")).split(" ");
  expect(values).toHaveLength(20);
  expect(values.slice(15)).toEqual(["0.000000", "0.000000", "0.000000", "1.000000", "0.000000"]);
});

it("promedia una ventana de 3 × 3 y recorta en los bordes", () => {
  const data = new Uint8ClampedArray(3 * 3 * 4);
  for (let i = 0; i < 9; i++) data.set([i === 4 ? 90 : 0, 0, 0, 255], i * 4);
  expect(sampleAverage(data, 3, 3, 1, 1)).toEqual([10, 0, 0]);
  expect(sampleAverage(data, 3, 3, 0, 0)).toEqual([23, 0, 0]); // 90 / 4 píxeles, redondeado
});
```

En `config.test.ts`:

```ts
import { contrastRatio } from "@/lib/color/convert"; // si no existe, agregarlo a convert.ts: (L1 + 0,05) / (L2 + 0,05)
import { simulate } from "@/lib/color/cvd";

describe.each(["protan", "deutan", "tritan"] as const)("los temas con %s", (kind) => {
  it.each(THEME_ORDER)("%s se sigue leyendo y el resaltado se distingue del fondo", (id) => {
    const v = THEMES[id].vars;
    const s = (hex: string) => simulate(hexToRgb(hex), kind);
    expect(contrastRatio(s(v.fg), s(v.bg))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(s(v.onAccent), s(v.accent))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(s(v.hlFg), s(v.hl))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(s(v.focus), s(v.bg))).toBeGreaterThanOrEqual(3);
    expect(deltaE2000(rgbToLab(s(v.hl)), rgbToLab(s(v.bg)))).toBeGreaterThanOrEqual(10);
  });
});
```

(Si se agrega `contrastRatio` a `convert.ts`, sumarle un test ahí.)

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd frontend && npx vitest run src/lib/color/ src/features/preferences/config.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `cvd.ts`.** Si algún tema no pasa, cambiar **solo** el color que falla, conservando los tests de contraste AA existentes, y anotar el cambio en el mensaje del commit.
- [ ] **Step 4: Correr**

Run: `cd frontend && npx vitest run src/lib/color/ src/features/preferences/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(color): simulación de daltonismo, realce y verificación de los temas"
```

---

### Task 4: Inspector de colores en las figuras

**Files:**
- Create: `frontend/src/features/reader/ColorInspector.tsx`
- Modify: `frontend/src/features/reader/FigureBlock.tsx`, `frontend/src/features/reader/DocumentView.tsx` (pasa `cvdType`), `frontend/src/features/preferences/settings.ts`, `frontend/src/features/preferences/controls.ts`, `frontend/src/app.test.tsx`

**Interfaces:**
- Consumes: `figureImageBlob` (plan 03, tarea 4), `nameColor` y `sampleAverage`.
- Produces:
  - `ColorInspector(props: { image: Blob; onClose(): void }): ReactNode`.
    - Dibuja la imagen en un canvas en memoria con `createImageBitmap`.
    - Muestra la imagen con una mira y un `div` con `role="application"`, `aria-roledescription="inspector de colores"`, `aria-label="Inspector de colores. Usá las flechas para recorrer la imagen y Esc para salir."` y `tabIndex={0}`, que toma el foco al abrirse.
    - Tiene un `<p aria-live="polite">` con el último nombre y una muestra visual (cuadrado con el color, el nombre y el hex) junto a la mira.
  - En `FigureBlock`, con `cvdType !== "none"`, una barra debajo de la figura con **«🔍 Identificar colores»** (abre o cierra el inspector, con `aria-pressed`).
  - `cvdType` en `settings.ts`, con el control `{ key: "cvdType", kind: "choice", label: "Visión de los colores", options: [{ value: "none", label: "Sin dificultad" }, { value: "unsure", label: "Tengo dificultad, no sé de qué tipo" }, { value: "protan", label: "Protanopía o protanomalía (rojos)" }, { value: "deutan", label: "Deuteranopía o deuteranomalía (verdes)" }, { value: "tritan", label: "Tritanopía o tritanomalía (azules y amarillos)" }, { value: "achromat", label: "Acromatopsia (sin colores)" }], help: "Con acromatopsia, probá también el perfil «Visión reducida» y el tema «Oscuro cálido» si te molesta la luz.", group: "colores", inReader: true }`.

- [ ] **Step 1: Escribir el test que falla**

```ts
describe("daltonismo", () => {
  beforeEach(() => {
    withOnboarding();
    withAI();
    window.localStorage.setItem("aulaclara.settings", JSON.stringify({ schemaVersion: 2, settings: { cvdType: "deutan" } }));
    vi.stubGlobal("createImageBitmap", async () => ({ width: 100, height: 50, close() {} }));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage() {},
      getImageData: () => ({ data: new Uint8ClampedArray(100 * 50 * 4).map((_, i) => [220, 30, 30, 255][i % 4]!) }),
    } as unknown as CanvasRenderingContext2D);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("el inspector nombra el color con el teclado", async () => {
    const user = userEvent.setup();
    renderAt("/leer/d1");
    await user.click(await screen.findByRole("button", { name: /Identificar colores/ }));
    const inspector = await screen.findByRole("application", { name: /Inspector de colores/ });
    expect(inspector).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(await screen.findByText("Rojo · #DC1E1E", {}, { timeout: 1_000 })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("application")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cd frontend && npx vitest run src/app.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr**

Run: `cd frontend && npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(daltonismo): inspector de colores con puntero y teclado"
```

---

### Task 5: Realce de colores en las figuras

**Files:**
- Create: `frontend/src/features/reader/ColorFilterDefs.tsx`
- Modify: `frontend/src/features/reader/FigureBlock.tsx`, `frontend/src/features/reader/ReaderScreen.tsx`, `frontend/src/app.test.tsx`

**Interfaces:**
- Consumes: `daltonizeMatrix` y `feColorMatrixValues` (tarea 3).
- Produces:
  - `ColorFilterDefs({ kind }: { kind: "protan" | "deutan" | "tritan" }): ReactNode`. Es un `<svg aria-hidden="true" width="0" height="0" style={{ position: "absolute" }}>` con `<filter id="cvd-enhance" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values={…} /></filter>`. `ReaderScreen` lo renderiza una vez cuando `cvdType` no es `"none"` ni `"achromat"`; `"unsure"` usa `"deutan"`.
  - En `FigureBlock`, el botón **«🎨 Realzar colores»** (con `aria-pressed`) aplica `style={{ filter: "url(#cvd-enhance)" }}` al contenedor de la imagen. Con `"achromat"`, el botón está deshabilitado y se muestra el texto de las Global Constraints.

- [ ] **Step 1: Escribir los tests que fallan** (en el `describe("daltonismo")` de la tarea 4)

```ts
it("«Realzar colores» aplica el filtro de realce y se puede apagar", async () => {
  const user = userEvent.setup();
  renderAt("/leer/d1");
  const toggle = await screen.findByRole("button", { name: /Realzar colores/ });
  await user.click(toggle);
  expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(document.querySelector("[style*='url(#cvd-enhance)']")).not.toBeNull();
  expect(document.querySelector("#cvd-enhance feColorMatrix")?.getAttribute("values")?.split(" ")).toHaveLength(20);
  await user.click(toggle);
  expect(document.querySelector("[style*='url(#cvd-enhance)']")).toBeNull();
});

it("con acromatopsia el realce se explica y no se ofrece", async () => {
  window.localStorage.setItem("aulaclara.settings", JSON.stringify({ schemaVersion: 2, settings: { cvdType: "achromat" } }));
  renderAt("/leer/d1");
  expect(await screen.findByRole("button", { name: /Realzar colores/ })).toBeDisabled();
  expect(screen.getByText(/Con acromatopsia, el realce de colores no ayuda/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Correr y ver que fallan.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr:** `cd frontend && npm run typecheck && npm test`. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(daltonismo): realce de colores en los gráficos según el tipo de daltonismo"
```

---

### Task 6: Descripciones de IA con guía de color

**Files:**
- Create: `backend/app/prompts/image_color_guide.md`
- Modify: `backend/app/services/prompts.py`, `backend/app/services/ai.py:121-133`, `backend/app/api/ai.py:48-72`, `frontend/src/features/assistant/api.ts:89-116`, `frontend/src/features/reader/FigureBlock.tsx`
- Test: `backend/tests/unit/test_ai_service.py`, `backend/tests/api/test_ai.py`, `frontend/src/features/assistant/api.test.ts`, `frontend/src/app.test.tsx`

**Interfaces:**
- Produces:
  - `app.services.prompts.COLOR_GUIDE_PROMPT: str`
  - `AIService.describe_image(*, provider, image, mime, context, color_guide: bool = False) -> AIAnswer`. Si `color_guide`, `system = IMAGE_PROMPT + "\n\n" + COLOR_GUIDE_PROMPT`. La clave de caché suma `"color"` o `"plain"`.
  - `POST /api/v1/ai/describe-image` acepta el campo `color_guide: Annotated[bool, Form()] = False`.
  - Frontend: `describeImage(image: Blob, context: string, options: { colorGuide?: boolean; signal?: AbortSignal } = {}): Promise<AIAnswer>`. Agrega `color_guide=true` al `FormData` solo si `colorGuide`. `FigureBlock` lo manda con `cvdType !== "none"`.

- [ ] **Step 1: Escribir los tests que fallan**

```python
# test_ai_service.py
async def test_color_guide_extends_the_image_prompt_and_has_its_own_cache() -> None:
    service, _ = _service()
    provider = _provider(answer="barras")
    await service.describe_image(provider=provider, image=b"\x89PNG", mime="image/png", context="")
    await service.describe_image(provider=provider, image=b"\x89PNG", mime="image/png", context="", color_guide=True)
    assert provider.describe_image.await_count == 2  # type: ignore[attr-defined]
    system = provider.describe_image.await_args.kwargs["system"]  # type: ignore[attr-defined]
    assert "posición" in system and "180 palabras" in system
```

```python
# tests/api/test_ai.py (mismo armado que el test de describe-image existente)
async def test_describe_image_accepts_color_guide(...) -> None:
    response = await client.post("/api/v1/ai/describe-image", headers=HEADERS,
                                 files={"image": ("a.png", PNG_BYTES, "image/png")}, data={"color_guide": "true"})
    assert response.status_code == 200
```

```ts
// app.test.tsx, dentro de describe("daltonismo")
it("con daltonismo, «Interpretar con IA» pide la guía de color", async () => {
  const user = userEvent.setup();
  renderAt("/leer/d1");
  await user.click(await screen.findByRole("button", { name: /Interpretar con IA/ }));
  await screen.findByRole("dialog", { name: "Interpretación de la imagen" });
  expect((calls("/ai/describe-image")[0]?.data as FormData).get("color_guide")).toBe("true");
});
```

- [ ] **Step 2: Correr y ver que fallan** (backend y frontend).
- [ ] **Step 3: Implementar.** Cambiar las llamadas existentes a `describeImage` a la firma nueva; `api.test.ts` sigue pasando sin opciones.
- [ ] **Step 4: Correr los dos lados**

Run: `cd backend && uv run pytest && uv run mypy app tests` y `cd frontend && npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/ frontend/
git commit -m "feat(ia): descripciones de imágenes con guía de color y posición"
```

---

### Task 7: Indicadores sin color, preset Daltonismo y documentación

**Files:**
- Modify: `frontend/src/features/reader/DocumentView.tsx:68-70` (bloque activo), `frontend/src/features/assistant/AISettingsDialog.tsx` (revisar estados), `backend/app/seed/presets.json`, `backend/tests/api/test_presets.py`, `backend/tests/unit/test_seed.py`, `docs/new_profiles/04-perfil-daltonismo.md`, `docs/accesibilidad.md`, `frontend/src/app.test.tsx`

- [ ] **Step 1: Tests que fallan**

```ts
// app.test.tsx, describe("lector"): ampliar «la lectura en voz alta resalta el párrafo actual…»
const active = document.querySelector("[id^=blk-][aria-current=true]");
expect(active).toHaveClass("border-l-4");
```

```python
# test_presets.py: el conjunto suma "daltonismo", y además:
assert presets["daltonismo"]["settings"]["cvd_type"] == "unsure"
```

En `test_the_shipped_seed_is_valid`, la lista suma `"daltonismo"` al final.

- [ ] **Step 2: Correr y ver que fallan.**
- [ ] **Step 3: Implementar.**
  - El bloque activo suma `border-l-4 border-[var(--accent)] pl-3`.
  - En `AISettingsDialog`, cada estado de éxito, aviso o error tiene que empezar con `✓`, `⚠️` o `✕`. Agregar el que falte, sin cambiar el texto.
  - Agregar el preset al final de `presets.json`:

```json
{"id": "daltonismo", "title": "Daltonismo", "icon": "◑",
 "description": "Nombres de los colores y realce en los gráficos, y descripciones con IA que dicen dónde está cada color.",
 "tags": ["Identificar colores", "Realce de colores", "IA con guía de color"],
 "settings": {"font": "atkinson", "font_size": 20, "line_height": 1.7, "theme": "claro", "audio_focus": false,
              "cvd_type": "unsure"}}
```

- [ ] **Step 4: Correr el backend, el test de contrato y toda la suite del frontend.** Expected: PASS.
- [ ] **Step 5: Verificación manual en Chrome.** Con un PDF que tenga un gráfico de barras rojo/verde: el inspector nombra los colores, «Realzar colores» separa las series vistas con la simulación de DevTools (Rendering → Emulate vision deficiencies → Deuteranopia), y la descripción con IA menciona color y posición.
- [ ] **Step 6: Actualizar `04-perfil-daltonismo.md`:**
  - acromatopsia sin realce;
  - 18 nombres con CIEDE2000;
  - inspector con teclado;
  - temas verificados bajo simulación;
  - tema `okabe` como opcional.
- [ ] **Step 7: Chequeos completos (hoja de ruta §6), `graphify update .` y commit**

```bash
git add backend/ frontend/ docs/ graphify-out/
git commit -m "feat(perfiles): preset Daltonismo e indicadores que no dependen del color"
```

---

### Task 8 (opcional): Tema «Daltonismo · Okabe-Ito»

Ejecutar solo si, después de la tarea 7, se quiere una paleta propia además de los temas verificados.

**Files:**
- Modify: `frontend/src/features/preferences/config.ts` (`THEMES.okabe` y `THEME_ORDER`), `frontend/src/features/preferences/ThemeButtons.tsx` (si cinco temas no entran en la grilla), `backend/app/seed/presets.json` (preset `daltonismo`: `"theme": "okabe"`)

**Interfaces:**
- Produces: `THEMES.okabe = { label: "Daltonismo · Okabe-Ito", swatch: ["#FAFAFA", "#0072B2"], vars: { bg: "#FAFAFA", fg: "#0F172A", panel: "#F1F5F9", muted: "#334155", border: "#64748B", accent: "#0072B2", onAccent: "#FFFFFF", soft: "#E0F2FE", hl: "#F0E442", hlFg: "#0F172A", focus: "#D55E00" } }`.

- [ ] **Step 1:** Agregar `okabe` a `THEME_ORDER`. Los tests de contraste AA y bajo simulación lo recorren solos.
- [ ] **Step 2: Correr y ver si fallan:** `cd frontend && npx vitest run src/features/preferences/`. Si falla un par, ajustar solo ese color.
- [ ] **Step 3:** Cambiar el tema del preset `daltonismo` a `okabe` y correr el test de contrato.
- [ ] **Step 4: Chequeos completos y commit**

```bash
git add frontend/ backend/
git commit -m "feat(daltonismo): tema Okabe-Ito opcional"
```
