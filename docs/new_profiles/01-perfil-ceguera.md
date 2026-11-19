# 01 · Perfil Ceguera (`id: "ceguera"`)

> **Estado:** **implementado** (teclado, voz, preset y Braille). Las secciones 1 y 2 son la investigación y la intención original, ya corregidas donde la implementación las cambió; las secciones 3 y 4 describen lo construido. Las correcciones a la primera propuesta están en la [hoja de ruta §7](2026-11-18-perfiles-00-hoja-de-ruta.md#7-correcciones-a-docsnew_profiles-que-los-planes-ya-aplican); los archivos citados (`profiles.json`, `models/profile.py`, `schemas/profile.py`) hoy son `presets.json`, `models/preset.py` y `schemas/preset.py`.

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
- `Alt+B` (y `B`) y el comando de voz «braille» abren el diálogo de Braille (§2.3) cuando el ajuste `brailleTools` está encendido, que es lo que hace el preset Ceguera. Con el ajuste apagado solo avisan «El Braille todavía no está disponible». Ambos caminos llaman a la misma función `openBraille()` de `ReaderScreen`.
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
| Braille | «braille», «traducir a braille» (abre el diálogo de Braille; con `brailleTools` apagado anuncia «El Braille todavía no está disponible») |
| Pregunta libre | «preguntar …» o «asistente …»: el resto de la frase va al asistente |

**Dónde está el catálogo y cómo ampliarlo.** Todas las frases viven en una sola tabla, `PHRASES` de [`frontend/src/lib/voice/commands.ts`](../../frontend/src/lib/voice/commands.ts). La lista que ve la persona (botón «¿Qué puedo decir?» de la barra de voz, `Alt+V` o `V`, y la frase «ayuda», «comandos» o «qué puedo decir») sale de `commandCatalog()`, que lee esa misma tabla. Para sumar una frase a un comando existente se agrega a su lista en `PHRASES`; para un comando nuevo, además de su lista, TypeScript obliga a darle un grupo y una etiqueta en `COMMAND_INFO` y a atenderlo en `runVoiceCommand` (`ReaderScreen`). Los tests comprueban que toda frase del catálogo se entienda como el comando con que aparece.

**Navegador sin servicio de voz.** En una sola frase (modo «al tocar» y dictado), si el navegador abre el micrófono y no devuelve ni un resultado ni un error —se cierra la sesión sin nada, o pasan 15 s—, la barra muestra «El navegador abrió el micrófono pero no devolvió ningún texto…» (es el caso de Firefox). En manos libres no se aplica: ahí cada ciclo sin hablar termina en silencio.

**Regla del modo continuo.** En manos libres el micrófono está siempre abierto y puede oír voces ajenas (un titular, un video, otra persona). Por eso las acciones que **gastan cuota de la IA** (resumir, conceptos clave, preguntas, describir imagen y preguntar) exigen decir antes el prefijo **«asistente»** («asistente resumí»), y la pregunta libre además necesita **al menos 3 palabras** después del prefijo. En cambio la navegación y la lectura van sin prefijo y no gastan cuota: **«para», «lee» o «baja» sueltos sí disparan detener, leer y bloque siguiente** en manos libres. En modo `push` todo va sin prefijo.

### 2.3. Traducción a Braille, vista en pantalla e impresión física (hecho, plan 03)

El ajuste `brailleTools` (apagado por defecto, encendido en el preset Ceguera) agrega el botón «⠿ Braille» al encabezado del lector. Abre el diálogo «Braille» (`features/reader/braille/BrailleDialog.tsx`), que también abren `Alt+B`, `B` y el comando de voz «braille».

#### A. Signografía Braille en español (grado 1)

El motor es puro y está en `frontend/src/lib/braille/` (`table.ts`, `translate.ts`, `layout.ts`, `brf.ts`). Sigue el *Documento técnico B 2: Signografía básica de las lenguas cooficiales españolas*, **versión 3, junio de 2023**, de la Comisión Braille Española (CBE). Cada celda es un carácter Unicode `U+2800 + Σ 2^(punto−1)`.

| Signo | Braille | Puntos |
|---|---|---|
| Letras `a`–`z` | las del Braille internacional (`w` = `⠺`) | |
| `á` `é` `í` `ó` `ú` `ü` `ñ` | `⠷` `⠮` `⠌` `⠬` `⠾` `⠳` `⠻` | 1-2-3-5-6 · 2-3-4-6 · 3-4 · 3-4-6 · 2-3-4-5-6 · 1-2-5-6 · 1-2-4-5-6 |
| Mayúscula | `⠨` | 4-6 |
| Número | `⠼` | 3-4-5-6 |
| Dígitos `1`–`9`, `0` | letras `a`–`j` | |
| `.` `,` `;` `:` | `⠄` `⠂` `⠆` `⠒` | 3 · 2 · 2-3 · 2-5 |
| `¿` `?` · `¡` `!` | `⠢` · `⠖` | 2-6 · 2-3-5 |
| `(` `)` `-` | `⠣` `⠜` `⠤` | 1-2-6 · 3-4-5 · 3-6 |
| `"` `«` `»` | `⠦` | 2-3-6 |
| Espacio | `⠀` (`U+2800`) | celda vacía |

El punto es `⠄` (punto 3). El `⠲` que traía la propuesta inicial es el punto del Braille inglés. Las reglas que la hoja de ruta dejaba por confirmar quedaron así (los tests citan la sección):

1. **Siglas (§7.1, recurso 2).** Una palabra de 2 o más letras toda en mayúsculas lleva dos signos de mayúscula antes de la primera letra: `IA` → `⠨⠨⠊⠁`. El documento también admite un `⠨` antes de cada letra.
2. **Mayúsculas parciales** (`PDFs`). B 2 no las define. Se usa un `⠨` por cada mayúscula (§7.1, recurso 1): `⠨⠏⠨⠙⠨⠋⠎`. Es un criterio propio.
3. **Decimales y miles (§8.1).** El separador decimal es el punto 2 (`⠂`), venga como `,`, `.` o `’` en el original, y los grupos de tres cifras se separan con el punto 3 (`⠄`), sin repetir `⠼`: `3,5` → `⠼⠉⠂⠑`, `26.653` → `⠼⠃⠋⠄⠋⠑⠉`. Criterio propio: un `.` entre cifras es punto de miles solo si lo siguen exactamente tres cifras; si no, es decimal.
4. **Letra `a`–`j` después de un número (§8.2).** Lleva el prefijo de latina minúscula (punto 5, `⠐`): `8b` → `⠼⠓⠐⠃`.

La ONCE ya publica la **versión 4** de B 2 (mayo de 2025). Lo construido sigue la versión 3: conviene revisar si la 4 cambia alguno de estos signos.

**Lo que no está en la tabla** (matemática, química, emoji, `@`, `%`…) no se transcribe. Nunca se inventa un signo: el diálogo lista los símbolos omitidos («No se transcribieron estos símbolos: …») y el `.BRF` se genera igual.

#### B. Vista en pantalla

Es para quien ve la pantalla: va dentro de un contenedor `aria-hidden="true"` y, antes, hay un texto solo para lectores de pantalla que explica que para leer en Braille se descarga el `.BRF` o se usa la línea Braille con el lector.

1. **Espejo (tinta y Braille):** cada palabra con su Braille de 28 px arriba y la tinta abajo. Muestra los primeros 40 párrafos; el `.BRF` tiene el documento completo.
2. **Plancha:** cada página como una grilla de celdas por línea × líneas por página, con «Página N de M» y los botones «Anterior» y «Siguiente».
3. **Formato de la impresora:** «Celdas por línea» (28 a 42) y «Líneas por página» (20 a 30), por defecto 40 × 25, guardado en `aulaclara.braille` = `{ "cols": n, "rows": n }`.
4. **Figuras:** se transcriben como un párrafo «Gráfico N: descripción.» o «Gráfico N: sin descripción.». Las descripciones hechas con IA se guardan en el documento (campo `alt` del bloque `figure`, en IndexedDB) y no se vuelven a pedir; si quedan figuras sin describir, el diálogo ofrece «Describir N gráficos con IA» (una consulta de la cuota por gráfico, una por una; un error corta la serie).

#### C. Archivo `.BRF` (impresoras Braille)

Texto plano en Braille ASCII norteamericano (NABCC): solo caracteres `0x20`–`0x5F`, líneas separadas por `\r\n` y páginas por `\f`. El índice de la tabla es `codepoint − 0x2800`. MIME `text/plain;charset=us-ascii`; el nombre es `slugify(título).brf` (minúsculas, sin tildes, guiones, 60 caracteres como máximo). Las palabras no se cortan en medio de una línea: una más larga que la línea (una URL) se parte con `⠤`, y un título nunca queda como última línea de una página.

#### D. Impresión en relieve (papel microcápsula)

«Imprimir en relieve» arma una hoja A4 en milímetros (`#braille-print-sheet`, un `<svg>` por página con un círculo por punto, negro sobre blanco), oculta el resto de la interfaz con `@media print` y llama a `window.print()`; al terminar (`afterprint`) la quita. Medidas: A4 de 210 × 297 mm, margen de 15 mm, 2,5 mm entre puntos, 6,0 mm entre celdas, 10,0 mm entre líneas y puntos de 1,5 mm de diámetro. Eso da **30 celdas × 27 líneas** por página, que no es el formato del `.BRF`. Son los valores usuales (Marburg Medium) y hay que confirmarlos con el papel o la impresora de la institución. Junto al botón: «Imprimí al 100 % (sin «Ajustar a la página») para que los puntos tengan la medida correcta.»

La verificación en una vista previa de impresión real (6 mm entre celdas, 10 mm entre líneas) sigue pendiente: ver [`docs/accesibilidad.md`](../accesibilidad.md).

#### E. Fuera de alcance

La signografía matemática y química, el Braille de grado 2 (abreviado) y la edición del Braille en pantalla.

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
    "tags": ["Teclado y voz", "Lectura en voz alta", "Braille (.BRF e impresión)"],
    "settings": {
      "font": "atkinson",
      "font_size": 24,
      "line_height": 1.8,
      "theme": "contraste",
      "audio_focus": true,
      "voice_guide": false,
      "voice_commands": "push",
      "single_key_shortcuts": false,
      "braille_tools": true
    }
  }
  ```
- **Diferencias con la propuesta inicial:** `voice_guide` y `single_key_shortcuts` vienen en `false` (se prenden a propósito: la guía pisaría a un lector de pantalla y las teclas sueltas chocan con las del lector), `voice_commands` es un modo (`"push"`) y no un booleano, y el Braille se prende con `braille_tools` (en `true`, plan 03), no con `braille_enabled`.

### Paso 2: Motor de traducción Braille y exportador `.BRF` (hecho, plan 03)
- `frontend/src/lib/braille/table.ts` (signos), `translate.ts` (`toBraille`, `toBrailleWords`), `layout.ts` (`wrap`, `paginate`) y `brf.ts` (`toBrfLine`, `toBrfDocument`); además `lib/download.ts` (`downloadText`) y `lib/slugify.ts`. Los nombres de la propuesta inicial (`spanishTable.ts`, `translator.ts`, `brfExporter.ts`) no se usaron.
- Cada módulo tiene su test al lado, y los de `translate.test.ts` citan la sección de B 2 v3.

### Paso 3: Diálogo de Braille e impresión en relieve (hecho, plan 03)
- `frontend/src/features/reader/braille/`: `articleToBraille.ts` (el documento a párrafos Braille), `format.ts` (formato de la impresora), `BrailleDialog.tsx` (el diálogo; no existe `BrailleModal.tsx`), `printGeometry.ts` y `BraillePrintSheet.tsx` (la hoja en milímetros). El estilo de impresión está en `index.css`.
- Se abre con el botón «⠿ Braille», `Alt+B`, `B` o el comando de voz «braille».

### Paso 4: Guía por voz y control por voz (hecho, plan 02)
- Reconocimiento: `frontend/src/lib/voice/` (`recognizer.ts` envuelve el navegador, `commands.ts` interpreta, `earcons.ts` genera los tonos, `consent.ts` guarda el consentimiento, `micLock.ts` reparte el micrófono). No existe `lib/voiceControl.ts`.
- En el lector: `useVoiceCommands` y `VoiceCommandBar` (estado del micrófono y última frase); `Alt+M` o el botón de micrófono. El dictado de preguntas en el asistente usa el mismo candado de micrófono.
- Con `voiceGuide` encendido, `AssistantPanel` y `FigureBlock` leen con `speakOnce` las respuestas, las descripciones, los avisos de corte y los errores. Detalle en §2.1 y §2.2.

### Paso 5: Navegación por bloques y figuras en el lector (hecho, plan 02)
- `useReaderNavigation` mantiene el cursor de bloque; `blockNav.ts` calcula el siguiente bloque, título o figura. `J`/`K` o `Alt+↓`/`Alt+↑` mueven por bloques y `H` / `Alt+H` por títulos; `G` / `Alt+G` por gráficos.
- La descripción de una figura se guarda en el documento (`libraryApi.saveFigureAlt`, hecho en el plan 03) y el Braille la incluye; una figura ya descrita no vuelve a gastar cuota.

---

## 4. Criterios de aceptación y pruebas automatizadas

Lo que hoy cubren los tests (`npm test` y `pytest`):
1. **`lib/keymap.test.ts` y `app.test.tsx`:** atajos con `Alt` y de una tecla, campos de escritura, `Espacio` sobre controles, `Esc` que silencia y cierra diálogos.
2. **`lib/speech.bus.test.ts` y `lib/speech.test.ts`:** un solo hablante a la vez, lectura que queda en pausa y se retoma.
3. **`lib/voice/commands.test.ts`:** frases, voseo y regla del modo continuo; `recognizer.test.ts`, `consent.test.ts`, `earcons.test.ts` y `micLock.test.ts` con dobles de las APIs del navegador.
4. **`features/reader/blockNav.test.ts`:** cursor por bloques, títulos y figuras, y los bordes del documento.
5. **Backend:** `tests/api/test_presets.py` y `tests/unit/test_seed.py` verifican que el catálogo incluye `ceguera`, con `voice_guide` en `false`, `voice_commands` en `"push"` y `braille_tools` en `true`; el contrato del frontend verifica que conoce esos ajustes.
6. **Braille:** `lib/braille/translate.test.ts`, `layout.test.ts` y `brf.test.ts`, `lib/slugify.test.ts`, `features/reader/braille/*.test.ts(x)` (documento a Braille, formato, diálogo, geometría y hoja de impresión), `features/library/api.test.ts` (descripciones guardadas) y los tests de «Braille» y «lector» en `app.test.tsx`.

La prueba manual con navegador real y lector de pantalla sigue pendiente: ver la lista en [`docs/accesibilidad.md`](../accesibilidad.md). La lista incluye ahora el Braille: probar el `.BRF` en una impresora real y la hoja de relieve sobre el papel de la institución.
