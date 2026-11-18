# 04 · Perfil Daltonismo (`id: "daltonismo"`)

## 1. Motivos y objetivos del perfil

El **daltonismo** (deficiencia en la visión del color o *CVD*) afecta aproximadamente al **8 % de los hombres y al 0,5 % de las mujeres**. En el ámbito universitario presenta una barrera cotidiana que suele pasar desapercibida:

1. **Gráficos, mapas y diagramas inaccesibles en los apuntes:**
   - Gran parte de los gráficos en PDF y Word (curvas de funciones, gráficos de barras y de torta, mapas temáticos, diagramas químicos o biológicos) distinguen sus series **únicamente por color** (típicamente rojo vs. verde, o azul vs. violeta).
   - Además, el texto del apunte suele referirse a la figura diciendo *«como muestra la curva roja en comparación con la curva verde»*, dejando al estudiante sin forma de saber cuál es cuál.
2. **Pérdida de luminancia y contraste en protanopía:**
   - En la **protanopía / protanomalía** (deficiencia al rojo), los tonos rojos y naranjas oscuros no solo cambian de matiz, sino que se perciben **mucho más oscuros** (casi negros), haciendo ilegibles bordes de foco, alertas o resaltados rojizos sobre fondos oscuros o sepia.
3. **Diferentes variantes de daltonismo:**
   - **Deuteranomalía / Deuteranopía** (deficiencia al verde, la más frecuente): confusión entre rojo/verde/marrón y azul/púrpura.
   - **Protanomalía / Protanopía** (deficiencia al rojo): confusión rojo/verde más oscurecimiento del extremo cálido.
   - **Tritanomalía / Tritanopía** (deficiencia al azul-amarillo): confusión entre azul/verde y amarillo/violeta.
   - **Acromatopsia / Monocromatismo**: visión únicamente en escala de luminancia (grises).

El objetivo del perfil **Daltonismo** en Aula Clara es garantizar una **interfaz con paletas científicamente seguras (Okabe-Ito)**, **herramientas interactivas para identificar y realzar colores en los gráficos del documento** y **descripciones de imágenes con IA que vinculen cada color con su posición y forma**.

---

## 2. Investigación técnica de las adaptaciones

### 2.1. Paleta científica segura (Okabe-Ito) y sub-perfiles por tipo de CVD

En [`frontend/src/features/preferences/config.ts`](../../frontend/src/features/preferences/config.ts), se incorpora:
1. **Un nuevo tema `okabe` («Daltonismo seguro · Okabe-Ito»):**
   - Basado en la paleta universal de **Masataka Okabe y Kei Ito**, diseñada específicamente para mantener máxima distancia perceptual tanto en visión tricromática como bajo protanopía, deuteranopía y tritanopía:
     - Fondo claro de alto descanso (`#FAFAFA`) y texto negro profundo (`#0F172A`).
     - Acento principal en **Azul Okabe (`#0072B2`)** con texto `#FFFFFF`.
     - Foco visible en **Bermellón / Naranja Okabe (`#D55E00`)** acompañado de doble anillo (borde sólido + sombra externa) para no depender solo del matiz.
     - Resaltado de lectura (`--hl`) en **Amarillo Okabe (`#F0E442`)** con borde izquierdo grueso de `4 px` en `#0072B2` (redundancia visual por forma + color).
2. **Selector de variante de daltonismo (`cvdType: "none" | "deuteranopia" | "protanopia" | "tritanopia" | "achromatopsia"`):**
   - Permite elegir la variante específica en el paso 2 del onboarding o en el panel de herramientas para calibrar el realce de gráficos.

---

### 2.2. Herramientas para Gráficos e Imágenes en el Lector (`FigureBlock.tsx`)

Cuando un documento PDF o Word contiene una figura o gráfico, el componente [`FigureBlock.tsx`](../../frontend/src/features/reader/FigureBlock.tsx) incorpora tres ayudas específicas cuando el perfil *Daltonismo* está activo:

#### A. Inspector / Lupa de Nombres de Color («🔍 Identificar colores»)
- **Problema que resuelve:** el texto del profesor dice *«la barra verde representa el grupo de control»*, pero el estudiante ve dos barras del mismo tono amarronado.
- **Cómo funciona técnicamente (`frontend/src/lib/color/colorNamer.ts`):**
  - Al activar **«🔍 Identificar colores»** sobre la figura, la imagen se dibuja en un `<canvas>` en memoria.
  - Al mover el cursor (o tocar en pantallas táctiles) sobre cualquier parte del gráfico, se lee el píxel `(x, y)` con `ctx.getImageData(x, y, 1, 1)` (promediando una ventana de $3 \times 3$ píxeles para evitar ruido de compresión JPEG).
  - Se convierte el RGB a espacio perceptual **CIELAB ($L^*, a^*, b^*$)** y se calcula la distancia $\Delta E$ contra una tabla compacta de 24 colores base en español (*Rojo*, *Verde*, *Verde claro*, *Azul*, *Azul marino*, *Amarillo*, *Naranja*, *Violeta*, *Rosa*, *Marrón*, *Gris*, *Negro*, *Blanco*).
  - Muestra un tooltip de alto contraste junto al puntero con una muestra del color, su **nombre claro en español** (ej. **`Verde oscuro · #1B7837`**) y un patrón geométrico asociado.

#### B. Realce de contraste cromático para gráficos («🎨 Realzar colores / Daltonizar»)
- **Cómo funciona técnicamente (`frontend/src/lib/color/daltonize.ts`):**
  - Implementa filtros SVG (`<svg className="sr-only"><filter id="daltonize-...">`) con matrices `<feColorMatrix>` de compensación (algoritmo de **Daltonización LMS**) que desplazan las diferencias entre rojo y verde hacia el canal azul y de luminancia, haciendo que dos series antes idénticas para un daltónico se separen visualmente al instante sin alterar el archivo original.
  - Incluye un botón de alternancia rápida **«Ver original / Ver con colores realzados»**.

#### C. Descripción de gráficos por IA con mapeo Color ↔ Posición/Forma
- En `POST /api/v1/ai/describe-image`, cuando la persona tiene activo el modo daltónico (o como mejora general del prompt [`backend/app/prompts/image_description.md`](../../backend/app/prompts/image_description.md)):
  - El prompt instruye al modelo de visión a:
    1. **Nombrar explícitamente cada color** de las series, leyendas o regiones del gráfico y asociarlo siempre con su **posición espacial** (*arriba, centro, abajo, primera columna de la izquierda*) o **patrón** (*línea continua, punteada, barra más alta*).
    2. **Transcribir los valores del gráfico en una tabla o lista ordenada**, para que el estudiante tenga toda la información cuantitativa sin depender del color.

---

### 2.3. Redundancia visual en toda la interfaz (Cero dependencia exclusiva del color)

Además del requisito WCAG 1.4.1 que ya cumple el selector de temas, se refuerzan los indicadores de estado de toda la aplicación:
- **Resaltado del párrafo leído en voz alta (`DocumentView.tsx`):** además del color de fondo `var(--hl)`, agrega un indicador lateral izquierdo (`border-l-4 border-[var(--accent)]`) y un ícono/prefijo no cromático para que incluso en acromatopsia total se distinga el párrafo activo.
- **Estados de error y validación (`AISettingsDialog.tsx`, `AssistantPanel.tsx`):** todo estado acompaña el color con iconografía explícita (`✓`, `⚠`, `✕`) y bordes diferenciados (sólido vs. discontinuo).

---

## 3. Plan de implementación paso a paso

### Paso 1: Tema `okabe`, Preset `daltonismo` y Matrices de Simulación CVD
- **Archivos a modificar:**
  - [`frontend/src/features/preferences/config.ts`](../../frontend/src/features/preferences/config.ts):
    - Agregar el tema `okabe` en `THEMES` y `THEME_ORDER`.
    - Agregar `cvdType: "none" | "deuteranopia" | "protanopia" | "tritanopia" | "achromatopsia"` en `ReadingSettings`.
    - Agregar el perfil `daltonismo` en `PROFILES`.
  - [`backend/app/seed/profiles.json`](../../backend/app/seed/profiles.json):
    ```json
    {
      "id": "daltonismo",
      "title": "Daltonismo",
      "icon": "◑",
      "description": "Paleta segura Okabe-Ito, identificador de colores en gráficos y realce cromático.",
      "tags": ["Paleta Okabe-Ito", "Detector de color en gráficos", "IA con guía de color"],
      "preset": {
        "font": "atkinson",
        "font_size": 20,
        "line_height": 1.7,
        "theme": "okabe",
        "audio_focus": false,
        "cvd_type": "deuteranopia"
      }
    }
    ```

### Paso 2: Utilidades de Color y Daltonización (`frontend/src/lib/color/`)
- **Archivos nuevos (funciones puras, sin dependencias externas):**
  1. `frontend/src/lib/color/colorNamer.ts`:
     - Conversión `rgbToLab(r, g, b)` y función `describeColor(r, g, b): { name: string; hex: string }` que devuelve el nombre en español más cercano.
  2. `frontend/src/lib/color/cvdSimulation.ts`:
     - Matrices de transformación de color (Machado et al., 2009) para simular `protanopia`, `deuteranopia`, `tritanopia` y `achromatopsia` sobre cualquier color hexadecimal (usadas tanto en los tests de contraste como en los filtros SVG de daltonización).

### Paso 3: Inspector de Color y Realce en `FigureBlock.tsx`
- **Archivos a modificar:**
  - [`frontend/src/features/reader/FigureBlock.tsx`](../../frontend/src/features/reader/FigureBlock.tsx):
    - Si `settings.cvdType !== "none"` (o a demanda desde la figura), mostrar dos controles junto a «Interpretar con IA»:
      1. **«🔍 Identificar colores»:** activa el puntero inspector sobre la imagen que muestra en vivo `Nombre del color (ej. Verde oscuro · #1B7837)` tanto en un tooltip visual como en una región `aria-live="polite"`.
      2. **«🎨 Realzar colores»:** aplica el filtro de daltonización acorde a `settings.cvdType` para separar series rojo/verde o azul/amarillo.

### Paso 4: Mejora del Prompt de Descripción de Imágenes en el Backend
- **Archivos a modificar:**
  - [`backend/app/prompts/image_description.md`](../../backend/app/prompts/image_description.md):
    - Incluir la instrucción explícita de vincular siempre cada color mencionado con su ubicación espacial, forma o etiqueta en el gráfico, y volcar las series en formato tabular/lista clara.

---

## 4. Criterios de aceptación y pruebas automatizadas

1. **Test matemático de contraste bajo Daltonismo (`frontend/src/features/preferences/config.test.ts`):**
   - Aplicar las matrices de `cvdSimulation.ts` (`protanopia`, `deuteranopia`, `tritanopia`) a los colores del tema `okabe` y verificar que los pares `bg/fg`, `panel/fg` y `accent/onAccent` mantengan un ratio de contraste $\ge 4.5:1$ incluso bajo simulación de pérdida de conos L, M o S.
2. **Test unitario del identificador de colores (`frontend/src/lib/color/colorNamer.test.ts`):**
   - Verificar que `(220, 30, 30)` se identifique como `"Rojo"`, `(30, 180, 50)` como `"Verde"`, `(20, 80, 210)` como `"Azul"`, `(240, 220, 30)` como `"Amarillo"` y `(128, 128, 128)` como `"Gris"`.
3. **Test de integración en el lector (`frontend/src/app.test.tsx`):**
   - Seleccionar el perfil **Daltonismo**, abrir un documento con figura y verificar que aplica el tema `okabe` y habilita las herramientas de identificación y realce de color en la figura.
