# Perfiles 01 · Catálogo de presets y preferencias — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El backend sirve el catálogo de presets en `GET /api/v1/presets` y el onboarding lo muestra sin perfiles escritos a mano en el frontend. Los ajustes quedan versionados y validados en un solo lugar.

**Architecture:** El backend guarda cada preset como datos (`settings`: pares clave-valor escalares) sin interpretar las capacidades. El frontend es dueño de las capacidades: `settings.ts` define el tipo `ReadingSettings`, sus valores por defecto y un validador por campo, que se usa tanto para `localStorage` como para el catálogo. Elegir un preset **reemplaza** los ajustes (`DEFAULT_SETTINGS` + valores del preset) en vez de mezclarlos. Solo se guardan los ajustes y la marca `onboarded`, nunca el id del preset.

**Tech Stack:** FastAPI + Pydantic v2 + dataclasses (Python 3.14, uv); React 19 + React Router 8 (loaders) + Vitest + Testing Library.

**Spec:** [Hoja de ruta](2026-11-18-perfiles-00-hoja-de-ruta.md) §1–§4; [docs/new_profiles/README.md](./README.md) §2.1; [docs/mejoras-pendientes.md](../mejoras-pendientes.md), Fases 2.1 y 2.4.

## Global Constraints

- Incluye las restricciones globales de la hoja de ruta (§6).
- Endpoint: `GET /api/v1/presets`, sin paginar, responde `list[PresetRead]`. **`/api/v1/profiles` se elimina** (el frontend nunca lo usó).
- Forma de un preset: `{ "id", "title", "icon", "description", "tags": [str], "settings": { clave: valor } }`.
- `id` cumple `^[a-z][a-z0-9-]{1,31}$` y es único. Las claves de `settings` cumplen `^[a-z][a-z0-9_]*$`. Los valores son `str`, `int`, `float` o `bool` (nada anidado ni `null`).
- «Personalizado» **no** es un preset del backend: es una opción fija del wizard que no cambia los ajustes.
- `localStorage`:
  - `aulaclara.settings` = `{ "schemaVersion": 2, "settings": { … } }`
  - `aulaclara.onboarded` = `true`
  - `aulaclara.presets` = `{ "savedAt": "<ISO 8601>", "presets": [<PresetRead tal cual llegó>] }`
  - `aulaclara.profile` (versión 1) se lee una vez para migrar y se borra.
- El pedido del catálogo usa `timeout: 5000` y `retry: false`: el wizard no puede quedar esperando 45 s.
- Texto exacto cuando no hay catálogo ni caché: **«No pudimos cargar los perfiles sugeridos. Podés seguir con «Personalizado» y ajustar todo a mano.»**

## Review Focus

1. **Ajustes guardados corruptos o de una versión vieja** (`fontSize: "grande"`, `theme: "neon"`): se usan los valores por defecto de esos campos y el resto se conserva. Lo cubre la tarea 2.
2. **Backend lento o caído al abrir `/perfil`:** el wizard aparece en 5 s o menos, con la caché o solo con «Personalizado». Lo cubren las tareas 3 y 4.
3. **Un preset del catálogo trae un ajuste que el frontend no conoce:** se ignora ese campo y se aplica el resto; el test de contrato lo detecta antes de desplegar. Lo cubre la tarea 3.
4. **Una persona de la versión anterior** (tiene `aulaclara.profile`): entra directo a la biblioteca, sin repetir el onboarding, y la clave vieja desaparece. Lo cubren las tareas 2 y 4.
5. **Pasar de un preset a otro:** no quedan activas capacidades del preset anterior. Lo cubre la tarea 4.

---

### Task 1: Backend · catálogo de presets

**Files:**
- Create: `backend/app/models/preset.py`, `backend/app/schemas/preset.py`, `backend/app/services/preset.py`, `backend/app/api/presets.py`, `backend/app/seed/presets.json`
- Modify: `backend/app/models/__init__.py`, `backend/app/crud/seed.py`, `backend/app/api/deps.py:21-42,164-184`, `backend/app/api/router.py`
- Delete: `backend/app/models/profile.py`, `backend/app/schemas/profile.py`, `backend/app/services/profile.py`, `backend/app/api/profiles.py`, `backend/app/seed/profiles.json`
- Test: `backend/tests/api/test_presets.py` (nuevo), `backend/tests/unit/test_seed.py` (nuevo). Renombrar `backend/tests/api/test_profiles_documents.py` → `backend/tests/api/test_documents.py` y quitarle `test_profiles_are_the_four_predefined_ones`.

**Interfaces:**
- Produces:
  - `app.models.preset`: `SettingValue = str | int | float | bool`; `@dataclass(frozen=True, slots=True) class Preset: id: str; title: str; icon: str; description: str; tags: tuple[str, ...]; settings: Mapping[str, SettingValue]`. No se usa como clave de un dict: `settings` no es hasheable.
  - `app.crud.seed`: `class SeedError(ValueError)`; `load_presets(path: Path = SEED_DIR / "presets.json") -> list[Preset]`.
  - `app.services.preset.PresetService(presets: Repository[Preset])` con `async list() -> Sequence[Preset]`.
  - `app.schemas.preset.PresetRead` (Pydantic, `from_attributes=True`): `id: str`, `title: str`, `icon: str`, `description: str`, `tags: list[str]`, `settings: dict[str, str | int | float | bool]`.
  - `app.api.deps`: `get_preset_service() -> PresetService`, `PresetServiceDep`.
  - `GET /api/v1/presets` → `list[PresetRead]`.

- [ ] **Step 1: Escribir los tests que fallan**

```python
# backend/tests/api/test_presets.py
from httpx import AsyncClient


async def test_presets_catalog_lists_the_seed_presets(client: AsyncClient) -> None:
    response = await client.get("/api/v1/presets")
    assert response.status_code == 200
    presets = {p["id"]: p for p in response.json()}
    assert set(presets) == {"dislexia", "vision", "fatiga"}
    assert presets["vision"]["settings"] == {
        "font": "atkinson", "font_size": 28, "line_height": 1.7, "theme": "contraste", "audio_focus": False,
    }
    assert presets["dislexia"]["tags"] == ["OpenDyslexic", "Interlineado amplio", "Fondo sepia"]


async def test_old_profiles_endpoint_is_gone(client: AsyncClient) -> None:
    assert (await client.get("/api/v1/profiles")).status_code == 404
```

```python
# backend/tests/unit/test_seed.py
import json
from pathlib import Path

import pytest

from app.crud.seed import SeedError, load_presets

VALID = {"id": "x-1", "title": "X", "icon": "X", "description": "d", "tags": ["t"], "settings": {"font_size": 20}}


def write(tmp_path: Path, rows: list[dict[str, object]]) -> Path:
    path = tmp_path / "presets.json"
    path.write_text(json.dumps(rows), encoding="utf-8")
    return path


def test_loads_a_valid_preset(tmp_path: Path) -> None:
    [preset] = load_presets(write(tmp_path, [VALID]))
    assert preset.id == "x-1"
    assert preset.tags == ("t",)
    assert dict(preset.settings) == {"font_size": 20}


@pytest.mark.parametrize(
    "bad",
    [
        {**VALID, "id": "Con Espacios"},
        {**VALID, "settings": {"fontSize": 20}},
        {**VALID, "settings": {"theme": None}},
        {**VALID, "settings": {"nested": {"a": 1}}},
        {**VALID, "tags": "no-es-lista"},
    ],
)
def test_rejects_an_invalid_preset_naming_it(tmp_path: Path, bad: dict[str, object]) -> None:
    with pytest.raises(SeedError, match=str(bad["id"])):
        load_presets(write(tmp_path, [bad]))


def test_rejects_duplicate_ids(tmp_path: Path) -> None:
    with pytest.raises(SeedError, match="x-1"):
        load_presets(write(tmp_path, [VALID, VALID]))


def test_the_shipped_seed_is_valid() -> None:
    assert [p.id for p in load_presets()] == ["dislexia", "vision", "fatiga"]
```

- [ ] **Step 2: Correr los tests y ver que fallan**

Run: `cd backend && uv run pytest tests/api/test_presets.py tests/unit/test_seed.py -v`
Expected: FAIL (`ImportError: cannot import name 'SeedError'` y 404 en `/api/v1/presets`).

- [ ] **Step 3: Crear `backend/app/seed/presets.json`**

Los tres presets de `profiles.json`, sin «Personalizado», con `preset` renombrado a `settings` y los mismos textos y valores:

```json
[
  {"id": "dislexia", "title": "Dislexia", "icon": "Aa",
   "description": "Fuente especializada, mayor interlineado y más espacio entre letras.",
   "tags": ["OpenDyslexic", "Interlineado amplio", "Fondo sepia"],
   "settings": {"font": "dyslexic", "font_size": 21, "line_height": 1.9, "theme": "sepia", "audio_focus": false}},
  {"id": "vision", "title": "Visión reducida", "icon": "A+",
   "description": "Alto contraste y texto grande para leer sin esfuerzo.",
   "tags": ["Texto 28 px", "Negro y amarillo", "Tipografía legible"],
   "settings": {"font": "atkinson", "font_size": 28, "line_height": 1.7, "theme": "contraste", "audio_focus": false}},
  {"id": "fatiga", "title": "Fatiga visual", "icon": "☾",
   "description": "Modo oscuro cálido y la lectura en voz alta siempre a mano.",
   "tags": ["Modo oscuro cálido", "Audio destacado", "Verdana"],
   "settings": {"font": "verdana", "font_size": 20, "line_height": 1.8, "theme": "oscuro", "audio_focus": true}}
]
```

- [ ] **Step 4: Implementar el modelo, `load_presets` y la capa de servicio**

- `load_presets` valida fila por fila con las reglas de las Global Constraints. Cada `SeedError` incluye el `id` de la fila (o su posición si no tiene `id`). Ojo: `bool` es subclase de `int` en Python, y está permitido.
- `PresetService.list()` devuelve `await self._presets.list(offset=0, limit=100)`, como el `ProfileService` actual.
- En `deps.py`, `_presets_repo()` (con `@lru_cache`) reemplaza a `_profiles_repo()`.
- `api/presets.py` copia la forma de `api/profiles.py` con `prefix="/presets"`, `tags=["presets"]`.
- En `api/router.py`, se reemplaza `profiles` por `presets`.
- Se borran los archivos de `Profile`.

- [ ] **Step 5: Correr los tests y los chequeos de capas**

Run: `cd backend && uv run pytest && uv run mypy app tests && uv run lint-imports`
Expected: PASS, 0 errores de mypy, contratos de import-linter `KEPT`.

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat(presets): catálogo de presets en GET /api/v1/presets"
```

---

### Task 2: Frontend · ajustes con esquema único y migración

**Files:**
- Create: `frontend/src/features/preferences/settings.ts`, `frontend/src/features/preferences/settings.test.ts`, `frontend/src/features/preferences/storage.test.ts`
- Modify: `frontend/src/features/preferences/config.ts:99-118` (se mudan `ReadingSettings` y `DEFAULT_SETTINGS`), `frontend/src/features/preferences/storage.ts`, `frontend/src/features/preferences/index.ts`

**Interfaces:**
- Produces (`settings.ts`):
  - `interface ReadingSettings { theme: ThemeId; font: FontId; fontSize: number; lineHeight: number; rate: number; audioFocus: boolean }`. Los planes siguientes le agregan campos.
  - `const DEFAULT_SETTINGS: ReadingSettings`, con los mismos valores de hoy.
  - `const SETTINGS_SCHEMA_VERSION = 2`
  - `const LINE_HEIGHT = { min: 1.3, max: 2.4, step: 0.1 } as const`
  - `function sanitizeSettings(raw: unknown): ReadingSettings`
  - `function sanitizePatch(raw: unknown): { patch: Partial<ReadingSettings>; rejected: string[] }`
  - `function snakeToCamelKeys(raw: Record<string, unknown>): Record<string, unknown>`
- Produces (`storage.ts`): `loadSettings(): ReadingSettings`, `saveSettings(s: ReadingSettings): void`, `isOnboarded(): boolean`, `markOnboarded(): void`. `loadProfileId` y `saveProfileId` siguen hasta la tarea 4, que los elimina; así esta tarea compila sola.

**Regla de diseño:** un único objeto `FIELDS` de tipo `{ [K in keyof ReadingSettings]: (v: unknown) => v is ReadingSettings[K] }`. Agregar una capacidad es agregar una entrada en `FIELDS` y su valor en `DEFAULT_SETTINGS`; TypeScript exige las dos.

Validadores de los campos actuales:
- `theme ∈ THEMES` y `font ∈ FONTS`.
- `fontSize`: entero en [`MIN_FS`, `MAX_FS`].
- `lineHeight`: número en [1.3, 2.4].
- `rate ∈ RATES`.
- `audioFocus`: booleano.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// settings.test.ts
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, sanitizePatch, sanitizeSettings, snakeToCamelKeys } from "./settings";

describe("sanitizeSettings", () => {
  it("sin datos devuelve los valores por defecto", () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings("basura")).toEqual(DEFAULT_SETTINGS);
  });
  it("conserva lo válido y reemplaza lo inválido campo por campo", () => {
    expect(sanitizeSettings({ theme: "neon", fontSize: "grande", font: "dyslexic", lineHeight: 9 })).toEqual({
      ...DEFAULT_SETTINGS,
      font: "dyslexic",
    });
  });
});

describe("sanitizePatch", () => {
  it("devuelve solo los campos conocidos y válidos, y nombra los rechazados", () => {
    expect(sanitizePatch({ font: "dyslexic", voiceOver: true, theme: "neon" })).toEqual({
      patch: { font: "dyslexic" },
      rejected: ["voiceOver", "theme"],
    });
  });
});

it("snakeToCamelKeys convierte solo las claves", () => {
  expect(snakeToCamelKeys({ font_size: 21, audio_focus: false, theme: "sepia" })).toEqual({
    fontSize: 21, audioFocus: false, theme: "sepia",
  });
});
```

```ts
// storage.test.ts
import { beforeEach, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./settings";
import { isOnboarded, loadSettings, markOnboarded, saveSettings } from "./storage";

beforeEach(() => window.localStorage.clear());

it("lee ajustes de la versión 1 (objeto plano) y los guarda en la versión 2", () => {
  window.localStorage.setItem("aulaclara.settings", JSON.stringify({ font: "verdana", fontSize: 99 }));
  const loaded = loadSettings();
  expect(loaded).toEqual({ ...DEFAULT_SETTINGS, font: "verdana" });
  saveSettings(loaded);
  expect(JSON.parse(window.localStorage.getItem("aulaclara.settings") ?? "")).toEqual({
    schemaVersion: 2,
    settings: loaded,
  });
});

it("una persona con el perfil de la versión anterior ya hizo el onboarding, y la clave vieja se borra", () => {
  window.localStorage.setItem("aulaclara.profile", JSON.stringify("dislexia"));
  expect(isOnboarded()).toBe(true);
  expect(window.localStorage.getItem("aulaclara.profile")).toBeNull();
  expect(window.localStorage.getItem("aulaclara.onboarded")).toBe("true");
});

it("sin nada guardado no hizo el onboarding; markOnboarded lo registra", () => {
  expect(isOnboarded()).toBe(false);
  markOnboarded();
  expect(isOnboarded()).toBe(true);
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd frontend && npx vitest run src/features/preferences/settings.test.ts src/features/preferences/storage.test.ts`
Expected: FAIL (`Failed to resolve import "./settings"`).

- [ ] **Step 3: Implementar `settings.ts`, mudar los tipos desde `config.ts` y reescribir `storage.ts`**

- `config.ts` conserva `THEMES`, `FONTS`, `RATES`, `MIN_FS`, `MAX_FS`, `clamp` y `readingStyle`. `readingStyle` importa el tipo `ReadingSettings` desde `./settings`.
- `loadSettings` acepta las dos formas: el sobre `{ schemaVersion: 2, settings }` y el objeto plano de la versión 1.
- `index.ts` exporta lo nuevo. `PROFILES`, `Profile` y `loadProfileId` se siguen exportando hasta la tarea 4.

- [ ] **Step 4: Correr los tests y el typecheck**

Run: `cd frontend && npx vitest run src/features/preferences/settings.test.ts src/features/preferences/storage.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/preferences/
git commit -m "feat(preferencias): esquema único de ajustes, versión 2 y migración"
```

---

### Task 3: Frontend · cliente del catálogo, caché y test de contrato

**Files:**
- Create: `frontend/src/features/preferences/presets.ts`, `frontend/src/features/preferences/presets.test.ts`, `frontend/src/features/preferences/presets.contract.test.ts`
- Modify: `frontend/src/features/preferences/index.ts`

**Interfaces:**
- Consumes: `request<T>(config: RequestConfig)` de `@/lib/http`; `sanitizePatch`, `snakeToCamelKeys` y `DEFAULT_SETTINGS` de la tarea 2.
- Produces:
  - `interface Preset { id: string; title: string; icon: string; description: string; tags: readonly string[]; settings: Partial<ReadingSettings> }`
  - `interface PresetCatalog { presets: readonly Preset[]; source: "live" | "cache" | "unavailable" }`
  - `loadPresetCatalog(): Promise<PresetCatalog>`
  - `applyPreset(preset: Preset): ReadingSettings`, que devuelve `{ ...DEFAULT_SETTINGS, ...preset.settings }`.
  - `matchPreset(presets: readonly Preset[], settings: ReadingSettings): string | null`, que devuelve el `id` del preset cuyo `applyPreset` es idéntico a `settings`.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// presets.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/http", async (o) => ({ ...(await o<typeof import("@/lib/http")>()), request }));

import { DEFAULT_SETTINGS } from "./settings";
import { applyPreset, loadPresetCatalog, matchPreset } from "./presets";

const DTO = {
  id: "dislexia", title: "Dislexia", icon: "Aa", description: "d", tags: ["t"],
  settings: { font: "dyslexic", font_size: 21, inventado: true },
};

beforeEach(() => {
  request.mockReset();
  window.localStorage.clear();
});

describe("loadPresetCatalog", () => {
  it("trae el catálogo, lo pasa a camelCase, descarta lo desconocido y lo guarda en caché", async () => {
    request.mockResolvedValue([DTO, { id: "roto" }]);
    const catalog = await loadPresetCatalog();
    expect(request).toHaveBeenCalledWith({ method: "GET", url: "/presets", timeout: 5000, retry: false });
    expect(catalog.source).toBe("live");
    expect(catalog.presets).toEqual([
      { id: "dislexia", title: "Dislexia", icon: "Aa", description: "d", tags: ["t"], settings: { font: "dyslexic", fontSize: 21 } },
    ]);
    expect(JSON.parse(window.localStorage.getItem("aulaclara.presets") ?? "{}").presets).toEqual([DTO, { id: "roto" }]);
  });
  it("si el backend falla, usa la caché", async () => {
    window.localStorage.setItem("aulaclara.presets", JSON.stringify({ savedAt: "2026-11-18T00:00:00Z", presets: [DTO] }));
    request.mockRejectedValue(new Error("caído"));
    const catalog = await loadPresetCatalog();
    expect(catalog.source).toBe("cache");
    expect(catalog.presets.map((p) => p.id)).toEqual(["dislexia"]);
  });
  it("sin backend ni caché no hay presets", async () => {
    request.mockRejectedValue(new Error("caído"));
    expect(await loadPresetCatalog()).toEqual({ presets: [], source: "unavailable" });
  });
});

it("applyPreset parte de los valores por defecto: no arrastra ajustes anteriores", () => {
  const preset = { id: "a", title: "A", icon: "A", description: "", tags: [], settings: { font: "dyslexic" as const } };
  expect(applyPreset(preset)).toEqual({ ...DEFAULT_SETTINGS, font: "dyslexic" });
  expect(matchPreset([preset], { ...DEFAULT_SETTINGS, font: "dyslexic" })).toBe("a");
  expect(matchPreset([preset], { ...DEFAULT_SETTINGS, font: "dyslexic", fontSize: 30 })).toBeNull();
});
```

```ts
// presets.contract.test.ts — el catálogo del backend solo usa capacidades que el frontend conoce
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { sanitizePatch, snakeToCamelKeys } from "./settings";

const seed = JSON.parse(
  readFileSync(new URL("../../../../backend/app/seed/presets.json", import.meta.url), "utf8"),
) as Array<{ id: string; settings: Record<string, unknown> }>;

it.each(seed.map((p) => [p.id, p] as const))("el preset %s solo usa ajustes y valores conocidos", (_id, preset) => {
  expect(sanitizePatch(snakeToCamelKeys(preset.settings)).rejected).toEqual([]);
});

it("los ids son únicos", () => {
  expect(new Set(seed.map((p) => p.id)).size).toBe(seed.length);
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd frontend && npx vitest run src/features/preferences/presets`
Expected: FAIL (`Failed to resolve import "./presets"`).

- [ ] **Step 3: Implementar `presets.ts`**

- Un elemento del DTO es válido si `id`, `title`, `icon` y `description` son strings, `tags` es un array de strings y `settings` es un objeto. Los inválidos se descartan.
- La caché guarda el DTO tal como llegó y se valida al leerla, igual que una respuesta en vivo.
- Si `localStorage` está bloqueado, se sigue sin caché: `storage` de `@/lib/storage` ya atrapa los errores.

- [ ] **Step 4: Correr los tests**

Run: `cd frontend && npx vitest run src/features/preferences/presets`
Expected: PASS (incluido el contrato contra los 3 presets del seed).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/preferences/
git commit -m "feat(preferencias): catálogo de presets desde el backend con caché y test de contrato"
```

---

### Task 4: Frontend · onboarding dinámico y guardas sin id de perfil

**Files:**
- Modify: `frontend/src/routes/profile.tsx`, `frontend/src/features/preferences/OnboardingWizard.tsx`, `frontend/src/features/preferences/PreferencesProvider.tsx`, `frontend/src/features/preferences/guards.ts`, `frontend/src/features/preferences/storage.ts` (borrar `loadProfileId` y `saveProfileId`), `frontend/src/features/preferences/index.ts`, `frontend/src/router.tsx:3,22`, `frontend/src/features/preferences/config.ts` (borrar `Profile` y `PROFILES`), `frontend/src/features/preferences/config.test.ts:34-45` (borrar el bloque «perfiles»), `frontend/src/app.test.tsx`

**Interfaces:**
- Consumes: `loadPresetCatalog`, `applyPreset`, `matchPreset` y `PresetCatalog` (tarea 3); `isOnboarded`, `markOnboarded`, `loadSettings` y `saveSettings` (tarea 2).
- Produces:
  - Contexto de `usePreferences()`: `{ settings: ReadingSettings; onboarded: boolean; updateSettings(patch: Partial<ReadingSettings>): void; replaceSettings(next: ReadingSettings): void; completeOnboarding(): void }`. Los ajustes se persisten mientras `onboarded` sea `true`, como hoy con el perfil.
  - `OnboardingWizard({ catalog }: { catalog: PresetCatalog })`
  - `routes/profile.tsx`: `export function loader(): Promise<PresetCatalog>` y `Component`, que lee `useLoaderData<typeof loader>()`.
  - `guards.ts`: `requireOnboarding: MiddlewareFunction` (reemplaza a `requireProfile`) y `homeLoader`, los dos con `isOnboarded()`.

Comportamiento del paso 1:
- Lista `catalog.presets` en el orden del backend y, al final, la opción fija «Personalizado» con los textos actuales (icono `⚙`, «Elegí vos el tamaño, los colores y la tipografía.», etiqueta «Control total»).
- Elegir un preset llama a `replaceSettings(applyPreset(p))` y anuncia «Perfil {title} aplicado». Elegir «Personalizado» no cambia nada.
- Selección inicial: si `onboarded`, `matchPreset(...) ?? "custom"`; si no, ninguna.
- Si `catalog.source === "unavailable"`, se muestra el aviso de las Global Constraints con `role="status"` encima de las opciones.
- `finish()` llama a `completeOnboarding()` (marca `onboarded` y guarda los ajustes). **No guarda el id elegido.**

- [ ] **Step 1: Adaptar `app.test.tsx` y escribir los tests nuevos que fallan**

En `fakeBackend`, agregar al principio:

```ts
if (url === "/presets") return Promise.resolve(PRESETS);
```

con este fixture al tope del archivo (los mismos 3 presets del seed):

```ts
const PRESETS = [
  { id: "dislexia", title: "Dislexia", icon: "Aa", description: "Fuente especializada…", tags: ["OpenDyslexic"],
    settings: { font: "dyslexic", font_size: 21, line_height: 1.9, theme: "sepia", audio_focus: false } },
  { id: "vision", title: "Visión reducida", icon: "A+", description: "Alto contraste…", tags: ["Texto 28 px"],
    settings: { font: "atkinson", font_size: 28, line_height: 1.7, theme: "contraste", audio_focus: false } },
  { id: "fatiga", title: "Fatiga visual", icon: "☾", description: "Modo oscuro…", tags: ["Audio destacado"],
    settings: { font: "verdana", font_size: 20, line_height: 1.8, theme: "oscuro", audio_focus: true } },
];
```

Reemplazar `withProfile` por `const withOnboarding = (): void => window.localStorage.setItem("aulaclara.onboarded", "true");` en todos los `beforeEach`.

En «elegir un perfil aplica su preset…», reemplazar la aserción de `aulaclara.profile` por:

```ts
expect(window.localStorage.getItem("aulaclara.profile")).toBeNull(); // no se guarda la etiqueta (Ley 25.326)
expect(window.localStorage.getItem("aulaclara.onboarded")).toBe("true");
expect(JSON.parse(window.localStorage.getItem("aulaclara.settings") ?? "{}")).toMatchObject({
  schemaVersion: 2,
  settings: { font: "dyslexic", theme: "sepia" },
});
```

Tests nuevos dentro de `describe("onboarding")`:

```ts
it("pasar de un preset a otro no arrastra ajustes del anterior", async () => {
  request.mockImplementation((c: { url: string }) =>
    c.url === "/presets"
      ? Promise.resolve([
          { id: "a", title: "A", icon: "A", description: "", tags: [], settings: { audio_focus: true, theme: "oscuro" } },
          { id: "b", title: "B", icon: "B", description: "", tags: [], settings: { font: "dyslexic" } },
        ])
      : fakeBackend(c),
  );
  const user = userEvent.setup();
  renderAt("/perfil");
  await user.click(await screen.findByRole("radio", { name: /Perfil A/ }));
  await user.click(screen.getByRole("radio", { name: /Perfil B/ }));
  await user.click(screen.getByRole("button", { name: /Siguiente/ }));
  expect(await screen.findByRole("checkbox", { name: /Destacar la lectura en voz alta/ })).not.toBeChecked();
  expect(screen.getByRole("button", { name: /Claro/ })).toHaveAttribute("aria-pressed", "true");
});

it("sin backend ni caché ofrece solo «Personalizado» y lo explica", async () => {
  request.mockRejectedValue(new Error("caído"));
  renderAt("/perfil");
  // findByText y no findByRole("status"): el Announcer global también tiene role="status".
  expect(await screen.findByText(/No pudimos cargar los perfiles sugeridos/)).toHaveAttribute("role", "status");
  expect(screen.getAllByRole("radio").map((r) => r.getAttribute("value"))).toEqual(["custom"]);
});

it("con el perfil guardado por la versión anterior entra directo a la biblioteca", async () => {
  window.localStorage.setItem("aulaclara.profile", JSON.stringify("dislexia"));
  const router = renderAt("/");
  await h1();
  expect(router.state.location.pathname).toBe("/biblioteca");
  expect(window.localStorage.getItem("aulaclara.profile")).toBeNull();
});
```

En `config.test.ts`, borrar el `describe("perfiles")`.

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd frontend && npx vitest run src/app.test.tsx`
Expected: FAIL (el wizard todavía importa `PROFILES`).

- [ ] **Step 3: Implementar el wizard, el provider, las guardas y la ruta**

- `router.tsx` importa `requireOnboarding`.
- `routes/profile.tsx` exporta `loader` y le pasa `catalog` al wizard.
- `DetailsStep` no cambia en esta tarea.

- [ ] **Step 4: Correr toda la suite del frontend y el typecheck**

Run: `cd frontend && npm run typecheck && npm test`
Expected: PASS. Los tests de biblioteca, lector e IA siguen en verde con `withOnboarding`.

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(onboarding): perfiles desde el catálogo del backend y sin guardar la etiqueta del perfil"
```

---

### Task 5: Registro de controles por capacidad y `Stepper` (WCAG 2.5.7)

**Files:**
- Create: `frontend/src/components/Stepper.tsx`, `frontend/src/components/Stepper.test.tsx`, `frontend/src/features/preferences/controls.ts`, `frontend/src/features/preferences/SettingsControls.tsx`
- Modify: `frontend/src/features/preferences/OnboardingWizard.tsx` (`DetailsStep`), `frontend/src/features/reader/ToolsPanel.tsx:121-135`, `frontend/src/features/preferences/index.ts`, `frontend/src/app.test.tsx:108`

**Interfaces:**
- Produces:
  - `Stepper(props: { id: string; label: string; value: number; min: number; max: number; step: number; format?: (v: number) => string; onChange: (v: number) => void }): ReactNode`. Es un grupo (`role="group"`, `aria-labelledby`) con un botón «−» (`aria-label="Bajar {label}"`), un `<output aria-live="polite">` con `format(value)` y un botón «+» (`aria-label="Subir {label}"`). Redondea a la precisión de `step`, así 1.7 + 0.1 da 1.8 y no 1.7999. Los botones se deshabilitan en los extremos.
  - `controls.ts`:
    - `type ControlGroup = "lectura" | "voz" | "interfaz" | "asistente" | "colores"`
    - `type ControlSpec` = `{ key: <clave booleana de ReadingSettings>; kind: "toggle"; label: string; help?: string; group: ControlGroup; inReader: boolean }` | `{ key: <clave de unión de strings>; kind: "choice"; label: string; help?: string; options: readonly { value: string; label: string }[]; group: ControlGroup; inReader: boolean }`
    - `const CONTROLS: readonly ControlSpec[]`, que hoy solo trae `{ key: "audioFocus", kind: "toggle", label: "Destacar la lectura en voz alta", group: "lectura", inReader: false }`.
  - `SettingsControls({ placement }: { placement: "onboarding" | "reader" }): ReactNode`. Renderiza `CONTROLS` agrupados (un `fieldset` con `legend` por grupo). Con `placement: "reader"`, solo los que tienen `inReader`. Un toggle es un checkbox con `label` y, si hay `help`, `aria-describedby` al texto de ayuda. Un choice es un grupo de radios.

**Regla para los planes siguientes:** cada capacidad nueva agrega una entrada en `CONTROLS`. No se escribe UI de ajustes a mano.

- [ ] **Step 1: Escribir los tests que fallan**

```tsx
// Stepper.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { Stepper } from "./Stepper";

it("suma y resta de a un paso, redondea y se frena en los extremos", async () => {
  const onChange = vi.fn();
  const { rerender } = render(
    <Stepper id="lh" label="Interlineado" value={1.7} min={1.3} max={2.4} step={0.1} onChange={onChange} />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Subir Interlineado" }));
  expect(onChange).toHaveBeenCalledWith(1.8);
  rerender(<Stepper id="lh" label="Interlineado" value={2.4} min={1.3} max={2.4} step={0.1} onChange={onChange} />);
  expect(screen.getByRole("button", { name: "Subir Interlineado" })).toBeDisabled();
  expect(screen.getByRole("group", { name: "Interlineado" })).toHaveTextContent("2.4");
});
```

En `app.test.tsx`, línea 108, reemplazar `expect(screen.getByLabelText(/Tamaño de fuente/)).toHaveValue("21")` por:

```ts
expect(screen.getByRole("group", { name: "Tamaño de fuente" })).toHaveTextContent("21 px");
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd frontend && npx vitest run src/components/Stepper.test.tsx src/app.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar `Stepper`, `controls.ts` y `SettingsControls`, y usarlos**

- En `DetailsStep`:
  - tamaño de fuente: `Stepper` con `min: MIN_FS`, `max: MAX_FS`, `step: 1` y `format: v => \`${v} px\``;
  - interlineado: `Stepper` con `LINE_HEIGHT` y `format: v => v.toFixed(1)`;
  - en lugar del checkbox suelto de `audioFocus`, `<SettingsControls placement="onboarding" />`.
- En `ToolsPanel`, el interlineado pasa a `Stepper`. Debajo de «Tipografía» se agrega `<section aria-labelledby="t-a11y">` con el título «Ajustes de accesibilidad» y `<SettingsControls placement="reader" />`; la sección se oculta si no hay controles con `inReader`.

- [ ] **Step 4: Correr toda la suite**

Run: `cd frontend && npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(preferencias): registro de controles por capacidad y Stepper sin arrastre"
```

---

### Task 6: Documentación (ADR 0004) y cierre del plan

**Files:**
- Create: `docs/adr/0004-catalogo-de-presets.md`
- Modify: `docs/arquitectura.md` (§4.2: la fila `GET /api/v1/profiles` pasa a `GET /api/v1/presets`; §5.2: la fila «Perfil y ajustes»; §5.4; §11: la fila `GET /profiles`), `docs/mejoras-pendientes.md` (Fase 2.1: puntos 1 y 3 hechos; Fase 2.4: «no se guarda la etiqueta» hecho), `docs/new_profiles/README.md` (§2.1: enlace a la hoja de ruta y a este plan)

- [ ] **Step 1: Escribir el ADR 0004** con el formato de los ADR existentes (contexto, decisión, consecuencias):
  - **Decisión:** catálogo en el backend, capacidades en el frontend, contrato por test, caché en `localStorage` y respaldo «Personalizado».
  - **Consecuencias:**
    - En GitHub Pages, el catálogo necesita `VITE_API_URL` y que el origen de Pages esté en `CORS_ORIGINS`.
    - Un preset nuevo no requiere desplegar el frontend.
    - Una capacidad nueva sí.
    - No se guarda la etiqueta del preset.
- [ ] **Step 2: Actualizar los documentos listados.**
- [ ] **Step 3: Chequeos completos**

Run: los dos comandos de la hoja de ruta §6.
Expected: todo en verde.

- [ ] **Step 4: Verificación manual en el navegador.** Con `npm run dev` y el backend levantado:
  1. `/perfil` muestra los 3 presets y «Personalizado».
  2. Con el backend apagado y la caché borrada, aparece solo «Personalizado» con el aviso.
  3. Con el backend apagado y caché, aparecen los 3 presets.
- [ ] **Step 5: `graphify update .` y commit**

```bash
git add docs/ graphify-out/
git commit -m "docs: ADR 0004 catálogo de presets en el backend"
```
