# 04 · Perfil Daltonismo (`id: "daltonismo"`)

> **Estado:** construido por el [plan 06](./2026-11-18-perfiles-06-daltonismo.md) (nombres de color, inspector, realce, temas verificados, descripciones con guía de color, indicadores sin color y preset). Las secciones 3 y 4 describen lo construido; la 2 es la investigación original. Donde este documento contradice a los planes de implementación (ver [README](./README.md)), manda el plan; los archivos citados (`profiles.json`, `models/profile.py`, `schemas/profile.py`) hoy son `presets.json`, `models/preset.py` y `schemas/preset.py`.

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

## 3. Cómo quedó construido

### Paso 1: Ajuste «Visión de los colores» y preset `daltonismo` (hecho, plan 06)
- El ajuste es `cvdType` (`none`, `unsure`, `protan`, `deutan`, `tritan`, `achromat`), en el grupo «Colores». Con `unsure` («Tengo dificultad, no sé de qué tipo») el realce usa el de deuteranopía, el tipo más frecuente.
- El preset está en [`backend/app/seed/presets.json`](../../backend/app/seed/presets.json) con `cvd_type: "unsure"`. No hay un campo `cvd_profile` ni sub-perfiles por tipo: el tipo se elige en el ajuste.

### Paso 2: Matemática de color (`frontend/src/lib/color/`) (hecho, plan 06)
- `convert.ts`: sRGB, RGB lineal, CIELAB (D65), distancia **CIEDE2000** (probada con los datos de Sharma, Wu y Dalal, 2005), luminancia y contraste WCAG.
- `names.ts`: **18 nombres de color en español** (Negro, Blanco, tres grises, Rojo y Rojo oscuro, Rosa, Naranja, Marrón, Amarillo, tres verdes, Celeste, Azul, Azul marino y Violeta). Se nombra la referencia más cercana por CIEDE2000; el hex que se muestra es el color medido.
- `cvd.ts`: simulación de **Machado, Oliveira y Fernandes (2009)**, severidad 1,0, en RGB lineal; el realce (daltonización) `M = I + E · (I − S)`; los 20 valores del `feColorMatrix`; y el promedio de 3 × 3 píxeles. La matriz de **tritanopía es una aproximación**. Las matrices se comprobaron por la propiedad que garantiza el artículo (cada fila suma 1, un gris sigue siendo gris) y contra los valores del plan, no contra la tabla del paper.
- **Acromatopsia sin realce:** con ese tipo no hay realce que ayude, así que «Realzar colores» se deshabilita y se explica; quedan «Identificar colores» e «Interpretar con IA».

### Paso 3: Inspector y realce en las figuras (hecho, plan 06)
- `features/reader/ColorInspector.tsx` y `ColorFilterDefs.tsx`; las botoneras están en `FigureBlock.tsx`, solo con `cvdType` distinto de `none`.
- **«🔍 Identificar colores»:** una mira sobre la figura que nombra el color con el puntero, el dedo o el **teclado** (flechas: 2 % del ancho o del alto; con Shift, 10 %; `Esc` sale y devuelve el foco al botón). Promedia 3 × 3 píxeles, así el ruido de un JPEG no cambia el nombre, y anuncia «{nombre} · {HEX}» 300 ms después de que la mira se detuvo.
- **«🎨 Realzar colores»:** aplica el filtro SVG `#cvd-enhance` (`feColorMatrix` en `linearRGB`) a la imagen, sin tocar los botones.

### Paso 4: Descripciones de IA con guía de color (hecho, plan 06)
- `describe-image` acepta `color_guide` (por defecto `false`); con él, el prompt suma `app/prompts/image_color_guide.md` (cada color con su posición o su forma, hasta 180 palabras) y la respuesta tiene su propia entrada de caché. `FigureBlock` lo manda con `cvdType` distinto de `none`.

### Paso 5: Temas verificados e indicadores sin color (hecho, plan 06)
- **Los cuatro temas se verificaron bajo simulación** de protanopía, deuteranopía y tritanopía: el texto, el texto sobre el color de acento y sobre el resaltado, y el foco mantienen el contraste (4,5:1 y 3:1) y el resaltado se distingue del fondo (ΔE2000 ≥ 10). Ningún tema necesitó cambios.
- **Cero dependencia exclusiva del color (1.4.1):** el bloque que se lee en voz alta lleva un **borde izquierdo de 4 px** además del fondo (y `aria-current`), el bloque elegido con un clic lleva un contorno de 4 px y los estados de «Configurar IA» empiezan con **✓** o **✕**.
- **Tema `okabe` (opcional):** ver la nota al final.

---

## 4. Criterios de aceptación y pruebas automatizadas

1. **`lib/color/*.test.ts`:** CIEDE2000 contra los datos de Sharma y otros, los 18 nombres, la simulación y el realce (el realce separa un rojo de un verde para una persona con deuteranopía), los 20 valores del filtro y el promedio de 3 × 3.
2. **`features/preferences/config.test.ts`:** cada tema bajo protan, deutan y tritan.
3. **`app.test.tsx` («daltonismo»):** el inspector con el teclado, el realce y su apagado, acromatopsia, «no sé» usa deuteranopía y la guía de color en «Interpretar con IA».
4. **Backend:** `test_ai_service.py` y `tests/api/test_ai.py` (la guía de color amplía el prompt y tiene su propia caché), `test_presets.py` y `test_seed.py`.

**Pendiente de prueba manual** (ver [`docs/accesibilidad.md`](../accesibilidad.md)): con un PDF que tenga un gráfico de barras rojo y verde, el inspector nombra los colores, «Realzar colores» separa las series con la simulación de DevTools (Rendering → Emulate vision deficiencies → Deuteranopia) y la descripción con IA menciona color y posición. No se hizo en la construcción: no había un navegador con DevTools.
