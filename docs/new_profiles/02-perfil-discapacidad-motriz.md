# 02 · Perfil Discapacidad Motriz (`id: "motriz"`)

> **Estado:** documento de propuesta inicial. Donde contradice a los planes de implementación (ver [README](./README.md)), manda el plan; los archivos citados (`profiles.json`, `models/profile.py`, `schemas/profile.py`) hoy son `presets.json`, `models/preset.py` y `schemas/preset.py`.

## 1. Motivos y objetivos del perfil

Los estudiantes con **discapacidad motriz** (como parálisis cerebral, lesiones medulares, distrofias musculares, temblor esencial, secuelas neuromotoras o amputaciones) enfrentan barreras muy concretas en las aplicaciones web de estudio tradicionales:

1. **Dificultad o imposibilidad para realizar movimientos finos o sostenidos con el ratón:** arrastrar el cursor para seleccionar texto (*drag & drop*), mover controles deslizantes (`<input type="range">`) o girar la rueda del ratón con precisión.
2. **Clics involuntarios o imprecisos:** los botones pequeños o muy juntos provocan activaciones accidentales o dobles clics involuntarios por temblor o espasticidad.
3. **Dificultad para presionar combinaciones de teclas simultáneas:** atajos como `Alt+Shift+P` o `Ctrl+C` resultan inaccesibles si se escribe con una sola mano, con un puntero cefálico (*headstick*), varilla bucal o mediante dispositivos de pulsador único (*switch access*).

El objetivo del perfil **Discapacidad Motriz** en Aula Clara es ofrecer una experiencia de **esfuerzo físico mínimo, objetivos grandes, selección sin arrastre y control manos libres por voz o con una sola tecla**.

---

## 2. Investigación técnica de las adaptaciones

### 2.1. Interfaces simplificadas con botones más grandes (`uiScale: "large"`)

Siguiendo y superando la pauta **WCAG 2.2 Criterio 2.5.8 (Tamaño del objetivo) nivel AAA**, se diseñan cuatro adaptaciones estructurales en la interfaz:

1. **Escala de controles aumentada y espaciado anti-error:**
   - Todos los botones interactivos pasan de `min-h-12` (`48 px`) a **`min-h-16` (`64 px`) o `min-h-18` (`72 px`)**, con tipografía de control en `18 px – 20 px` (`text-lg` / `text-xl`), bordes de `3 px` y separación mínima de **`16 px` (`gap-4`)** entre elementos adyacentes.
   - El anillo de foco (`:focus-visible`) aumenta a **`6 px`** con desplazamiento (`outline-offset: 4px`) para que el recorrido con `Tab` o con pulsadores sea visible desde cualquier distancia.
2. **Reemplazo de controles de arrastre (`range` y scroll manual) por botoneras discretas:**
   - En lugar de exigir usar la rueda del ratón o arrastrar la barra de scroll del navegador, se incorpora una **Barra de Navegación Simplificada (`SimplifiedBar.tsx`)** fija en la parte inferior del visor con botones gigantes:
     - `⬆ Subir` (desplaza media pantalla hacia arriba o retrocede un párrafo).
     - `⬇ Bajar` (desplaza media pantalla hacia abajo o avanza un párrafo).
     - `▶ Leer / ❚❚ Pausar` (lectura en voz alta con un solo toque).
     - `🎙 Voz` (activa escucha de comandos o dictado).
     - `✦ Asistente` (abre/enfoca acciones rápidas de IA).
   - Los deslizadores `<input type="range">` (como el de interlineado o tamaño de fuente) suman botones grandes **`−`** y **`+`** a los lados para no depender de arrastrar el pulgar del control.
3. **Selección de párrafo con un solo clic / toque (`singleClickSelect: true`):**
   - Hoy, pedirle a la IA *«Explicar más simple»* en [`hooks.ts`](../../frontend/src/features/reader/hooks.ts#L21) requiere seleccionar texto arrastrando el ratón al menos 12 caracteres.
   - Con `singleClickSelect: true`, **hacer un solo clic (o presionar `Enter`) sobre cualquier párrafo del documento** selecciona automáticamente ese bloque completo, lo resalta con un borde claro y despliega una barra de acción fija con botones grandes:
     - **«✦ Explicar este párrafo más simple»**
     - **«🔊 Leer desde este párrafo»**
     - **«❓ Hacer una pregunta sobre este párrafo»**
4. **Filtro anti-rebote de clics (Debounce de activación):**
   - En el componente base [`Button.tsx`](../../frontend/src/components/Button.tsx), cuando `uiScale === "large"`, se aplica una ventana de guarda de `350 ms` tras un clic para evitar que un temblor involuntario dispare dos veces seguidas una acción de mutación o conmutación (como iniciar y pausar inmediatamente la lectura).

---

### 2.2. Navegación por teclado de una sola tecla (`singleKeyShortcuts: true`)

Para quienes usan teclado adaptado, protector acrílico de teclado (*keyguard*), varilla cefálica o pulsadores mapeados a teclas:

- **Sin combinaciones `Alt + Tecla` obligatorias:** cuando el foco **no** está dentro de un `<input>`, `<textarea>` o `<select>`, funcionan atajos directos de **una sola pulsación**:
  - `Espacio`: Leer / Pausar el documento.
  - `J` o `Flecha Abajo`: Avanzar al siguiente párrafo (y centrarlo en pantalla automáticamente sin usar la rueda del ratón).
  - `K` o `Flecha Arriba`: Retroceder al párrafo anterior.
  - `Enter` (sobre un párrafo): Seleccionar el párrafo activo para pedir explicación simple.
  - `1`: Ejecutar **«Resumir documento»** en el asistente.
  - `2`: Ejecutar **«Conceptos clave»** en el asistente.
  - `3`: Ejecutar **«Preguntas de repaso»** en el asistente.
  - `4`: Ejecutar **«Explicar más simple»** sobre el párrafo actual.
  - `V`: Activar micrófono para hablar.
- **Cumplimiento de WCAG 2.1.4 (Atajos de teclado de un solo carácter):**
  Los atajos de una sola tecla solo se activan si `singleKeyShortcuts` está encendido en las preferencias del usuario (activo por defecto en los perfiles *Discapacidad Motriz* y *Ceguera*, y desactivable desde el panel de herramientas o el perfil).

---

### 2.3. Navegación y dictado por voz manos libres (`voiceCommands: true`)

Reutiliza el módulo `lib/voiceControl.ts` (compartido con el perfil *Ceguera*), pero incorpora una experiencia visual pensada para personas con discapacidad motriz:

1. **Modo de escucha continua opcional («Manos libres»):**
   - A diferencia del modo *Push-to-Talk* puntual, permite dejar el micrófono escuchando comandos durante la sesión de lectura (`continuous: true` con reinicio automático si el navegador corta por silencio), con un botón grande **«🎙 Manos libres: Activo / Pausado»**.
2. **Píldora visual de confirmación en pantalla (`VoiceCommandBar.tsx`):**
   - Muestra en la parte superior/inferior del lector el estado del micrófono y la transcripción en vivo del último comando reconocido (por ejemplo: `🎙 "Bajar página" ✓`), dando certeza visual inmediata de que la orden fue tomada.
3. **Dictado por voz en el Asistente de IA:**
   - Al lado del campo de texto de `AssistantPanel.tsx`, un botón grande **«🎙 Dictar pregunta»** transcribe lo que el estudiante dice directamente en el input y ofrece enviarlo automáticamente al terminar la frase o decir *"enviar"*.

---

## 3. Plan de implementación paso a paso

### Paso 1: Preset `motriz` en Preferencias y Backend
- **Archivos a modificar:**
  - [`frontend/src/features/preferences/config.ts`](../../frontend/src/features/preferences/config.ts)
  - [`backend/app/seed/profiles.json`](../../backend/app/seed/profiles.json)
  - [`backend/app/models/profile.py`](../../backend/app/models/profile.py) y [`backend/app/schemas/profile.py`](../../backend/app/schemas/profile.py)
- **Configuración del preset:**
  ```json
  {
    "id": "motriz",
    "title": "Discapacidad motriz",
    "icon": "⌖",
    "description": "Botones grandes, interfaz despejada, selección con un toque y control por teclado o voz.",
    "tags": ["Botones grandes (64 px)", "Teclado de 1 tecla", "Control por voz"],
    "preset": {
      "font": "atkinson",
      "font_size": 22,
      "line_height": 1.8,
      "theme": "claro",
      "audio_focus": false,
      "ui_scale": "large",
      "single_click_select": true,
      "single_key_shortcuts": true,
      "voice_commands": true
    }
  }
  ```

### Paso 2: Escala de interfaz grande (`uiScale: "large"`) y protección anti-rebote
- **Archivos a modificar:**
  - [`frontend/src/features/preferences/PreferencesProvider.tsx`](../../frontend/src/features/preferences/PreferencesProvider.tsx): exponer el atributo `data-ui-scale={settings.uiScale}` en el contenedor de tema (`ThemeScope`).
  - [`frontend/src/index.css`](../../frontend/src/index.css): reglas para `[data-ui-scale="large"]` que aumentan el `:focus-visible` a `6px` y fijan objetivos mínimos amplios.
  - [`frontend/src/components/Button.tsx`](../../frontend/src/components/Button.tsx): aplicar altura `min-h-16 px-6 text-lg` cuando `uiScale === "large"` y guarda de `350 ms` contra doble clic involuntario.
  - [`frontend/src/features/reader/ToolsPanel.tsx`](../../frontend/src/features/reader/ToolsPanel.tsx): agregar botones grandes `−` y `+` para ajustar el interlineado sin depender del slider `<input type="range">`.

### Paso 3: Selección de párrafo con un clic y Barra Simplificada (`ReaderScreen.tsx`)
- **Archivos a crear/modificar:**
  - `frontend/src/features/reader/SimplifiedBar.tsx` (nuevo): barra inferior con botones de `64 px` (`⬆ Subir`, `⬇ Bajar`, `▶ Leer`, `🎙 Voz`, `✦ Explicar párrafo`).
  - [`frontend/src/features/reader/DocumentView.tsx`](../../frontend/src/features/reader/DocumentView.tsx): cuando `singleClickSelect` está activo, cada bloque `<p>` y `<h2>` es seleccionable con un clic o `Enter` (`tabIndex={0}`, `role="region"` o interacción directa), fijando ese bloque como `selectedBlock` sin necesidad de arrastrar el ratón.

### Paso 4: Atajos de una sola tecla y control por voz
- **Archivos a crear/modificar:**
  - [`frontend/src/features/reader/hooks.ts`](../../frontend/src/features/reader/hooks.ts): ampliar `useReaderHotkeys` para que, si `settings.singleKeyShortcuts` es `true` y `document.activeElement` no es un campo editable (`INPUT`, `TEXTAREA`, `SELECT`), procese `Space`, `KeyJ`, `KeyK`, `Digit1`–`Digit4` y `KeyV`.
  - `frontend/src/features/reader/VoiceCommandBar.tsx` (nuevo): indicador flotante de escucha y botón de dictado en `AssistantPanel.tsx`.

---

## 4. Criterios de aceptación y pruebas automatizadas

1. **Test de selección sin arrastre (`app.test.tsx`):**
   - Con el perfil **Discapacidad motriz** activo, hacer un solo clic en un párrafo del documento activa el botón **«Explicar este párrafo más simple»** y envía ese párrafo al asistente sin usar `window.getSelection()`.
2. **Test de atajos de una sola tecla (`app.test.tsx`):**
   - Presionar `J` avanza el bloque activo; presionar `1` dispara la acción `summarize` del asistente; escribir `J` o `1` dentro del input del chat **no** dispara atajos.
3. **Test de escala y anti-rebote (`Button.test.tsx`):**
   - Dos clics separados por `50 ms` con `uiScale: "large"` ejecutan `onClick` una sola vez.
