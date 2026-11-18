# Aula Clara · Arquitectura del MVP

> Este documento adapta [`instructions.md`](../instructions.md) a las convenciones de [`.skills/`](../.skills/README.md). Cuando los dos se contradicen, gana la skill (regla 4.1 de las instrucciones), y cada desvío queda en la tabla de la sección 2.
> Prototipo original (UX, textos, flujos): disponible en el historial de git (commit 2940725).

## 1. Qué hace el prototipo

Es una SPA de React 18 en un solo archivo, con Tailwind por CDN y Babel en el navegador. Tiene tres vistas, que se cambian con un estado `view` dentro de un único `AppCtx`:

| Vista | Qué hace |
|---|---|
| **Onboarding** | Wizard de 2 pasos. Paso 1: elegir uno de los 4 perfiles (`PROFILES`: dislexia, visión reducida, fatiga visual, personalizado). Paso 2: ajustar el tema, la tipografía, el tamaño (14 a 40 px) y el interlineado, con vista previa en vivo. Guarda `aulaclara.profile` y `aulaclara.settings` en `localStorage`. |
| **Biblioteca** | Drag & drop de archivos (con procesamiento simulado), documentos recientes (`INITIAL_DOCS`) con barra de progreso y búsqueda. |
| **Lector** | Tres columnas: herramientas de accesibilidad, visor y asistente. El visor muestra el `ARTICLE` fijo y la figura `CHART`. Incluye: lectura en voz alta (`useReadAloud` con Web Speech, resaltado del párrafo y simulación si no hay voces), progreso de lectura según el scroll, el botón flotante «Explicar más simple» al seleccionar texto, el botón «Interpretar con IA» en la figura, atajos Alt+P/S/=/−/T/A y un diálogo de atajos con trampa de foco. |

La IA está simulada en dos lugares: `mockReply(kind, text)`, con los tipos `resumir`, `conceptos`, `preguntas`, `imagen`, `simplificar` y libre, y la constante `IMAGE_ANALYSIS`. El chat usa `role="log"`, y los anuncios para lectores de pantalla pasan por una región `aria-live` del proveedor global.

## 2. Dónde las skills cambian lo que pedían las instrucciones

| Tema | `instructions.md` | Skill que manda | Decisión |
|---|---|---|---|
| Versión de React | React 18 | `architecting-react-apps`, `routing-with-react-router` (React Router v8 exige React ≥ 19.2.7) | **React 19** + TypeScript estricto |
| Navegación | `view` en el contexto global ("router por vista") | `routing-with-react-router` | **React Router v8 en data mode**: `createBrowserRouter`, rutas `lazy`, `loader`/`action`, `ErrorBoundary` por rama |
| Estado global | Un contexto con vista, ajustes, perfil, documentos y documento abierto | `architecting-react-apps` (el contexto global gigante es un anti-patrón) | **Contextos chicos**: `Preferences` (perfil y ajustes de lectura) y `Announcer` (`aria-live`). Los documentos se leen en loaders, la vista sale de la URL y el documento abierto, de `:documentId` |
| Carpetas del frontend | `app/`, `shared/{ui,hooks,lib,config}`, `types/` | `architecting-react-apps` | `main.tsx`, `router.tsx`, `lib/`, `components/`, `features/<f>/` con `index.ts` público y `routes/`, más el alias `@/` y reglas de ESLint que hacen cumplir los imports |
| Cliente HTTP | `shared/lib/apiClient.ts` | `building-axios-clients` | **Axios solo en `lib/http`**, con `toApiError` (una unión discriminada) y reintento con backoff solo en métodos idempotentes. No hay login, así que no hay refresh de tokens |
| Memoización | sin definir | `optimizing-react-renders` (proyecto nuevo) | **React Compiler** activado y nada de `useMemo`/`useCallback` manual |
| Errores en el frontend | sin definir | `handling-react-errors` | `lib/telemetry.ts` y una boundary por zona: ruta, panel del asistente y figura |
| SPA o SSR | SPA estática | `choosing-ssr-or-spa` | SPA (no hay contenido público que indexar). Queda registrado en `docs/adr/0001-spa.md` |
| Python y dependencias | Python 3.12 + `requirements.txt` | `scaffolding-fastapi-backends` | **Python 3.14 + uv** (`pyproject.toml` + `uv.lock`). Vercel ya soporta 3.14; se fija con `requires-python` y `.python-version` |
| Carpetas del backend | `core/{config,errors,rate_limit}.py`, `api/v1/routers/` | `layering-fastapi-apps` | `app/config.py`, `app/errors.py` y `app/rate_limit.py` en la raíz de `app/`; `app/api/` contiene los routers, `deps.py` (la raíz de composición) y `router.py` |
| Errores del backend | "respuestas JSON consistentes" | `handling-fastapi-errors` | Respuestas `application/problem+json` (RFC 9457), una jerarquía `AppError` y 4 handlers globales |
| Configuración | `ALLOWED_ORIGINS`; un `.env.example` en `frontend/` y otro en `backend/` | `configuring-fastapi-settings` | Un `Settings` con `APP_ENV` por stage y `SecretStr` para las keys. `CORS_ORIGINS` reemplaza a `ALLOWED_ORIGINS`. Hay **un único `.env.example` en la raíz** (Vite lo lee con `envDir: ".."` y solo expone las variables `VITE_*`) |
| Health check | `GET /api/v1/health` | `layering-fastapi-apps` (salud fuera de `/api/v1`, con `live` y `ready`) | `GET /api/health/live` y `GET /api/health/ready`. `ready` devuelve el proveedor de IA activo. Siguen bajo `/api` para que Vercel los mande a FastAPI |
| Modelos | dataclasses | `layering-fastapi-apps` (`models/` = ORM) | Dataclasses mientras no haya base. Al pasar a PostgreSQL se reemplazan por modelos de SQLAlchemy 2.0 (`modeling-postgres-with-sqlalchemy`) sin tocar los services |
| Capas | por convención | `layering-fastapi-apps` | **import-linter** en `pyproject.toml` (contratos en la sección 4.1) |
| Observabilidad | — | `scaffolding-fastapi-backends`, paso 8 en su variante para Vercel | Logs JSON a stdout y `tracing.py` en modo mínimo (solo `opentelemetry-api`, para el `trace_id`). No hay Prometheus, Loki ni Tempo |
| Auth, Docker, PostgreSQL | fuera del MVP | `scaffolding-fastapi-backends`, pasos 3, 4, 5 y 7 | No aplican: el MVP no tiene usuarios ni base y debe costar cero. El README lo declara y explica cómo sumarlos |
| CI | solo el workflow de Pages | `scaffolding-fastapi-backends` (CircleCI + Coveralls) | **Sin CI** (decisión del 2026-11-17). Como pide la skill cuando no hay CI, los chequeos de la sección 9 son obligatorios antes de integrar, y el README lo declara |
| Variables de entorno | `.env.example` con valores vacíos | `configuring-fastapi-settings` | **Todo secreto y toda configuración van en un `.env` en la raíz** (ignorado por git). `.env.example` es la referencia versionada, con las keys vacías. En Vercel, las mismas claves se cargan en Environment Variables |
| Linter del frontend | ESLint + Prettier | `architecting-react-apps` | La plantilla actual de Vite trae oxlint y TypeScript 7. Se reemplazó oxlint por **ESLint** (lo exigen las reglas de capas y de hooks) y se fijó **TypeScript 6.0**, la última versión que acepta `typescript-eslint` |

## 3. Estructura del repositorio

```text
aula-clara/
├─ .skills/                       # convenciones, solo como referencia local (ignorado por git)
├─ .env                           # secretos y configuración local (ignorado por git)
├─ .env.example                   # referencia versionada: backend (Settings) y frontend (VITE_*)
├─ .gitignore · .vercelignore · .python-version · requirements.txt (lo lee Vercel; se regenera con uv export)
├─ vercel.json                    # build del frontend, fallback de la SPA y ruteo de /api/* a la función
├─ api/index.py                   # entrypoint de Vercel: agrega backend/ al path e importa app.main
├─ .github/workflows/pages.yml    # despliegue opcional del frontend a GitHub Pages
├─ docs/  (arquitectura.md · accesibilidad.md · adr/0001-spa.md)
├─ frontend/                      # React 19 + Vite 8 + TypeScript 6 + Tailwind 4
│  ├─ vite.config.ts              # alias @/, React Compiler, envDir "..", base para Pages, proxy /api
│  ├─ eslint.config.js            # dirección de dependencias + react-hooks recommended
│  └─ src/
│     ├─ main.tsx · router.tsx    # createRoot + reporte de errores · árbol de rutas (lazy, middleware)
│     ├─ routes/                  # módulos de ruta finos: root-layout, profile, library, reader, route-error
│     ├─ features/
│     │  ├─ preferences/          # config (temas, fuentes, perfiles), provider, wizard de onboarding, guards
│     │  ├─ library/              # api (localStorage + IndexedDB), importación por pasos, pantalla, subida
│     │  ├─ reader/               # visor, herramientas, figuras con «Interpretar con IA», hooks (selección, progreso, atajos)
│     │  └─ assistant/            # cliente de IA con respaldo al mock, chat, panel, indicador de proveedor
│     ├─ components/              # Button, Dialog (trampa de foco), ProgressBar, Logo, SkipLink, KeysDialog, ErrorBoundary
│     └─ lib/
│        ├─ http/                 # axios solo acá: errores tipados (problem+json), reintento con backoff en GET
│        ├─ extractors/           # pdf.js, mammoth, paragraphs (puro), image (redimensionar ≤ 4 MB)
│        ├─ speech.ts · useReadAloud.ts   # Web Speech API + simulación sin voces
│        └─ announcer.tsx · storage.ts · idb.ts · telemetry.ts
└─ backend/                       # Python 3.14 + FastAPI + uv
   ├─ pyproject.toml · uv.lock    # dependencias, ruff, mypy --strict, pytest, import-linter
   ├─ app/
   │  ├─ main.py · config.py · errors.py · rate_limit.py
   │  ├─ api/        deps.py (raíz de composición) · router.py · health · profiles · documents · ai
   │  ├─ schemas/    profile · document (Page[T]) · ai
   │  ├─ services/   profile · document · ai · ai_rules (funciones puras) · prompts
   │  ├─ crud/       base (Repository[T]) · memory · seed · answer_cache
   │  ├─ providers/llm/   base · gemini · groq · mock · factory
   │  ├─ models/     dataclasses: Profile, Document, ChatMessage
   │  ├─ prompts/    study_assistant.md · image_description.md (versionados)
   │  ├─ seed/       profiles.json · documents.json
   │  └─ observability/   logging (JSON a stdout) · tracing (modo mínimo)
   └─ tests/         unit/ (reglas puras, services con autospec, proveedores) · api/ (endpoints)
```

## 4. Backend

### 4.1 Capas

La dependencia va en un solo sentido: `api → services → (crud | providers) → models`. `crud` y `providers` son capas hermanas que no se conocen entre sí. `schemas` es transversal.

| Capa | Hace | Nunca |
|---|---|---|
| `api/` | valida con schemas, resuelve dependencias, aplica el rate limit y devuelve `XRead` | lógica de negocio, llamadas a proveedores |
| `services/` | reglas de negocio, recorte del texto, elección del prompt, caché y fallback; lanza `AppError` | `HTTPException`, `Request`, importar `fastapi` |
| `crud/` | guarda y lee entidades (hoy en memoria) | reglas de negocio |
| `providers/llm/` | traduce `LLMProvider` al SDK del proveedor; convierte un 429 o un fallo en `ProviderUnavailable` | reglas de negocio, elegir otro proveedor |
| `models/` | entidades puras | importar capas superiores |

Estos contratos de `import-linter` en `backend/pyproject.toml` hacen cumplir las capas:

- **Capas:** `app.api` → `app.services` → `app.crud | app.providers` → `app.models` (`crud` y `providers` como capas independientes; confirmar la sintaxis en la fase 1).
- **Sin HTTP:** `app.services`, `app.crud` y `app.providers` no importan `fastapi`.
- **Composición:** dentro de `app.api`, solo `app.api.deps` importa `app.crud` y `app.providers`.

Los repositorios en memoria y la caché viven mientras viva el proceso: `deps.py` los crea una sola vez. Al pasar a PostgreSQL, `SqlAlchemyRepository` recibe una `AsyncSession` por constructor (`configuring-sqlalchemy-sessions`), y el único archivo que cambia es `deps.py`.

### 4.2 Endpoints

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/api/health/live` | `{status}` |
| GET | `/api/health/ready` | `{status, ai_provider: "gemini" \| "groq" \| "mock"}` |
| GET | `/api/v1/profiles` | los 4 perfiles (catálogo chico, sin paginar) |
| GET · POST · PATCH · DELETE | `/api/v1/documents[/{id}]` | `DocumentRead`; el listado se pagina con `offset`/`limit` |
| POST | `/api/v1/ai/chat` | `{action, message?, document_text, selection?}` → `{answer, provider}` |
| POST | `/api/v1/ai/describe-image` | multipart (`image` + `context?`) → `{description, provider}` |

`action` es un `Literal["free", "summarize", "key_concepts", "quiz", "simplify"]`. Todo esquema de entrada usa `extra="forbid"` y límites explícitos: el tamaño de `document_text` se valida contra `MAX_INPUT_CHARS` y la imagen, contra `MAX_IMAGE_BYTES`.

### 4.3 Errores (problem+json)

| Caso | Excepción | HTTP |
|---|---|---|
| Documento inexistente | `NotFoundError` | 404 `not_found` |
| Se pasó el límite por IP | `RateLimitedError` (con el header `Retry-After`) | 429 `rate_limited` |
| La imagen pesa más de 4 MB, o no es una imagen | `HTTPException` en `api/` (son errores de transporte) | 413 / 415 |
| El payload no es válido | `RequestValidationError` | 422 `validation_error` |
| El proveedor de IA da 429 o falla | **no es un error**: después de un reintento con backoff, el service usa el mock y responde 200 con `provider: "mock"` | 200 |
| Cualquier otra cosa | `Exception` | 500 `internal_error`, con `trace_id` |

### 4.4 Configuración (`app/config.py`)

`APP_ENV`, `APP_NAME`, `DOCS_ENABLED`, `LOG_LEVEL`, `CORS_ORIGINS`, `ERRORS_BASE_URL`, `AI_PROVIDER` (`auto | gemini | groq | mock`), `GEMINI_API_KEY: SecretStr | None`, `GEMINI_MODEL`, `GROQ_API_KEY: SecretStr | None`, `GROQ_MODEL`, `MAX_INPUT_CHARS`, `MAX_IMAGE_BYTES`, `RATE_LIMIT_PER_MIN`, `AI_CACHE_TTL_SECONDS`.

Las API keys son opcionales, a diferencia de lo que pide la skill para los secretos. Es una excepción a propósito: la definición de terminado exige que sin key todo siga andando en modo mock. Para que no falle en silencio, un `model_validator` exige la key y el modelo cuando `AI_PROVIDER` vale `gemini` o `groq`, y en staging y prod rechaza `*` en `CORS_ORIGINS`. Ningún identificador de modelo tiene default en el código.

### 4.5 Tests

- `tests/api/` usa `httpx.AsyncClient(transport=ASGITransport(app))`, con `AI_PROVIDER=mock` y `dependency_overrides` sobre el proveedor. Ningún test llama a un proveedor real.
- `tests/unit/` cubre las funciones puras de `ai_rules.py` y prueba `AIService` con `create_autospec(LLMProvider, instance=True)`: un 429 del proveedor tiene que terminar en una respuesta del mock, y una respuesta en caché no debe volver a llamar al proveedor (`assert_not_awaited`).
- Todo eso corre junto con `uv run pytest`, `uv run mypy app`, `uv run ruff check` y `uv run lint-imports`.

## 5. Frontend

### 5.1 Rutas

```text
/                        → loader: redirige a /biblioteca si hay perfil guardado, si no a /perfil
/perfil                  → wizard de onboarding (también se entra desde «👤 Perfil»)
(pathless, middleware: requireProfile → sin perfil, redirige a /perfil?next=…)
  /biblioteca            → loader: documentos; action: subir, borrar
  /leer/:documentId      → loader: documento + contenido (404 si no existe)
*                        → NotFound dentro del layout
```

Cada ruta es `lazy`, así que Vite genera un chunk por ruta: pdf.js y mammoth quedan fuera del bundle inicial. `basename` sale de `import.meta.env.BASE_URL`, para que la app funcione bajo `/<repo>/` en GitHub Pages.

### 5.2 Datos y estado

| Dato | Dónde vive |
|---|---|
| Perfil y ajustes de lectura | `PreferencesProvider` (se persiste en `localStorage`) |
| Anuncios para lectores de pantalla | `Announcer` (contexto separado: cambia con otra frecuencia) |
| Documentos (metadatos y progreso) | `features/library/api.ts` → `localStorage`; loaders y actions de ruta. El progreso se guarda con debounce, sin action, para no revalidar en cada scroll |
| Contenido extraído | **IndexedDB** (decisión del 2026-11-17): `localStorage` tiene alrededor de 5 MB por origen y un par de PDF largos lo llenan |
| Chat | estado local de `AssistantPanel`; cada envío es una Action (`useActionState`), porque no cambia datos de ningún loader |

### 5.3 IA en el cliente

`features/assistant/api.ts` expone `chat()` y `describeImage()`, que pasan por `lib/http`. Si `VITE_AI_MODE=mock`, o si la request termina en `network`, `timeout` o `server`, usa `mock.ts`, que tiene las mismas respuestas del prototipo. Así, el build de Pages funciona 100 % estático. La respuesta siempre trae `provider`, y `ProviderBadge` muestra «respuesta simulada» cuando el valor es `mock`.

### 5.4 Accesibilidad (paridad con el prototipo)

Se mantiene todo lo del prototipo: el enlace "Saltar al contenido" en el layout, el foco al `h1` al abrir el lector, el `Dialog` con trampa de foco y cierre con Esc, `aria-live` mediante `Announcer`, el chat con `role="log"`, objetivos táctiles de 48 px como mínimo, `prefers-reduced-motion`, los atajos con `useHotkeys` (Alt+P/S/=/−/T/A) y contraste AA en los 4 temas, que se verifica con un test de los pares de `THEMES`.

## 6. Despliegue

- **Vercel**: FastAPI corre como Vercel Function y la SPA se sirve desde `frontend/dist`. Antes de escribir `vercel.json` hay que confirmar contra la guía oficial vigente tanto el entrypoint (`api/index.py` o `[tool.vercel] entrypoint` en `pyproject.toml`) como la instalación con `uv.lock`. `vercel-index` marca **tres cosas sin probar** que se validan en la fase 1 con un despliegue vacío: (1) el fallback de la SPA a `index.html`, (2) que `/api/*` llegue a FastAPI y (3) el rate limit, que en memoria es por instancia y por eso solo sirve como freno, no como límite estricto. Para operar Vercel se instala la skill oficial `vercel-cli`.
- **GitHub Pages**: `pages.yml` hace el build con `base: '/<repo>/'` y `VITE_AI_MODE=mock`, y copia `index.html` a `404.html` para que funcionen las URLs profundas del router.

## 7. Plan por fases

El plan sigue el de `instructions.md`, reordenado según el orden de construcción de `scaffolding-fastapi-backends`. Cada fase termina en verde antes de pasar a la siguiente.

1. **Esqueleto** ✅. Monorepo, `.gitignore`, `.env`/`.env.example`, backend y frontend con sus chequeos. El despliegue vacío en Vercel quedó incluido en la fase 6, sin probar.
2. **Frontend sin IA** ✅. Migración del prototipo a features y rutas con el mock local. Paridad visual y de accesibilidad, más un test de humo por ruta.
3. **Backend en capas** ✅. `profiles` y `documents`: schemas, models, repositorios en memoria, services y routers, con tests.
4. **IA real** ✅ (probada con dobles; falta probar con keys reales). `LLMProvider` (Gemini, Groq y mock), prompts, rate limit, caché y fallback. Se conectan el chat y «Interpretar con IA». Los identificadores de modelo se verifican en la documentación oficial.
5. **Documentos reales** ✅ (probada con un PDF y un DOCX generados; falta probar con archivos reales). pdf.js y mammoth en el cliente, imágenes embebidas con descripción por IA y un mensaje claro para PPTX y PDF escaneados.
6. **Despliegue y cierre** ✅ (archivos escritos; el despliegue en Vercel y Pages no se probó). Vercel en producción, Pages en modo mock, README (incluido cómo pasar a PostgreSQL) y checklist de accesibilidad.

## 8. Proveedor de IA (verificado el 2026-11-17)

Se verificó en la documentación oficial de cada proveedor, no en sitios de terceros (regla 4.4 de las instrucciones).

| Rol | Proveedor y modelo | Por qué |
|---|---|---|
| **Principal** | Gemini API, `GEMINI_MODEL=gemini-3.5-flash-lite` | Es estable, gratuito, multimodal (cubre el chat y «Interpretar con IA») y no tiene fecha de baja anunciada. Es el reemplazo oficial de `gemini-2.5-flash` (que se da de baja el 1 de diciembre de 2026) y de `gemini-3.1-flash-lite` (que se da de baja el 7 de mayo de 2027). |
| **Respaldo de texto** | Groq, `GROQ_MODEL=llama-3.3-70b-versatile` | Es un modelo de producción, compatible con la API de OpenAI y con buen español. La documentación no confirma que Groq tenga modelos con visión en producción, así que solo se usa para texto. |
| **Último recurso** | Mock | Sin key, con `AI_PROVIDER=mock`, o si el proveedor da 429 o falla después de un reintento. Usa las respuestas del prototipo. |

- **Límites del free tier:** la documentación oficial no publica los números de requests por día del nivel gratuito de cada modelo. Se consultan en vivo en [AI Studio → Rate limit](https://aistudio.google.com/rate-limit) y en la página de límites de la cuenta de Groq. Un reporte del foro de Google habla de alrededor de 500 requests por día para Flash-Lite y de 20 para Flash. Por eso se eligió Flash-Lite, y por eso hacen falta el rate limit por IP y la caché.
- **SDK:** `google-genai` (el SDK anterior, `google-generativeai`, está deprecado). La documentación recomienda la *Interactions API* para apps nuevas. Groq tiene su propio SDK y también acepta el cliente de OpenAI con `base_url=https://api.groq.com/openai/v1`. La elección final se confirma en la fase 4.
- **Privacidad:** en el nivel gratuito de Gemini, el contenido enviado se usa para mejorar los productos de Google (en el nivel pago, no). Por eso la biblioteca muestra el aviso «No subas documentos con datos personales», y el README lo explica.
- **Configuración:** las keys van solo en `.env`, que no se versiona (y en Vercel, en Environment Variables). Los identificadores de modelo van en `.env` y nunca en el código. Si hay una key sin modelo, el backend no arranca.

## 9. Chequeos obligatorios antes de integrar (no hay CI)

```bash
# backend/
uv run pytest && uv run mypy app tests && uv run ruff check && uv run ruff format --check && uv run lint-imports
# frontend/
npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
```

## 10. Decisiones tomadas (2026-11-17)

1. **`.skills/`** queda en el repo solo como referencia local y se excluye en `.gitignore`.
2. **No hay CI.** Los chequeos de la sección 9 son obligatorios antes de integrar.
3. **El texto extraído va en IndexedDB.** Las preferencias y los metadatos siguen en `localStorage`.
4. **URLs limpias en GitHub Pages**, con `createBrowserRouter` y una copia de `index.html` como `404.html`.
5. **Todo secreto y toda configuración de entorno van en `.env`**, con `.env.example` como referencia versionada.

## 11. Qué cambió respecto del plan inicial

| Tema | Plan | Lo construido | Por qué |
|---|---|---|---|
| Error 429 del proveedor | cae al mock | cae al siguiente proveedor y, al final, al mock | Con Gemini y Groq configurados, probar Groq antes del mock da una respuesta real |
| Límite por IP excedido (429 propio) | — | **no** cae al mock: el cliente muestra «esperá N segundos» | Si cayera al mock, el límite no frenaría nada y la persona no sabría por qué la respuesta es simulada |
| Chat | `useActionState` | hook `useChat` con estado local | La mutación no cambia datos de ningún loader y necesita el historial de mensajes |
| Importar y avanzar el progreso | `action` de ruta | funciones de `libraryApi` | La importación muestra el avance por pasos, y el progreso se guarda con cada scroll |
| `GET /profiles` | lo consume el frontend | existe y funciona, pero el frontend usa su propia copia | Los perfiles tienen que funcionar sin backend (Pages); el endpoint demuestra la arquitectura |
| Proveedor de Groq | SDK | `httpx` contra la API compatible con OpenAI | Un SDK menos que empaquetar en la función de Vercel |
| Contexto del asistente | «sección visible y selección» | el comienzo del documento (hasta `MAX_INPUT_CHARS`) y la selección | Elegir la sección visible agrega complejidad; queda como mejora |
| Figuras de PDF | en su posición | al final de su página | pdf.js no entrega la posición exacta de las imágenes |
| Entrypoint de Vercel | `api/index.py` importando `backend.app.main` | `api/index.py` agrega `backend/` al path | Los imports del backend son `app.*`, igual que en local |
