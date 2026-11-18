# Perfiles 05 · Sordera e hipoacusia — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Respuestas del asistente en tres niveles de lenguaje (estándar, lenguaje claro y Lectura Fácil).
- Dos acciones nuevas: «Glosario fácil» y «Esquema visual».
- «Definir término» sobre una palabra seleccionada.
- Una interfaz sin controles de audio, con avisos visibles.
- Subtítulos en vivo de la clase, con consentimiento.
- El preset **Sordera e hipoacusia**.

**Architecture:**
- **Backend:** el nivel de lenguaje viaja en `ChatRequest.language` y lo aplican las reglas puras de `ai_rules.py`, que también lo suman a la clave de caché. Las acciones nuevas son entradas de `ACTION_INSTRUCTIONS`.
- **Frontend:**
  - el nivel sale de `settings.aiLanguage`;
  - los avisos visibles leen el último anuncio del `Announcer`;
  - los subtítulos reutilizan `lib/voice/recognizer.ts` (plan 02) en modo continuo con resultados parciales y no guardan nada.

**Tech Stack:** FastAPI + Pydantic v2, pytest; React 19, Web Speech API, Vitest.

**Spec:** [docs/new_profiles/03-perfil-sordera.md](./03-perfil-sordera.md); [hoja de ruta](2026-11-18-perfiles-00-hoja-de-ruta.md) §1 (decisión 3) y §7.

## Global Constraints

- Incluye las restricciones globales de la hoja de ruta (§6). Depende de los planes 01 y 02 (`createRecognizer`, `VoiceConsentDialog` con `kind: "captions"`, `KEYMAP.requires: "audio"`).
- `AnswerLanguage = Literal["standard", "plain", "easy"]`. Por defecto, `"standard"`. Cualquier otro valor da 422.
- `ChatAction` suma `"glossary"` y `"visual_outline"`. Ninguna de las dos exige selección.
- **Textos exactos de las instrucciones** (en `ai_rules.py`):
  - `LANGUAGE_INSTRUCTIONS["standard"]` = `""`
  - `LANGUAGE_INSTRUCTIONS["plain"]` = «Escribí en lenguaje claro (ISO 24495-1): una idea por oración, oraciones de 20 palabras como máximo, voz activa, palabras de uso común y sin metáforas ni dobles negaciones. Si usás un término técnico, explicalo en la misma oración.»
  - `LANGUAGE_INSTRUCTIONS["easy"]` = «Escribí en Lectura Fácil: oraciones muy cortas, de 15 palabras como máximo, una idea por oración, palabras de uso diario, un ejemplo concreto para cada idea difícil y sin metáforas, ironías ni números que no hagan falta.»
  - `ACTION_INSTRUCTIONS["glossary"]` = «Elegí hasta 8 términos difíciles del fragmento seleccionado o, si no hay selección, del documento. Para cada uno escribí tres líneas: «Término: …», «Qué significa: …» (una oración simple) y «Ejemplo: …» (un ejemplo de la vida real). Dejá una línea en blanco entre términos.»
  - `ACTION_INSTRUCTIONS["visual_outline"]` = «Armá un esquema del documento en texto, sin tablas: el tema principal en la primera línea y debajo las ideas clave, una por línea, empezando con «→». Si una idea tiene una causa o una consecuencia, escribila en la línea siguiente empezando con «   ⇒».»
- **Umbral de selección:** 3 caracteres cuando `aiLanguage !== "standard"`, y 12 en los demás casos. Si la selección tiene 3 palabras o menos, el botón flotante dice **«📖 Definir término»** y manda `glossary` con la selección.
- **`hideAudio` oculta todos los controles de lectura en voz alta:**
  - la sección «Lectura en voz alta» de `ToolsPanel`;
  - «Escuchar este documento» de `DocumentView`;
  - «🔊 Escuchar respuesta» de `AssistantPanel`;
  - «🔊 Escuchar descripción» de `FigureBlock`;
  - «▶ Leer» y «🔊 Leer desde este párrafo» de `ReaderBottomBar`;
  - los atajos con `requires: "audio"`.
- **`visualAlerts`:** el último anuncio se ve en un recuadro fijo arriba a la derecha hasta el anuncio siguiente o hasta «Cerrar aviso». No desaparece solo (criterio 2.2.1) y no es una región `aria-live` (el `Announcer` ya lo anuncia).
- **Subtítulos en vivo:**
  - Reconocimiento con `continuous: true`, `interim: true` y `lang: "es-AR"`.
  - Se guardan en memoria las últimas 200 líneas finales, que se borran al salir del lector. Nunca se guardan en `localStorage`, IndexedDB ni el servidor.
  - «✦ Explicar en lenguaje claro lo último» manda los últimos 1500 caracteres como `selection`, con `action: "simplify"`, el mensaje «Explicá en lenguaje claro lo que dijo el docente» y el `language` actual. Si `language` es `"standard"`, manda `"plain"`.
  - Piden consentimiento de tipo `captions` (texto en el plan 02, tarea 5).
- **Ajustes nuevos:**
  - `aiLanguage: "standard" | "plain" | "easy" = "standard"`
  - `hideAudio: boolean = false`
  - `visualAlerts: boolean = false`
  - `liveCaptions: boolean = false`

## Review Focus

1. **La misma pregunta en «estándar» y en «lenguaje claro»:** son dos respuestas distintas; la caché no devuelve una por la otra. Lo cubre la tarea 1.
2. **Una sola palabra seleccionada con lenguaje claro activo:** aparece «Definir término» y se manda `glossary`. En estándar, una palabra no muestra nada. Lo cubre la tarea 2.
3. **Con `hideAudio`, `Alt+P` y `Espacio`** no empiezan una lectura invisible. Lo cubre la tarea 3.
4. **Los subtítulos se cortan por silencio:** vuelven a escuchar solos mientras sigan activos. Lo cubre la tarea 4 (con el reinicio del plan 02).
5. **Salir del lector con subtítulos activos:** el micrófono se apaga y la transcripción se borra. Lo cubre la tarea 4.

---

### Task 1: Backend · niveles de lenguaje, glosario y esquema visual

**Files:**
- Modify: `backend/app/models/chat.py:4`, `backend/app/models/__init__.py`, `backend/app/schemas/ai.py:8-15`, `backend/app/services/ai_rules.py`, `backend/app/services/ai.py:89-119`, `backend/app/api/ai.py:34-45`, `backend/app/prompts/study_assistant.md`
- Test: `backend/tests/unit/test_ai_rules.py`, `backend/tests/unit/test_ai_service.py`, `backend/tests/api/test_ai.py`

**Interfaces:**
- Produces:
  - `app.models.chat`: `ChatAction = Literal["free", "summarize", "key_concepts", "quiz", "simplify", "glossary", "visual_outline"]` y `AnswerLanguage = Literal["standard", "plain", "easy"]` (exportado en `app.models`).
  - `ChatRequest.language: AnswerLanguage = "standard"`.
  - `ai_rules.LANGUAGE_INSTRUCTIONS: dict[AnswerLanguage, str]`.
  - `ai_rules.build_user_message(action: ChatAction, message: str | None, context: str, language: AnswerLanguage = "standard") -> str`: la instrucción de la acción, luego la de lenguaje si no está vacía, luego la pregunta y el contexto, separados por una línea en blanco.
  - `AIService.chat(..., language: AnswerLanguage = "standard")`. `cache_key` suma `language` después de `action`.
- `study_assistant.md`:
  - la primera oración pasa a «Sos el asistente de estudio de Aula Clara, una plataforma para estudiantes universitarios con discapacidad visual, auditiva o motriz, dislexia, daltonismo o fatiga visual.»;
  - la regla de formato pasa a «No uses tablas, ni encabezados con #, ni formato markdown pesado: las respuestas se muestran como texto y a veces se escuchan en voz alta.»;
  - se suman dos reglas: «Para el glosario, seguí exactamente el formato de tres líneas por término.» y «Para el esquema, usá «→» y «⇒» como se indica, una idea por línea.».

- [ ] **Step 1: Escribir los tests que fallan**

```python
# test_ai_rules.py (agregar)
from app.services.ai_rules import LANGUAGE_INSTRUCTIONS, build_user_message


def test_plain_language_adds_its_rules_and_standard_adds_nothing() -> None:
    plain = build_user_message("summarize", None, "<documento>x</documento>", "plain")
    assert LANGUAGE_INSTRUCTIONS["plain"] in plain
    standard = build_user_message("summarize", None, "<documento>x</documento>")
    assert "lenguaje claro" not in standard and "Lectura Fácil" not in standard


def test_glossary_and_outline_have_their_own_instructions() -> None:
    assert "«Término: …»" in build_user_message("glossary", None, "ctx")
    assert "«→»" in build_user_message("visual_outline", None, "ctx")
```

```python
# test_ai_service.py (agregar)
async def test_language_is_part_of_the_cache_key() -> None:
    service, _ = _service()
    provider = _provider(answer="respuesta")
    await service.chat(provider=provider, action="summarize", message=None, document_text="t", selection=None)
    await service.chat(
        provider=provider, action="summarize", message=None, document_text="t", selection=None, language="plain"
    )
    assert provider.chat.await_count == 2  # type: ignore[attr-defined]


async def test_glossary_does_not_require_a_selection() -> None:
    service, _ = _service()
    assert (await _ask(service, _provider(), action="glossary")).text == "respuesta"
```

```python
# tests/api/test_ai.py (agregar, con el mismo armado de proveedor falso y headers que los tests de chat existentes)
async def test_chat_accepts_the_new_actions_and_language(...) -> None:
    for action in ("glossary", "visual_outline"):
        response = await client.post("/api/v1/ai/chat", headers=HEADERS,
                                     json={"action": action, "document_text": "texto", "language": "easy"})
        assert response.status_code == 200


async def test_chat_rejects_an_unknown_language(...) -> None:
    response = await client.post("/api/v1/ai/chat", headers=HEADERS,
                                 json={"action": "summarize", "document_text": "t", "language": "klingon"})
    assert response.status_code == 422
```

(Hay que copiar la firma, las fixtures y `HEADERS` del test de chat que ya existe en `tests/api/test_ai.py`.)

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd backend && uv run pytest tests/unit/test_ai_rules.py tests/unit/test_ai_service.py tests/api/test_ai.py -v`
Expected: FAIL.

- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr todo el backend**

Run: `cd backend && uv run pytest && uv run mypy app tests && uv run lint-imports`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat(ia): niveles de lenguaje claro, glosario y esquema visual"
```

---

### Task 2: Frontend · nivel de lenguaje, acciones nuevas y «Definir término»

**Files:**
- Modify: `frontend/src/features/assistant/api.ts:8,51-56,73-78`, `frontend/src/features/assistant/useChat.ts`, `frontend/src/features/assistant/AssistantPanel.tsx:15-19`, `frontend/src/features/reader/hooks.ts` (`useTextSelection`), `frontend/src/features/reader/ReaderScreen.tsx`, `frontend/src/features/preferences/settings.ts`, `frontend/src/features/preferences/controls.ts`, `frontend/src/app.test.tsx`

**Interfaces:**
- Produces:
  - `ChatAction` (frontend) suma `"glossary" | "visual_outline"`.
  - `type AnswerLanguage = "standard" | "plain" | "easy"`, exportado por `@/features/assistant`.
  - `ChatInput.language: AnswerLanguage`, que se manda como `language`.
  - `useChat(documentText: string, language: AnswerLanguage): Chat`
  - En `AssistantPanel`, `SHORTCUTS` suma `["Glosario fácil", "glossary"]` y `["Esquema visual", "visual_outline"]`, para todas las personas.
  - `useTextSelection(articleRef, scrollRef, minChars: number)`
  - `aiLanguage` en `settings.ts`, con el control `{ key: "aiLanguage", kind: "choice", label: "Cómo te responde el asistente", options: [{ value: "standard", label: "Estándar" }, { value: "plain", label: "Lenguaje claro" }, { value: "easy", label: "Lectura Fácil" }], help: "Lenguaje claro: oraciones cortas y directas. Lectura Fácil: todavía más simple, con ejemplos.", group: "asistente", inReader: true }`.

- [ ] **Step 1: Escribir los tests que fallan** (en `app.test.tsx`, `describe("lector")`)

```ts
it("con lenguaje claro, las consultas lo piden y aparecen glosario y esquema", async () => {
  window.localStorage.setItem("aulaclara.settings", JSON.stringify({ schemaVersion: 2, settings: { aiLanguage: "plain" } }));
  const user = userEvent.setup();
  renderAt("/leer/d1");
  await user.click(await screen.findByRole("button", { name: "Glosario fácil" }));
  await waitFor(() => expect(calls("/ai/chat")[0]?.data).toMatchObject({ action: "glossary", language: "plain" }));
  expect(screen.getByRole("button", { name: "Esquema visual" })).toBeInTheDocument();
});

it("con lenguaje claro, seleccionar una palabra ofrece «Definir término»", async () => {
  window.localStorage.setItem("aulaclara.settings", JSON.stringify({ schemaVersion: 2, settings: { aiLanguage: "plain" } }));
  const user = userEvent.setup();
  renderAt("/leer/d1");
  const p = (await screen.findAllByText(/La incorporación de entornos virtuales/))[0]!;
  const range = document.createRange();
  range.setStart(p.firstChild!, 3);
  range.setEnd(p.firstChild!, 16); // «incorporación» (13 letras desde la posición 3)
  window.getSelection()!.removeAllRanges();
  window.getSelection()!.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));
  await user.click(await screen.findByRole("button", { name: /Definir término/ }));
  await waitFor(() =>
    expect(calls("/ai/chat")[0]?.data).toMatchObject({ action: "glossary", selection: "incorporación" }),
  );
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd frontend && npx vitest run src/app.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar.** `ReaderScreen` llama a `useChat(texts.join("\n\n"), settings.aiLanguage)` y a `useTextSelection(..., settings.aiLanguage === "standard" ? 12 : 3)`.
- [ ] **Step 4: Correr**

Run: `cd frontend && npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(asistente): lenguaje claro, glosario, esquema visual y definir término"
```

---

### Task 3: Interfaz sin audio y avisos visibles

**Files:**
- Create: `frontend/src/features/preferences/VisualStatus.tsx`
- Modify: `frontend/src/lib/announcer.tsx`, `frontend/src/routes/root-layout.tsx`, `frontend/src/features/reader/ToolsPanel.tsx`, `frontend/src/features/reader/DocumentView.tsx`, `frontend/src/features/reader/FigureBlock.tsx`, `frontend/src/features/reader/ReaderBottomBar.tsx`, `frontend/src/features/reader/ReaderScreen.tsx` (filtra los handlers con `requires: "audio"`), `frontend/src/features/assistant/AssistantPanel.tsx`, `frontend/src/features/preferences/settings.ts`, `frontend/src/features/preferences/controls.ts`, `frontend/src/features/preferences/index.ts`, `frontend/src/app.test.tsx`

**Interfaces:**
- Produces:
  - `useLastAnnouncement(): { message: string; id: number } | null` (`lib/announcer.tsx`). El `id` crece con cada anuncio, aunque el texto se repita.
  - `VisualStatus(): ReactNode` (`features/preferences`). Con `settings.visualAlerts`, muestra el último anuncio en un recuadro `fixed top-4 right-4` con el botón **«Cerrar aviso»**. Se renderiza en `RootLayout`, dentro de `ThemeScope`.
  - `AssistantPanel` y `FigureBlock` suman la prop `canListen: boolean`.
  - `hideAudio` en `settings.ts`, con el control `{ key: "hideAudio", kind: "toggle", label: "Ocultar la lectura en voz alta", help: "Saca de la pantalla los controles de audio que no usás.", group: "interfaz", inReader: true }`.
  - `visualAlerts` en `settings.ts`, con el control `{ key: "visualAlerts", kind: "toggle", label: "Mostrar los avisos en pantalla", help: "Cada aviso («Preferencias guardadas», «Tema Sepia»…) queda visible hasta el siguiente.", group: "interfaz", inReader: true }`.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
it("sin audio no hay controles de lectura y Alt+P no hace nada", async () => {
  window.localStorage.setItem("aulaclara.settings", JSON.stringify({ schemaVersion: 2, settings: { hideAudio: true, audioFocus: true } }));
  const user = userEvent.setup();
  renderAt("/leer/d1");
  await h1();
  expect(screen.queryByRole("button", { name: "Reproducir lectura" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Escuchar este documento/ })).not.toBeInTheDocument();
  await user.keyboard("{Alt>}p{/Alt}");
  expect(screen.queryByText(/Leyendo · bloque/)).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Resumir esta página" }));
  await waitFor(() => expect(screen.getByRole("log")).toHaveTextContent("Resumen de esta página (prueba)"));
  expect(screen.queryByRole("button", { name: /Escuchar respuesta/ })).not.toBeInTheDocument();
});

it("con avisos en pantalla, el último anuncio queda visible hasta cerrarlo", async () => {
  window.localStorage.setItem("aulaclara.settings", JSON.stringify({ schemaVersion: 2, settings: { visualAlerts: true } }));
  const user = userEvent.setup();
  renderAt("/leer/d1");
  await h1();
  await user.keyboard("{Alt>}t{/Alt}");
  const notice = await screen.findByText("Tema Sepia", { selector: ":not([role=status])" });
  await user.click(screen.getByRole("button", { name: "Cerrar aviso" }));
  expect(notice).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd frontend && npx vitest run src/app.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr**

Run: `cd frontend && npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(sordera): interfaz sin audio y avisos visibles en pantalla"
```

---

### Task 4: Subtítulos en vivo de la clase

**Files:**
- Create: `frontend/src/features/assistant/LiveCaptions.tsx`, `frontend/src/features/assistant/useLiveCaptions.ts`
- Modify: `frontend/src/features/assistant/index.ts`, `frontend/src/features/reader/ReaderScreen.tsx`, `frontend/src/features/preferences/settings.ts`, `frontend/src/features/preferences/controls.ts`, `frontend/src/app.test.tsx`

**Interfaces:**
- Consumes: `createRecognizer` y `speechRecognitionAvailable`; `hasVoiceConsent("captions")`, `grantVoiceConsent` y `VoiceConsentDialog` (plan 02).
- Produces:
  - `useLiveCaptions(): { available: boolean; active: boolean; lines: readonly string[]; interim: string; start(): void; stop(): void; clear(): void; consentOpen: boolean; acceptConsent(): void; cancelConsent(): void; lastText(maxChars: number): string }`. Se apaga y se borra al desmontarse.
  - `LiveCaptions(props: { onExplain(fragment: string): void; style: React.CSSProperties }): ReactNode`. Es una sección con el título **«💬 Subtítulos en vivo (clase)»** y:
    - el botón **«Empezar subtítulos»** o **«Detener subtítulos»**;
    - la lista de líneas finales con `readingStyle(settings)`;
    - el texto parcial en `var(--muted)`;
    - **«✦ Explicar en lenguaje claro lo último»**, que llama a `onExplain(lastText(1500))`;
    - **«Borrar»**.
    - Sin soporte, muestra: **«Tu navegador no permite subtítulos en vivo. Probá Chrome o Edge, o usá los subtítulos del sistema (Transcripción Instantánea en Android, subtítulos en vivo de Windows 11).»**
  - En `ReaderScreen`, con `settings.liveCaptions`, `LiveCaptions` va arriba del asistente. `onExplain` llama a `chat.send("Explicá en lenguaje claro lo que dijo el docente", "simplify", { selection: fragment })`, con `language` igual a `aiLanguage`, o `"plain"` si es `"standard"`.
  - `liveCaptions` en `settings.ts`, con el control `{ key: "liveCaptions", kind: "toggle", label: "Subtítulos en vivo de la clase", help: "Usa el micrófono para transcribir lo que se dice en el aula. Pedí permiso antes de usarlo.", group: "asistente", inReader: true }`.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
describe("subtítulos en vivo", () => {
  beforeEach(() => {
    withOnboarding();
    withAI();
    FakeRecognition.instances = [];
    window.localStorage.setItem("aulaclara.settings", JSON.stringify({ schemaVersion: 2, settings: { liveCaptions: true, aiLanguage: "plain" } }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("pide consentimiento, muestra lo que se dice y lo explica en lenguaje claro", async () => {
    installFakeRecognition();
    const user = userEvent.setup();
    renderAt("/leer/d1");
    await user.click(await screen.findByRole("button", { name: "Empezar subtítulos" }));
    const dialog = await screen.findByRole("dialog", { name: "Antes de usar el micrófono" });
    expect(dialog).toHaveTextContent("Pedile permiso al docente");
    await user.click(within(dialog).getByRole("button", { name: "Usar el micrófono" }));
    const fake = FakeRecognition.instances[0]!;
    expect(fake.interimResults).toBe(true);
    act(() => fake.emitInterim("la ley veintiséis"));
    expect(screen.getByText("la ley veintiséis")).toBeInTheDocument();
    act(() => fake.emitFinal("la ley 26.653 obliga a las universidades"));
    await user.click(screen.getByRole("button", { name: /Explicar en lenguaje claro lo último/ }));
    await waitFor(() =>
      expect(calls("/ai/chat")[0]?.data).toMatchObject({
        action: "simplify",
        language: "plain",
        selection: "la ley 26.653 obliga a las universidades",
      }),
    );
  });

  it("al salir del lector se apaga el micrófono y no queda nada guardado", async () => {
    installFakeRecognition();
    window.localStorage.setItem("aulaclara.voiceConsent", JSON.stringify({ captions: true }));
    const user = userEvent.setup();
    const router = renderAt("/leer/d1");
    await user.click(await screen.findByRole("button", { name: "Empezar subtítulos" }));
    act(() => FakeRecognition.instances[0]!.emitFinal("dato privado"));
    await act(() => router.navigate("/biblioteca"));
    expect(FakeRecognition.instances[0]!.aborts + FakeRecognition.instances[0]!.stops).toBeGreaterThan(0);
    expect(JSON.stringify(window.localStorage)).not.toContain("dato privado");
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd frontend && npx vitest run src/app.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr**

Run: `cd frontend && npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(sordera): subtítulos en vivo de la clase con consentimiento y explicación en lenguaje claro"
```

---

### Task 5: Preset Sordera e hipoacusia, documentación y verificación manual

**Files:**
- Modify: `backend/app/seed/presets.json`, `backend/tests/api/test_presets.py`, `backend/tests/unit/test_seed.py`, `docs/new_profiles/03-perfil-sordera.md`, `docs/arquitectura.md` §4.2 (`ChatRequest` con `language` y las acciones nuevas)

- [ ] **Step 1: Tests que fallan.**
  - En `test_presets_catalog_lists_the_seed_presets`, el conjunto suma `"sordera"`, y se agrega `assert presets["sordera"]["settings"]["ai_language"] == "plain"`.
  - En `test_the_shipped_seed_is_valid`, la lista suma `"sordera"` al final.
- [ ] **Step 2: Correr y ver que fallan:** `cd backend && uv run pytest tests/api/test_presets.py tests/unit/test_seed.py`.
- [ ] **Step 3: Agregar el preset al final de `presets.json`**

```json
{"id": "sordera", "title": "Sordera e hipoacusia", "icon": "🧏",
 "description": "Respuestas en lenguaje claro, glosario y esquemas, avisos en pantalla y subtítulos en vivo de la clase.",
 "tags": ["Lenguaje claro", "Glosario y esquemas", "Subtítulos en vivo"],
 "settings": {"font": "atkinson", "font_size": 20, "line_height": 1.8, "theme": "claro", "audio_focus": false,
              "ai_language": "plain", "hide_audio": true, "visual_alerts": true, "live_captions": true}}
```

- [ ] **Step 4: Correr el backend y el test de contrato del frontend.** Expected: PASS.
- [ ] **Step 5: Verificación manual en Chrome con una key real:**
  1. Pedir «Resumir» en estándar y en lenguaje claro, y comparar el largo de las oraciones.
  2. «Glosario fácil»: tres líneas por término.
  3. Subtítulos con el micrófono de la notebook a 3 m de distancia: anotar la precisión en `03-perfil-sordera.md`.
- [ ] **Step 6: Actualizar `03-perfil-sordera.md`:**
  - los tres niveles;
  - el botón de figuras que se omitía;
  - la privacidad de los subtítulos;
  - la recomendación de los subtítulos del sistema operativo.
- [ ] **Step 7: Chequeos completos (hoja de ruta §6), `graphify update .` y commit**

```bash
git add backend/ frontend/ docs/ graphify-out/
git commit -m "feat(perfiles): preset Sordera e hipoacusia"
```

---

## Pendientes heredados del plan 02

Los subtítulos en vivo reutilizan `createRecognizer`, `micLock`, el consentimiento y `speechBus`. El plan 02 dejó para este plan:

- **Vigilante de `onend` faltante.** Chrome con voces remotas puede dejar de hablar a los ~15 s sin disparar `onend`. El árbitro (`speechBus`) queda «hablando», el micrófono en pausa y solo `Esc` lo recupera. Agregá un temporizador o una consulta a `speechSynthesis.speaking` en `speakOnce` y en `ReadAloudEngine.speakFrom`.
- **Consentimiento y `micLock` viven en los hooks, no en `createRecognizer`.** `useLiveCaptions` tiene que pedir el consentimiento de tipo `captions` y tomar el `micLock`. Lo más seguro es mover ambos al reconocedor, con una opción `consent`, para que nadie pueda omitirlos.
- **La pausa mientras habla la app es incondicional.** Ofrecé una opción (por ejemplo `pauseWhileAppSpeaks: false`) para los subtítulos, y decidí qué corresponde en clase.
- **Revocar el consentimiento.** `aulaclara.voiceConsent` no se puede borrar desde la interfaz. `captions: true` sugiere una pérdida auditiva (dato sensible, Ley 25.326): agregá un botón para revocarlo y no lo guardes nunca en el servidor.
- **`FakeRecognition` es limitado:** emite un solo resultado en el índice 0 y no tiene `SpeechRecognition.available()`. Sumá ayudantes de varios resultados y provisorios (`interim`), y `available`.
- **Contador de errores de red.** Solo se reinicia con un resultado no vacío. En sesiones largas y silenciosas, errores esporádicos pueden sumar 5 y apagar el micrófono. Reinicialo también en un `end` limpio.
- **Carrera menor:** `stop()` y `start()` seguidos en modo «tocar para hablar» pueden cortar la sesión nueva con el `end` tardío de la anterior.
