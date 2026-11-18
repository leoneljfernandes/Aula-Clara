# Planificación de Nuevos Perfiles de Accesibilidad

> **Objetivo:** Ampliar el alcance de **Aula Clara** más allá de las dificultades visuales de lectura (dislexia, visión reducida y fatiga visual) para incluir cuatro nuevos perfiles con adaptaciones profundas de interacción, representación cromática, táctil y asistencia con IA: **Ceguera**, **Discapacidad Motriz**, **Sordera / Hipoacusia** y **Daltonismo**.

---

## Índice de documentos en `/docs/new_profiles`

1. **[01 · Perfil Ceguera](./01-perfil-ceguera.md)**
   - Lector de pantalla y guía asistida por voz propia.
   - Navegación integral por teclado y comandos de voz (`SpeechRecognition`).
   - Traducción a **Braille en español (Grado 1)**, previsualización en pantalla (Unicode Braille + espejo en tinta) e impresión para impresoras Braille (**archivo `.BRF`** y hoja `@media print` para embossers gráficos / papel microcápsula).
2. **[02 · Perfil Discapacidad Motriz](./02-perfil-discapacidad-motriz.md)**
   - Navegación por teclado de una sola tecla (*single-key*) y control por voz manos libres.
   - Interfaz simplificada con objetivos táctiles y de clic gigantes (`64 px – 72 px`, estándar WCAG 2.2 AAA).
   - Interacción sin *drag & drop* (selección de párrafos con un solo toque/clic y botonera de desplazamiento en pantalla).
3. **[03 · Perfil Sordera / Hipoacusia](./03-perfil-sordera.md)**
   - Adaptación lingüística a **Español Claro / Lectura Fácil** (ISO 24495-1) para personas sordas cuya primera lengua es la Lengua de Señas (LSA).
   - Glosario interactivo automático, resúmenes visuales estructurados y ocultamiento de controles de audio irrelevantes.
   - Herramienta opcional de **Subtitulado en vivo del aula** con asistencia de IA.
4. **[04 · Perfil Daltonismo](./04-perfil-daltonismo.md)**
   - Paleta científica segura **Okabe-Ito** validada matemáticamente para deuteranopía, protanopía, tritanopía y acromatopsia.
   - **Inspector de nombres de color («Lupa cromática»)** sobre gráficos del documento y filtro de **Daltonización** para separar series rojo/verde o azul/amarillo.
   - Descripciones de gráficos con IA que vinculan cada color con su posición espacial y forma.

---

## 1. Visión general y matriz de nuevos perfiles

Actualmente, `PROFILES` en [`frontend/src/features/preferences/config.ts`](../../frontend/src/features/preferences/config.ts) y [`backend/app/seed/profiles.json`](../../backend/app/seed/profiles.json) definen 4 opciones (`dislexia`, `vision`, `fatiga`, `custom`) centradas exclusivamente en variables tipográficas y de color (`ReadingSettings`).

Los cuatro nuevos perfiles requieren pasar de **preferencias solo visuales** a **preferencias multimodales (visuales, cromáticas, auditivas, táctiles, motrices y lingüísticas)**:

| Perfil (`id`) | Nombre visible | Foco principal | Adaptaciones clave |
| :--- | :--- | :--- | :--- |
| `ceguera` | **Ceguera** | Auditivo, táctil (Braille) y sin ratón | Guía por voz automática, lectura automática de respuestas de IA, comandos por voz, navegación estructural por bloques, auto-descripción de imágenes y **traductor/impresor Braille (`.brf` y vista en pantalla)**. |
| `motriz` | **Discapacidad motriz** | Esfuerzo físico mínimo y manos libres | Botones de `64 px+` con separación amplia, layout simplificado, botones de scroll en pantalla, selección de párrafo con 1 clic (sin arrastrar), atajos de 1 sola tecla y control por voz continuo. |
| `sordera` | **Sordera / Hipoacusia** | Visual-espacial y Español Claro | Interfaz 100 % visual (sin controles de voz en alta prioridad), prompts de IA adaptados a **Lectura Fácil / Español Claro**, glosario automático de términos complejos, esquemas visuales y subtitulado en vivo opcional. |
| `daltonismo` | **Daltonismo** | Distinción cromática y gráficos accesibles | Tema **Okabe-Ito** seguro en todas las variantes (deuteranopía, protanopía, tritanopía), **inspector de nombres de color** al pasar el cursor por un gráfico, filtro de realce cromático (daltonización) y descripciones de IA con referencia color ↔ posición. |

---

## 2. Arquitectura transversal compartida

Varios requerimientos se comparten entre perfiles (por ejemplo, **navegación por teclado y voz** se usa tanto en *Ceguera* como en *Discapacidad Motriz*). Para mantener la arquitectura limpia (`lib/` → `components/` → `features/` → `routes/`) y el costo operativo en **cero**, se diseñan módulos transversales en el frontend y una extensión mínima en el backend.

```text
frontend/src/
├─ lib/
│  ├─ speech.ts              (existente: TTS con SpeechSynthesis)
│  ├─ voiceControl.ts        (NUEVO: STT con SpeechRecognition para comandos y dictado)
│  ├─ braille/               (NUEVO: motor de transcripción Braille español + exportador .BRF)
│  │  ├─ spanishTable.ts     (mapa de caracteres, mayúsculas, números y puntuación a puntos 1-6)
│  │  ├─ translator.ts       (texto → Unicode Braille U+2800..U+28FF y ASCII Braille)
│  │  └─ brfExporter.ts      (paginación 40×25 celdas, saltos de página y descarga .brf)
│  ├─ color/                 (NUEVO: soporte cromático para Daltonismo)
│  │  ├─ colorNamer.ts       (RGB → CIELAB → nombre de color en español para gráficos)
│  │  └─ cvdSimulation.ts    (matrices de simulación y filtros SVG de daltonización)
│  └─ hotkeys.ts             (NUEVO: atajos globales, de 1 tecla y navegación por bloques)
├─ features/
│  ├─ preferences/
│  │  └─ config.ts           (ampliación de ReadingSettings, tema okabe y PROFILES con los 4 perfiles)
│  ├─ reader/
│  │  ├─ BrailleModal.tsx    (NUEVO: previsualización Braille en pantalla, espejo e impresión)
│  │  ├─ VoiceCommandBar.tsx (NUEVO: indicador accesible de micrófono y comandos por voz)
│  │  ├─ SimplifiedBar.tsx   (NUEVO: botonera gigante para perfil motriz)
│  │  └─ FigureBlock.tsx     (AMPLIADO: lupa de nombres de color y realce para daltonismo)
│  └─ assistant/
│     └─ LiveCaptions.tsx    (NUEVO: subtítulos en vivo + explicación en Español Claro)
```

### 2.1. Extensión del modelo `ReadingSettings`

En [`frontend/src/features/preferences/config.ts`](../../frontend/src/features/preferences/config.ts) y en el esquema del backend (`backend/app/schemas/profile.py` y `backend/app/models/profile.py`), `ReadingSettings` incorpora banderas ortogonales (que cualquier persona también puede activar manualmente en el paso 2 del wizard «Ajustá los detalles»):

```ts
export type CvdType = "none" | "deuteranopia" | "protanopia" | "tritanopia" | "achromatopsia";

export interface ReadingSettings {
  // Existentes
  theme: ThemeId;             // "claro" | "sepia" | "oscuro" | "contraste" | "okabe"
  font: FontId;
  fontSize: number;
  lineHeight: number;
  rate: number;
  audioFocus: boolean;

  // Nuevas capacidades multimodales
  voiceGuide: boolean;        // Anuncia por voz controles enfocados y respuestas de IA (Ceguera)
  voiceCommands: boolean;     // Habilita control y dictado por micrófono (Ceguera, Motriz)
  brailleEnabled: boolean;    // Muestra herramientas de traducción e impresión Braille (Ceguera)
  uiScale: "normal" | "large";// Botones de 64px+, mayor espaciado y layout simplificado (Motriz)
  singleClickSelect: boolean; // Tocar un párrafo lo selecciona sin arrastrar el mouse (Motriz)
  singleKeyShortcuts: boolean;// Atajos de una sola tecla J/K/Espacio/1-4 fuera de inputs (Motriz, Ceguera)
  plainLanguageAI: boolean;   // IA responde en Español Claro / Lectura Fácil y habilita Glosario (Sordera)
  hideAudioControls: boolean; // Oculta reproductor TTS para limpiar la interfaz (Sordera)
  cvdType: CvdType;           // Ajusta realce cromático e inspector de colores en gráficos (Daltonismo)
}
```

### 2.2. Cambio necesario en `vercel.json` para comandos por voz

Actualmente, en [`vercel.json`](../../vercel.json#L40), la cabecera `Permissions-Policy` bloquea el micrófono en todo el sitio:

```json
"value": "camera=(), microphone=(), geolocation=(), payment=()"
```

Para que la API nativa `SpeechRecognition` del navegador funcione en producción en los perfiles **Ceguera**, **Discapacidad Motriz** y **Sordera (subtitulado)**, se debe cambiar únicamente `microphone=()` por `microphone=(self)`:

```json
"value": "camera=(), microphone=(self), geolocation=(), payment=()"
```

La `Content-Security-Policy` actual no requiere cambios para voz, filtros SVG de daltonismo ni Braille Unicode (todo corre en `'self'`).

---

## 3. Hoja de ruta de implementación recomendada

Para entregar valor incremental sin romper los chequeos existentes (`pytest`, `mypy --strict`, `ruff`, `lint-imports`, `vitest`, `eslint`, `tsc`), se propone este orden en **4 etapas**:

### Etapa 1 · Base de Perfiles, Tema Daltonismo y Navegación por Bloques (Chica)
1. Extender `ReadingSettings`, el tema `okabe` (Okabe-Ito) y `PROFILES` en frontend y backend con los 4 presets nuevos: `ceguera`, `motriz`, `sordera` y `daltonismo` (manteniendo compatibilidad hacia atrás en `localStorage`).
2. Agregar las herramientas de **Daltonismo** en figuras (`colorNamer.ts`, filtros de daltonización en `FigureBlock.tsx` y tests matemáticos de contraste bajo simulación CVD en `config.test.ts`).
3. Implementar la navegación estructural por bloques en el lector (`activeBlock` navegable con teclado `J`/`K` o `Alt+↓`/`Alt+↑`, salto por encabezados `H` y selección de párrafo con 1 clic).

### Etapa 2 · Motor de Voz: Guía Auditiva + Comandos por Voz (Mediana)
1. Crear `lib/voiceControl.ts` sobre `SpeechRecognition` / `webkitSpeechRecognition` con degradación elegante en navegadores sin soporte.
2. Implementar el intérprete local de comandos de voz (reproducir, pausar, siguiente/anterior párrafo, resumir, describir imagen, volver, etc.) y el dictado directo en el chat del asistente.
3. Implementar `voiceGuide` (lectura automática de respuestas del asistente y anuncios de navegación).
4. Actualizar `Permissions-Policy` en `vercel.json`.

### Etapa 3 · Traducción, Vista e Impresión Braille (Mediana)
1. Construir `lib/braille/` con la tabla de signografía Braille en español (Grado 1: alfabeto, vocales acentuadas, `ñ`, `ü`, prefijo de mayúscula `⠨`, prefijo numérico `⠼` y puntuación).
2. Crear el visor `BrailleModal.tsx` con dos modos en pantalla: **Vista Espejo (Braille Unicode + tinta alineada)** y **Vista Plancha ($40 \times 25$ celdas)**.
3. Agregar exportación de archivo estándar **`.BRF` (Braille Ready Format)** para impresoras Braille físicas y hoja de estilos `@media print` calibrada para embossers gráficos / papel microcápsula.

### Etapa 4 · Interfaz Motriz Simplificada y Adaptaciones para Sordera (Mediana)
1. Crear la variante `uiScale: "large"` y `SimplifiedBar.tsx` (botones de `64 px`, scroll por botones grandes en pantalla, prevención de doble clic involuntario).
2. En el backend (`backend/app/prompts/` y `schemas/ai.py`), agregar las acciones `glossary` («Glosario fácil») y `visual_outline` («Esquema visual»), el modificador `plain_language: bool` para **Lectura Fácil / Español Claro** y las instrucciones de referencia Color ↔ Posición en `image_description.md`.
3. Incorporar el modo de **Subtitulado en vivo** para tomar notas accesibles en clase.

---

## Planes de implementación

Los planes ejecutables (hoja de ruta y un plan por subsistema) están en esta misma carpeta. **Donde un plan contradice a los documentos 01–04, manda el plan**: corrige errores de la primera propuesta (ver §7 de la hoja de ruta).

0. [Hoja de ruta](./2026-11-18-perfiles-00-hoja-de-ruta.md)
1. [Catálogo de presets y preferencias](./2026-11-18-perfiles-01-catalogo-y-preferencias.md)
2. [Teclado y voz (Ceguera)](./2026-11-18-perfiles-02-teclado-y-voz.md)
3. [Braille](./2026-11-18-perfiles-03-braille.md)
4. [Discapacidad motriz](./2026-11-18-perfiles-04-motriz.md)
5. [Sordera e hipoacusia](./2026-11-18-perfiles-05-sordera.md)
6. [Daltonismo](./2026-11-18-perfiles-06-daltonismo.md)
