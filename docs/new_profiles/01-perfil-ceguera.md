# 01 · Perfil Ceguera (`id: "ceguera"`)

## 1. Motivos y objetivos del perfil

Mientras que los perfiles actuales (*Visión reducida* y *Fatiga visual*) asumen que el estudiante mira la pantalla y usa el audio como complemento, una persona **ciega** (o con ceguera legal severa) interactúa con la plataforma **sin referencia visual**:

1. **No usa ratón ni cursores espaciales:** depende al 100 % del teclado, de gestos de su lector de pantalla (NVDA, JAWS, VoiceOver, TalkBack, Orca) o de la voz.
2. **Necesita estructura semántica y orientación constante:** saber en qué sección del apunte está, cuántos bloques o encabezados quedan y recibir automáticamente la lectura de las respuestas del asistente de IA y de las descripciones de los gráficos.
3. **Requiere acceso al código de lectoescritura táctil (Braille):** tanto para líneas braille electrónicas conectadas a la computadora como para **imprimir apuntes físicos en relieve** (mediante impresoras Braille / *embossers* universitarios o papel microcápsula) y permitir que docentes o acompañantes visualicen en pantalla cómo quedará la transcripción.

---

## 2. Investigación técnica de las adaptaciones

### 2.1. Lector de pantalla y navegación asistida por voz

Existen dos escenarios reales para un estudiante con ceguera y la app debe resolver ambos sin que choquen entre sí:

| Escenario | Qué usa la persona | Cómo debe comportarse Aula Clara |
| :--- | :--- | :--- |
| **Escenario A: Usa su propio lector de pantalla (NVDA / VoiceOver / JAWS)** | El sistema operativo ya lee cada elemento enfocado y las regiones `aria-live`. | La app **no debe superponer** su propia voz sobre la del lector al mover el foco con `Tab`. Debe ofrecer *landmarks* impecables, encabezados jerárquicos (`h1`, `h2`), `aria-live="polite"` para respuestas del asistente y botones con etiquetas explícitas. |
| **Escenario B: Computadora sin lector de pantalla instalado (ej. biblioteca o laboratorio universitario)** | No tiene NVDA/JAWS activo; depende del sintetizador integrado del navegador (`SpeechSynthesis`). | Con la opción **«Guía de navegación por voz» (`voiceGuide: true`)**, la app anuncia en voz alta (`speakOnce`) el cambio de pantalla, el control que recibe el foco (`focusin`), el párrafo al que se salta con el teclado y lee automáticamente las respuestas del asistente de IA apenas llegan. |

**Regla de oro para evitar colisión de voces:**
- `voiceGuide` incluye un atajo rápido de silencio instantáneo (**tecla `Control` o `Escape`** cancela cualquier locución en curso con `window.speechSynthesis.cancel()`, igual que hacen NVDA y JAWS) y se puede encender/apagar en cualquier momento con `Alt+G`.

### 2.2. Navegación por teclado y por comandos de voz

#### A. Navegación estructural por teclado en el documento
Hoy el lector (`ReaderScreen.tsx`) solo permite reproducir todo el texto de corrido (`Alt+P`) o detenerlo (`Alt+S`). Para estudiar un apunte universitario, una persona ciega necesita moverse por el texto como quien hojea páginas y secciones:

- **Cursor de bloque activo (`focusedBlockIndex`):** independiente o sincronizado con la reproducción de voz.
- **Atajos de lectura y navegación:**
  - `Alt+P` (o `Espacio` fuera de inputs): Reproducir / Pausar desde el bloque actual.
  - `Alt+→` / `J`: Ir al **siguiente párrafo** y leerlo.
  - `Alt+←` / `K`: Ir al **párrafo anterior** y leerlo.
  - `Alt+H` / `H`: Saltar al **siguiente título o sección (`h2`)** del documento y anunciarlo («Sección 3 de 6: Redes neuronales»).
  - `Alt+I` / `G`: Saltar a la **siguiente figura/gráfico** y disparar (o leer si ya está en caché) su descripción por IA.
  - `Alt+A`: Llevar el foco al cuadro de consulta del asistente de IA.
  - `Alt+M`: Activar/desactivar micrófono para dictar comando o pregunta.
  - `Alt+B`: Abrir el panel de traducción e impresión **Braille**.

#### B. Navegación y dictado por voz (`Web Speech API - SpeechRecognition`)
- **Tecnología:** `window.SpeechRecognition || window.webkitSpeechRecognition`, nativo en Chrome, Edge y Safari, configurado con `lang = "es-AR"`, `interimResults = false`, `continuous = false` (modo *Push-to-Talk* con sonido corto de inicio/fin generado con `AudioContext` Web Audio API para que la persona ciega sepa que el micrófono empezó y terminó de escuchar).
- **Señal auditiva (*earcons* con `AudioContext`):**
  - Una persona ciega no ve el ícono rojo de «Grabando». Se generan dos tonos suaves de 80 ms con `OscillatorNode` (sin archivos MP3 externos): tono ascendente (`440 Hz → 660 Hz`) al abrir micrófono y tono descendente (`660 Hz → 440 Hz`) al cerrar.
- **Intérprete local de intenciones (`lib/voiceControl.ts`):**
  Normaliza el texto reconocido (minúsculas, sin tildes) y evalúa comandos sin gastar llamadas a la IA:
  - `"leer"` | `"reproducir"` | `"continuar"` → `audio.play()`
  - `"pausar"` | `"pausa"` → `audio.pause()`
  - `"detener"` | `"parar"` → `audio.stop()`
  - `"siguiente"` | `"siguiente parrafo"` → avanza un bloque y lo lee
  - `"anterior"` | `"parrafo anterior"` → retrocede un bloque y lo lee
  - `"siguiente seccion"` | `"siguiente titulo"` → salta al próximo `h2`
  - `"mas rapido"` / `"mas lento"` → ajusta `settings.rate`
  - `"resumir"` | `"resumen"` → ejecuta acción rápida `summarize` en el asistente
  - `"conceptos clave"` → ejecuta acción `key_concepts`
  - `"preguntas"` | `"preguntas de repaso"` → ejecuta acción `quiz`
  - `"describir imagen"` | `"interpretar grafico"` → ejecuta descripción de la figura activa
  - `"braille"` | `"traducir a braille"` → abre el diálogo Braille
  - `"preguntar ..."` (cualquier frase que empiece con *"preguntar"* o *"asistente"*) → envía el resto de la frase como consulta libre al asistente de IA y lee la respuesta en voz alta al recibirla.

---

### 2.3. Traducción a Braille, vista en pantalla e impresión física

#### A. Signografía Braille en Español (Grado 1 / Integral)
En hispanoamérica (normativa de la Comisión Braille Española y la Unión Latinoamericana de Ciegos - ULAC), el estándar para textos académicos es el **Braille integral de 6 puntos (Grado 1)**, donde cada carácter se representa en un cajetín de 6 puntos numerados:

```text
1 • • 4
2 • • 5
3 • • 6
```

En Unicode, el bloque **Braille Patterns (`U+2800` a `U+28FF`)** codifica cualquier combinación de puntos sumando a `0x2800` una máscara de bits:
$$\text{codepoint} = \text{0x2800} + b_1 \cdot 1 + b_2 \cdot 2 + b_3 \cdot 4 + b_4 \cdot 8 + b_5 \cdot 16 + b_6 \cdot 32$$

**Reglas específicas del Braille español que implementará `lib/braille/spanishTable.ts`:**
1. **Letras básicas (`a`–`z`):** mapeo estándar internacional.
2. **Letras propias del español y vocales acentuadas:**
   - `ñ` → puntos `1-2-4-5-6` (`⠻`, `U+283B`)
   - `á` → puntos `1-2-3-5-6` (`⠷`, `U+2837`)
   - `é` → puntos `2-3-4-6` (`⠮`, `U+282E`)
   - `í` → puntos `3-4` (`⠌`, `U+280C`)
   - `ó` → puntos `3-4-6` (`⠬`, `U+282C`)
   - `ú` → puntos `2-3-4-5-6` (`⠾`, `U+283E`)
   - `ü` → puntos `1-2-5-6` (`⠳`, `U+2833`)
3. **Mayúsculas:**
   - En Braille español no existe un alfabeto distinto para mayúsculas: se antepone el **prefijo de mayúscula** (puntos `4-6`, `⠨`, `U+2828`) antes de una letra mayúscula (`Aula` → `⠨⠁⠥⠇⠁`).
   - Si una palabra entera de 2 o más letras está en mayúsculas (`PDF`), se antepone **doble signo de mayúscula** (`⠨⠨⠏⠙⠋`).
4. **Números:**
   - Se antepone el **signo generador de número** (puntos `3-4-5-6`, `⠼`, `U+283C`) al inicio de una secuencia numérica, y los dígitos `1`–`9`, `0` usan las letras `a`–`j` (`2026` → `⠼⠃⠚⠃⠋`).
5. **Signos de puntuación:**
   - `.` (`⠲`, punto 3), `,` (`⠂`, punto 2), `;` (`⠆`, puntos 2-3), `:` (`⠒`, puntos 2-5), `¿` / `?` (`⠢`, puntos 2-6), `¡` / `!` (`⠖`, puntos 2-3-5), `-` (`⠤`, puntos 3-6), `«` / `"` (`⠦`, puntos 2-3-6), `(` (`⠷`, puntos 1-2-3-5-6), `)` (`⠾`, puntos 2-3-4-5-6).

#### B. Visualización en pantalla («Cómo sería el texto en Braille»)
El diálogo/vista **`BrailleModal.tsx`** ofrecerá tres modos de visualización en pantalla:
1. **Modo Espejo Interlineado (Didáctico / Revisión):**
   Muestra cada palabra o línea con los puntos Braille Unicode grandes arriba (`28 px`) y el texto original en tinta justo debajo alineado palabra por palabra. Ideal para docentes, familiares o personas con resto visual que están aprendiendo Braille.
2. **Modo Plancha Braille ($40 \times 25$ celdas):**
   Simula exactamente la hoja física de una impresora Braille estándar: líneas de **40 cajetines** y **25 líneas por página**, mostrando los puntos vacíos tenues (`⠀`) y los puntos activos resaltados (`⠿`), con selector de página.
3. **Integración de figuras:**
   Si una figura del documento ya fue descrita con IA, se inserta en el flujo Braille precedida por `[Gráfico N: <descripción>]` para que el apunte en Braille esté completo.

#### C. Cómo imprimir para quien cuenta con la impresora adecuada
Las impresoras Braille reales (*embossers* como **Index Braille Basic-D / Everest-D**, **ViewPlus**, **Romeo/Juliet**, **Braillo**) trabajan de dos maneras, y Aula Clara dará soporte a **ambas**:

1. **Descarga de archivo `.BRF` (Braille Ready Format) — *Estándar universal de impresoras Braille*:**
   - Todas las impresoras Braille y programas de impresión (Duxbury DBT, BrailleBlaster, Index Direct Braille, comando `lp` / utilidad USB de la impresora) reciben archivos `.brf`.
   - Un archivo `.brf` es texto plano ASCII codificado en **Braille ASCII (North American Braille Computer Code)** donde cada carácter ASCII (`A-Z`, `0-9`, símbolos entre `0x20` y `0x5F`) corresponde biunívocamente a una combinación de los 6 puntos del cajetín (por ejemplo, `⠨` puntos 4-6 es `.` en BRF; `⠼` puntos 3-4-5-6 es `#`), formateado con:
     - **Ancho de línea configurable:** `40` caracteres por defecto (ajustable a `32` o `42` según el ancho del carro de la impresora y papel tractor).
     - **Largo de página configurable:** `25` líneas por página (ajustable a `28`), separadas por el carácter de salto de página `Form Feed` (`\x0C`, `^L`).
     - **Corte de palabras inteligente (*word-wrap*):** nunca corta una palabra a mitad sin guion Braille (`-`, puntos 3-6), y nunca deja un título (`h2`) huérfano en la última línea de una página.
2. **Impresión directa desde el navegador (`window.print()`) — *Para embossers con driver gráfico o Papel Microcápsula (Horno Fuser)*:**
   - Muchas instituciones usan impresoras **ViewPlus** (que actúan como impresoras del sistema en Windows/macOS convirtiendo fuentes Braille o puntos negros en relieve) o **papel microcápsula (Swell Paper)** impreso en láser negro y pasado por horno fusor térmico.
   - Al pulsar **«Imprimir plancha Braille»**, se activa un contenedor `#braille-print-sheet` visible únicamente en `@media print`:
     - Oculta toda la interfaz (`header`, `aside`, diálogos).
     - Fija `@page { size: A4 portrait; margin: 15mm; }`.
     - Renderiza las páginas de $40 \times 25$ celdas en **negro puro (`#000000`) sobre blanco (`#FFFFFF`)**, tamaño `24pt` monoespaciado (`line-height: 10mm`, `letter-spacing: 1.5mm`), con `break-after: page` en cada página de 25 líneas.

---

## 3. Plan de implementación paso a paso

### Paso 1: Preset `ceguera` en Preferencias y Backend
- **Archivos a modificar:**
  - [`frontend/src/features/preferences/config.ts`](../../frontend/src/features/preferences/config.ts)
  - [`backend/app/seed/profiles.json`](../../backend/app/seed/profiles.json)
  - [`backend/app/models/profile.py`](../../backend/app/models/profile.py) y [`backend/app/schemas/profile.py`](../../backend/app/schemas/profile.py)
- **Configuración del preset:**
  ```json
  {
    "id": "ceguera",
    "title": "Ceguera",
    "icon": "⠿",
    "description": "Navegación total por teclado y voz, guía hablada y traducción e impresión en Braille.",
    "tags": ["Guía por voz", "Comandos de voz", "Braille (.BRF e impresión)"],
    "preset": {
      "font": "atkinson",
      "font_size": 24,
      "line_height": 1.8,
      "theme": "contraste",
      "audio_focus": true,
      "voice_guide": true,
      "voice_commands": true,
      "braille_enabled": true,
      "single_key_shortcuts": true
    }
  }
  ```

### Paso 2: Motor de traducción Braille y exportador `.BRF` (`frontend/src/lib/braille/`)
- **Archivos nuevos:**
  1. `frontend/src/lib/braille/spanishTable.ts`: Tabla pura de puntos 1–6 para letras, vocales con tilde, `ñ`, `ü`, dígitos, puntuación y prefijos (`CAPS = 0b101000`, `NUM = 0b111100`).
  2. `frontend/src/lib/braille/translator.ts`:
     - `toBrailleUnicode(text: string): string` → convierte cualquier cadena en español a caracteres `U+2800..U+28FF`.
     - `toBrailleTokens(text: string): Array<{ word: string; braille: string }>` → para la vista espejo alineada palabra por palabra.
  3. `frontend/src/lib/braille/brfExporter.ts`:
     - `formatBraillePages(blocks: Block[], cols = 40, rows = 25): string[][]` → divide el documento (incluyendo títulos y descripciones de figuras) en páginas y líneas sin cortar palabras indebidamente.
     - `toBrfFile(pages: string[][]): string` → convierte cada celda Unicode a su equivalente ASCII Braille estándar y une páginas con `\f` (`\x0C`).
     - `downloadBrf(filename: string, content: string): void` → dispara descarga de `<titulo>.brf` con MIME `text/plain;charset=us-ascii`.

### Paso 3: Componente de vista e impresión Braille (`frontend/src/features/reader/BrailleModal.tsx`)
- Diálogo accesible (usando `Dialog.tsx` con trampa de foco) que se abre desde el panel de herramientas o con `Alt+B`:
  - Selector de modo: **«Vista espejo (Tinta + Braille)»** vs. **«Plancha Braille ($40 \times 25$)»**.
  - Configuración de impresora: ancho de línea (`32`, `40`, `42` celdas) y líneas por página (`25`, `28`).
  - Botón **«⬇ Descargar archivo .BRF (para impresora Braille)»**.
  - Botón **«🖨 Imprimir en relieve / Papel microcápsula»** (invoca `window.print()` con la hoja `#braille-print-sheet`).

### Paso 4: Guía por voz y control por voz (`frontend/src/lib/voiceControl.ts`)
- Implementar `VoiceController` sobre `SpeechRecognition` con tonos auditivos de inicio/fin (`AudioContext`).
- Agregar botón y estado de micrófono en el encabezado del lector y en el panel del asistente (`Alt+M` para hablar).
- En `useChat` / `AssistantPanel.tsx`: cuando `settings.voiceGuide` es `true`, al completarse una respuesta del asistente o una descripción de imagen, invocar `speakOnce(answer, settings.rate)` automáticamente.

### Paso 5: Navegación por bloques y figuras en el lector (`ReaderScreen.tsx` y `hooks.ts`)
- Mantener un índice de bloque enfocado (`cursorBlock`), navegable con `J`/`K` o `Alt+↓`/`Alt+↑`, y salto de encabezados con `H` / `Alt+H`.
- Al describir una imagen con IA en `FigureBlock.tsx`, persistir la descripción en el bloque del documento en IndexedDB (`libraryApi.saveFigureDescription(docId, blockId, description)`) para que tanto el lector de pantalla como el traductor Braille la incluyan automáticamente.

---

## 4. Criterios de aceptación y pruebas automatizadas

1. **`lib/braille/translator.test.ts`:**
   - Verifica palabras simples, vocales con tilde (`educación`), la `ñ` (`español`), la `ü` (`pingüino`), prefijo de mayúscula simple (`Aula` → `⠨⠁⠥⠇⠁`), palabra en mayúsculas (`IA` → `⠨⠨⠊⠁`) y números (`2026` → `⠼⠃⠚⠃⠋`).
2. **`lib/braille/brfExporter.test.ts`:**
   - Verifica que ninguna línea supere las 40 celdas, que cada página tenga como máximo 25 líneas y que las páginas estén separadas por `\f`.
3. **`lib/voiceControl.test.ts`:**
   - Con un doble (`vi.fn()`) de `SpeechRecognition`, verifica que frases como *"siguiente párrafo"*, *"pausar"*, *"resumir"* y *"preguntar qué es la mitosis"* disparen las acciones esperadas.
4. **Accesibilidad manual y con test de integración (`app.test.tsx`):**
   - Seleccionar el perfil **Ceguera** en `/perfil`, abrir un documento, navegar entre bloques con el teclado, abrir el visor Braille con `Alt+B` y comprobar la generación del `.brf`.
