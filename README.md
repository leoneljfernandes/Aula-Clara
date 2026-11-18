# Aula Clara

Plataforma de accesibilidad educativa para estudiantes universitarios con **discapacidad visual, dislexia o fatiga visual**.

## Qué hace

El estudiante configura su perfil una vez, sube su material (PDF o Word) y lo lee adaptado a sus necesidades: tipografía, tamaño, interlineado y tema de color (incluido alto contraste). Además puede:

- **Escuchar** el texto en voz alta, con el párrafo resaltado.
- Pedir a la IA que **describa imágenes y gráficos** que no tienen texto alternativo.
- Consultar a un **asistente de estudio** que resume, explica conceptos, arma preguntas de repaso y reformula párrafos con palabras más simples.

## Objetivo del proyecto

Que cualquier estudiante pueda acceder al material de su carrera sin depender de que el docente lo entregue en un formato accesible, y sin costo: la herramienta funciona con infraestructura y modelos de IA de nivel gratuito.

## Por qué se hizo

Mucho material universitario llega en PDF y Word pensados para una sola forma de leer: texto chico, imágenes sin descripción, sin opciones para quien se cansa la vista o tiene dislexia. Aula Clara nació como un MVP académico para mostrar que se puede resolver con herramientas gratuitas y abiertas.

## Open source

Es una herramienta **abierta y libre**. Invito a la comunidad a usarla, copiarla, adaptarla y mejorarla para quien la necesite: estudiantes, docentes, instituciones y desarrolladores. Si te sirve, usala; si encontrás un problema o tenés una idea, abrí un issue o un pull request.

## Levantarlo en local

### Requisitos

- [uv](https://docs.astral.sh/uv/) (instala Python 3.14 con `uv python install 3.14`).
- Node.js 22 o superior y npm.

### 1. Configuración (`.env`)

Todo secreto y toda configuración de entorno va en **un único `.env` en la raíz**, que no se versiona. `.env.example` es la referencia, con las keys vacías:

```bash
cp .env.example .env
```

Sin API keys la app funciona igual, en **modo simulado**: el asistente responde con textos de ejemplo y la interfaz lo indica («Respuesta simulada»).

### 2. Activar la IA real con el nivel gratuito

1. **Gemini (principal, texto e imágenes).** Creá una key gratis en <https://aistudio.google.com/apikey> y pegala en `GEMINI_API_KEY`. `GEMINI_MODEL` ya trae un modelo estable de nivel gratuito.
2. **Groq (respaldo opcional, solo texto).** Creá una key gratis en <https://console.groq.com/keys> y pegala en `GROQ_API_KEY`.
3. Reiniciá el backend y abrí <http://localhost:8000/api/health/ready>: `ai_provider` debe decir `gemini`.

| Variable | Qué hace |
|---|---|
| `AI_PROVIDER` | `auto` (Gemini → Groq → simulado, según las keys), `gemini`, `groq` o `mock` |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini. Una key sin modelo hace fallar el arranque, a propósito |
| `GROQ_API_KEY`, `GROQ_MODEL` | Groq |
| `MAX_INPUT_CHARS` | Tope del texto del documento que se envía al modelo (recorta) |
| `MAX_IMAGE_BYTES` | Tamaño máximo de imagen (4 MB) |
| `RATE_LIMIT_PER_MIN` | Solicitudes de IA por minuto y por IP (10) |
| `AI_CACHE_TTL_SECONDS` | Caché de respuestas por (acción, texto) |
| `CORS_ORIGINS` | Orígenes permitidos (JSON) |
| `VITE_API_URL`, `VITE_AI_MODE` | Del frontend. Solo las `VITE_*` llegan al navegador |

**Si la IA falla** (cuota agotada, sin red, key inválida), el backend reintenta una vez, prueba el siguiente proveedor y, como último recurso, responde con el modo simulado. La respuesta siempre indica qué proveedor respondió.

> **Privacidad.** En el nivel gratuito de Gemini, Google puede usar el contenido enviado para mejorar sus productos. No subas documentos con datos personales.
>
> **Cuota.** Los límites del nivel gratuito cambian y se consultan en [AI Studio](https://aistudio.google.com/rate-limit) y en la cuenta de Groq. Por eso la app limita consultas por IP, cachea respuestas y recorta el texto enviado.

### 3. Correr

```bash
# Terminal 1: backend → http://localhost:8000
cd backend && uv sync && uv run uvicorn app.main:app --reload

# Terminal 2: frontend → http://localhost:5173  (/api va al backend por el proxy de Vite)
cd frontend && npm install && npm run dev
```

### Chequeos antes de integrar cambios

```bash
cd backend  && uv run pytest && uv run mypy app tests && uv run ruff check && uv run ruff format --check && uv run lint-imports
cd frontend && npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
```

## Especificaciones técnicas

### Arquitectura general

```text
  Navegador (SPA React + Vite)                         Backend (FastAPI, Python 3.14)
 ┌──────────────────────────────────┐   /api/v1    ┌─────────────────────────────────────┐
 │ routes → features → components   │ ───────────▶ │ api → services → crud | providers   │
 │ pdf.js · mammoth (extracción)    │   (solo      │          │            │             │
 │ Web Speech (voz) · localStorage  │    texto)    │   en memoria     Gemini → Groq → Mock│
 │ IndexedDB (texto extraído)       │              │   (semilla)      (nivel gratuito)    │
 └──────────────────────────────────┘              └─────────────────────────────────────┘
```

- **Los documentos se procesan en el navegador.** pdf.js y mammoth extraen el texto; el servidor solo recibe fragmentos de texto o una imagen.
- **El frontend nunca llama a un proveedor de IA.** Las API keys viven solo en el backend.
- **Sin cuentas:** perfil, preferencias, documentos y progreso viven en el navegador (localStorage e IndexedDB).

### Backend

| Tema | Detalle |
|---|---|
| Lenguaje y framework | Python 3.14, FastAPI, Pydantic v2, pydantic-settings |
| Gestor de dependencias | uv |
| IA | google-genai (Gemini), httpx (Groq, API compatible con OpenAI), proveedor simulado |
| Estrategia de IA | Gemini → Groq (solo texto) → simulado; un reintento con espera; caché de respuestas; límite por IP |
| Errores | `application/problem+json` (RFC 9457) |
| Observabilidad | Logs JSON, trazas mínimas con opentelemetry-api |
| Almacenamiento | Repositorio en memoria con datos semilla (interfaz `Repository[T]`, listo para migrar a PostgreSQL) |
| Calidad | pytest (asyncio, pytest-mock, randomly), mypy `--strict`, ruff, import-linter |

Capas (`api → services → crud | providers → models`), verificadas con import-linter.

Endpoints principales: `GET /api/health/live`, `GET /api/health/ready`, `/api/v1/profiles`, `/api/v1/documents`, `POST /api/v1/ai/chat`, `POST /api/v1/ai/describe-image`.

### Frontend

| Tema | Detalle |
|---|---|
| Base | React 19, TypeScript (estricto), Vite, React Compiler |
| Rutas | React Router (modo datos): rutas lazy y middleware que exige perfil configurado |
| Estilos | Tailwind CSS 4 |
| Extracción de documentos | pdf.js (PDF) y mammoth (Word), en el navegador |
| Voz | Web Speech API |
| Tipografías | OpenDyslexic y Atkinson Hyperlegible, autoalojadas (licencia OFL) |
| HTTP | axios, solo dentro de `lib/http` |
| Calidad | ESLint (con reglas de capas), Prettier, Vitest + Testing Library |

Accesibilidad (objetivo WCAG 2.1 AA): enlace «Saltar al contenido», foco visible, objetivos táctiles de 48 px, anuncios por `aria-live`, atajos de teclado, respeto de `prefers-reduced-motion`. El estado y lo pendiente de probar a mano está en [docs/accesibilidad.md](docs/accesibilidad.md).

### Estructura del proyecto

```text
Aula-Clara/
├─ backend/
│  ├─ app/
│  │  ├─ api/          routers y composición de dependencias
│  │  ├─ services/     reglas de negocio e IA
│  │  ├─ crud/         repositorios (en memoria) y caché
│  │  ├─ providers/    Gemini, Groq y simulado
│  │  ├─ models/       entidades
│  │  ├─ schemas/      DTOs de la API
│  │  ├─ prompts/      instrucciones del asistente (Markdown)
│  │  ├─ seed/         datos de ejemplo
│  │  └─ config.py     configuración desde .env
│  └─ tests/           unit/ y api/
├─ frontend/
│  └─ src/
│     ├─ routes/       pantallas (perfil, biblioteca, lector)
│     ├─ features/     preferences · library · assistant · reader
│     ├─ components/   piezas de interfaz reutilizables
│     └─ lib/          http, extractores, voz, almacenamiento
├─ docs/               arquitectura, ADR y checklist de accesibilidad
├─ .env.example        variables de entorno de referencia
└─ README.md
```

Más detalle de las decisiones en [docs/arquitectura.md](docs/arquitectura.md) y [docs/adr/0001-spa.md](docs/adr/0001-spa.md).

## Límites del MVP

- **Formatos:** PDF con texto y Word (.docx). No se leen PowerPoint, Word antiguo (.doc) ni PDF escaneados (sin OCR).
- **Imágenes de PDF:** se muestran al final de su página. En Word quedan en su lugar.
- **Sin sincronización:** borrar los datos del sitio borra la biblioteca.
- **El asistente** recibe el texto del documento recortado a `MAX_INPUT_CHARS`, no la sección que se está viendo.
