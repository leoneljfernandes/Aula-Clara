<p align="center">
  <img src="frontend/src/assets/logo.png" alt="Logo de Aula Clara" width="120" height="120" />
</p>

# Aula Clara

> *«Inclusión que transforma el aprendizaje. Diferentes formas de aprender, las mismas oportunidades.»*

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

### Nuestros pilares y lemas

El proyecto se guía por tres ejes que resumen por qué existe y qué busca lograr:

- **Enfoque en inclusión:** que ningún formato de archivo deje afuera a un estudiante.
  - *«Aprender sin barreras».*
  - *«La educación, al alcance de todos».*
  - *«Un mundo de aprendizaje para todos».*
  - *«Inclusión que transforma el aprendizaje».*
- **Enfoque en personalización:** que el material se adapte a la persona, y no la persona al material.
  - *«Cada forma de aprender importa».*
  - *«Aprender a tu manera, sin límites».*
  - *«Un aprendizaje para cada persona».*
  - *«Diferentes formas de aprender, las mismas oportunidades».*
- **Enfoque en tecnología e innovación:** poner la inteligencia artificial y las herramientas abiertas al servicio de la accesibilidad real.
  - *«La tecnología que hace la educación más accesible».*
  - *«Inteligencia que incluye, educación que transforma».*
  - *«Innovación para aprender sin límites».*

## Open source

Es una herramienta **abierta y libre**. Invito a la comunidad a usarla, copiarla, adaptarla y mejorarla para quien la necesite: estudiantes, docentes, instituciones y desarrolladores. Si te sirve, usala; si encontrás un problema o tenés una idea, abrí un issue o un pull request.

## Levantarlo en local

### Requisitos

- [uv](https://docs.astral.sh/uv/) (instala Python 3.14 con `uv python install 3.14`).
- Node.js 22 o superior y npm.

### 1. Configuración (`.env`)

La configuración de entorno va en **un único `.env` en la raíz**, que no se versiona. `.env.example` es la referencia:

```bash
cp .env.example .env
```

El servidor **no necesita ninguna API key de IA**: cada persona usa la suya (ver el paso 2).

| Variable | Qué hace |
|---|---|
| `CORS_ORIGINS` | Orígenes permitidos (JSON) |
| `MAX_INPUT_CHARS` | Tope del texto del documento que se envía al modelo (recorta) |
| `MAX_IMAGE_BYTES` | Tamaño máximo de imagen (4 MB) |
| `RATE_LIMIT_PER_MIN` | Consultas de IA por minuto y por IP (10) |
| `AI_CACHE_TTL_SECONDS` | Caché de respuestas, separada por key y modelo |
| `AI_TIMEOUT_SECONDS` | Tiempo máximo de espera al proveedor (20 s; máximo 25, para entrar en los 30 s de una función de Vercel) |
| `SEALING_KEY` | **Recomendada.** Clave secreta del servidor para guardar la key de cada persona en una cookie cifrada que la página no puede leer. Sin ella funciona igual, con la key en el navegador. Ver abajo |
| `SEALING_KEY_PREVIOUS` | Opcional: la clave anterior, para rotar sin que nadie tenga que volver a cargar su key |
| `AI_SESSION_HOURS`, `AI_SESSION_REMEMBER_DAYS` | Vida de la cookie: 12 horas, o 30 días con «Recordar en este dispositivo» |
| `VITE_API_URL` | Del frontend: URL del backend si no comparte origen. Solo las `VITE_*` llegan al navegador |

**Key sellada (`SEALING_KEY`).** Es un secreto **del servidor**, no una key de IA: sirve para cifrar la key que cada persona carga, y así guardarla en una cookie `HttpOnly` que ni la propia página puede leer. Generala una vez y pegala en tu `.env`:

```bash
cd backend && uv run python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

En producción va como variable de entorno del servidor, nunca en el repositorio. Si no la definís, todo funciona igual pero la key queda en el navegador (menos protegida). Detalle y límites en el [ADR 0003](docs/adr/0003-key-sellada-en-cookie.md).

### 2. Usar la IA con tu propia API key (gratis o de pago)

Aula Clara **no trae una key de IA propia**: cada persona usa la suya, de alguno de estos siete proveedores. Cinco tienen uso gratuito y ninguno de ellos pide tarjeta para empezar. **OpenAI (ChatGPT) y Anthropic (Claude) no tienen uso gratuito**: se pagan por uso, con saldo prepago, y conviene poner un límite de gasto mensual bajo en su consola.

| Proveedor | Qué necesitás para registrarte | Uso gratuito | Lee imágenes |
|---|---|---|---|
| **Google Gemini** | Cuenta de Google | Límites diarios por modelo | Sí (modelos `gemini-*`) |
| **Anthropic (Claude)** | Email o Google, más una tarjeta para comprar crédito | **No tiene**: se paga por uso | Sí (todos los modelos) |
| **OpenAI (ChatGPT)** | Email o Google, más una tarjeta para cargar saldo | **No tiene**: se paga por uso | Sí (los `gpt-4o`, `gpt-4.1`, `gpt-5`…) |
| **Groq** | Email, Google o GitHub | Límites por minuto y por día | Algunos modelos |
| **OpenRouter** | Email, Google o GitHub | Los modelos marcados «gratis», con límite diario | Según el modelo |
| **Mistral AI** | Email o Google, más un teléfono para verificar | Plan «Experiment» | Algunos modelos |
| **NVIDIA Build** | Email (cuenta de NVIDIA) | Créditos iniciales limitados | Algunos modelos |

Si no sabés cuál elegir, empezá por **Google Gemini**: con una cuenta de Google se resuelve en dos minutos y también describe imágenes.

**Cómo conseguir la key.** La app trae una **guía paso a paso** para cada proveedor: crear la cuenta, iniciar sesión, generar la key y qué hacer si algo falla. Se abre desde «Configurar IA» y también está en **`/ayuda/ia`** (<http://localhost:5173/ayuda/ia> en local), sin necesidad de haber hecho el onboarding. Los textos viven en [`frontend/src/features/assistant/providers.ts`](frontend/src/features/assistant/providers.ts).

**Cómo configurarla en la app:**

1. Abrí un documento y, en el panel del asistente, tocá **«Configurar IA»**.
2. Elegí el proveedor. Si todavía no tenés key, desplegá «¿No tenés una? Cómo conseguir tu key…» y seguí los pasos.
3. Pegá la key y tocá **«Probar key y ver modelos»**. La app la valida con el proveedor y te muestra los modelos que esa key puede usar, listados en vivo.
4. Elegí un modelo y tocá **«Guardar»**. Para «Interpretar con IA», elegí uno que diga «lee imágenes». En OpenRouter, dejá marcado «Mostrar solo modelos gratuitos».

Podés cambiar de proveedor o de modelo cuando quieras con «Cambiar», en el mismo panel. Cada respuesta indica qué proveedor y qué modelo la generó.

**Dónde queda tu key.**

- **Con `SEALING_KEY` en el servidor:** queda en una **cookie cifrada que la página no puede leer** (`HttpOnly`). Solo el servidor la abre, y solo para hacer tus consultas. Aunque la página sufriera un ataque, el código malicioso no puede llevarse tu key. La app solo recuerda en el navegador tu proveedor y tu modelo. Como la key no se puede mostrar, «Configurar IA» te deja cambiar el modelo, pegar una key nueva o borrarla.
- **Sin `SEALING_KEY`, o si tu navegador no acepta la cookie** (por ejemplo, con la web y el servidor en sitios distintos): queda en tu navegador, y la app te lo avisa al guardar.
- En los dos casos se borra al cerrar la pestaña o el navegador (como máximo a las 12 horas), salvo que marques «Recordar en este dispositivo» (30 días). «Borrar mi key» la borra del navegador y del servidor.
- El servidor **no la guarda en ningún lado** y la tacha de sus logs.
- **Para que una key perdida no pueda hacer daño**, usá una key solo para Aula Clara, en el plan gratuito y sin tarjeta ni saldo: lo máximo que podrían gastar es tu cuota gratuita. La guía de la app lo explica proveedor por proveedor.
- El diseño completo, y lo que no se resuelve, está en el [ADR 0003](docs/adr/0003-key-sellada-en-cookie.md) y en [docs/seguridad.md](docs/seguridad.md).

**Si algo falla**, la app explica qué pasó y qué hacer, con un mensaje distinto para cada caso: key rechazada o vencida, cuota por minuto, por día o sin saldo (con cuánto esperar, si el proveedor lo informa), texto o imagen demasiado grandes, bloqueo por filtros de seguridad, modelo que no existe o no lee imágenes, cuenta sin acceso o sin soporte en tu región, modelo que se quedó sin respuesta, proveedor saturado o lento, y también la red caída, el backend sin configurar y los límites de Vercel. Cuando el proveedor da un motivo exacto, se muestra. Si el modelo corta la respuesta por su límite de largo, la app lo avisa. Nunca inventa una respuesta. **NVIDIA Build** no permite comprobar la key de antemano: si está mal, lo vas a ver en la primera consulta.

> **Privacidad.** En los usos gratuitos, el proveedor puede usar lo que le mandes para mejorar o entrenar sus modelos (Google, el plan «Experiment» de Mistral y algunos modelos gratuitos de OpenRouter lo dicen explícitamente). No subas documentos con datos personales.
>
> **Cuota.** Cada proveedor fija sus límites gratuitos y los muestra en tu cuenta, y pueden cambiar. La app recorta el texto enviado, cachea respuestas y limita las consultas por IP.

#### Agregar otro proveedor

Si el proveedor tiene una API compatible con OpenAI, alcanza con tres cambios y sus tests:

1. **Backend:** una entrada en `SPECS`, en [`openai_compatible.py`](backend/app/providers/llm/openai_compatible.py). Ahí va la URL base, cómo se valida la key y el formato de imagen.
2. **Backend:** su nombre en `AIProviderName`, en [`models/chat.py`](backend/app/models/chat.py).
3. **Frontend:** su ficha en `PROVIDERS`, en [`providers.ts`](frontend/src/features/assistant/providers.ts), con el paso a paso para la guía.

La URL base es una lista cerrada a propósito: la persona elige un proveedor, nunca una URL.

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
cd frontend && npm run audit:prod   # vulnerabilidades en lo que llega al navegador
cd backend  && uv export --no-dev --no-hashes --no-emit-project | uvx pip-audit -r /dev/stdin
```

## Especificaciones técnicas

### Arquitectura general

```text
  Navegador (SPA React + Vite)                         Backend (FastAPI, Python 3.14)
 ┌──────────────────────────────────┐   /api/v1    ┌─────────────────────────────────────┐
 │ routes → features → components   │ ───────────▶ │ api → services → crud | providers   │
 │ pdf.js · mammoth (extracción)    │   (solo      │          │            │             │
 │ Web Speech (voz) · localStorage  │    texto)    │   en memoria   5 proveedores de IA   │
 │ IndexedDB (texto extraído)       │              │   (semilla)      (nivel gratuito)    │
 └──────────────────────────────────┘              └─────────────────────────────────────┘
```

- **Los documentos se procesan en el navegador.** pdf.js y mammoth extraen el texto; el servidor solo recibe fragmentos de texto o una imagen.
- **El frontend nunca llama directo a un proveedor de IA.** Manda la key de la persona al backend en cada consulta; el backend hace el pedido y no la guarda.
- **Sin cuentas:** preferencias, documentos y progreso viven en el navegador (localStorage e IndexedDB).

### Backend

| Tema | Detalle |
|---|---|
| Lenguaje y framework | Python 3.14, FastAPI, Pydantic v2, pydantic-settings |
| Gestor de dependencias | uv |
| IA | google-genai (Gemini); httpx para Claude (API Messages de Anthropic) y para OpenAI, Groq, OpenRouter, Mistral y NVIDIA Build (API compatible con OpenAI) |
| Estrategia de IA | La key y el modelo de cada persona viajan en headers (`X-AI-*`); modelos listados en vivo desde el proveedor; un reintento ante errores transitorios; caché separada por key; límite por IP |
| Errores | `application/problem+json` (RFC 9457) |
| Observabilidad | Logs JSON, trazas mínimas con opentelemetry-api |
| Almacenamiento | Repositorio en memoria con datos semilla (interfaz `Repository[T]`, listo para migrar a PostgreSQL) |
| Calidad | pytest (asyncio, pytest-mock, randomly), mypy `--strict`, ruff, import-linter |

Capas (`api → services → crud | providers → models`), verificadas con import-linter.

Endpoints principales: `GET /api/health/live`, `GET /api/health/ready`, `GET /api/v1/presets`, `/api/v1/documents`, `POST /api/v1/ai/chat`, `POST /api/v1/ai/describe-image`.

### Frontend

| Tema | Detalle |
|---|---|
| Base | React 19, TypeScript (estricto), Vite, React Compiler |
| Rutas | React Router (modo datos): rutas lazy y middleware (`requireOnboarding`) que exige haber hecho el onboarding |
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
│  │  ├─ providers/    Gemini, Claude y compatibles con OpenAI (OpenAI, Groq, OpenRouter, Mistral, NVIDIA)
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
├─ docs/               arquitectura, ADR, checklist de accesibilidad y mejoras pendientes
├─ .env.example        variables de entorno de referencia
└─ README.md
```

Más detalle de las decisiones en [docs/arquitectura.md](docs/arquitectura.md), [ADR 0001 (SPA)](docs/adr/0001-spa.md) y [ADR 0002 (API key por persona)](docs/adr/0002-api-key-por-usuario.md), [ADR 0003 (key sellada en cookie)](docs/adr/0003-key-sellada-en-cookie.md) y [ADR 0004 (catálogo de presets)](docs/adr/0004-catalogo-de-presets.md). El modelo de seguridad, qué queda sin resolver y las dependencias están en [docs/seguridad.md](docs/seguridad.md). Lo que viene (cuentas, base de datos, archivos y RAG) está planificado en [docs/mejoras-pendientes.md](docs/mejoras-pendientes.md).

## Límites del MVP

- **Formatos:** PDF con texto y Word (.docx). No se leen PowerPoint, Word antiguo (.doc) ni PDF escaneados (sin OCR).
- **Imágenes de PDF:** se muestran al final de su página. En Word quedan en su lugar.
- **Sin sincronización:** borrar los datos del sitio borra la biblioteca.
- **El asistente** recibe el texto del documento recortado a `MAX_INPUT_CHARS`, no la sección que se está viendo. La búsqueda en todo el documento (RAG) está planificada en [docs/mejoras-pendientes.md](docs/mejoras-pendientes.md).
- **Sin key no hay asistente:** cada persona necesita su propia API key: gratuita (Gemini, Groq, OpenRouter, Mistral o NVIDIA Build) o de pago (Claude de Anthropic o ChatGPT de OpenAI).
