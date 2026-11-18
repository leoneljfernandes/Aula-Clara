# Perfiles 04 · Discapacidad motriz — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una interfaz que pide el menor esfuerzo físico posible:
- objetivos de 64 px y pantalla simplificada;
- filtro de clics dobles involuntarios;
- selección de un párrafo con un clic o con Enter, sin arrastrar;
- una barra inferior fija con las acciones principales;
- el preset **Discapacidad motriz**.

**Architecture:**
- `ThemeScope` publica `data-ui-scale` y los componentes reaccionan con la variante de Tailwind `large-ui:`, así `components/` no depende de `features/`. Un bloque de CSS global de respaldo agranda cualquier control interactivo.
- El filtro de clics es un listener del documento en fase de captura (`lib/clickGuard.ts`) que instala `ThemeScope`. No toca ningún componente.
- La selección de párrafo y la barra inferior usan el cursor de bloque del plan 02.

**Tech Stack:** React 19, Tailwind CSS 4 (`@custom-variant`), DOM events.

**Spec:** [docs/new_profiles/02-perfil-discapacidad-motriz.md](./02-perfil-discapacidad-motriz.md); [hoja de ruta](2026-11-18-perfiles-00-hoja-de-ruta.md) §5 y §7.

## Global Constraints

- Incluye las restricciones globales de la hoja de ruta (§6). Depende de los planes 01 (`controls.ts`, `Stepper`) y 02 (`useReaderNavigation`, `ReadAloud.playFrom`, `KEYMAP.simplifyBlock`, `useVoiceCommands`).
- **Interfaz grande** (`uiScale: "large"`):
  - controles interactivos de 64 px de alto como mínimo;
  - checkboxes y radios de 32 × 32 px;
  - 16 px entre controles de un mismo grupo;
  - texto de los botones de 20 px;
  - anillo de foco de 6 px con 4 px de separación.

  Supera el criterio 2.5.5 (AAA, 44 px); 64 px es una decisión de diseño, no un número de WCAG.
- **Pantalla simplificada** (con `uiScale: "large"` y a cualquier ancho): el panel de herramientas queda plegado detrás del botón «⚙ Herramientas». El lector queda en dos columnas en escritorio (documento y asistente) y en una en el celular.
- **Filtro de clics:** `"off"` = 0 ms, `"normal"` = 350 ms y `"strong"` = 700 ms.
  - Solo filtra clics de puntero (`event.detail > 0`) sobre el **mismo** elemento interactivo.
  - Enter y Espacio (`detail === 0`) nunca se filtran.
- **Barra inferior:**
  - `<nav aria-label="Barra simplificada">` fija abajo.
  - Mientras está visible, el contenedor del documento tiene `pb-36` y `scroll-pb-36`: el foco nunca queda tapado (criterio 2.4.11).
- **Nada aparece solo al pasar el mouse.** Con `clickToSelect`, el botón flotante de la selección de texto se reemplaza por la barra inferior, que no desaparece al hacer scroll.
- **Ajustes nuevos:**
  - `uiScale: "normal" | "large" = "normal"`
  - `clickToSelect: boolean = false`
  - `clickGuard: "off" | "normal" | "strong" = "off"`

## Review Focus

1. **Enter dos veces seguidas sobre un botón:** el teclado nunca se filtra, así que las dos pulsaciones cuentan. Lo cubre la tarea 2.
2. **La barra fija tapa el bloque enfocado:** el scroll deja el bloque visible por encima de la barra. Lo cubre la tarea 4.
3. **Con `clickToSelect` activo, seleccionar texto arrastrando:** sigue funcionando y no selecciona el bloque. Lo cubre la tarea 3.
4. **Interfaz grande en un celular (360 px):** sin scroll horizontal. Es una verificación manual de la tarea 5.
5. **Volver a «Normal»:** desaparecen el atributo y la barra, y la pantalla vuelve a tres columnas. Lo cubre la tarea 1.

---

### Task 1: Interfaz grande y pantalla simplificada

**Files:**
- Modify: `frontend/src/index.css`, `frontend/src/features/preferences/PreferencesProvider.tsx` (`ThemeScope`), `frontend/src/components/Button.tsx:5-6`, `frontend/src/features/reader/ReaderScreen.tsx` (grilla y panel de herramientas), `frontend/src/features/preferences/settings.ts`, `frontend/src/features/preferences/controls.ts`, `frontend/src/app.test.tsx`
- Create: `frontend/src/components/Button.test.tsx`

**Interfaces:**
- Produces:
  - En `ThemeScope`, el `div` raíz suma `data-ui-scale={settings.uiScale}`.
  - En `index.css`, la variante `@custom-variant large-ui (&:where([data-ui-scale="large"] *));` y este bloque **fuera de capas** (después de `@import "tailwindcss"`, así le gana a las utilidades):

```css
[data-ui-scale="large"] :is(button, a[href], select, summary, input:not([type="checkbox"], [type="radio"], [type="range"])) { min-height: 64px; }
[data-ui-scale="large"] :is(input[type="checkbox"], input[type="radio"]) { width: 32px; height: 32px; }
[data-ui-scale="large"] [role="group"] { gap: 1rem; }
[data-ui-scale="large"] *:focus-visible { outline-width: 6px; outline-offset: 4px; }
```

  - En `Button.tsx`, `BASE` suma `large-ui:min-h-16 large-ui:px-6 large-ui:text-xl large-ui:border-[3px]`.
  - `uiScale` en `settings.ts`, con el control `{ key: "uiScale", kind: "choice", label: "Tamaño de los botones", options: [{ value: "normal", label: "Normal" }, { value: "large", label: "Grandes y pantalla simplificada" }], group: "interfaz", inReader: true }`.
  - `ReaderScreen` con `uiScale === "large"`:
    - el `aside#herramientas` usa `${toolsOpen ? "block" : "hidden"}`, sin `lg:block`;
    - el botón «⚙ Herramientas» no tiene `lg:hidden`;
    - la grilla es `lg:grid-cols-[minmax(0,1fr)_420px]`.

- [ ] **Step 1: Escribir los tests que fallan**

```tsx
// Button.test.tsx
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Button } from "./Button";

it("el botón crece con la interfaz grande sin depender de las preferencias", () => {
  render(<Button>Leer</Button>);
  expect(screen.getByRole("button", { name: "Leer" })).toHaveClass("large-ui:min-h-16");
});
```

En `app.test.tsx` (`describe("lector")`):

```ts
it("con botones grandes, la pantalla se simplifica: herramientas plegadas y atributo en el tema", async () => {
  window.localStorage.setItem("aulaclara.settings", JSON.stringify({ schemaVersion: 2, settings: { uiScale: "large" } }));
  const user = userEvent.setup();
  renderAt("/leer/d1");
  await h1();
  expect(document.querySelector("[data-ui-scale]")).toHaveAttribute("data-ui-scale", "large");
  const tools = screen.getByRole("complementary", { name: "Barra de accesibilidad" });
  expect(tools).toHaveClass("hidden");
  expect(tools).not.toHaveClass("lg:block");
  await user.click(screen.getByRole("button", { name: /Herramientas/ }));
  expect(tools).toHaveClass("block");
});

it("en tamaño normal el panel de herramientas se ve en escritorio", async () => {
  renderAt("/leer/d1");
  await h1();
  expect(document.querySelector("[data-ui-scale]")).toHaveAttribute("data-ui-scale", "normal");
  expect(screen.getByRole("complementary", { name: "Barra de accesibilidad" })).toHaveClass("lg:block");
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd frontend && npx vitest run src/components/Button.test.tsx src/app.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr**

Run: `cd frontend && npm run typecheck && npm test && npm run build`
Expected: PASS. El build confirma que Tailwind acepta la variante.

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(motriz): interfaz grande y pantalla simplificada"
```

---

### Task 2: Filtro de clics dobles involuntarios

**Files:**
- Create: `frontend/src/lib/clickGuard.ts`, `frontend/src/lib/clickGuard.test.ts`
- Modify: `frontend/src/features/preferences/PreferencesProvider.tsx` (`ThemeScope`), `frontend/src/features/preferences/settings.ts`, `frontend/src/features/preferences/controls.ts`

**Interfaces:**
- Produces:
  - `installClickGuard(root: Document, ms: number): () => void`. Agrega un listener de `click` en fase de captura y devuelve la función que lo saca.
    - El elemento interactivo es el `closest("button, a[href], [role=button], input[type=checkbox], input[type=radio], summary")` del `target`.
    - Si es el mismo que el último clic aceptado y pasaron menos de `ms` según `performance.now()`, el clic se cancela con `preventDefault()` y `stopImmediatePropagation()`.
  - `ThemeScope` instala el filtro en un `useEffect` cuando `clickGuard !== "off"`.
  - `clickGuard` en `settings.ts`, con el control `{ key: "clickGuard", kind: "choice", label: "Evitar clics dobles involuntarios", options: [{ value: "off", label: "No" }, { value: "normal", label: "Sí" }, { value: "strong", label: "Sí, más fuerte" }], help: "Ignora un segundo clic sobre el mismo botón si llega demasiado rápido. No afecta al teclado.", group: "interfaz", inReader: true }`.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// clickGuard.test.ts
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { installClickGuard } from "./clickGuard";

let off = () => {};
const now = vi.spyOn(performance, "now");
const click = (el: Element, at: number, detail = 1) => {
  now.mockReturnValue(at);
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail }));
};
beforeEach(() => {
  document.body.innerHTML = "<button id='x'><span>x</span></button><button id='y'>y</button>";
  off = installClickGuard(document, 350);
});
afterEach(() => off());

it("ignora un segundo clic del mouse sobre el mismo botón dentro del intervalo", () => {
  const onX = vi.fn();
  document.getElementById("x")!.addEventListener("click", onX);
  click(document.querySelector("#x span")!, 1_000);
  click(document.getElementById("x")!, 1_100);
  click(document.getElementById("x")!, 1_500);
  expect(onX).toHaveBeenCalledTimes(2);
});

it("no filtra el teclado ni un botón distinto", () => {
  const onX = vi.fn();
  const onY = vi.fn();
  document.getElementById("x")!.addEventListener("click", onX);
  document.getElementById("y")!.addEventListener("click", onY);
  click(document.getElementById("x")!, 1_000, 0);
  click(document.getElementById("x")!, 1_010, 0);
  click(document.getElementById("y")!, 1_020);
  expect(onX).toHaveBeenCalledTimes(2);
  expect(onY).toHaveBeenCalledTimes(1);
});

it("al desinstalarlo deja de filtrar", () => {
  off();
  const onX = vi.fn();
  document.getElementById("x")!.addEventListener("click", onX);
  click(document.getElementById("x")!, 1_000);
  click(document.getElementById("x")!, 1_010);
  expect(onX).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd frontend && npx vitest run src/lib/clickGuard.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `clickGuard.ts` y conectarlo en `ThemeScope`.**
- [ ] **Step 4: Correr**

Run: `cd frontend && npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(motriz): filtro opcional de clics dobles involuntarios"
```

---

### Task 3: Elegir un párrafo con un clic o con Enter

**Files:**
- Create: `frontend/src/features/reader/ReaderBottomBar.tsx`
- Modify: `frontend/src/features/reader/DocumentView.tsx`, `frontend/src/features/reader/ReaderScreen.tsx`, `frontend/src/features/assistant/AssistantPanel.tsx` (pregunta libre con selección), `frontend/src/features/preferences/settings.ts`, `frontend/src/features/preferences/controls.ts`, `frontend/src/app.test.tsx`

**Interfaces:**
- Consumes: `useReaderNavigation().setCursor` y `readableIndex` (plan 02); `ReadAloud.playFrom`; `chat.send`.
- Produces:
  - `DocumentView` suma `selectedBlock: number | null` y `onSelectBlock?: (i: number) => void`.
    - Con `onSelectBlock`, un clic sobre un `p` o un `h2` llama a `onSelectBlock(i)` solo si `window.getSelection()?.isCollapsed !== false`. Así arrastrar para seleccionar texto sigue funcionando.
    - Enter sobre el bloque enfocado (el cursor del plan 02) también lo selecciona.
    - El bloque seleccionado lleva `data-selected="true"` y `outline-4 outline-[var(--accent)]`.
  - `ReaderBottomBar(props: { block: { text: string; onExplain(): void; onReadFrom?(): void; onAsk(): void; onClear(): void } | null; nav: { onPrev(): void; onNext(): void; playing: boolean; onPlayPause?(): void; onVoice?(): void; listening: boolean; onAssistant(): void } | null }): ReactNode`. No renderiza nada si los dos son `null`.
  - La fila de bloque tiene **«✦ Explicar este párrafo más simple»**, **«🔊 Leer desde este párrafo»**, **«❓ Preguntar sobre este párrafo»** y **«✕ Quitar selección»**. La fila `nav` es de la tarea 4.
  - En `ReaderScreen`:
    - `selectedBlock` en el estado. Al seleccionar se anuncia **«Párrafo seleccionado. Las acciones están en la barra de abajo.»**
    - «Preguntar» le pasa el texto del bloque a `AssistantPanel` como `selection` y enfoca el campo del chat.
    - `simplifyBlock` (tecla `4`) actúa sobre `selectedBlock` o, si no hay, sobre el bloque del cursor.
  - En `AssistantPanel`, una pregunta libre manda `{ selection }` cuando hay una selección.
  - `clickToSelect` en `settings.ts`, con el control `{ key: "clickToSelect", kind: "toggle", label: "Elegir un párrafo con un clic", help: "Un clic o Enter sobre un párrafo lo selecciona, sin arrastrar el mouse, y muestra acciones grandes abajo.", group: "interfaz", inReader: true }`.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
describe("elegir un párrafo con un clic", () => {
  beforeEach(() => {
    withOnboarding();
    withAI();
    window.localStorage.setItem("aulaclara.settings", JSON.stringify({ schemaVersion: 2, settings: { clickToSelect: true } }));
  });

  it("un clic selecciona el párrafo y «Explicar» lo manda sin selección de texto", async () => {
    const user = userEvent.setup();
    renderAt("/leer/d1");
    const paragraph = (await screen.findAllByText(/La incorporación de entornos virtuales/))[0]!;
    await user.click(paragraph);
    expect(paragraph).toHaveAttribute("data-selected", "true");
    await user.click(screen.getByRole("button", { name: /Explicar este párrafo más simple/ }));
    await waitFor(() =>
      expect(calls("/ai/chat")[0]?.data).toMatchObject({ action: "simplify", selection: paragraph.textContent }),
    );
  });

  it("«Preguntar» lleva el párrafo como contexto de la pregunta libre", async () => {
    const user = userEvent.setup();
    renderAt("/leer/d1");
    const paragraph = (await screen.findAllByText(/La incorporación de entornos virtuales/))[0]!;
    await user.click(paragraph);
    await user.click(screen.getByRole("button", { name: /Preguntar sobre este párrafo/ }));
    expect(screen.getByLabelText("Escribí tu pregunta")).toHaveFocus();
    await user.keyboard("¿Qué quiere decir?{Enter}");
    await waitFor(() =>
      expect(calls("/ai/chat")[0]?.data).toMatchObject({ action: "free", selection: paragraph.textContent }),
    );
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd frontend && npx vitest run src/app.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar.** «Leer desde este párrafo» llama a `audio.playFrom(readableIndex(...))` y solo aparece si el bloque es leíble.
- [ ] **Step 4: Correr**

Run: `cd frontend && npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(motriz): elegir un párrafo con un clic o Enter y acciones grandes"
```

---

### Task 4: Barra simplificada fija

**Files:**
- Modify: `frontend/src/features/reader/ReaderBottomBar.tsx`, `frontend/src/features/reader/ReaderScreen.tsx`, `frontend/src/app.test.tsx`

**Interfaces:**
- Consumes: `useReaderNavigation().move` (plan 02); `useVoiceCommands().toggle` y `listening` (plan 02); `audio.play` y `audio.pause`.
- Produces:
  - Con `uiScale === "large"`, `ReaderScreen` pasa `nav` a `ReaderBottomBar`.
  - La fila `nav` tiene **«⬆ Anterior»**, **«⬇ Siguiente»**, **«▶ Leer»** o **«❚❚ Pausar»**, **«🎙 Voz»** (solo si `voiceCommands !== "off"` y hay soporte; con `aria-pressed={listening}`) y **«✦ Asistente»** (enfoca el chat).
  - Si hay un bloque seleccionado, su fila va arriba de la fila `nav`, en el mismo `<nav>`.
  - Mientras la barra está visible, `main#contenido` suma `pb-36 scroll-pb-36`.

- [ ] **Step 1: Escribir el test que falla**

```ts
it("la barra simplificada mueve el cursor y deja espacio para que no tape el foco", async () => {
  window.localStorage.setItem("aulaclara.settings", JSON.stringify({ schemaVersion: 2, settings: { uiScale: "large" } }));
  const user = userEvent.setup();
  renderAt("/leer/d1");
  const bar = await screen.findByRole("navigation", { name: "Barra simplificada" });
  await user.click(within(bar).getByRole("button", { name: /Siguiente/ }));
  expect(document.activeElement?.id).toBe("blk-0");
  expect(document.getElementById("contenido")).toHaveClass("pb-36", "scroll-pb-36");
});
```

(Va en `describe("lector")`, que ya tiene `withOnboarding` y `withAI`.)

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
git commit -m "feat(motriz): barra simplificada fija con navegación, lectura, voz y asistente"
```

---

### Task 5: Preset Discapacidad motriz, documentación y verificación manual

**Files:**
- Modify: `backend/app/seed/presets.json`, `backend/tests/api/test_presets.py`, `backend/tests/unit/test_seed.py`, `docs/new_profiles/02-perfil-discapacidad-motriz.md`, `docs/accesibilidad.md`

- [ ] **Step 1: Tests que fallan.**
  - En `test_presets_catalog_lists_the_seed_presets`, el conjunto suma `"motriz"`, y se agrega `assert presets["motriz"]["settings"]["ui_scale"] == "large"`.
  - En `test_the_shipped_seed_is_valid`, la lista suma `"motriz"` al final.
- [ ] **Step 2: Correr y ver que fallan:** `cd backend && uv run pytest tests/api/test_presets.py tests/unit/test_seed.py`.
- [ ] **Step 3: Agregar el preset al final de `presets.json`**

```json
{"id": "motriz", "title": "Discapacidad motriz", "icon": "⌖",
 "description": "Botones grandes, pantalla despejada, elegir párrafos con un toque y control por teclado o por voz.",
 "tags": ["Botones grandes", "Atajos de una tecla", "Párrafos con un toque"],
 "settings": {"font": "atkinson", "font_size": 22, "line_height": 1.8, "theme": "claro", "audio_focus": false,
              "ui_scale": "large", "click_to_select": true, "click_guard": "normal",
              "single_key_shortcuts": true, "voice_commands": "push"}}
```

- [ ] **Step 4: Correr el backend y el test de contrato del frontend.** Expected: PASS.
- [ ] **Step 5: Verificación manual en Chrome** (con la skill `run`):
  1. Recorrer el lector solo con `Tab`, `Enter`, `J` y `K`. Ningún control queda tapado por la barra.
  2. Ancho de 360 px con la interfaz grande: sin scroll horizontal.
  3. Doble clic rápido en «▶ Leer»: no inicia y pausa enseguida.
  4. Comandos por voz en modo «Manos libres»: «bajar» y «subir» mueven el cursor, y la app no se oye a sí misma.
- [ ] **Step 6: Actualizar `02-perfil-discapacidad-motriz.md`:**
  - criterios WCAG corregidos (2.5.5, 2.5.7 y 2.4.11);
  - cursor de bloque en lugar de `role="region"`;
  - filtro solo para el puntero;
  - variante `large-ui`.
- [ ] **Step 7: Chequeos completos (hoja de ruta §6), `graphify update .` y commit**

```bash
git add backend/ frontend/ docs/ graphify-out/
git commit -m "feat(perfiles): preset Discapacidad motriz"
```

---

## Pendientes heredados del plan 02

Cosas que el plan 02 dejó a propósito para este plan:

- **Reproducir desde el cursor en todos los controles.** `Alt+P`, `Espacio` y la voz («leer», «continuar») arrancan desde el bloque del cursor con `startReading()` (en `ReaderScreen`), pero el botón ▶ de `ToolsPanel` sigue arrancando desde el principio. Usá `startReading` en ese botón y en «▶ Leer» de la barra simplificada, para que coincidan. «Escuchar este documento» sigue desde el principio, como dice su etiqueta.
- **Tecla `4` (`simplifyBlock`).** Hoy explica más simple el bloque donde está el cursor y avisa «Elegí un párrafo primero (Alt+↓ o J).» si no hay ninguno. Este plan la extiende: primero el bloque elegido con un clic (`selectedBlock`) y, si no hay, el del cursor.
- **Cursor después de leer todo.** Al terminar la lectura o con `Alt+S`, el cursor queda en el último bloque leído y `Alt+P` vuelve a leer solo ese. Evaluá reiniciarlo en «Lectura finalizada».
- **`KeysDialog` no filtra por capacidades** (muestra atajos de funciones apagadas). `ToolsPanel` sí filtra.
