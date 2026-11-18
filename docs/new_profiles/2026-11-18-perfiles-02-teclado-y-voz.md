# Perfiles 02 · Teclado y voz — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Navegación estructural del documento por teclado, con una tabla única de atajos y atajos de una tecla opcionales. Una voz que nunca se pisa con otra, guía por voz opcional para quien no usa lector de pantalla, comandos y dictado por voz con consentimiento, y el preset **Ceguera**.

**Architecture:**
- `lib/keymap.ts` es la única fuente de atajos: el lector despacha por id, y el diálogo de atajos y el panel de herramientas leen la misma tabla.
- `lib/speech.ts` suma un árbitro (`speechBus`): quien empieza a hablar interrumpe al anterior y le avisa, así la lectura del documento queda en pausa en vez de trabada.
- Reconocimiento de voz en `lib/voice/`:
  - `recognizer.ts` envuelve el navegador;
  - `commands.ts` es un intérprete puro;
  - `earcons.ts` genera los tonos;
  - `consent.ts` guarda el consentimiento.
- El lector usa un cursor de bloque (`useReaderNavigation`) que mueve el foco a bloques con `tabIndex=-1`, sin agregar paradas de `Tab`.

**Tech Stack:** React 19, Web Speech API (`speechSynthesis`, `SpeechRecognition` / `webkitSpeechRecognition`), Web Audio API, Vitest con dobles de esas APIs.

**Spec:** [docs/new_profiles/01-perfil-ceguera.md](./01-perfil-ceguera.md) §2.1–§2.2 y §3 pasos 1, 4 y 5; [02-perfil-discapacidad-motriz.md](./02-perfil-discapacidad-motriz.md) §2.2–§2.3; [hoja de ruta](2026-11-18-perfiles-00-hoja-de-ruta.md) §4, §5 y §7.

## Global Constraints

- Incluye las restricciones globales de la hoja de ruta (§6) y depende del plan 01 (`settings.ts`, `controls.ts`, `presets.json`).
- **Atajos:** la tabla de la hoja de ruta §5, exacta.
  - Los atajos de una tecla funcionan solo si `singleKeyShortcuts` está activo, sin `Ctrl`, `Meta` ni `Alt`, y con el foco fuera de un campo de escritura (`input` de texto, `textarea`, `select`, `[contenteditable]`, `role="textbox"` o `role="combobox"`).
  - `Espacio` se ignora si el foco está en un control que se activa con Espacio (`button`, `a`, `summary`, `input[type=checkbox|radio]`, `[role=button|link|checkbox|radio|switch|menuitem|option|tab]`).
  - `Alt+↑` y `Alt+↓` se ignoran en campos de escritura, porque abren el `select`.
- **`Esc` silencia toda voz** (`speechBus.silence()`) y además sigue cerrando diálogos.
- **Reconocimiento de voz:**
  - `lang = "es-AR"`.
  - Modo `"push"`: `continuous = false` e `interimResults = false`.
  - Modo `"continuous"`: `continuous = true`, `interimResults = false`; se reinicia 300 ms después de cada `end` mientras siga activo, y se pausa mientras `speechBus.isSpeaking()`.
  - Errores `not-allowed`, `service-not-allowed` y `language-not-supported` apagan el micrófono sin reintentar.
  - Si el navegador ofrece reconocimiento en el dispositivo (MDN: `SpeechRecognition.processLocally`), se prefiere. Hay que verificar la forma de la API en MDN al implementarlo. Si no está, se usa el servicio del navegador con consentimiento.
- **Earcons:** 80 ms, ganancia 0,15. Inicio: 440 → 660 Hz. Fin: 660 → 440 Hz. Sin `AudioContext`, no suena nada y no falla.
- **Consentimiento:** texto exacto en la tarea 5. Se guarda en `aulaclara.voiceConsent` = `{ "commands"?: true, "captions"?: true }`.
- **`vercel.json`:** `Permissions-Policy` = `camera=(), microphone=(self), geolocation=(), payment=()`. Ningún otro header cambia.
- **Ajustes nuevos:**
  - `singleKeyShortcuts: boolean = false`
  - `voiceGuide: boolean = false`
  - `voiceCommands: "off" | "push" | "continuous" = "off"`

## Review Focus

1. **Escribir «j», «1» o un espacio en el campo del chat o en un `select`** no dispara ningún atajo. Lo cubre la tarea 1.
2. **«Escuchar respuesta» mientras se lee el documento:** la lectura queda en pausa en el mismo párrafo y «Continuar» sigue desde ahí. Lo cubre la tarea 2.
3. **Micrófono en modo manos libres mientras habla la app:** el reconocimiento se detiene mientras suena la voz y vuelve a escuchar después, sin oírse a sí mismo. Lo cubre la tarea 5.
4. **Navegador sin `SpeechRecognition` (Firefox):** no aparece el botón de micrófono, se explica por qué y no hay excepciones. Lo cubre la tarea 6.
5. **`J` en el último bloque o `K` en el primero:** el cursor no se mueve y se anuncia «Fin del documento» o «Principio del documento». Lo cubre la tarea 3.

---

### Task 1: Tabla única de atajos y atajos de una tecla

**Files:**
- Create: `frontend/src/lib/keymap.ts`, `frontend/src/lib/keymap.test.ts`
- Modify: `frontend/src/features/reader/hooks.ts:101-136` (`useReaderHotkeys`), `frontend/src/features/reader/ReaderScreen.tsx:40`, `frontend/src/components/KeysDialog.tsx`, `frontend/src/features/reader/ToolsPanel.tsx:168-184`, `frontend/src/features/preferences/settings.ts`, `frontend/src/features/preferences/controls.ts`, `frontend/src/app.test.tsx`

**Interfaces:**
- Produces (`lib/keymap.ts`):
  - `type ShortcutId = "playPause" | "stop" | "fontUp" | "fontDown" | "nextTheme" | "focusAssistant" | "nextBlock" | "prevBlock" | "nextHeading" | "nextFigure" | "toggleMic" | "openBraille" | "summarize" | "keyConcepts" | "quiz" | "simplifyBlock" | "silence"`
  - `interface Shortcut { id: ShortcutId; label: string; alt?: readonly string[]; single?: readonly string[]; plain?: readonly string[]; requires?: "audio" | "voice" | "braille" }` (los arrays tienen valores de `KeyboardEvent.code`)
  - `const KEYMAP: readonly Shortcut[]`
  - `type KeyLike = Pick<KeyboardEvent, "code" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey"> & { target: EventTarget | null }`
  - `matchShortcut(e: KeyLike, opts: { singleKey: boolean }): ShortcutId | null`
  - `describeKeys(s: Shortcut, opts: { singleKey: boolean }): string`, que devuelve por ejemplo `"Alt + ↓ · J"`. Se muestra solo el primer código de cada lista. Nombres de teclas: `Space` → «Espacio», `Equal` → «=», `Minus` → «−», `ArrowDown` → «↓», `ArrowUp` → «↑», `Escape` → «Esc», `KeyX` → «X», `DigitN` → «N».
- Produces (`hooks.ts`): `useReaderHotkeys(deps: { handlers: Partial<Record<ShortcutId, () => void>>; singleKey: boolean }): void`. Si el id no tiene handler, no hace nada y no llama a `preventDefault`.
- Produces (`settings.ts`, `controls.ts`):
  - `singleKeyShortcuts: boolean`, por defecto `false`.
  - Control `{ key: "singleKeyShortcuts", kind: "toggle", label: "Atajos de una sola tecla", help: "J y K para moverte por bloques, Espacio para leer y 1 a 4 para el asistente. No funcionan mientras escribís.", group: "voz", inReader: true }`.

`KEYMAP` exacto:

| id | label | alt | single | plain | requires |
|---|---|---|---|---|---|
| playPause | Leer / pausar | KeyP | Space | | audio |
| stop | Detener lectura | KeyS | | | audio |
| fontUp | Agrandar texto | Equal, NumpadAdd | | | |
| fontDown | Achicar texto | Minus, NumpadSubtract | | | |
| nextTheme | Cambiar tema de color | KeyT | | | |
| focusAssistant | Ir al asistente | KeyA | | | |
| nextBlock | Bloque siguiente | ArrowDown | KeyJ | | |
| prevBlock | Bloque anterior | ArrowUp | KeyK | | |
| nextHeading | Título siguiente | KeyH | KeyH | | |
| nextFigure | Gráfico siguiente | KeyG | KeyG | | |
| toggleMic | Activar o apagar el micrófono | KeyM | KeyM | | voice |
| openBraille | Abrir Braille | KeyB | KeyB | | braille |
| summarize | Resumir | | Digit1, Numpad1 | | |
| keyConcepts | Conceptos clave | | Digit2, Numpad2 | | |
| quiz | Preguntas de repaso | | Digit3, Numpad3 | | |
| simplifyBlock | Explicar el bloque actual más simple | | Digit4, Numpad4 | | |
| silence | Silenciar la voz | | | Escape | |

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// keymap.test.ts
import { describe, expect, it } from "vitest";
import { describeKeys, KEYMAP, matchShortcut, type KeyLike } from "./keymap";

const key = (code: string, extra: Partial<KeyLike> = {}): KeyLike => ({
  code, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, target: document.body, ...extra,
});
const el = (html: string): Element => {
  document.body.innerHTML = html;
  return document.body.firstElementChild!;
};

describe("matchShortcut", () => {
  it("Alt+letra funciona siempre", () => {
    expect(matchShortcut(key("KeyP", { altKey: true }), { singleKey: false })).toBe("playPause");
  });
  it("una tecla sola solo si está activado", () => {
    expect(matchShortcut(key("KeyJ"), { singleKey: false })).toBeNull();
    expect(matchShortcut(key("KeyJ"), { singleKey: true })).toBe("nextBlock");
    expect(matchShortcut(key("Digit1"), { singleKey: true })).toBe("summarize");
  });
  it.each(["<input>", "<textarea></textarea>", "<select><option>a</option></select>", "<div contenteditable='true'></div>"])(
    "no dispara una tecla sola mientras se escribe en %s",
    (html) => {
      expect(matchShortcut(key("KeyJ", { target: el(html) }), { singleKey: true })).toBeNull();
      expect(matchShortcut(key("Digit1", { target: el(html) }), { singleKey: true })).toBeNull();
    },
  );
  it("Espacio sobre un botón activa el botón, no el atajo", () => {
    expect(matchShortcut(key("Space", { target: el("<button>x</button>") }), { singleKey: true })).toBeNull();
    expect(matchShortcut(key("Space"), { singleKey: true })).toBe("playPause");
  });
  it("con Ctrl o Meta no hay atajo de una tecla", () => {
    expect(matchShortcut(key("KeyJ", { ctrlKey: true }), { singleKey: true })).toBeNull();
  });
  it("Alt+↓ dentro de un select no se intercepta", () => {
    expect(matchShortcut(key("ArrowDown", { altKey: true, target: el("<select></select>") }), { singleKey: false })).toBeNull();
  });
  it("Esc silencia aunque los atajos de una tecla estén apagados", () => {
    expect(matchShortcut(key("Escape"), { singleKey: false })).toBe("silence");
  });
});

it("ninguna combinación está asignada a dos acciones", () => {
  const bindings = KEYMAP.flatMap((s) => [
    ...(s.alt ?? []).map((c) => `alt:${c}`),
    ...(s.single ?? []).map((c) => `single:${c}`),
    ...(s.plain ?? []).map((c) => `plain:${c}`),
  ]);
  expect(new Set(bindings).size).toBe(bindings.length);
});

it("describeKeys muestra la variante con Alt y la de una tecla", () => {
  const next = KEYMAP.find((s) => s.id === "nextBlock")!;
  expect(describeKeys(next, { singleKey: true })).toBe("Alt + ↓ · J");
  expect(describeKeys(next, { singleKey: false })).toBe("Alt + ↓");
});
```

En `app.test.tsx`, dentro de `describe("lector")`:

```ts
it("con atajos de una tecla, «1» resume pero escribir «1» en el chat no", async () => {
  window.localStorage.setItem("aulaclara.settings", JSON.stringify({ schemaVersion: 2, settings: { singleKeyShortcuts: true } }));
  const user = userEvent.setup();
  renderAt("/leer/d1");
  await user.type(await screen.findByLabelText("Escribí tu pregunta"), "1");
  expect(calls("/ai/chat")).toHaveLength(0);
  await user.click(screen.getByRole("heading", { level: 1 }));
  await user.keyboard("1");
  await waitFor(() => expect(calls("/ai/chat")[0]?.data).toMatchObject({ action: "summarize" }));
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd frontend && npx vitest run src/lib/keymap.test.ts src/app.test.tsx`
Expected: FAIL (`Failed to resolve import "./keymap"`).

- [ ] **Step 3: Implementar `keymap.ts` y conectar el resto**

- `useReaderHotkeys` usa `matchShortcut`.
- `ReaderScreen` arma `handlers` con los atajos de hoy (`playPause`, `stop`, `fontUp`, `fontDown`, `nextTheme` con su anuncio, `focusAssistant`), más:
  - `summarize`, `keyConcepts` y `quiz`, que llaman a `chat.send` con el mismo texto que el botón del panel;
  - `silence`, que llama a `speechBus.silence()` en la tarea 2. Hasta entonces, `window.speechSynthesis?.cancel()`.
- `KeysDialog` arma sus filas con `KEYMAP` y `describeKeys(s, { singleKey: true })`, y mantiene las dos filas fijas «Esc / Cerrar ventanas» y «Tab / Shift + Tab».
- La lista «Atajos» de `ToolsPanel` usa `KEYMAP` filtrada por las capacidades disponibles y `describeKeys(s, { singleKey: settings.singleKeyShortcuts })`.

- [ ] **Step 4: Correr la suite**

Run: `cd frontend && npm run typecheck && npm test`
Expected: PASS (incluido el test existente «Alt+T cambia el tema y Alt+= agranda el texto»).

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(teclado): tabla única de atajos y atajos opcionales de una tecla"
```

---

### Task 2: Árbitro de voz y lectura desde un bloque

**Files:**
- Modify: `frontend/src/lib/speech.ts`, `frontend/src/lib/useReadAloud.ts`, `frontend/src/features/reader/ReaderScreen.tsx` (handler `silence`)
- Create: `frontend/src/lib/speech.bus.test.ts`

**Interfaces:**
- Produces (`lib/speech.ts`):
  - `interface SpeechOwner { onInterrupted(): void }`
  - `const speechBus: { claim(owner: SpeechOwner): void; release(owner: SpeechOwner): void; silence(): void; isSpeaking(): boolean; subscribe(listener: (speaking: boolean) => void): () => void }`
  - `speakOnce(text: string, rate?: number): boolean` mantiene la firma; ahora toma el árbitro con un dueño de un solo uso.
  - `ReadAloudEngine.playFrom(i: number): void` (público).
- Produces (`useReadAloud.ts`): `ReadAloud` suma `playFrom: (i: number) => void`, donde `i` es el índice en la lista de textos leíbles.

**Comportamiento:**
- `claim(nuevo)` llama a `onInterrupted()` del dueño anterior (si es otro) antes de `speechSynthesis.cancel()`.
- `ReadAloudEngine.onInterrupted`: incrementa `token`, limpia el temporizador y pasa a `{ status: "paused", idx }` (nunca a `"stopped"`). Al llamar a `play()` en esa pausa, vuelve a leer el mismo párrafo desde el principio.
- `isSpeaking()` es `true` mientras algún dueño tiene el árbitro: desde `claim` hasta `release`, `end`, `error` o `cancel`. `subscribe` avisa cada cambio. El motor toma el árbitro al leer un párrafo y lo suelta al detenerse o terminar, también en modo simulado. Así el micrófono (tarea 5) se comporta igual con o sin voces.
- `silence()` interrumpe al dueño actual y cancela.

- [ ] **Step 1: Escribir los tests que fallan** (dobles de `speechSynthesis`: el módulo calcula `hasTTS` al importarse)

```ts
// speech.bus.test.ts
import { afterEach, beforeEach, expect, it, vi } from "vitest";

class FakeUtterance { onend: (() => void) | null = null; onerror: ((e: { error: string }) => void) | null = null; constructor(public text: string) {} }
const spoken: FakeUtterance[] = [];
const synth = {
  speak: (u: FakeUtterance) => spoken.push(u),
  cancel: () => spoken.splice(0).forEach((u) => u.onerror?.({ error: "interrupted" })),
  pause: vi.fn(), resume: vi.fn(), getVoices: () => [],
};

let speech: typeof import("./speech");
beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  speech = await import("./speech");
});
afterEach(() => vi.unstubAllGlobals());

it("hablar algo suelto pausa la lectura del documento en el mismo párrafo", () => {
  const states: unknown[] = [];
  const engine = new speech.ReadAloudEngine(["a", "b"], () => 1, (s) => states.push(s), vi.fn());
  engine.play();
  speech.speakOnce("respuesta del asistente");
  expect(states.at(-1)).toEqual({ status: "paused", idx: 0 });
  engine.play();
  expect(states.at(-1)).toEqual({ status: "playing", idx: 0 });
});

it("isSpeaking y subscribe siguen la locución", () => {
  const seen: boolean[] = [];
  speech.speechBus.subscribe((s) => seen.push(s));
  speech.speakOnce("hola");
  expect(speech.speechBus.isSpeaking()).toBe(true);
  spoken.at(-1)!.onend!();
  expect(speech.speechBus.isSpeaking()).toBe(false);
  expect(seen).toEqual([true, false]);
});

it("playFrom lee desde el párrafo pedido y silence lo deja en pausa", () => {
  const states: unknown[] = [];
  const engine = new speech.ReadAloudEngine(["a", "b", "c"], () => 1, (s) => states.push(s), vi.fn());
  engine.playFrom(2);
  expect(states.at(-1)).toEqual({ status: "playing", idx: 2 });
  speech.speechBus.silence();
  expect(states.at(-1)).toEqual({ status: "paused", idx: 2 });
  expect(speech.speechBus.isSpeaking()).toBe(false);
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd frontend && npx vitest run src/lib/speech.bus.test.ts`
Expected: FAIL (`speechBus` no existe).

- [ ] **Step 3: Implementar el árbitro, `playFrom` y el handler `silence`.** El test existente `speech.test.ts` (modo simulado) tiene que seguir pasando sin cambios.

- [ ] **Step 4: Correr**

Run: `cd frontend && npx vitest run src/lib/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/ frontend/src/features/reader/ReaderScreen.tsx
git commit -m "feat(voz): árbitro de voz; la lectura queda en pausa cuando otra voz la interrumpe"
```

---

### Task 3: Cursor de bloque y navegación estructural

**Files:**
- Create: `frontend/src/features/reader/blockNav.ts`, `frontend/src/features/reader/blockNav.test.ts`, `frontend/src/features/reader/useReaderNavigation.ts`
- Modify: `frontend/src/features/reader/DocumentView.tsx`, `frontend/src/features/reader/FigureBlock.tsx` (prop `buttonId`), `frontend/src/features/reader/ReaderScreen.tsx`, `frontend/src/features/preferences/settings.ts`, `frontend/src/features/preferences/controls.ts`, `frontend/src/app.test.tsx`

**Interfaces:**
- Consumes: `ReadAloud.playFrom` (tarea 2); `handlers` de `useReaderHotkeys` (tarea 1).
- Produces (`blockNav.ts`, funciones puras):
  - `type BlockKind = "any" | "h2" | "figure"`
  - `findBlock(blocks: readonly Block[], from: number, kind: BlockKind, dir: 1 | -1): number | null`, que busca desde `from + dir` sin incluir `from`.
  - `headingPosition(blocks: readonly Block[], index: number): { n: number; total: number } | null`
  - `figurePosition(blocks: readonly Block[], index: number): number | null`, el número de gráfico (1, 2…).
  - `readableIndex(blocks: readonly Block[], index: number): number | null`, el índice en la lista de textos leíbles; `null` para figuras.
- Produces (`useReaderNavigation.ts`): `useReaderNavigation(opts: { blocks: readonly Block[]; audio: ReadAloud; voiceGuide: boolean; announce: (m: string) => void }): { cursor: number; move(kind: BlockKind, dir: 1 | -1): void; setCursor(i: number): void }`.
- Produces (`settings.ts`, `controls.ts`):
  - `voiceGuide: boolean`, por defecto `false`.
  - Control `{ key: "voiceGuide", kind: "toggle", label: "Guía por voz (si no usás lector de pantalla)", help: "Lee en voz alta el bloque al que te movés y las respuestas del asistente. Si usás NVDA, JAWS o VoiceOver, dejalo apagado para no escuchar dos voces.", group: "voz", inReader: true }`.

**Comportamiento de `move`:**
- El cursor empieza en −1.
- Si `findBlock` da `null`, el cursor no cambia y se anuncia **«Fin del documento»** (con `dir` 1) o **«Principio del documento»** (con `dir` −1).
- Si encuentra un bloque:
  1. Lo enfoca: el bloque `#blk-{i}` si es de texto, o el botón `#fig-btn-{i}` si es una figura. Hace `scrollIntoView({ block: "center" })`, sin animación si `prefersReducedMotion()`.
  2. Anuncia **«Sección {n} de {total}: {texto}»** en un `h2` y **«Gráfico {n}»** en una figura. En un párrafo no anuncia: el foco ya hace que el lector de pantalla lo lea.
  3. Si es de texto y `voiceGuide || audio.status === "playing"`, llama a `audio.playFrom(readableIndex)`.
- `DocumentView`:
  - `h2` y `p` llevan `tabIndex={-1}`.
  - Cada figura queda envuelta en un `div` con `id="blk-{i}"`.
  - `FigureBlock` recibe `buttonId="fig-btn-{i}"` para su botón «Interpretar con IA».
- `handlers`: `nextBlock` y `prevBlock` → `move("any", ±1)`; `nextHeading` → `move("h2", 1)`; `nextFigure` → `move("figure", 1)`.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// blockNav.test.ts
import { expect, it } from "vitest";
import type { Block } from "@/lib/extractors";
import { figurePosition, findBlock, headingPosition, readableIndex } from "./blockNav";

const B: Block[] = [
  { type: "h2", text: "Intro" }, { type: "p", text: "a" }, { type: "figure", id: "f1" },
  { type: "p", text: "b" }, { type: "h2", text: "Fin" }, { type: "p", text: "c" },
];

it("busca el bloque siguiente o anterior por tipo, sin incluir el actual", () => {
  expect(findBlock(B, -1, "any", 1)).toBe(0);
  expect(findBlock(B, 5, "any", 1)).toBeNull();
  expect(findBlock(B, 0, "any", -1)).toBeNull();
  expect(findBlock(B, 0, "h2", 1)).toBe(4);
  expect(findBlock(B, 4, "h2", -1)).toBe(0);
  expect(findBlock(B, 0, "figure", 1)).toBe(2);
});

it("posiciones de títulos, gráficos y texto leíble", () => {
  expect(headingPosition(B, 4)).toEqual({ n: 2, total: 2 });
  expect(headingPosition(B, 1)).toBeNull();
  expect(figurePosition(B, 2)).toBe(1);
  expect(readableIndex(B, 3)).toBe(2);
  expect(readableIndex(B, 2)).toBeNull();
});
```

En `app.test.tsx` (`describe("lector")`):

```ts
it("Alt+H salta al primer título, lo enfoca y anuncia la sección", async () => {
  const user = userEvent.setup();
  renderAt("/leer/d1");
  await h1();
  await user.keyboard("{Alt>}h{/Alt}");
  expect(document.activeElement?.id).toBe("blk-0");
  expect(await screen.findByText(/^Sección 1 de \d+: 1\. Introducción$/)).toBeInTheDocument();
});

it("Alt+↑ en el principio no se mueve y lo anuncia", async () => {
  const user = userEvent.setup();
  renderAt("/leer/d1");
  await h1();
  await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
  expect(await screen.findByText("Principio del documento")).toBeInTheDocument();
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd frontend && npx vitest run src/features/reader/blockNav.test.ts src/app.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar `blockNav.ts`, `useReaderNavigation.ts` y los cambios en `DocumentView`, `FigureBlock` y `ReaderScreen`.**
- [ ] **Step 4: Correr la suite**

Run: `cd frontend && npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(lector): cursor de bloque y navegación por párrafos, títulos y gráficos"
```

---

### Task 4: Guía por voz: respuestas y descripciones leídas solas

**Files:**
- Modify: `frontend/src/features/assistant/AssistantPanel.tsx`, `frontend/src/features/reader/FigureBlock.tsx`, `frontend/src/features/reader/DocumentView.tsx` (pasa `autoSpeak` a las figuras), `frontend/src/features/reader/ReaderScreen.tsx`, `frontend/src/app.test.tsx`

**Interfaces:**
- Consumes: `speakOnce` (tarea 2) y `settings.voiceGuide` (tarea 3).
- Produces:
  - `AssistantPanel` suma la prop `autoSpeak: boolean`. Cuando aparece una respuesta nueva de la IA (no el saludo), llama a `speakOnce(text, rate)`.
  - `FigureBlock` suma la prop `autoSpeak: boolean`. Cuando llega una descripción, llama a `speakOnce(result.text)`.

- [ ] **Step 1: Escribir el test que falla**

Agregar al tope de `app.test.tsx`:

```ts
vi.mock("@/lib/speech", async (o) => ({ ...(await o<typeof import("@/lib/speech")>()), speakOnce: vi.fn(() => true) }));
```

y en `describe("lector")`:

```ts
it("con la guía por voz, la respuesta del asistente se lee sola; sin ella, no", async () => {
  const { speakOnce } = await import("@/lib/speech");
  window.localStorage.setItem("aulaclara.settings", JSON.stringify({ schemaVersion: 2, settings: { voiceGuide: true } }));
  const user = userEvent.setup();
  renderAt("/leer/d1");
  await user.click(await screen.findByRole("button", { name: "Resumir esta página" }));
  await waitFor(() => expect(speakOnce).toHaveBeenCalledWith("Resumen de esta página (prueba)", 1));
});

it("sin guía por voz no se lee nada solo", async () => {
  const { speakOnce } = await import("@/lib/speech");
  vi.mocked(speakOnce).mockClear();
  const user = userEvent.setup();
  renderAt("/leer/d1");
  await user.click(await screen.findByRole("button", { name: "Resumir esta página" }));
  await waitFor(() => expect(screen.getByRole("log")).toHaveTextContent("Resumen de esta página (prueba)"));
  expect(speakOnce).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cd frontend && npx vitest run src/app.test.tsx`
Expected: FAIL en el primer test.

- [ ] **Step 3: Implementar.** Detectar «respuesta nueva» comparando el largo de `messages` con el del render anterior (`useRef`). No se relee al volver a renderizar.
- [ ] **Step 4: Correr**

Run: `cd frontend && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(voz): guía por voz que lee respuestas y descripciones al llegar"
```

---

### Task 5: Reconocimiento de voz, earcons, consentimiento y política de micrófono

**Files:**
- Create: `frontend/src/lib/voice/recognizer.ts`, `frontend/src/lib/voice/recognizer.test.ts`, `frontend/src/lib/voice/earcons.ts`, `frontend/src/lib/voice/consent.ts`, `frontend/src/lib/voice/consent.test.ts`, `frontend/src/components/VoiceConsentDialog.tsx`, `frontend/src/test/fakeSpeechRecognition.ts`
- Modify: `vercel.json:40`, `frontend/src/features/preferences/settings.ts`, `frontend/src/features/preferences/controls.ts`

**Interfaces:**
- Consumes: `speechBus` (tarea 2).
- Produces (`lib/voice/recognizer.ts`):
  - `speechRecognitionAvailable(): boolean`, evaluada en cada llamada (no al importar).
  - `type RecognitionErrorKind = "not-allowed" | "no-speech" | "network" | "language" | "other"`
  - `interface RecognizerOptions { continuous: boolean; interim: boolean; onFinal(text: string): void; onInterim?(text: string): void; onListeningChange(listening: boolean): void; onError(kind: RecognitionErrorKind): void }`
  - `interface Recognizer { start(): void; stop(): void; dispose(): void }`
  - `createRecognizer(opts: RecognizerOptions): Recognizer | null`, que devuelve `null` sin soporte.
- Produces: `playEarcon(kind: "start" | "stop"): void` (`lib/voice/earcons.ts`).
- Produces (`lib/voice/consent.ts`): `type VoiceConsentKind = "commands" | "captions"`, `hasVoiceConsent(kind): boolean`, `grantVoiceConsent(kind): void`.
- Produces: `VoiceConsentDialog(props: { kind: VoiceConsentKind; onAccept(): void; onCancel(): void }): ReactNode`, construido sobre `Dialog`.
- Produces (`settings.ts`, `controls.ts`):
  - `voiceCommands: "off" | "push" | "continuous"`, por defecto `"off"`.
  - Control `{ key: "voiceCommands", kind: "choice", label: "Comandos por voz", options: [{ value: "off", label: "Apagados" }, { value: "push", label: "Al tocar el micrófono" }, { value: "continuous", label: "Manos libres (escucha siempre)" }], help: "Necesita Chrome, Edge o Safari.", group: "voz", inReader: true }`.
- Produces (`test/fakeSpeechRecognition.ts`): `class FakeRecognition` (registra sus instancias en `FakeRecognition.instances`, expone `lang`, `continuous` e `interimResults`, cuenta `starts`, `stops` y `aborts`, y tiene `emitFinal(text)`, `emitInterim(text)`, `emitError(error)` y `emitEnd()`) e `installFakeRecognition(): void`, que hace `vi.stubGlobal("webkitSpeechRecognition", FakeRecognition)`. Los tests de `app.test.tsx` lo importan desde `@/test/fakeSpeechRecognition`.

**Textos exactos del diálogo de consentimiento:**
- Título: **«Antes de usar el micrófono»**.
- Párrafo para los dos tipos: **«Para entender tu voz, el navegador envía el audio a su servicio de reconocimiento (Google en Chrome, Microsoft en Edge, Apple en Safari), salvo que pueda procesarlo en tu dispositivo. Aula Clara no graba ni guarda el audio.»**
- Párrafo extra para `captions`: **«Vas a transcribir lo que dicen otras personas. Pedile permiso al docente y avisá a tus compañeros. La transcripción no se guarda: se borra al salir del lector.»**
- Botones: **«Usar el micrófono»** y **«Ahora no»**.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// recognizer.test.ts
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FakeRecognition, installFakeRecognition } from "@/test/fakeSpeechRecognition";
import { speechBus } from "@/lib/speech";
import { createRecognizer, speechRecognitionAvailable } from "./recognizer";

const opts = () => ({ continuous: true, interim: false, onFinal: vi.fn(), onListeningChange: vi.fn(), onError: vi.fn() });
beforeEach(() => { vi.useFakeTimers(); FakeRecognition.instances = []; });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("sin soporte devuelve null", () => {
  expect(speechRecognitionAvailable()).toBe(false);
  expect(createRecognizer(opts())).toBeNull();
});

it("configura español de Argentina y entrega el texto final", () => {
  installFakeRecognition();
  const o = opts();
  createRecognizer(o)!.start();
  const fake = FakeRecognition.instances[0]!;
  expect(fake.lang).toBe("es-AR");
  expect(fake.continuous).toBe(true);
  fake.emitFinal("  siguiente párrafo ");
  expect(o.onFinal).toHaveBeenCalledWith("siguiente párrafo");
});

it("en modo continuo se reinicia a los 300 ms, y no después de stop()", () => {
  installFakeRecognition();
  const r = createRecognizer(opts())!;
  r.start();
  const fake = FakeRecognition.instances[0]!;
  fake.emitEnd();
  vi.advanceTimersByTime(300);
  expect(fake.starts).toBe(2);
  r.stop();
  vi.advanceTimersByTime(1_000);
  expect(fake.starts).toBe(2);
});

it("si no hay permiso avisa y no reintenta", () => {
  installFakeRecognition();
  const o = opts();
  createRecognizer(o)!.start();
  const fake = FakeRecognition.instances[0]!;
  fake.emitError("not-allowed");
  fake.emitEnd();
  vi.advanceTimersByTime(1_000);
  expect(o.onError).toHaveBeenCalledWith("not-allowed");
  expect(fake.starts).toBe(1);
});

it("se calla mientras la app habla y vuelve a escuchar después", () => {
  installFakeRecognition();
  createRecognizer(opts())!.start();
  const fake = FakeRecognition.instances[0]!;
  const owner = { onInterrupted: vi.fn() };
  speechBus.claim(owner); // simula una locución en curso
  expect(fake.aborts).toBe(1);
  speechBus.release(owner);
  vi.advanceTimersByTime(300);
  expect(fake.starts).toBe(2);
});
```

```ts
// consent.test.ts
import { beforeEach, expect, it } from "vitest";
import { grantVoiceConsent, hasVoiceConsent } from "./consent";

beforeEach(() => window.localStorage.clear());
it("el consentimiento se guarda por tipo", () => {
  expect(hasVoiceConsent("commands")).toBe(false);
  grantVoiceConsent("commands");
  expect(hasVoiceConsent("commands")).toBe(true);
  expect(hasVoiceConsent("captions")).toBe(false);
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd frontend && npx vitest run src/lib/voice/`
Expected: FAIL.

- [ ] **Step 3: Implementar `recognizer.ts`, `earcons.ts`, `consent.ts`, el doble de prueba y el diálogo**

- El reconocedor llama a `playEarcon("start")` en `start` y a `playEarcon("stop")` en `end`, solo si no es un reinicio automático.
- Mapeo de errores:
  - `not-allowed` y `service-not-allowed` → `"not-allowed"`;
  - `language-not-supported` → `"language"`;
  - `no-speech` y `network` → el mismo nombre;
  - cualquier otro → `"other"`.
- Cambiar `vercel.json` y comprobar con `grep -n "Permissions-Policy\|microphone" frontend/index.html` que el HTML no fija otra política.

- [ ] **Step 4: Correr**

Run: `cd frontend && npx vitest run src/lib/ && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/ vercel.json
git commit -m "feat(voz): reconocimiento de voz con consentimiento, earcons y micrófono permitido en el sitio"
```

---

### Task 6: Comandos por voz en el lector y dictado en el asistente

**Files:**
- Create: `frontend/src/lib/voice/commands.ts`, `frontend/src/lib/voice/commands.test.ts`, `frontend/src/features/reader/useVoiceCommands.ts`, `frontend/src/features/reader/VoiceCommandBar.tsx`, `frontend/src/features/assistant/useDictation.ts`
- Modify: `frontend/src/features/reader/ReaderScreen.tsx`, `frontend/src/features/assistant/AssistantPanel.tsx`, `frontend/src/app.test.tsx`

**Interfaces:**
- Consumes: `createRecognizer`, `speechRecognitionAvailable`, `hasVoiceConsent`, `grantVoiceConsent` y `VoiceConsentDialog` (tarea 5); `useReaderNavigation().move` (tarea 3); `KEYMAP` id `toggleMic` (tarea 1).
- Produces (`lib/voice/commands.ts`):
  - `type VoiceCommand = { kind: "play" | "pause" | "stop" | "nextBlock" | "prevBlock" | "nextHeading" | "nextFigure" | "faster" | "slower" | "summarize" | "keyConcepts" | "quiz" | "describeFigure" | "openBraille" } | { kind: "ask"; question: string }`
  - `normalizeSpeech(text: string): string`: minúsculas, sin tildes (NFD), sin signos de puntuación y con espacios simples.
  - `parseCommand(transcript: string): VoiceCommand | null`
- Produces (`useVoiceCommands.ts`): `useVoiceCommands(opts: { mode: "off" | "push" | "continuous"; onCommand(c: VoiceCommand): void }): { available: boolean; listening: boolean; toggle(): void; heard: { text: string; understood: boolean } | null; consentOpen: boolean; acceptConsent(): void; cancelConsent(): void }`
- Produces (`useDictation.ts`): `useDictation(opts: { onText(text: string): void; onSend(): void }): { available: boolean; listening: boolean; start(): void; consentOpen: boolean; acceptConsent(): void; cancelConsent(): void }`. Usa el modo `push`. Si la frase normalizada es «enviar», llama a `onSend()`; si no, a `onText(texto original)`.

**Frases** (coincidencia exacta con la frase normalizada completa, salvo `ask`):

| kind | frases |
|---|---|
| play | leer · reproducir · continuar |
| pause | pausar · pausa |
| stop | detener · parar |
| nextBlock | siguiente · siguiente parrafo · bajar |
| prevBlock | anterior · parrafo anterior · subir |
| nextHeading | siguiente seccion · siguiente titulo |
| nextFigure | siguiente grafico · siguiente imagen |
| faster / slower | mas rapido / mas lento |
| summarize | resumir · resumen |
| keyConcepts | conceptos clave |
| quiz | preguntas · preguntas de repaso |
| describeFigure | describir imagen · interpretar grafico |
| openBraille | braille · traducir a braille |
| ask | empieza con «preguntar » o «asistente »; `question` es el resto del texto **original**, sin la primera palabra |

**Efectos en el lector:**
- `faster` y `slower` pasan al valor siguiente o anterior de `RATES` y anuncian «Velocidad x1,5».
- `describeFigure` hace clic en `#fig-btn-{i}` de la figura del cursor o, si el cursor no está en una figura, de la siguiente.
- `ask` llama a `chat.send(question, "free")`.
- `openBraille` no hace nada hasta el plan 03.

**Interfaz:**
- Con `voiceCommands !== "off"` y `available`, el encabezado del lector muestra `Button` «🎙 Micrófono» con `aria-pressed={listening}`, que también se activa con el atajo `toggleMic`.
- `VoiceCommandBar` (`role="status"`) muestra:
  - «🎙 Escuchando…» o «🎙 Micrófono apagado»;
  - después de cada frase, «"{texto}" ✓» si se entendió o «"{texto}" ✗ No entendí ese comando»;
  - con `voiceCommands !== "off"` y sin soporte: **«Tu navegador no permite comandos por voz. Probá Chrome, Edge o Safari.»**
- `AssistantPanel`, con `voiceCommands !== "off"` y soporte, muestra junto a «Enviar» el botón «🎙 Dictar pregunta».

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// commands.test.ts
import { expect, it } from "vitest";
import { normalizeSpeech, parseCommand } from "./commands";

it("normaliza mayúsculas, tildes y puntuación", () => {
  expect(normalizeSpeech("  Siguiente   PÁRRAFO. ")).toBe("siguiente parrafo");
});

it.each([
  ["Siguiente párrafo.", { kind: "nextBlock" }],
  ["PAUSAR", { kind: "pause" }],
  ["siguiente sección", { kind: "nextHeading" }],
  ["más rápido", { kind: "faster" }],
  ["preguntas de repaso", { kind: "quiz" }],
  ["preguntar qué es la mitosis", { kind: "ask", question: "qué es la mitosis" }],
  ["Asistente ¿cuándo empezó?", { kind: "ask", question: "¿cuándo empezó?" }],
])("«%s»", (said, expected) => {
  expect(parseCommand(said)).toEqual(expected);
});

it("no confunde frases que solo contienen un comando", () => {
  expect(parseCommand("hola")).toBeNull();
  expect(parseCommand("leer el siguiente capítulo")).toBeNull();
  expect(parseCommand("preguntar")).toBeNull();
});
```

En `app.test.tsx`:

```ts
describe("comandos por voz", () => {
  beforeEach(() => {
    withOnboarding();
    withAI();
    FakeRecognition.instances = [];
    window.localStorage.setItem("aulaclara.settings", JSON.stringify({ schemaVersion: 2, settings: { voiceCommands: "push" } }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("pide consentimiento la primera vez y «resumir» llama al asistente", async () => {
    installFakeRecognition();
    const user = userEvent.setup();
    renderAt("/leer/d1");
    await user.click(await screen.findByRole("button", { name: /Micrófono/ }));
    const dialog = await screen.findByRole("dialog", { name: "Antes de usar el micrófono" });
    await user.click(within(dialog).getByRole("button", { name: "Usar el micrófono" }));
    act(() => FakeRecognition.instances[0]!.emitFinal("resumir"));
    await waitFor(() => expect(calls("/ai/chat")[0]?.data).toMatchObject({ action: "summarize" }));
    expect(screen.getByText(/"resumir" ✓/)).toBeInTheDocument();
  });

  it("sin soporte del navegador lo explica y no muestra el micrófono", async () => {
    renderAt("/leer/d1");
    expect(await screen.findByText(/Tu navegador no permite comandos por voz/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Micrófono/ })).not.toBeInTheDocument();
  });

  it("el dictado escribe la pregunta y «enviar» la manda", async () => {
    installFakeRecognition();
    window.localStorage.setItem("aulaclara.voiceConsent", JSON.stringify({ commands: true }));
    const user = userEvent.setup();
    renderAt("/leer/d1");
    await user.click(await screen.findByRole("button", { name: /Dictar pregunta/ }));
    act(() => FakeRecognition.instances.at(-1)!.emitFinal("qué dice la ley"));
    expect(screen.getByLabelText("Escribí tu pregunta")).toHaveValue("qué dice la ley");
    await user.click(screen.getByRole("button", { name: /Dictar pregunta/ }));
    act(() => FakeRecognition.instances.at(-1)!.emitFinal("enviar"));
    await waitFor(() => expect(calls("/ai/chat")[0]?.data).toMatchObject({ message: "qué dice la ley" }));
  });
});
```

(`act` sale de `@testing-library/react`; `afterEach`, de `vitest`.)

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd frontend && npx vitest run src/lib/voice/commands.test.ts src/app.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar el intérprete, los hooks, `VoiceCommandBar` y los cambios en `ReaderScreen` y `AssistantPanel`.**
- [ ] **Step 4: Correr la suite**

Run: `cd frontend && npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(voz): comandos por voz en el lector y dictado de preguntas"
```

---

### Task 7: Preset Ceguera, documentación y verificación manual

**Files:**
- Modify: `backend/app/seed/presets.json`, `backend/tests/api/test_presets.py`, `backend/tests/unit/test_seed.py` (lista de ids), `docs/new_profiles/01-perfil-ceguera.md`, `docs/accesibilidad.md` (tabla de atajos), `docs/arquitectura.md` §5.4

- [ ] **Step 1: Actualizar los tests del backend con el preset nuevo**

En `test_presets_catalog_lists_the_seed_presets`, el conjunto pasa a `{"dislexia", "vision", "fatiga", "ceguera"}`, y se agrega:

```python
assert presets["ceguera"]["settings"]["voice_guide"] is False
assert presets["ceguera"]["settings"]["voice_commands"] == "push"
```

En `test_the_shipped_seed_is_valid`, la lista pasa a `["dislexia", "vision", "fatiga", "ceguera"]`.

- [ ] **Step 2: Correr y ver que falla**

Run: `cd backend && uv run pytest tests/api/test_presets.py tests/unit/test_seed.py`
Expected: FAIL.

- [ ] **Step 3: Agregar el preset al final de `presets.json`**

```json
{"id": "ceguera", "title": "Ceguera", "icon": "⠿",
 "description": "Navegación por teclado y por voz, y lectura en voz alta del documento y de las respuestas.",
 "tags": ["Teclado y voz", "Lectura en voz alta", "Guía por voz opcional"],
 "settings": {"font": "atkinson", "font_size": 24, "line_height": 1.8, "theme": "contraste", "audio_focus": true,
              "voice_guide": false, "voice_commands": "push", "single_key_shortcuts": false}}
```

- [ ] **Step 4: Correr los dos lados**

Run: `cd backend && uv run pytest` y `cd frontend && npx vitest run src/features/preferences/presets.contract.test.ts`
Expected: PASS. El contrato confirma que el frontend conoce `voice_guide`, `voice_commands` y `single_key_shortcuts`.

- [ ] **Step 5: Actualizar los documentos** con lo construido:
  - atajos según la hoja de ruta §5;
  - `voiceGuide` apagado por defecto;
  - `Esc` para silenciar;
  - el consentimiento.

- [ ] **Step 6: Verificación manual** (Windows, Chrome y Firefox, con NVDA):
  1. Con NVDA en modo navegación, `H` y `G` los resuelve NVDA, y `Alt+H`, `Alt+G`, `Alt+↓` y `Alt+↑` funcionan en la app.
  2. En Firefox, `Alt+H`, `Alt+B`, `Alt+M`, `Alt+S` y `Alt+T` no abren menús del navegador. Si alguno los abre, anotarlo en `docs/accesibilidad.md` y proponer otra tecla.
  3. Leer el documento y tocar «Escuchar respuesta»: la lectura queda en pausa y «Continuar» retoma.
  4. Comandos por voz en Chrome: el consentimiento aparece una vez, los earcons suenan y «siguiente párrafo» avanza.

- [ ] **Step 7: Chequeos completos (hoja de ruta §6), `graphify update .` y commit**

```bash
git add backend/ frontend/ docs/ graphify-out/
git commit -m "feat(perfiles): preset Ceguera con navegación por teclado y voz"
```
