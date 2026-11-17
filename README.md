# Aula Clara

Plataforma de accesibilidad educativa para estudiantes universitarios con **discapacidad visual, dislexia o fatiga visual**. El estudiante configura su perfil una vez, sube su material (PDF o Word) y lo lee adaptado: tipografía, tamaño, interlineado y tema de color. Además puede:

- **escuchar** el texto en voz alta con el párrafo resaltado;
- pedir a la IA que **describa imágenes y gráficos** sin texto alternativo;
- consultar a un **asistente de estudio** que resume, explica conceptos, arma preguntas de repaso y reformula párrafos con palabras más simples.

Es un MVP académico. **Restricción principal: costo cero** de infraestructura y de IA.

- Decisiones de arquitectura: [docs/arquitectura.md](docs/arquitectura.md) · [ADR 0001 (SPA)](docs/adr/0001-spa.md)
- Checklist de accesibilidad: [docs/accesibilidad.md](docs/accesibilidad.md)
- Prototipo de referencia (UX, textos, flujos): [docs/mvp-referencia.html](docs/mvp-referencia.html)

## Arquitectura

```text
  Navegador (SPA React 19 + Vite)                      Backend (FastAPI, Python 3.14)
 ┌──────────────────────────────────┐   /api/v1    ┌─────────────────────────────────────┐
 │ routes → features → components   │ ───────────▶ │ api → services → crud | providers   │
 │ pdf.js · mammoth (extracción)    │   (solo      │          │            │             │
 │ Web Speech (voz) · localStorage  │    texto)    │   en memoria     Gemini → Groq → Mock│
 │ IndexedDB (texto extraído)       │              │   (semilla)      (free tier)         │
 └──────────────────────────────────┘              └─────────────────────────────────────┘
        │  VITE_AI_MODE=mock: todo local, sin backend (GitHub Pages)
```

- **Los documentos se procesan en el navegador.** pdf.js y mammoth extraen el texto; el servidor solo recibe fragmentos de texto o una imagen.
- **El frontend nunca llama a un proveedor de IA.** Las API keys viven solo en el backend.
- **Capas del backend** (`api → services → crud | providers → models`), verificadas con import-linter.

## Requisitos

- [uv](https://docs.astral.sh/uv/) (instala Python 3.14 con `uv python install 3.14`).
- Node.js 22 o superior y npm.

## Configuración (`.env`)

Todo secreto y toda configuración de entorno van en **un único `.env` en la raíz**, que no se versiona. `.env.example` es la referencia, con las keys vacías:

```bash
cp .env.example .env
```

Sin API keys, el asistente funciona en **modo simulado** y la interfaz lo indica («Respuesta simulada»).

### Activar la IA real (nivel gratuito)

1. **Gemini (principal, texto e imágenes):** creá una key en <https://aistudio.google.com/apikey> y pegala en `GEMINI_API_KEY`. `GEMINI_MODEL` ya trae un modelo estable y gratuito, verificado el 2026-11-17.
2. **Groq (respaldo opcional, solo texto):** creá una key en <https://console.groq.com/keys> y pegala en `GROQ_API_KEY`.
3. Reiniciá el backend y abrí <http://localhost:8000/api/health/ready>: `ai_provider` debe decir `gemini`.

| Variable | Qué hace |
|---|---|
| `AI_PROVIDER` | `auto` (Gemini → Groq → mock según las keys), `gemini`, `groq` o `mock` |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini. Una key sin modelo hace fallar el arranque, a propósito |
| `GROQ_API_KEY`, `GROQ_MODEL` | Groq |
| `MAX_INPUT_CHARS` | Tope del texto del documento que se manda al modelo (recorta; nunca manda un documento largo entero) |
| `MAX_IMAGE_BYTES` | Tamaño máximo de imagen (4 MB) |
| `RATE_LIMIT_PER_MIN` | Solicitudes de IA por minuto y por IP (10) |
| `AI_CACHE_TTL_SECONDS` | Caché de respuestas por (acción, texto) |
| `CORS_ORIGINS` | Orígenes permitidos (JSON). Sumá el de GitHub Pages si lo usás |
| `VITE_API_URL`, `VITE_AI_MODE` | Del frontend. Solo `VITE_*` llegan al navegador |

**Si la IA falla** (cuota agotada, sin red, key inválida), el backend reintenta una vez con espera, prueba el siguiente proveedor y, como último recurso, responde con el mock. La respuesta siempre incluye `provider`.

> **Privacidad.** En el nivel gratuito de Gemini, Google puede usar el contenido enviado para mejorar sus productos. La biblioteca avisa «No subas documentos con datos personales».
>
> **Cuota.** La documentación oficial no publica los límites del nivel gratuito por modelo: se ven en [AI Studio](https://aistudio.google.com/rate-limit) y en la cuenta de Groq. Por eso hay límite por IP, caché y recorte del texto.

## Correr en local

```bash
# Terminal 1: backend → http://localhost:8000  (docs de la API con DOCS_ENABLED=true: /api/docs)
cd backend && uv sync && uv run uvicorn app.main:app --reload

# Terminal 2: frontend → http://localhost:5173  (/api va al backend por el proxy de Vite)
cd frontend && npm install && npm run dev
```

## Chequeos obligatorios antes de integrar

No hay CI: estos chequeos se corren a mano.

```bash
cd backend  && uv run pytest && uv run mypy app tests && uv run ruff check && uv run ruff format --check && uv run lint-imports
cd frontend && npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
```

## Despliegue

### A. Vercel (frontend + backend en un proyecto, plan Hobby)

1. Importá el repositorio en Vercel. `vercel.json` ya define el build del frontend (`frontend/dist`), el fallback de la SPA y el ruteo de `/api/*` hacia `api/index.py` (la función de FastAPI).
2. En **Settings → Environment Variables** cargá las mismas claves que en `.env`: `APP_ENV=prod`, `ERRORS_BASE_URL`, `CORS_ORIGINS`, `AI_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GROQ_API_KEY`, `GROQ_MODEL` (y las opcionales que quieras ajustar). `VITE_API_URL` se deja vacía: la SPA y la API comparten origen.
3. Si cambian las dependencias del backend, regenerá el archivo que Vercel lee:
   `cd backend && uv export --no-dev --no-hashes --no-emit-project -o ../requirements.txt`.

> ⚠️ **Sin probar en Vercel.** La configuración sigue la documentación oficial vigente, pero este repositorio todavía no se desplegó. Qué verificar en el primer despliegue: que `api/index.py` se detecte como función, que `/api/health/ready` responda, y que las rutas profundas de la SPA (`/leer/d1`) sirvan `index.html`. Ver «Límites» más abajo.

### B. GitHub Pages (solo frontend)

El workflow [.github/workflows/pages.yml](.github/workflows/pages.yml) compila con `base: /<repo>/` y publica `frontend/dist`, con una copia de `index.html` como `404.html` para que funcionen las URLs profundas.

- **Demo 100 % estática:** no hace falta configurar nada. El asistente responde en modo simulado.
- **Con IA real:** definí la variable de repositorio `VITE_API_URL` con la URL del backend en Vercel y sumá el dominio de Pages (`https://<usuario>.github.io`) a `CORS_ORIGINS` en Vercel.

## Límites del MVP

- **Formatos:** PDF con texto y Word (.docx). **No se leen** PowerPoint, Word antiguo (.doc) ni PDF escaneados (sin OCR): la app lo explica y ofrece el documento de ejemplo.
- **Imágenes de PDF:** se muestran al final de su página, porque pdf.js no da la posición exacta. En Word sí quedan en su lugar.
- **Sin cuentas ni sincronización:** el perfil, las preferencias, los documentos y el progreso viven en el navegador (localStorage e IndexedDB). Borrar los datos del sitio los borra.
- **El CRUD de documentos del backend** (`/api/v1/documents`) existe para demostrar la arquitectura y funciona en local. En Vercel las funciones no conservan memoria entre invocaciones, por eso la fuente de verdad es el navegador.
- **El rate limit** es en memoria: en Vercel cada instancia de la función cuenta por separado, así que es un freno de la cuota gratuita y no un límite estricto.
- **El asistente** recibe el texto del documento recortado a `MAX_INPUT_CHARS` (el comienzo, más la selección), no la sección que se está viendo.

## Cómo pasar a PostgreSQL

La interfaz `Repository[T]` (`backend/app/crud/base.py`) ya separa el almacenamiento de las reglas de negocio.

1. Seguí las skills `configuring-sqlalchemy-sessions`, `modeling-postgres-with-sqlalchemy` y `migrating-with-alembic` de `.skills/`.
2. Reemplazá los dataclasses de `app/models/` por modelos de SQLAlchemy 2.0 y agregá `SqlAlchemyRepository` en `app/crud/` con la misma interfaz.
3. Cambiá `InMemoryRepository` por `SqlAlchemyRepository` en `app/api/deps.py` (único lugar que compone repositorios). Los services y los routers no se tocan.
