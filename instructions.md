# Prompt · Aula Clara: del MVP en HTML a un proyecto desplegable

> Cómo usarlo: copiá `docs/mvp-referencia.html` y la carpeta `.skills/` en la raíz del repo y pegá este prompt completo en el agente de tu IDE. Está escrito para que el agente proponga un plan primero y construya por fases.

---

## 1. Rol

Sos un ingeniero de software senior especializado en **React + TypeScript**, **Python + FastAPI**, **arquitectura limpia**, **accesibilidad web (WCAG 2.1 AA)** e **integración de modelos de lenguaje**. Trabajás con criterio de MVP: lo mínimo que demuestra la funcionalidad completa, bien estructurado para crecer, sin sobreingeniería.

## 2. Contexto del producto

**Aula Clara** es una plataforma de accesibilidad educativa para estudiantes universitarios con discapacidad visual, dislexia o fatiga visual. El estudiante configura su perfil una vez, sube su material (PDF, Word) y lo lee adaptado: tipografía, tamaño, interlineado y tema de color. Además:

- escucha el texto en voz alta con el párrafo resaltado,
- pide a la IA que describa imágenes y gráficos sin texto alternativo,
- consulta a un asistente de estudio que resume, explica conceptos, arma preguntas de repaso y reformula párrafos con palabras más simples.

Es un MVP académico para demostrar la funcionalidad. **Restricción principal: costo cero** de infraestructura y de IA.

## 3. Fuente de verdad

- `docs/mvp-referencia.html` es el prototipo funcional, una SPA en React con Tailwind en un solo archivo. Es la **referencia de UX, textos, flujos, estados y accesibilidad**. Replicá su comportamiento y su diseño; no lo copies como un único archivo.
- Las respuestas de IA del prototipo están **simuladas** (función `mockReply` y la constante `IMAGE_ANALYSIS`). Tu tarea es reemplazarlas por IA real a través del backend, **conservando el mock como modo de respaldo**.

## 4. Reglas de trabajo (obligatorias)

1. **Antes de escribir código, leé todo `.skills/`.** Esas convenciones (arquitectura, nombres, estructura, estilo, testing, commits) **prevalecen sobre este prompt** cuando haya conflicto. Si algo de este prompt contradice un skill, seguí el skill y avisame.
2. Primero respondé con: (a) un resumen de lo que entendiste del prototipo, (b) el plan por fases de la sección 12, (c) dudas bloqueantes. **Esperá mi confirmación** antes de generar el proyecto.
3. Trabajá por fases. Al cerrar cada una: qué hiciste, cómo probarlo, qué queda pendiente.
4. No inventes versiones de librerías ni identificadores de modelos de IA: **verificá en la documentación oficial vigente** (Vercel, Gemini API, Groq, Vite). Todo identificador de modelo va en variables de entorno, nunca en el código.
5. Nada de secretos en el frontend ni en el repo. Usá `.env.example` con valores vacíos.

## 5. Stack definido

| Capa | Tecnología | Notas |
|---|---|---|
| Frontend | React 18 + **Vite** + TypeScript + Tailwind CSS | SPA estática. Sin NestJS ni Next.js: el backend es FastAPI. |
| Backend | Python 3.12 + **FastAPI** + Pydantic v2 + pydantic-settings | Arquitectura limpia (sección 7). |
| Persistencia | **Sin base de datos en el MVP** | Repositorios en memoria con datos semilla, más `localStorage` en el frontend. Interfaz lista para PostgreSQL. |
| IA | **Gemini API (free tier)**, con **Groq (free tier)** opcional como respaldo de texto, y **Mock** como último recurso | Abstracción de proveedor (sección 8). |
| Voz | **Web Speech API** del navegador | Sin costo y sin backend. |
| Documentos | **pdf.js** y **mammoth.js** en el navegador | La extracción corre en el cliente; el servidor solo recibe texto. |
| Despliegue | **Vercel** (frontend + FastAPI en un proyecto) o **GitHub Pages** (solo frontend) | Sección 10. |

## 6. Estructura del repositorio (monorepo)

```
aula-clara/
├─ .skills/                     # convenciones del equipo (leer primero)
├─ docs/
│  └─ mvp-referencia.html       # prototipo de referencia
├─ frontend/
│  ├─ index.html
│  ├─ vite.config.ts
│  ├─ src/
│  │  ├─ app/                   # App.tsx, providers (contexto global), router por vista
│  │  ├─ features/
│  │  │  ├─ onboarding/         # perfiles y wizard de 2 pasos
│  │  │  ├─ library/            # carga, extracción, documentos recientes
│  │  │  ├─ reader/             # barra de accesibilidad, visor, imágenes con IA
│  │  │  └─ assistant/          # chat, atajos, «explicar más simple»
│  │  ├─ shared/
│  │  │  ├─ ui/                 # Button, Dialog accesible, ProgressBar, ThemeButtons
│  │  │  ├─ hooks/              # useReadAloud, useLocalStorage, useAnnouncer
│  │  │  ├─ lib/                # apiClient.ts, extractors (pdf, docx), storage.ts
│  │  │  └─ config/             # themes.ts, fonts.ts, profiles.ts
│  │  └─ types/
│  └─ .env.example              # VITE_API_URL, VITE_AI_MODE
├─ backend/
│  ├─ app/
│  │  ├─ main.py                # crea la app FastAPI, CORS, monta routers
│  │  ├─ core/                  # config.py (Settings), errors.py, rate_limit.py
│  │  ├─ api/v1/routers/        # health.py, profiles.py, documents.py, ai.py
│  │  ├─ schemas/               # Pydantic: request/response por recurso
│  │  ├─ models/                # entidades de dominio (dataclasses)
│  │  ├─ crud/                  # repositorios: base.py (interfaz), memory.py
│  │  ├─ services/              # ai_service.py, document_service.py
│  │  ├─ providers/llm/         # base.py, gemini.py, groq.py, mock.py, factory.py
│  │  ├─ prompts/               # system prompts versionados en .md
│  │  └─ seed/                  # profiles.json, documents.json
│  ├─ tests/
│  ├─ requirements.txt
│  └─ .env.example
├─ api/
│  └─ index.py                  # entrypoint para Vercel: from backend.app.main import app
├─ vercel.json
├─ .github/workflows/pages.yml  # despliegue opcional a GitHub Pages
└─ README.md
```

Si `.skills/` define otra estructura, usá la de los skills.

## 7. Arquitectura limpia del backend

Flujo de dependencias: **router → service → crud (repositorio) / provider**. Ninguna capa conoce a la de arriba.

- **routers** (`api/v1/routers`): solo HTTP. Validan con schemas, inyectan dependencias con `Depends`, llaman al service y mapean errores a códigos HTTP.
- **schemas**: contratos Pydantic de entrada y salida, separados de los modelos de dominio.
- **models**: entidades de dominio puras (`Profile`, `Document`, `ChatMessage`), sin dependencias de frameworks.
- **crud**: interfaz `Repository[T]` (`get`, `list`, `create`, `update`, `delete`) y una implementación `InMemoryRepository` con datos semilla. Dejá documentado cómo agregar `SqlAlchemyRepository` para PostgreSQL sin tocar services ni routers.
- **services**: lógica de negocio. `AIService` arma el contexto, recorta el texto, elige el prompt según la acción y llama al proveedor. `DocumentService` gestiona los metadatos.
- **providers/llm**: interfaz `LLMProvider` con `chat(system, messages) -> str` y `describe_image(image_bytes, mime, context) -> str`. Hay una implementación por proveedor y una `factory` que elige según configuración.

### Endpoints (prefijo `/api/v1`)

| Método | Ruta | Uso |
|---|---|---|
| GET | `/health` | Estado y proveedor de IA activo (`gemini`, `groq` o `mock`). |
| GET | `/profiles` | Los 4 perfiles predefinidos: dislexia, visión reducida, fatiga visual y personalizado. |
| GET, POST, PATCH, DELETE | `/documents` | CRUD de metadatos (título, tipo, materia, progreso). En memoria. |
| POST | `/ai/chat` | `{action, message?, document_text, selection?}`, donde `action` es `free`, `summarize`, `key_concepts`, `quiz` o `simplify`. Devuelve `{answer, provider}`. |
| POST | `/ai/describe-image` | `multipart/form-data` con la imagen y un `context` opcional. Devuelve `{description, provider}`. |

**Nota de persistencia:** en Vercel las funciones no conservan memoria entre invocaciones. Por eso, en el MVP **la fuente de verdad del usuario es `localStorage`** (perfil, preferencias, documentos y progreso). El CRUD del backend existe para demostrar la arquitectura y funciona en local. Dejalo explícito en el README.

## 8. Estrategia de IA sin costo

1. **Proveedor principal: Gemini API, nivel gratuito.** Usá un modelo de la familia Flash o Flash-Lite, que es multimodal y cubre tanto el chat como la descripción de imágenes. El modelo se configura en `GEMINI_MODEL`; verificá el identificador vigente en la documentación oficial. Usá el SDK oficial actual de Google para Python.
2. **Respaldo opcional: Groq, nivel gratuito**, para texto (chat, resumen, simplificación). Es compatible con la API de OpenAI y se configura en `GROQ_MODEL`.
3. **Mock** con las respuestas actuales del prototipo. Se usa en estos casos:
   - no hay API key,
   - `AI_PROVIDER=mock`,
   - el proveedor responde 429 o falla después de un reintento con backoff.

   La respuesta incluye siempre `provider`, y la UI muestra un indicador discreto ("respuesta simulada").
4. **Protección de la cuota gratuita:**
   - límite por IP (por ejemplo, 10 solicitudes por minuto) en `core/rate_limit.py`,
   - `MAX_INPUT_CHARS` para recortar el texto del documento: se envían la sección visible y la selección, nunca el documento entero si es largo,
   - caché en memoria por hash de `(action, texto)`,
   - imágenes de hasta 4 MB, redimensionadas en el cliente antes de enviarlas.
5. **Seguridad:** las API keys viven solo en variables de entorno del backend (Vercel → Settings → Environment Variables). El frontend nunca llama directo a un proveedor de IA.
6. **Privacidad:** en el nivel gratuito, Google puede usar el contenido enviado para mejorar sus productos. Mostrá un aviso breve en la biblioteca: "No subas documentos con datos personales". Explicalo en el README.

### System prompts (en `backend/app/prompts/`)

- **Asistente de estudio:**
  - español rioplatense, lenguaje claro y oraciones cortas, apto para dislexia;
  - responder **solo con base en el texto del documento recibido**; si la respuesta no está en el texto, decirlo;
  - viñetas cortas para resúmenes y conceptos;
  - exactamente 3 preguntas en `quiz`;
  - en `simplify`, reformular el fragmento sin perder el significado ni agregar información.
- **Descripción de imágenes:** estructura fija:
  1. tipo de imagen,
  2. qué muestra,
  3. datos o valores visibles,
  4. idea principal en una oración.

  No inventar valores ilegibles: si no se leen, decirlo. Máximo 120 palabras, pensado para escucharse en voz alta.

## 9. Frontend: qué conservar del prototipo

- **Estado global** con Context API: vista actual, ajustes de lectura, perfil, documentos y documento abierto. Persistencia en `localStorage` con `try/catch`.
- **Las tres vistas:** Onboarding (wizard de 2 pasos con vista previa en vivo), Biblioteca (drag & drop, procesamiento, recientes con progreso y búsqueda) y Lector en 3 columnas (accesibilidad · visor · asistente).
- **Temas, tipografías y perfiles** con los mismos valores del prototipo: `THEMES`, `FONTS` y `PROFILES`. OpenDyslexic real, autoalojada en `public/fonts` (licencia OFL).
- **Extracción real:** PDF con pdf.js (texto por página, en párrafos) y DOCX con mammoth.js. Las imágenes embebidas del PDF o DOCX se muestran con el botón «Interpretar con IA». PPTX y OCR de PDF escaneados quedan **fuera del MVP**: mostrar un mensaje claro y ofrecer el documento de ejemplo.
- **`useReadAloud`** con Web Speech API: resaltado del párrafo, pausa, velocidad x0,75 / x1 / x1,5 y simulación si no hay voces disponibles.
- **Accesibilidad (no negociable):**
  - foco visible,
  - enlace "Saltar al contenido",
  - diálogos con trampa de foco y cierre con Esc,
  - `aria-live` para anuncios,
  - chat con `role="log"`,
  - objetivos táctiles de 48 px como mínimo,
  - atajos Alt+P, Alt+S, Alt+=, Alt+−, Alt+T y Alt+A,
  - `prefers-reduced-motion`,
  - contraste AA en los 4 temas.
- **`apiClient.ts`** lee `VITE_API_URL`. Si `VITE_AI_MODE=mock` o la API no responde, usa el mock local (las mismas respuestas del prototipo), así el sitio funciona 100 % estático.

## 10. Despliegue (las dos opciones deben funcionar)

**A. Vercel, recomendado (frontend + backend en un proyecto, plan gratuito Hobby)**

- La app FastAPI se expone como Vercel Function desde `api/index.py`. Las rutas `/api/*` van a FastAPI y el resto sirve `frontend/dist` con fallback a `index.html`.
- Antes de escribir `vercel.json`, **consultá la guía oficial vigente de FastAPI en Vercel** y usá la configuración que indique.
- Mantené liviano el bundle de Python, porque las funciones tienen límite de tamaño: nada de OCR ni librerías pesadas en el backend.
- Variables de entorno:

  ```
  AI_PROVIDER, GEMINI_API_KEY, GEMINI_MODEL, GROQ_API_KEY, GROQ_MODEL,
  MAX_INPUT_CHARS, RATE_LIMIT_PER_MIN, ALLOWED_ORIGINS
  ```

**B. GitHub Pages (solo frontend)**

- Workflow `.github/workflows/pages.yml`: build de Vite con `base: '/<nombre-repo>/'` y publicación de `dist`.
- Dos modos:
  - `VITE_AI_MODE=mock`: demo 100 % estática y gratuita;
  - `VITE_API_URL` apuntando al backend desplegado en Vercel, con el dominio de Pages en `ALLOWED_ORIGINS`.

## 11. Calidad mínima

- **Backend:** tests con pytest para services y routers, usando `MockProvider` (ningún test llama a un proveedor real). Tipado completo y manejo de errores con respuestas JSON consistentes.
- **Frontend:** ESLint + Prettier, tipos estrictos y un test de humo de cada vista (Vitest + Testing Library). Verificación manual con teclado y lector de pantalla.
- **README:** qué es, arquitectura (diagrama simple), cómo correr en local (`uvicorn` + `vite`), variables de entorno, despliegue A y B, límites del MVP y cómo pasar a PostgreSQL.

## 12. Plan por fases

1. **Esqueleto:** monorepo, tooling, `.env.example`, health check y despliegue vacío en Vercel funcionando.
2. **Frontend sin IA:** migración del prototipo a componentes y features, con el mock local. Paridad visual y de accesibilidad con `docs/mvp-referencia.html`.
3. **Backend con arquitectura limpia:** schemas, models, repositorios en memoria, services y routers de `profiles` y `documents`, con tests.
4. **IA real:** `LLMProvider` con Gemini, Groq y Mock, system prompts, rate limit, caché y fallback. Conexión del chat y de «Interpretar con IA».
5. **Documentos reales:** extracción de PDF y DOCX en el cliente e imágenes embebidas con descripción por IA.
6. **Despliegue y cierre:** Vercel productivo, workflow de GitHub Pages en modo mock, README y checklist de accesibilidad.

### Definición de terminado

- Un usuario nuevo elige su perfil, sube un PDF real, lo lee adaptado, lo escucha, obtiene la descripción de una imagen y una explicación simplificada, todo en el sitio desplegado y sin costo.
- Si se quita la API key, todo sigue funcionando en modo mock, con el indicador visible.
- Ninguna clave aparece en el bundle del frontend ni en el repositorio.