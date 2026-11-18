# 01 · Perfil Ceguera (`id: "ceguera"`)

> **Estado:** documento de propuesta inicial, actualizado en §2.1, §2.2, §3 (pasos 1, 4 y 5) y §4 con lo que el [plan 02](./2026-11-18-perfiles-02-teclado-y-voz.md) dejó construido: teclado, voz y preset. El Braille (§2.3 y pasos 2 y 3 de §3) sigue sin construir: es el plan 03. Donde contradice a los planes de implementación (ver [README](./README.md)), manda el plan; los archivos citados (`profiles.json`, `models/profile.py`, `schemas/profile.py`) hoy son `presets.json`, `models/preset.py` y `schemas/preset.py`.

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
| **Escenario B: Computadora sin lector de pantalla instalado (ej. biblioteca o laboratorio universitario)** | No tiene NVDA/JAWS activo; depende del sintetizador integrado del navegador (`SpeechSynthesis`). | Con la opción **«Guía de navegación por voz» (`voiceGuide: true`)**, la app lee el bloque al que se mueve el cursor con el teclado a través del **motor de lectura en voz alta** (`audio.playFrom`, el mismo de «Leer»), de modo que la lectura sigue de corrido desde ahí. `speakOnce` queda para las respuestas del asistente, las descripciones de gráficos y los errores, que se leen apenas llegan. No lee el cambio de pantalla ni cada control que recibe el foco: eso quedó fuera. |

**Cómo quedó resuelto (plan 02):**
- **Un árbitro de voz (`speechBus`, en `lib/speech.ts`).** Habla una sola voz a la vez: quien empieza a hablar interrumpe a la anterior y le avisa. Si lo interrumpido era la lectura del documento, queda **en pausa en el mismo párrafo** y «Continuar» sigue desde ahí. Una lectura en pausa cuenta como «no está hablando»: por eso el micrófono en manos libres vuelve a escuchar y «continuar» se entiende.
- **`Esc` silencia toda voz** (`speechBus.silence()`), sin importar dónde esté el foco **dentro del lector** (los atajos se registran solo en `ReaderScreen`), y **además sigue cerrando diálogos** y desplegables: no se le quita ese uso. Con un diálogo modal abierto, es la única tecla del lector que sigue activa.
- **Salir del lector silencia la voz:** al volver a la biblioteca se corta lo que haya quedado hablando (por ejemplo una respuesta pendiente de `speakOnce`).
- **`voiceGuide` («Guía por voz») viene apagada**, también en el preset Ceguera. Quien usa NVDA, JAWS o VoiceOver tiene que dejarla apagada para no escuchar dos voces; la persona sin lector de pantalla la prende en Preferencias o en el lector. Con la guía encendida, la app lee:
  - el bloque al que se mueve el cursor (con `Alt+↓`/`Alt+↑`, `Alt+H`, `Alt+G` o las teclas sueltas), con el motor de lectura en voz alta (`audio.playFrom`);
  - las respuestas del asistente y las descripciones de figuras apenas llegan (`speakOnce`);
  - **también los errores** de esos pedidos (key inválida, cuota, sin conexión), para que nadie espere una respuesta que no va a llegar;
  - **el aviso de corte** cuando la respuesta de la IA llegó truncada.
- **`Alt+G` ya no enciende o apaga la guía:** salta al gráfico siguiente (ver §2.2). La guía se maneja desde el control «Guía por voz».
- **Límite conocido:** la política de reproducción automática de los navegadores puede bloquear la voz hasta que la página recibió un gesto de la persona (un toque o una tecla). Una respuesta que llega de forma asíncrona, sin gesto reciente, puede quedar muda.

### 2.2. Navegación por teclado y por comandos de voz

#### A. Navegación estructural por teclado en el documento

El lector tiene un **cursor de bloque** (`useReaderNavigation`). Mueve el foco real a párrafos, títulos y gráficos, y los bloques son `tabIndex=-1`: **no agrega paradas de `Tab`**. El cursor sigue a la lectura (si el audio avanza solo, «bloque siguiente» sale de donde se está leyendo) y al foco (tocar o tabular a un bloque lo vuelve el actual). Al llegar al borde se anuncia «Fin del documento» o «Principio del documento» y el cursor no se mueve. Al llegar a un título se anuncia «Sección 3 de 6: …».

Todos los atajos salen de una tabla única, `frontend/src/lib/keymap.ts`, que leen el lector, el diálogo de atajos y el panel de herramientas. Es la tabla de la [hoja de ruta §5](./2026-11-18-perfiles-00-hoja-de-ruta.md#5-atajos-de-teclado-tabla-única):

| Acción | Con Alt | Una tecla (si «Atajos de una sola tecla» está activo) |
|---|---|---|
| Leer / pausar | `Alt+P` | `Espacio` |
| Detener | `Alt+S` | — |
| Agrandar / achicar texto | `Alt+=` / `Alt+−` | — |
| Cambiar tema | `Alt+T` | — |
| Ir al asistente | `Alt+A` | — |
| Bloque siguiente / anterior | `Alt+↓` / `Alt+↑` | `J` / `K` |
| Título siguiente | `Alt+H` | `H` |
| Gráfico siguiente | `Alt+G` | `G` |
| Micrófono (comandos de voz; el dictado tiene su propio botón) | `Alt+M` | `M` |
| Braille | `Alt+B` | `B` |
| Resumir · Conceptos · Preguntas · Explicar el bloque | — | `1` · `2` · `3` · `4` |
| Silenciar la voz | `Esc` (siempre, dentro del lector) | — |

`Alt+←` y `Alt+→` no se usan: son «Atrás» y «Adelante» en todos los navegadores. Respecto de la propuesta inicial de este documento cambiaron: `Alt+→`/`Alt+←` (ahora `Alt+↓`/`Alt+↑`), `Alt+I` (ahora `Alt+G`) y `Alt+G` como interruptor de la guía (ahora salta al gráfico).

Reglas de los atajos de una sola tecla (`singleKeyShortcuts`, apagado por defecto, también en el preset Ceguera):
- Solo cuentan sin `Ctrl`, `Meta`, `Alt` ni `Shift`, y con el foco **fuera de un campo de escritura** (`input` de texto, `textarea`, `select`, `[contenteditable]`, `role="textbox"` o `role="combobox"`). Escribir «j», «1» o un espacio en el chat no dispara nada.
- `Espacio` se ignora si el foco está en un control que ya se activa con Espacio (botón, enlace, casilla, `summary`, roles `button`, `link`, `checkbox`, `radio`, `switch`, `menuitem`, `option`, `tab`).
- `Alt+↑` y `Alt+↓` se ignoran en campos de escritura, porque abren el desplegable del `select`.
- `Alt+B` (y `B`) hoy solo avisa «El Braille todavía no está disponible», tanto por teclado como por voz («braille»): ambos caminos llaman a la misma función `openBraille()` de `ReaderScreen`, que el plan 03 reemplaza. El atajo no aparece en la ayuda hasta que exista.
- `4` («Explicar el bloque») pide a la IA que explique con palabras más simples el bloque donde está el cursor, con el mismo texto que el botón «Explicar con palabras más simples». Necesita un párrafo elegido: con el cursor sin mover o sobre un gráfico anuncia «Elegí un párrafo primero (Alt+↓ o J).» y no manda nada.
- `Alt+M` (y `M`) alterna solo los **comandos** de voz, y solo si `voiceCommands` no está en `off` y el navegador sabe reconocer voz. El dictado tiene su propio botón «Dictar pregunta».
- **La lectura arranca desde el cursor.** Con la lectura detenida y el cursor en un bloque de texto, `Alt+P` / `Espacio` y el comando de voz «leer», «reproducir» o «continuar» empiezan en ese bloque (`audio.playFrom`); con el cursor sin mover o sobre un gráfico, desde el principio. En pausa se reanuda donde quedó. Decir «continuar» con la lectura en marcha no hace nada (no reinicia el párrafo).
- Con la guía de voz apagada pero la lectura ya en marcha, `Alt+↓` y compañía también leen el bloque nuevo (la lectura sigue desde ahí).
- Con un lector de pantalla en modo navegación, `H` y `G` los resuelve el lector, no la app. Por eso las teclas sueltas son opcionales y los atajos con `Alt` existen siempre.

#### B. Comandos y dictado por voz (`SpeechRecognition`)

- **Tecnología:** `SpeechRecognition` / `webkitSpeechRecognition`, con `lang = "es-AR"` e `interimResults = false`. Funciona en Chrome, Edge y Safari; **en Firefox no existe**: no aparece el botón de micrófono, la barra de voz explica «Tu navegador no permite comandos por voz. Probá Chrome, Edge o Safari.» y no hay errores.
- **Dos modos** (ajuste `voiceCommands`: `off`, `push` o `continuous`; el preset Ceguera trae `push`):
  - **Al tocar el micrófono (`push`):** `continuous = false`. La app se calla (`speechBus.silence()`) antes de abrir el micrófono para no oírse a sí misma, escucha una frase y se apaga.
  - **Manos libres (`continuous`):** `continuous = true`. El reconocimiento se reinicia 300 ms después de cada `end` mientras siga activo, y **se pausa mientras la app habla**.
- **Un solo micrófono a la vez.** Los comandos y el dictado de preguntas comparten un candado (`micLock`): quien pide el micrófono corta al anterior. El dictado le gana a los comandos, así lo que se dicta no se interpreta como un comando; si los comandos estaban en manos libres, se reanudan al terminar el dictado.
- **Errores:** `not-allowed`, `service-not-allowed`, `language-not-supported` y la falta de micrófono lo apagan sin reintentar. En manos libres, `no-speech` se reinicia sin avisar y los errores de red se reintentan con espera creciente (300 ms hasta 5 s) y se rinde tras 5 seguidos.
- **Consentimiento** (`lib/voice/consent.ts`, clave `aulaclara.voiceConsent` = `{ "commands"?: true, "captions"?: true }`). Antes de la primera vez aparece un diálogo, una sola vez por tipo de uso:
  - Título: «Antes de usar el micrófono».
  - Texto: «Para entender tu voz, el navegador envía el audio a su servicio de reconocimiento (Google en Chrome, Microsoft en Edge, Apple en Safari), salvo que pueda procesarlo en tu dispositivo. Aula Clara no graba ni guarda el audio.»
  - Botones: «Ahora no» y «Usar el micrófono».
  - Para el subtitulado en vivo (`captions`, plan 05) se suma un párrafo sobre pedir permiso al docente y avisar a los compañeros.
- **Nota de privacidad:** el audio va al servicio de reconocimiento del navegador. Solo se procesa en el dispositivo si el navegador ofrece `processLocally` y el paquete de idioma `es-AR` ya está instalado; en ese caso se prefiere. Aula Clara no guarda audio ni transcripciones.
- **Cabecera HTTP:** `vercel.json` sirve `Permissions-Policy: camera=(), microphone=(self), geolocation=(), payment=()`. El micrófono queda permitido solo para el propio sitio.
- **Earcons** (`lib/voice/earcons.ts`): dos tonos de 80 ms y ganancia 0,15, generados con `AudioContext` (sin archivos). Inicio: 440 → 660 Hz. Fin: 660 → 440 Hz, que suena cuando el micrófono se apaga de verdad (no en los reinicios automáticos). Sin `AudioContext`, no suena nada y no falla.
- **Barra de voz** (`VoiceCommandBar`): el estado «Escuchando…» / «Micrófono apagado» es solo visual (`aria-hidden`): no está en la región anunciada, porque un lector de pantalla con parlantes lo diría justo ante el micrófono recién abierto y esa sería la única frase que se oiría; los sonidos de encendido y apagado ya avisan del estado. La región `role="status"` anuncia únicamente resultados y errores: la frase entendida con ✓, lo entendido pero no hecho (✗ con el motivo) y los errores del micrófono. No anuncia lo que dice la app, para no duplicar voces.
- **Feedback sin eco.** En modo `push` una frase que no es un comando se muestra con «✗ No entendí ese comando». En **manos libres nunca se escribe una frase no reconocida**: el micrófono abierto oye voces ajenas o a un lector de pantalla, y repetirlas en la región anunciada las volvería a decir ante el micrófono. Solo se anuncian los comandos entendidos y los errores.
- **Diálogos abiertos.** Con un diálogo modal abierto (por ejemplo la descripción de una figura) los comandos de voz solo ejecutan «pausar» y «detener»; el resto se marca como no hecho, sin mover el foco.
- **Velocidad y pedidos a la IA.** «Más rápido» y «más lento» anuncian «Velocidad x…». Si hay una respuesta de IA en curso, un comando que pide otra a la IA se marca «Esperá a que termine la respuesta» en vez de ✓.
- **Dictado.** Lo dictado se escribe en el campo de la pregunta y se anuncia «Escribiste: …» para quien no ve la pantalla. Decir «enviar» manda lo escrito.
- **Consentimiento en manos libres.** Si el modo es `continuous`, el diálogo suma: «En modo manos libres el micrófono queda abierto: también puede oír a otras personas que estén cerca.»

**Intérprete local de comandos** (`lib/voice/commands.ts`, puro, sin llamadas a la IA). Normaliza el texto (minúsculas, sin tildes, sin puntuación) y solo entiende frases completas, salvo «preguntar …». Incluye las formas de voseo; como se normalizan sin tilde, «leé» y «lee» son la misma frase:

| Comando | Frases |
|---|---|
| Leer | «leer», «lee», «leé», «reproducir», «continuar» |
| Pausar | «pausar», «pausa», «pausá» |
| Detener | «detener», «detene», «detené», «parar», «para», «pará» |
| Bloque siguiente | «siguiente», «siguiente párrafo», «bajar», «baja», «bajá» |
| Bloque anterior | «anterior», «párrafo anterior», «subir», «subí» |
| Título siguiente | «siguiente sección», «siguiente título» |
| Gráfico siguiente | «siguiente gráfico», «siguiente imagen» |
| Velocidad | «más rápido», «más lento» |
| Resumir | «resumir», «resumí», «resumen» |
| Conceptos clave | «conceptos clave» |
| Preguntas de repaso | «preguntas», «preguntas de repaso» |
| Describir la figura | «describir imagen», «interpretar gráfico» |
| Braille | «braille», «traducir a braille» (hoy anuncia «El Braille todavía no está disponible») |
| Pregunta libre | «preguntar …» o «asistente …»: el resto de la frase va al asistente |

**Regla del modo continuo.** En manos libres el micrófono está siempre abierto y puede oír voces ajenas (un titular, un video, otra persona). Por eso las acciones que **gastan cuota de la IA** (resumir, conceptos clave, preguntas, describir imagen y preguntar) exigen decir antes el prefijo **«asistente»** («asistente resumí»), y la pregunta libre además necesita **al menos 3 palabras** después del prefijo. En cambio la navegación y la lectura van sin prefijo y no gastan cuota: **«para», «lee» o «baja» sueltos sí disparan detener, leer y bloque siguiente** en manos libres. En modo `push` todo va sin prefijo.

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

### Paso 1: Preset `ceguera` en el catálogo del backend (hecho, plan 02)
- **Dónde vive:** [`backend/app/seed/presets.json`](../../backend/app/seed/presets.json). El frontend lo recibe por `GET /api/v1/presets`; un test de contrato (`presets.contract.test.ts`) falla si un preset usa un ajuste que el frontend no conoce.
- **Preset tal como quedó:**
  ```json
  {
    "id": "ceguera",
    "title": "Ceguera",
    "icon": "⠿",
    "description": "Navegación por teclado y por voz, y lectura en voz alta del documento y de las respuestas.",
    "tags": ["Teclado y voz", "Lectura en voz alta", "Guía por voz opcional"],
    "settings": {
      "font": "atkinson",
      "font_size": 24,
      "line_height": 1.8,
      "theme": "contraste",
      "audio_focus": true,
      "voice_guide": false,
      "voice_commands": "push",
      "single_key_shortcuts": false
    }
  }
  ```
- **Diferencias con la propuesta inicial:** `voice_guide` y `single_key_shortcuts` vienen en `false` (se prenden a propósito: la guía pisaría a un lector de pantalla y las teclas sueltas chocan con las del lector), `voice_commands` es un modo (`"push"`) y no un booleano, y no hay `braille_enabled`: el Braille es del plan 03.

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

### Paso 4: Guía por voz y control por voz (hecho, plan 02)
- Reconocimiento: `frontend/src/lib/voice/` (`recognizer.ts` envuelve el navegador, `commands.ts` interpreta, `earcons.ts` genera los tonos, `consent.ts` guarda el consentimiento, `micLock.ts` reparte el micrófono). No existe `lib/voiceControl.ts`.
- En el lector: `useVoiceCommands` y `VoiceCommandBar` (estado del micrófono y última frase); `Alt+M` o el botón de micrófono. El dictado de preguntas en el asistente usa el mismo candado de micrófono.
- Con `voiceGuide` encendido, `AssistantPanel` y `FigureBlock` leen con `speakOnce` las respuestas, las descripciones, los avisos de corte y los errores. Detalle en §2.1 y §2.2.

### Paso 5: Navegación por bloques y figuras en el lector (hecho, plan 02)
- `useReaderNavigation` mantiene el cursor de bloque; `blockNav.ts` calcula el siguiente bloque, título o figura. `J`/`K` o `Alt+↓`/`Alt+↑` mueven por bloques y `H` / `Alt+H` por títulos; `G` / `Alt+G` por gráficos.
- Pendiente (no se hizo en el plan 02): persistir la descripción de una figura en el documento guardado (`libraryApi.saveFigureDescription`) para que el traductor Braille la incluya. Va con el plan 03.

---

## 4. Criterios de aceptación y pruebas automatizadas

Lo que hoy cubren los tests (`npm test` y `pytest`):
1. **`lib/keymap.test.ts` y `app.test.tsx`:** atajos con `Alt` y de una tecla, campos de escritura, `Espacio` sobre controles, `Esc` que silencia y cierra diálogos.
2. **`lib/speech.bus.test.ts` y `lib/speech.test.ts`:** un solo hablante a la vez, lectura que queda en pausa y se retoma.
3. **`lib/voice/commands.test.ts`:** frases, voseo y regla del modo continuo; `recognizer.test.ts`, `consent.test.ts`, `earcons.test.ts` y `micLock.test.ts` con dobles de las APIs del navegador.
4. **`features/reader/blockNav.test.ts`:** cursor por bloques, títulos y figuras, y los bordes del documento.
5. **Backend:** `tests/api/test_presets.py` y `tests/unit/test_seed.py` verifican que el catálogo incluye `ceguera`, con `voice_guide` en `false` y `voice_commands` en `"push"`; el contrato del frontend verifica que conoce esos tres ajustes.

La prueba manual con navegador real y lector de pantalla sigue pendiente: ver la lista en [`docs/accesibilidad.md`](../accesibilidad.md). Los tests del Braille (`translator.test.ts`, `brfExporter.test.ts`) son del plan 03.
