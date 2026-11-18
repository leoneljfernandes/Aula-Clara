# 02 · Perfil Discapacidad Motriz (`id: "motriz"`)

> **Estado:** construido por el [plan 04](./2026-11-18-perfiles-04-motriz.md) (interfaz grande, filtro de clics, elegir un párrafo con un clic, barra simplificada y preset) sobre el teclado y la voz del [plan 02](./2026-11-18-perfiles-02-teclado-y-voz.md). Donde este documento contradice a los planes (ver [README](./README.md)), manda el plan; los archivos citados (`profiles.json`, `models/profile.py`, `schemas/profile.py`) hoy son `presets.json`, `models/preset.py` y `schemas/preset.py`.

## 1. Motivos y objetivos del perfil

Los estudiantes con **discapacidad motriz** (como parálisis cerebral, lesiones medulares, distrofias musculares, temblor esencial, secuelas neuromotoras o amputaciones) enfrentan barreras muy concretas en las aplicaciones web de estudio tradicionales:

1. **Dificultad o imposibilidad para realizar movimientos finos o sostenidos con el ratón:** arrastrar el cursor para seleccionar texto (*drag & drop*), mover controles deslizantes (`<input type="range">`) o girar la rueda del ratón con precisión.
2. **Clics involuntarios o imprecisos:** los botones pequeños o muy juntos provocan activaciones accidentales o dobles clics involuntarios por temblor o espasticidad.
3. **Dificultad para presionar combinaciones de teclas simultáneas:** atajos como `Alt+Shift+P` o `Ctrl+C` resultan inaccesibles si se escribe con una sola mano, con un puntero cefálico (*headstick*), varilla bucal o mediante dispositivos de pulsador único (*switch access*).

El objetivo del perfil **Discapacidad Motriz** en Aula Clara es ofrecer una experiencia de **esfuerzo físico mínimo, objetivos grandes, selección sin arrastre y control manos libres por voz o con una sola tecla**.

---

## 2. Investigación técnica de las adaptaciones

### 2.1. Interfaces simplificadas con botones más grandes (`uiScale: "large"`) (hecho, plan 04)

**Criterios WCAG.** El tamaño mínimo de objetivo es el criterio **2.5.8 nivel AA (24 px)**; el **2.5.5 nivel AAA** pide 44 px. Los 64 px de este perfil son una decisión de diseño que supera a los dos, no un número de WCAG. Los otros criterios que importan acá son el **2.5.7** (movimientos de arrastre: toda acción de arrastre tiene una alternativa de un solo puntero) y el **2.4.11** (el foco no queda tapado por contenido fijo).

Cuatro adaptaciones:

1. **Escala de controles aumentada** (ajuste «Tamaño de los botones»: *Normal* o *Grandes y pantalla simplificada*).
   - `ThemeScope` publica `data-ui-scale="normal" | "large"` en su `div` raíz. `index.css` define la variante de Tailwind `large-ui:` (`@custom-variant large-ui (&:where([data-ui-scale="large"] *))`), así `components/` reacciona sin depender de `features/`. `Button` suma `large-ui:min-h-16 large-ui:px-6 large-ui:text-xl large-ui:border-[3px]`.
   - Un bloque de CSS global, fuera de capas, es el respaldo para todo lo que no pasa por `Button`: botones, enlaces, `select` y `summary` de 64 px de alto como mínimo, casillas y radios de 32 × 32 px, 16 px entre los controles de un `role="group"` y anillo de foco de 6 px con 4 px de separación.
2. **Pantalla simplificada.** Con `uiScale: "large"`, a cualquier ancho, el panel de herramientas queda plegado detrás del botón «⚙ Herramientas» y el lector tiene dos columnas en escritorio (documento y asistente) y una en el celular.
3. **Barra simplificada fija** (`features/reader/ReaderBottomBar.tsx`, no `SimplifiedBar.tsx`): un `<nav aria-label="Barra simplificada">` abajo con «⬆ Anterior», «⬇ Siguiente» (mueven el cursor de bloque, como `K` y `J`), «▶ Leer» o «❚❚ Pausar» (la lectura arranca desde el bloque del cursor), «🎙 Voz» (solo con los comandos de voz activos y un navegador que reconozca voz) y «✦ Asistente» (enfoca el chat). Mientras es visible, `main#contenido` tiene `pb-36` y `scroll-pb-36`, así el foco nunca queda tapado. Los deslizadores del panel de herramientas ya tienen botones `−` y `+` (el `Stepper` del plan 01), que son la alternativa al arrastre.
4. **Elegir un párrafo con un clic** (`clickToSelect`, no `singleClickSelect`): un clic o `Enter` sobre un párrafo o título lo elige (`data-selected="true"` y un borde de 4 px), sin arrastrar el mouse. Si hay una selección de texto (arrastrar sí sigue funcionando), el clic no elige el bloque. La barra suma la fila de acciones: «✦ Explicar este párrafo más simple», «🔊 Leer desde este párrafo», «❓ Preguntar sobre este párrafo» y «✕ Quitar selección». «Preguntar» enfoca el chat con el párrafo como contexto de la pregunta libre. La tecla `4` explica el párrafo elegido o, si no hay, el del cursor. Con `clickToSelect` el botón flotante «Explicar más simple» se reemplaza por esta barra, que no desaparece al hacer scroll: el texto arrastrado también tiene sus acciones ahí.

**Filtro de clics dobles involuntarios** (`clickGuard`: `off` = 0 ms, `normal` = 350 ms, `strong` = 700 ms). No vive en `Button` ni depende de `uiScale`: es un listener de `click` del documento en fase de captura (`lib/clickGuard.ts`) que instala `ThemeScope`. Ignora un segundo clic **del puntero** (`event.detail > 0`) sobre el **mismo** elemento interactivo; Enter y Espacio (`detail === 0`) nunca se filtran.

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

Reutiliza el módulo `lib/voice/` del plan 02 (compartido con el perfil *Ceguera*), pero incorpora una experiencia visual pensada para personas con discapacidad motriz:

1. **Modo de escucha continua opcional («Manos libres»):**
   - A diferencia del modo *Push-to-Talk* puntual, permite dejar el micrófono escuchando comandos durante la sesión de lectura (`continuous: true` con reinicio automático si el navegador corta por silencio), con un botón grande **«🎙 Manos libres: Activo / Pausado»**.
2. **Píldora visual de confirmación en pantalla (`VoiceCommandBar.tsx`):**
   - Muestra en la parte superior/inferior del lector el estado del micrófono y la transcripción en vivo del último comando reconocido (por ejemplo: `🎙 "Bajar página" ✓`), dando certeza visual inmediata de que la orden fue tomada.
3. **Dictado por voz en el Asistente de IA:**
   - Al lado del campo de texto de `AssistantPanel.tsx`, un botón grande **«🎙 Dictar pregunta»** transcribe lo que el estudiante dice directamente en el input y ofrece enviarlo automáticamente al terminar la frase o decir *"enviar"*.

---

## 3. Cómo quedó construido

### Paso 1: Preset `motriz` en el catálogo (hecho, plan 04)
- Está en [`backend/app/seed/presets.json`](../../backend/app/seed/presets.json) y el frontend lo recibe por `GET /api/v1/presets`.
  ```json
  {
    "id": "motriz",
    "title": "Discapacidad motriz",
    "icon": "⌖",
    "description": "Botones grandes, pantalla despejada, elegir párrafos con un toque y control por teclado o por voz.",
    "tags": ["Botones grandes", "Atajos de una tecla", "Párrafos con un toque"],
    "settings": {
      "font": "atkinson", "font_size": 22, "line_height": 1.8, "theme": "claro", "audio_focus": false,
      "ui_scale": "large", "click_to_select": true, "click_guard": "normal",
      "single_key_shortcuts": true, "voice_commands": "push"
    }
  }
  ```
- Diferencias con la propuesta inicial: `voice_commands` es un modo (`"push"`), no un booleano; `click_to_select` reemplaza a `single_click_select`; y el filtro de clics (`click_guard`) es un ajuste propio en `"normal"`.

### Paso 2: Escala grande y filtro de clics (hecho, plan 04)
- `PreferencesProvider.tsx` (`ThemeScope`: `data-ui-scale` e instalación del filtro), `index.css` (variante `large-ui:` y respaldo global), `components/Button.tsx` (variante `large-ui:`) y `lib/clickGuard.ts`.

### Paso 3: Elegir un párrafo y barra simplificada (hecho, plan 04)
- `features/reader/DocumentView.tsx` (los bloques `p` y `h2` se eligen con un clic o `Enter`, sin `role="region"`: el cursor de bloque del plan 02 ya les da foco), `ReaderBottomBar.tsx` y `ReaderScreen.tsx` (estado `selectedBlock`).

### Paso 4: Atajos de una sola tecla y voz (hecho, plan 02)
- Detalle en [`01-perfil-ceguera.md`](./01-perfil-ceguera.md) §2.1 y §2.2. El botón ▶ del panel de herramientas, el «▶ Leer» de la barra y `Alt+P` arrancan todos desde el bloque del cursor.

---

## 4. Criterios de aceptación y pruebas automatizadas

1. **Selección sin arrastre (`app.test.tsx`, «elegir un párrafo con un clic»):** un clic o `Enter` elige el párrafo; «Explicar» y «Preguntar» lo mandan al asistente como contexto sin usar una selección de texto; arrastrar no elige el bloque; la tecla `4` actúa sobre el elegido.
2. **Interfaz grande (`Button.test.tsx` y `app.test.tsx`):** `Button` lleva la variante `large-ui:`; con `uiScale: "large"` el panel de herramientas queda plegado y `data-ui-scale` es `large`; con `normal` se ve en escritorio.
3. **Filtro de clics (`lib/clickGuard.test.ts` y `app.test.tsx`):** el segundo clic del puntero dentro del intervalo se ignora, el teclado y otro botón no, y desinstalarlo lo apaga; con `clickGuard: "normal"` dos clics seguidos en «⚙ Herramientas» dejan el panel abierto.
4. **Barra simplificada (`app.test.tsx`):** mueve el cursor, lee desde el cursor, enfoca el chat, no ofrece «Voz» con los comandos apagados y reserva `pb-36` solo mientras es visible.
5. **Backend:** `tests/api/test_presets.py` y `tests/unit/test_seed.py` verifican que el catálogo incluye `motriz`, con `ui_scale` en `"large"`; el contrato del frontend verifica que conoce sus ajustes.

La prueba manual con navegador real sigue pendiente: ver la lista en [`docs/accesibilidad.md`](../accesibilidad.md).
