# Aula Clara · Arquitectura del MVP

> Este documento adapta [`instructions.md`](../instructions.md) a las convenciones de [`.skills/`](../.skills/README.md). Cuando los dos se contradicen, gana la skill (regla 4.1 de las instrucciones), y cada desvío queda en la tabla de la sección 2.
> Prototipo original (UX, textos, flujos): disponible en el historial de git (commit 2940725).

## 1. Qué hace el prototipo

Es una SPA de React 18 en un solo archivo, con Tailwind por CDN y Babel en el navegador. Tiene tres vistas, que se cambian con un estado `view` dentro de un único `AppCtx`:

| Vista | Qué hace |
|---|---|
| **Onboarding** | Wizard de 2 pasos. Paso 1: elegir un preset del catálogo que sirve el backend (hoy dislexia, visión reducida y fatiga visual) o «Personalizado». Paso 2: ajustar el tema, la tipografía, el tamaño (14 a 40 px) y el interlineado, con vista previa en vivo. Guarda `aulaclara.settings` y `aulaclara.onboarded` en `localStorage` (el preset elegido no se guarda). |
| **Biblioteca** | Drag & drop de archivos (con procesamiento simulado), documentos recientes (`INITIAL_DOCS`) con barra de progreso y búsqueda. |
| **Lector** | Tres columnas: herramientas de accesibilidad, visor y asistente. El visor muestra el `ARTICLE` fijo y la figura `CHART`. Incluye: lectura en voz alta (`useReadAloud` con Web Speech, resaltado del párrafo y simulación si no hay voces), progreso de lectura según el scroll, el botón flotante «Explicar más simple» al seleccionar texto, el botón «Interpretar con IA» en la figura, atajos Alt+P/S/=/−/T/A y un diálogo de atajos con trampa de foco. |

La IA está simulada en dos lugares: `mockReply(kind, text)`, con los tipos `resumir`, `conceptos`, `preguntas`, `imagen`, `simplificar` y libre, y la constante `IMAGE_ANALYSIS`. El chat usa `role="log"`, y los anuncios para lectores de pantalla pasan por una región `aria-live` del proveedor global.

## 2. Dónde las skills cambian lo que pedían las instrucciones

| Tema | `instructions.md` | Skill que manda | Decisión |
|---|---|---|---|
| Versión de React | React 18 | `architecting-react-apps`, `routing-with-react-router` (React Router v8 exige React ≥ 19.2.7) | **React 19** + TypeScript estricto |
| Navegación | `view` en el contexto global ("router por vista") | `routing-with-react-router` | **React Router v8 en data mode**: `createBrowserRouter`, rutas `lazy`, `loader`/`action`, `ErrorBoundary` por rama |
| Estado global | Un contexto con vista, ajustes, perfil, documentos y documento abierto | `architecting-react-apps` (el contexto global gigante es un anti-patrón) | **Contextos chicos**: `Preferences` (ajustes de lectura) y `Announcer` (`aria-live`). Los documentos se leen en loaders, la vista sale de la URL y el documento abierto, de `:documentId` |
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
├─ docs/  (arquitectura.md · accesibilidad.md · adr/0001 a 0004)
├─ frontend/                      # React 19 + Vite 8 + TypeScript 6 + Tailwind 4
│  ├─ vite.config.ts              # alias @/, React Compiler, envDir "..", base para Pages, proxy /api
│  ├─ eslint.config.js            # dirección de dependencias + react-hooks recommended
│  └─ src/
│     ├─ main.tsx · router.tsx    # createRoot + reporte de errores · árbol de rutas (lazy, middleware)
│     ├─ routes/                  # módulos de ruta finos: root-layout, profile, library, reader, ai-guide, route-error
│     ├─ features/
│     │  ├─ preferences/          # config (temas, fuentes), settings (validador único), presets (catálogo del backend), controls (registro), provider, wizard, guards
│     │  ├─ library/              # api (localStorage + IndexedDB), importación por pasos, pantalla, subida
│     │  ├─ reader/               # visor, herramientas, figuras con «Interpretar con IA», hooks (selección, progreso, atajos)
│     │  └─ assistant/            # cliente de IA, chat, panel, indicador de proveedor
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
   │  ├─ api/        deps.py (raíz de composición) · router.py · health · presets · documents · ai
   │  ├─ schemas/    preset · document (Page[T]) · ai
   │  ├─ services/   preset · document · ai · ai_rules (funciones puras) · prompts
   │  ├─ crud/       base (Repository[T]) · memory · seed · answer_cache
   │  ├─ providers/llm/   base · gemini · openai_compatible (Groq, OpenRouter) · factory
   │  ├─ models/     dataclasses: Preset, Document, ChatMessage
   │  ├─ prompts/    study_assistant.md · image_description.md (versionados)
   │  ├─ seed/       presets.json · documents.json
   │  └─ observability/   logging (JSON a stdout) · tracing (modo mínimo)
   └─ tests/         unit/ (reglas puras, services con autospec, proveedores) · api/ (endpoints)
```

## 4. Backend

### 4.1 Capas

La dependencia va en un solo sentido: `api → services → (crud | providers) → models`. `crud` y `providers` son capas hermanas que no se conocen entre sí. `schemas` es transversal.

| Capa | Hace | Nunca |
|---|---|---|
| `api/` | valida con schemas, resuelve dependencias, aplica el rate limit y devuelve `XRead` | lógica de negocio, llamadas a proveedores |
| `services/` | reglas de negocio, recorte del texto, elección del prompt, caché y reintento; lanza `AppError` | `HTTPException`, `Request`, importar `fastapi` |
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
| GET | `/api/health/ready` | `{status, version}` (no depende de ninguna key) |
| GET | `/api/v1/presets` | el catálogo de presets de ajustes (`id`, `title`, `icon`, `description`, `tags`, `settings`), sin paginar. El frontend lo pide en runtime y valida lo que llega ([ADR 0004](adr/0004-catalogo-de-presets.md)) |
| GET · POST · PATCH · DELETE | `/api/v1/documents[/{id}]` | `DocumentRead`; el listado se pagina con `offset`/`limit` |
| POST · GET · DELETE | `/api/v1/ai/session` | **Key sellada en cookie** ([ADR 0003](adr/0003-key-sellada-en-cookie.md)). `POST {provider, api_key, remember}` sella la key y la deja en la cookie `__Host-aula_ai`; `GET` comprueba que la cookie vuelve; `DELETE` la borra. Nunca devuelven la key. Todos exigen el header `X-Aula-Clara: 1`. Sin `SEALING_KEY` el `POST` responde 503 `ai_sessions_disabled` |
| GET | `/api/v1/ai/models` | headers `X-AI-Provider` y `X-AI-Key` (o la cookie) → `{provider, key_verified, models: [{id, name, supports_images, free}]}`. Valida la key si el proveedor lo permite |
| POST | `/api/v1/ai/chat` | headers `X-AI-Provider`, `X-AI-Model`, `X-AI-Key` + `{action, message?, document_text, selection?}` → `{answer, provider, model}` |
| POST | `/api/v1/ai/describe-image` | los mismos headers + multipart (`image` + `context?`) → `{description, provider, model}` |

**Dos formas de recibir la key** (`api/deps.py`, `resolve_credentials`): el header `X-AI-Key` (modo de headers) o la cookie sellada (modo de cookie, con `X-AI-Model` y `X-Aula-Clara`). Si llegan las dos, gana el header. Una cookie que no se puede abrir (vencida, manipulada, de otra `SEALING_KEY`) da 401 `ai_credentials_required` con `reason: session_expired`; la interfaz borra lo guardado y pide la key de nuevo.

Las rutas de IA usan **la key y el modelo de cada persona** (ver [ADR 0002](adr/0002-api-key-por-usuario.md)). `api/deps.py` valida los headers y crea el proveedor en cada pedido (una dependencia con `yield` lo cierra al terminar, para liberar sus conexiones); la key no se guarda ni se loguea.

`action` es un `Literal["free", "summarize", "key_concepts", "quiz", "simplify"]`. Todo esquema de entrada usa `extra="forbid"` y límites explícitos: el tamaño de `document_text` se valida contra `MAX_INPUT_CHARS` y la imagen, contra `MAX_IMAGE_BYTES`.

### 4.3 Errores (problem+json)

| Caso | Excepción | HTTP |
|---|---|---|
| Documento inexistente | `NotFoundError` | 404 `not_found` |
| Se pasó el límite por IP | `RateLimitedError` (con el header `Retry-After`) | 429 `rate_limited` |
| La imagen pesa más de 4 MB, o no es una imagen | `HTTPException` en `api/` (son errores de transporte) | 413 / 415 |
| El payload no es válido | `RequestValidationError` | 422 `validation_error` |
| Faltan proveedor, key o modelo (o la sesión de la cookie venció: `reason: session_expired`) | `AICredentialsRequiredError` | 401 `ai_credentials_required` |
| Pedido con la cookie sin el header `X-Aula-Clara` | `ForbiddenError` | 403 `forbidden` |
| `POST /ai/session` sin `SEALING_KEY` en el servidor | `AISessionsDisabledError` | 503 `ai_sessions_disabled` |
| El proveedor rechaza la key (o tiene un formato imposible) | `AIKeyInvalidError` | 401 `ai_key_invalid` |
| Se agotó la cuota o el saldo de la key | `AIQuotaExceededError` (`reason`: `rate`, `daily` o `credit`; `retry_after_seconds` y el header `Retry-After` si el proveedor lo informa) | 429 `ai_quota_exceeded` |
| La imagen o el texto superan el máximo del proveedor: 413, o la ventana de contexto del modelo | `AIInputTooLargeError` (`reason`: `size` o `context`) | 413 `ai_input_too_large` |
| Los filtros de seguridad bloquearon el pedido o la respuesta | `AIContentBlockedError` | 422 `ai_content_blocked` |
| El modelo contestó sin texto (`reason: length` = gastó todo el límite de salida «razonando») | `AIEmptyResponseError` | 502 `ai_response_empty` |
| La cuenta no puede usar el modelo o la región (`reason`: `access` o `region`) | `AIPermissionDeniedError` | 403 `ai_permission_denied` |
| El modelo no existe, fue dado de baja o la cuenta no tiene acceso | `AIModelNotFoundError` | 422 `ai_model_not_found` |
| El modelo no lee la imagen o no admite su formato (solo al describir imágenes) | `AIImageRejectedError` | 422 `ai_image_rejected` |
| Cualquier otro rechazo del proveedor (400/422) | `AIModelRejectedError` | 422 `ai_model_rejected` |
| El proveedor no responde (`reason`: `overloaded`, `provider_error`, `unreachable`, `malformed`) | un reintento con backoff, **solo si falló en menos de 5 s**, y después `AIUnavailableError` | 503 `ai_unavailable` |
| Se agotó `AI_TIMEOUT_SECONDS` (20 s) (`reason: timeout`) | sin reintento: otro intento igual de lento no entra en los 30 s de la función de Vercel | 503 `ai_unavailable` |
| Un error de proveedor que nadie tradujo todavía | `AIUnavailableError` (nunca un 500 sin explicación) | 503 `ai_unavailable` |
| Cualquier otra cosa | `Exception` | 500 `internal_error`, con `trace_id` |

**Cómo se clasifican los errores de los proveedores** (`providers/llm/http_errors.py`, una sola vez para los cinco): manda el **código HTTP** y después el texto. Un 429 es cuota aunque el texto hable de la «API key», y un 403 que no es de la key es de permisos, no de credenciales. Si la clasificación falla, el error cae en una categoría genérica **con el mensaje del proveedor**, así la persona igual ve el motivo. Las clasificaciones por texto se basan en los mensajes que documentan los proveedores; no se probaron contra respuestas reales de cuota, modelo inexistente o contexto excedido (hacen falta keys con ese estado).

**El mensaje del proveedor** (`provider_message`) se muestra a la persona solo después de pasar por `sanitize_message`: se reemplaza su key, se tachan restos que parezcan keys, se pasa a una sola línea y se corta a 300 caracteres. Para los 401 no se muestra ningún mensaje del proveedor.

**Respuesta cortada:** si el modelo para por su límite de salida (2048 tokens) pero ya escribió algo, la respuesta llega con `truncated: true` y la interfaz lo avisa. Si no llegó a escribir nada, es `ai_response_empty`.

**Qué no sale nunca en una respuesta de error:** la key. El `detail` es un texto fijo (proveedor, modelo y tipo de error, sin repetir el texto de la excepción) y el `reason` solo se reenvía si es una palabra simple. Como segunda barrera, la key del pedido en curso se tacha de cualquier línea de log (`observability/redaction.py`).
### 4.4 Configuración (`app/config.py`)

`APP_ENV`, `APP_NAME`, `DOCS_ENABLED`, `LOG_LEVEL`, `CORS_ORIGINS`, `ERRORS_BASE_URL`, `MAX_INPUT_CHARS`, `MAX_IMAGE_BYTES`, `RATE_LIMIT_PER_MIN`, `AI_CACHE_TTL_SECONDS`, `AI_TIMEOUT_SECONDS` (20 s por defecto, máximo 25: con un posible reintento rápido, el peor caso es unos 26 s, dentro del `maxDuration` de 30 s), `SEALING_KEY` y `SEALING_KEY_PREVIOUS` (`SecretStr`, 32 bytes en base64: una clave mal formada hace fallar el arranque), `AI_SESSION_HOURS` (12) y `AI_SESSION_REMEMBER_DAYS` (30). En staging y prod, sin `SEALING_KEY` se registra una advertencia al arrancar.

El servidor **no tiene API keys ni modelo de IA**: los trae cada persona en sus pedidos. Un `.env` viejo con `GEMINI_API_KEY` o `GROQ_MODEL` no rompe el arranque (`extra="ignore"`), pero esos valores ya no se usan. En staging y prod, un `model_validator` rechaza `*` en `CORS_ORIGINS`.

### 4.5 Tests

- `tests/api/` usa `httpx.AsyncClient(transport=ASGITransport(app))` y reemplaza `build_provider` por un proveedor falso: así se prueba la lectura real de los headers (falta de key, proveedor no admitido, modelo inválido) sin llamar a ningún modelo. Un test verifica que la key no aparece ni en la respuesta ni en los logs.
- `tests/unit/` cubre las funciones puras de `ai_rules.py`, la clasificación de errores HTTP de cada proveedor (`httpx.MockTransport` y dobles del SDK de Gemini), el filtrado de modelos, y `AIService` con `create_autospec(LLMProvider, instance=True)`: un error transitorio se reintenta una vez, los errores de la persona (key, cuota, modelo) no se reintentan, y la caché se separa por key.
- Todo eso corre junto con `uv run pytest`, `uv run mypy app`, `uv run ruff check` y `uv run lint-imports`.

## 5. Frontend

### 5.1 Rutas

```text
/                        → loader: redirige a /biblioteca si ya se hizo el onboarding (`aulaclara.onboarded`), si no a /perfil
/perfil                  → wizard de onboarding (también se entra desde «👤 Perfil»)
/ayuda/ia                → guía pública para conseguir la API key de cada proveedor (sin onboarding)
(pathless, middleware: requireOnboarding → sin onboarding, redirige a /perfil?next=…)
  /biblioteca            → loader: documentos; action: subir, borrar
  /leer/:documentId      → loader: documento + contenido (404 si no existe)
*                        → NotFound dentro del layout
```

Cada ruta es `lazy`, así que Vite genera un chunk por ruta: pdf.js y mammoth quedan fuera del bundle inicial. Las rutas cuyo loader lee `localStorage` llevan `hydrateFallbackElement` («Cargando tu perfil de lectura…»), para no mostrar una pantalla en blanco mientras se resuelven. `basename` sale de `import.meta.env.BASE_URL`, para que la app funcione bajo `/<repo>/` en GitHub Pages.

### 5.2 Datos y estado

| Dato | Dónde vive |
|---|---|
| Ajustes de lectura | `PreferencesProvider`. Se persisten en `localStorage` (`aulaclara.settings`) como `{ schemaVersion: 2, settings }`; un único validador `FIELDS` (`settings.ts`) valida cada campo al leer y al aplicar un preset. La clave vieja `aulaclara.profile` se migra a `aulaclara.onboarded` y se borra |
| Onboarding hecho | `aulaclara.onboarded` (`localStorage`). **No se guarda qué preset se eligió**: revelaría una discapacidad, dato sensible según la Ley 25.326 |
| Catálogo de presets | `GET /api/v1/presets` en runtime (`presets.ts`, timeout de 5 s, sin reintento) con caché en `localStorage` (`aulaclara.presets`). Sin backend ni caché, el onboarding ofrece solo «Personalizado», una opción fija del frontend (el id `custom` está reservado) |
| Anuncios para lectores de pantalla | `Announcer` (contexto separado: cambia con otra frecuencia) |
| Documentos (metadatos y progreso) | `features/library/api.ts` → `localStorage`; loaders y actions de ruta. El progreso se guarda con debounce, sin action, para no revalidar en cada scroll |
| Contenido extraído | **IndexedDB** (decisión del 2026-11-17): `localStorage` tiene alrededor de 5 MB por origen y un par de PDF largos lo llenan |
| Chat | estado local de `AssistantPanel`; cada envío es una Action (`useActionState`), porque no cambia datos de ningún loader |

### 5.3 IA en el cliente

`features/assistant/api.ts` expone `chat()`, `describeImage()` y `listModels()`, que pasan por `lib/http` y agregan los headers `X-AI-*` con lo que guarda `credentials.ts`. Sin credenciales, `chat()` lanza `MissingCredentialsError` sin llamar a la API.

- **Credenciales** (`credentials.ts`): proveedor, key y modelo en `sessionStorage` (se borran al cerrar la pestaña) o en `localStorage` si la persona marca «Recordar en este dispositivo». Se leen con `useSyncExternalStore`.
- **«Configurar IA»** (`AISettingsDialog.tsx`): elegir proveedor, pegar la key, «Probar key y ver modelos» (llama a `/ai/models`) y elegir el modelo. Solo se guarda una key que el proveedor aceptó. Al guardar, `session.ts` la **sella en la cookie** (`POST /ai/session`) y comprueba con `GET` que el navegador la devuelve; si no (servidor sin `SEALING_KEY`, cookie bloqueada, web y backend en sitios distintos), cae al modo de headers y lo explica. Con una key ya sellada, el diálogo no muestra nada secreto: deja cambiar el modelo (listando con la cookie), reemplazar la key o borrarla.
- **Lo guardado en el navegador** (`credentials.ts`): en modo de cookie, solo `{provider, model, remember, sealed: true}`; en modo de headers, además `apiKey`. Una lectura nunca devuelve una key junto al aviso de sello.
- **Errores:** `describeApiError` da un mensaje distinto para cada código (`ai_key_invalid`, `ai_quota_exceeded`, `ai_model_rejected`, …) y `needsAISetup` decide si se muestra el botón «Configurar IA» junto al mensaje. No hay respuestas simuladas.
- `ProviderBadge` muestra proveedor y modelo de cada respuesta.

### 5.4 Accesibilidad (paridad con el prototipo)

Se mantiene todo lo del prototipo: el enlace "Saltar al contenido" en el layout, el foco al `h1` al abrir el lector, el `Dialog` con trampa de foco y cierre con Esc, `aria-live` mediante `Announcer`, el chat con `role="log"`, objetivos táctiles de 48 px como mínimo, `prefers-reduced-motion`, los atajos y contraste AA en los 4 temas, que se verifica con un test de los pares de `THEMES`.

**Atajos y voz (plan 02).**
- `lib/keymap.ts` es la única tabla de atajos (Alt+P/S/=/−/T/A/↑/↓/H/G/M/B, más las teclas sueltas J/K/H/G/M/B/Espacio/1 a 4 si «Atajos de una sola tecla» está activo): `useReaderHotkeys` despacha por id y el diálogo de atajos y el panel de herramientas leen las mismas filas. Las teclas sueltas se ignoran dentro de campos de escritura y `Esc` silencia la voz sin dejar de cerrar diálogos. La tabla completa está en [accesibilidad.md](accesibilidad.md#atajos-de-teclado).
- `lib/speech.ts` tiene un árbitro (`speechBus`): habla una voz a la vez y quien interrumpe deja a la anterior en pausa, de modo que la lectura del documento se retoma en el mismo párrafo.
- `lib/voice/` agrupa el reconocimiento de voz: `recognizer.ts` (envoltorio de `SpeechRecognition`, `es-AR`, modos `push` y `continuous`), `commands.ts` (intérprete puro de frases; en manos libres las acciones de IA exigen el prefijo «asistente»), `earcons.ts` (tonos con `AudioContext`), `consent.ts` (consentimiento en `aulaclara.voiceConsent`) y `micLock.ts` (un solo micrófono a la vez). El `Permissions-Policy` de `vercel.json` permite el micrófono solo al propio sitio.
- `useReaderNavigation` es el cursor de bloque: mueve el foco a bloques con `tabIndex=-1`, sin paradas de `Tab` extra.
- Los ajustes `singleKeyShortcuts`, `voiceGuide` y `voiceCommands` salen del registro `CONTROLS` y el preset Ceguera del catálogo del backend los usa ([ADR 0004](adr/0004-catalogo-de-presets.md)).

Ajustes de lectura sin arrastrar (WCAG 2.5.7): el tamaño y el interlineado usan `Stepper` (botones «−» y «+»), no controles deslizantes. La interfaz de ajustes, en el onboarding y en el lector, sale del registro `CONTROLS` (`controls.ts`) vía `SettingsControls`. En la biblioteca **ya no hay una caja «Perfil activo»**: mostrar el preset elegido exponía una categoría sensible, y es una decisión de producto, no un faltante ([ADR 0004](adr/0004-catalogo-de-presets.md)).

## 6. Despliegue

- **Headers de seguridad** (`vercel.json`): CSP estricta (`script-src 'self' 'wasm-unsafe-eval'`, `connect-src 'self'`), `nosniff`, `Referrer-Policy: no-referrer` y `Permissions-Policy`. La CSP importa porque la key de cada persona vive en el navegador: un XSS podría robarla. Se probó en Chromium sirviendo `dist/` con los mismos headers: importar PDF y Word, chatear y describir imágenes no generan violaciones.
- **Vercel**: FastAPI corre como Vercel Function y la SPA se sirve desde `frontend/dist`. Antes de escribir `vercel.json` hay que confirmar contra la guía oficial vigente tanto el entrypoint (`api/index.py` o `[tool.vercel] entrypoint` en `pyproject.toml`) como la instalación con `uv.lock`. `vercel-index` marca **tres cosas sin probar** que se validan en la fase 1 con un despliegue vacío: (1) el fallback de la SPA a `index.html`, (2) que `/api/*` llegue a FastAPI y (3) el rate limit, que en memoria es por instancia y por eso solo sirve como freno, no como límite estricto. Para operar Vercel se instala la skill oficial `vercel-cli`.
- **GitHub Pages**: `pages.yml` hace el build con `base: '/<repo>/'` (y `VITE_API_URL` si está definida), y copia `index.html` a `404.html` para que funcionen las URLs profundas del router.

## 7. Plan por fases

El plan sigue el de `instructions.md`, reordenado según el orden de construcción de `scaffolding-fastapi-backends`. Cada fase termina en verde antes de pasar a la siguiente.

1. **Esqueleto** ✅. Monorepo, `.gitignore`, `.env`/`.env.example`, backend y frontend con sus chequeos. El despliegue vacío en Vercel quedó incluido en la fase 6, sin probar.
2. **Frontend sin IA** ✅. Migración del prototipo a features y rutas. Paridad visual y de accesibilidad, más un test de humo por ruta.
3. **Backend en capas** ✅. `presets` (antes `profiles`) y `documents`: schemas, models, repositorios en memoria, services y routers, con tests.
4. **IA real** ✅. `LLMProvider` (Gemini, Groq y OpenRouter), prompts, rate limit, caché y reintento. Se conectan el chat y «Interpretar con IA».
   - **4c. Key sellada en cookie, auditoría de dependencias** ✅ (2026-11-18). Ver ADR 0003. Probado en Chromium, contra el servidor de pruebas y contra el servidor de desarrollo de Vite.
   - **4b. Key y modelo por persona** ✅ (2026-11-17). «Configurar IA», `/ai/models`, errores separados y CSP. Probado de punta a punta en Chromium con keys reales de Gemini (chat e imagen) y Groq (chat); OpenRouter, solo con dobles.
5. **Documentos reales** ✅ (probada con un PDF y un DOCX generados; falta probar con archivos reales). pdf.js y mammoth en el cliente, imágenes embebidas con descripción por IA y un mensaje claro para PPTX y PDF escaneados.
6. **Despliegue y cierre** ✅ (archivos escritos; el despliegue en Vercel y Pages no se probó). Vercel en producción, Pages (necesita `VITE_API_URL` para la IA), README (incluido cómo pasar a PostgreSQL) y checklist de accesibilidad.

## 8. Proveedores de IA (actualizado el 2026-11-17)

Cada persona elige proveedor y modelo y usa su propia key ([ADR 0002](adr/0002-api-key-por-usuario.md)). Los modelos **no se fijan en el código**: se listan en vivo desde la API del proveedor con la key de la persona, porque cambian seguido (por ejemplo, `llama-3.3-70b-versatile` ya no figura en Groq).

| Proveedor | Cliente | Lista de modelos | Imágenes |
|---|---|---|---|
| **Gemini** | SDK `google-genai` | `models.list`, filtrando los que soportan `generateContent` y descartando los de imagen, audio, embeddings y agentes | los `gemini-*` sí; de Gemma no hay dato |
| **Groq** | `httpx`, API compatible con OpenAI | `GET /openai/v1/models`: solo entrada y salida de texto, activos y sin modelos de moderación (`guard`) | según `input_modalities` |
| **OpenRouter** | `httpx`, API compatible con OpenAI | `GET /api/v1/models` (público: la key se valida antes con `GET /key`), marcando los gratuitos (precio 0); la interfaz los muestra primero | según `architecture.input_modalities` |
| **Mistral AI** | `httpx`, API compatible con OpenAI | `GET /v1/models`, con `capabilities.completion_chat` | según `capabilities.vision`; la imagen va como texto en `image_url` |
| **NVIDIA Build** | `httpx`, API compatible con OpenAI | `GET /v1/models` (público y sin modalidades): se descartan por nombre embeddings, moderación, rerankers y detectores. **No valida la key** (`key_verified: false`) | por nombre (`-vl`, `vision`, `omni`); si no, sin dato |

- **Diferencias entre proveedores:** viven en `SPECS` (`openai_compatible.py`): URL base, cómo se valida la key, si informa modelos gratuitos y el formato de imagen.
- **Guía para conseguir la key:** la ruta pública `/ayuda/ia` (`AIKeysGuide.tsx`) explica, para cada proveedor, cómo registrarse, iniciar sesión y crear la key. Los textos están en `providers.ts`, junto a la ficha de cada proveedor.
- **URL base cerrada:** la persona elige un proveedor, nunca una URL. Así el backend no puede usarse para pedir otras direcciones (SSRF).
- **Límites del free tier:** cada proveedor los muestra en la cuenta de la persona ([AI Studio](https://aistudio.google.com/rate-limit), Groq, OpenRouter). El límite por IP y la caché siguen, porque cada consulta también gasta tiempo de función en Vercel.
- **SDK:** `google-genai` (el anterior, `google-generativeai`, está deprecado). Groq y OpenRouter comparten `OpenAICompatibleProvider`.
- **Privacidad:** en los niveles gratuitos, el proveedor puede usar el contenido enviado para mejorar sus productos. Por eso la biblioteca muestra el aviso «No subas documentos con datos personales», y «Configurar IA» explica adónde viaja la key.
- **Configuración:** el servidor no tiene keys ni modelos de IA. Tiene un secreto propio, `SEALING_KEY`, para sellar la key de cada persona en una cookie `HttpOnly`. Sin él, la key vive en el navegador y viaja en `X-AI-Key`. Ver [docs/seguridad.md](seguridad.md).

## 9. Chequeos obligatorios antes de integrar (no hay CI)

```bash
# backend/
uv run pytest && uv run mypy app tests && uv run ruff check && uv run ruff format --check && uv run lint-imports
# frontend/
npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
# dependencias (ver docs/seguridad.md)
npm run audit:prod   # en frontend/
uv export --no-dev --no-hashes --no-emit-project | uvx pip-audit -r /dev/stdin   # en backend/
```

## 10. Decisiones tomadas (2026-11-17)

1. **`.skills/`** queda en el repo solo como referencia local y se excluye en `.gitignore`.
2. **No hay CI.** Los chequeos de la sección 9 son obligatorios antes de integrar.
3. **El texto extraído va en IndexedDB.** Las preferencias y los metadatos siguen en `localStorage`.
4. **URLs limpias en GitHub Pages**, con `createBrowserRouter` y una copia de `index.html` como `404.html`.
5. **Toda configuración de entorno va en `.env`**, con `.env.example` como referencia versionada. Desde la decisión 6, el servidor no tiene secretos de IA.
6. **Cada persona usa su propia API key y elige el modelo** (Gemini, Groq, OpenRouter, Mistral o NVIDIA Build). Se retiraron las keys y los modelos del `.env`. Ver [ADR 0002](adr/0002-api-key-por-usuario.md).
7. **La key va sellada en una cookie `HttpOnly`** (2026-11-18), con el modo de headers como respaldo. Ver [ADR 0003](adr/0003-key-sellada-en-cookie.md) y [docs/seguridad.md](seguridad.md).

## 11. Qué cambió respecto del plan inicial

| Tema | Plan | Lo construido | Por qué |
|---|---|---|---|
| Error 429 del proveedor | cae al mock | cae al siguiente proveedor; si no queda ninguno, 503 `ai_unavailable` | Se eliminó el mock a pedido: las respuestas siempre vienen de un modelo real |
| Límite por IP excedido (429 propio) | — | el cliente muestra «esperá N segundos» | El límite protege la cuota gratuita y la persona sabe cuánto esperar |
| Chat | `useActionState` | hook `useChat` con estado local | La mutación no cambia datos de ningún loader y necesita el historial de mensajes |
| Importar y avanzar el progreso | `action` de ruta | funciones de `libraryApi` | La importación muestra el avance por pasos, y el progreso se guarda con cada scroll |
| `GET /profiles` | lo consume el frontend | pasó a `GET /presets` y el frontend lo pide en runtime, con caché en `localStorage` y el respaldo «Personalizado» sin backend | Un preset nuevo no debería requerir desplegar el frontend; ver [ADR 0004](adr/0004-catalogo-de-presets.md). En Pages hace falta `VITE_API_URL` y el origen en `CORS_ORIGINS` |
| Proveedor de Groq | SDK | `OpenAICompatibleProvider` con `httpx` (también sirve para OpenRouter) | Un SDK menos que empaquetar en la función de Vercel |
| Keys de IA | en el `.env` del servidor, con cadena Gemini → Groq | la key y el modelo de cada persona, en headers | El servicio en Vercel no depende de una cuota única; ver ADR 0002 |
| Contexto del asistente | «sección visible y selección» | el comienzo del documento (hasta `MAX_INPUT_CHARS`) y la selección | Elegir la sección visible agrega complejidad; queda como mejora |
| Figuras de PDF | en su posición | al final de su página | pdf.js no entrega la posición exacta de las imágenes |
| Entrypoint de Vercel | `api/index.py` importando `backend.app.main` | `api/index.py` agrega `backend/` al path | Los imports del backend son `app.*`, igual que en local |
