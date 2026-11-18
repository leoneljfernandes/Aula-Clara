# Checklist de accesibilidad (WCAG 2.1 AA)

Estado al 2026-11-18. **Automatizado** = lo verifica un test que corre con `npm test`. **Pendiente** = hay que probarlo a mano antes de dar el MVP por terminado: nadie lo probó todavía con un lector de pantalla ni en un navegador real.

## Verificado por tests

| Requisito | Dónde se prueba |
|---|---|
| Contraste AA en los 4 temas (texto 4,5:1; foco, bordes y acento 3:1) | `features/preferences/config.test.ts` |
| Enlace «Saltar al contenido» en todas las vistas | `app.test.tsx` |
| Diálogos: foco adentro, cierre con Esc y foco de vuelta al disparador | `app.test.tsx` («Interpretar con IA») |
| Chat con `role="log"` y etiqueta; botones con nombre accesible | `app.test.tsx` |
| Atajos con Alt (P, S, =, −, T, A, ↑, ↓, H, G, M) y de una sola tecla (J, K, H, G, M, Espacio, 1 a 4): no se disparan escribiendo en un campo ni con Espacio sobre un botón | `lib/keymap.test.ts`, `app.test.tsx` |
| `Esc` silencia la voz y sigue cerrando diálogos | `app.test.tsx`, `lib/speech.bus.test.ts` |
| Un solo hablante a la vez: «Escuchar respuesta» deja la lectura del documento en pausa y «Continuar» la retoma | `lib/speech.bus.test.ts`, `lib/speech.test.ts`, `app.test.tsx` |
| Cursor de bloque: foco sin paradas de Tab extra, bordes («Fin del documento», «Principio del documento») | `features/reader/blockNav.test.ts`, `app.test.tsx` |
| Comandos por voz: frases, voseo y regla del modo manos libres; reconocedor, consentimiento, tonos y micrófono único | `lib/voice/*.test.ts`, `components/VoiceConsentDialog.test.tsx`, `app.test.tsx` |
| El catálogo incluye el preset Ceguera y el frontend conoce todos sus ajustes | `backend/tests/api/test_presets.py`, `presets.contract.test.ts` |
| Lectura en voz alta: reproducir, pausar, detener, resaltado y simulación sin voces | `lib/speech.test.ts`, `app.test.tsx` |
| `?next=` no permite redirigir a otro sitio | `app.test.tsx` |
| «Configurar IA»: proveedor con botones de opción, key con etiqueta y ayuda, resultado de la prueba en `role="status"`, error de key con mensaje claro | `app.test.tsx` («IA con la key de cada persona») |
| Diseño que no depende del color: el tema activo se indica con `aria-pressed` y borde | `app.test.tsx` |

## Atajos de teclado

Los define `frontend/src/lib/keymap.ts`; el diálogo de atajos y el panel de herramientas leen la misma tabla. Los de una sola tecla vienen apagados («Atajos de una sola tecla») y no funcionan mientras se escribe en un campo.

| Acción | Con Alt | Una tecla |
|---|---|---|
| Leer / pausar | `Alt+P` | `Espacio` |
| Detener | `Alt+S` | — |
| Agrandar / achicar texto | `Alt+=` / `Alt+−` | — |
| Cambiar tema | `Alt+T` | — |
| Ir al asistente | `Alt+A` | — |
| Bloque siguiente / anterior | `Alt+↓` / `Alt+↑` | `J` / `K` |
| Título siguiente | `Alt+H` | `H` |
| Gráfico siguiente | `Alt+G` | `G` |
| Micrófono (comandos de voz) | `Alt+M` | `M` |
| Braille (todavía anuncia «El Braille todavía no está disponible», por teclado y por voz) | `Alt+B` | `B` |
| Resumir · Conceptos · Preguntas · Explicar el bloque actual más simple | — | `1` · `2` · `3` · `4` |
| Silenciar la voz | `Esc` (siempre, dentro del lector) | — |

Reglas: `Espacio` se ignora sobre botones, enlaces, casillas y otros controles que ya se activan con Espacio; `Alt+↑` y `Alt+↓` se ignoran en campos de escritura (abren el desplegable del `select`); `Esc` silencia y además cierra el diálogo abierto, y vale solo dentro del lector (los atajos se registran únicamente en `ReaderScreen`). `4` necesita un párrafo elegido con el cursor: si no, anuncia «Elegí un párrafo primero (Alt+↓ o J).». `Alt+M` alterna solo los comandos de voz (con `voiceCommands` distinto de `off` y un navegador que reconozca voz); el dictado tiene su botón «Dictar pregunta». `Alt+P` / `Espacio` empiezan a leer desde el bloque del cursor (desde el principio si no hay cursor o está en un gráfico). `Alt+←` y `Alt+→` no se usan porque son «Atrás» y «Adelante» del navegador.

## Voz

- **Guía por voz** (`voiceGuide`): apagada por defecto. Lee el bloque al que se mueve el cursor (con el motor de lectura en voz alta, `audio.playFrom`, no con `speakOnce`), las respuestas del asistente, las descripciones de figuras, **los errores** de esos pedidos y los avisos de corte. **Con un lector de pantalla (NVDA, JAWS, VoiceOver) tiene que quedar apagada**, o se escuchan dos voces.
- Con la guía apagada pero la lectura ya en marcha, moverse de bloque con el teclado también lee el bloque nuevo. La lectura arranca desde el cursor. Salir del lector silencia la voz.
- **Una sola voz a la vez:** quien empieza a hablar interrumpe a la anterior. Si interrumpe a la lectura del documento, esta queda en pausa en el mismo párrafo y «Continuar» sigue desde ahí.
- **Comandos por voz** (`voiceCommands`): `off`, `push` (al tocar el micrófono) o `continuous` (manos libres). Necesitan Chrome, Edge o Safari; Firefox no tiene reconocimiento de voz y la app lo explica en vez de mostrar el botón.
- **Consentimiento:** la primera vez aparece «Antes de usar el micrófono». El audio lo procesa el servicio de reconocimiento del navegador (Google en Chrome, Microsoft en Edge, Apple en Safari), salvo que el navegador pueda hacerlo en el dispositivo (solo si el paquete de idioma ya está instalado). Aula Clara no graba ni guarda el audio. La aceptación se guarda en `aulaclara.voiceConsent`.
- **Permiso del sitio:** `vercel.json` manda `Permissions-Policy: camera=(), microphone=(self), geolocation=(), payment=()`.
- **Tonos de aviso:** un tono ascendente (440 → 660 Hz) cuando el micrófono empieza a escuchar y uno descendente (660 → 440 Hz) cuando se apaga; 80 ms cada uno. Sin `AudioContext` no suenan.
- **Manos libres:** las acciones que gastan cuota de la IA (resumir, conceptos clave, preguntas, describir imagen, preguntar) piden decir antes «asistente», y la pregunta libre necesita al menos 3 palabras. La lectura y la navegación van sin prefijo: «para», «lee» o «baja» sueltos detienen, leen o avanzan.
- **Estado y anuncios de los comandos:** «Escuchando…» y «Micrófono apagado» son solo visuales (`aria-hidden`), fuera de la región `role="status"`: los tonos ya avisan del estado y un lector de pantalla con parlantes no debe hablar ante el micrófono abierto. La región anuncia solo resultados (✓ entendido, ✗ con el motivo cuando no se pudo hacer, p. ej. «Esperá a que termine la respuesta» si hay una respuesta de IA en curso) y errores. En `push` también muestra «✗ No entendí ese comando»; en **manos libres nunca se escribe una frase no reconocida**, para no repetir ante el micrófono abierto lo que dijo otra persona o un lector de pantalla.
- **Diálogos abiertos:** con un diálogo modal abierto los comandos de voz solo ejecutan «pausar» y «detener».
- **Velocidad:** «más rápido» y «más lento» anuncian «Velocidad x…».
- **Dictado:** lo dictado se anuncia como «Escribiste: …». «Enviar» manda la pregunta.
- **Consentimiento en manos libres:** suma «En modo manos libres el micrófono queda abierto: también puede oír a otras personas que estén cerca.»
- **Un micrófono a la vez:** el dictado de preguntas corta a los comandos y estos se reanudan después.

## Implementado, sin prueba automática

- Foco visible de 4 px en todos los controles (`index.css`).
- El cursor de bloque del lector mueve el foco a párrafos, títulos y gráficos (`tabIndex=-1`) sin agregar paradas de Tab, y sigue a la lectura y al foco.
- Objetivos táctiles de 48 px como mínimo (`min-h-12` en botones y enlaces).
- `prefers-reduced-motion` desactiva animaciones y transiciones (`index.css`), y el scroll automático del párrafo leído pasa a instantáneo.
- Anuncios por `aria-live` (`lib/announcer.tsx`): tema, tamaño, velocidad, estado de la importación y fin de la lectura.
- Tipografías autoalojadas (OpenDyslexic y Atkinson Hyperlegible, licencia OFL): no dependen de ningún CDN.
- `<html lang="es">` y `lang="es"` en el artículo; título de página distinto en cada vista.

## Pendiente: prueba manual

- [ ] Recorrer las 3 vistas **solo con teclado** (Tab, Shift+Tab, Enter, Espacio, Esc y los atajos de la tabla de arriba).
- [ ] Recorrerlas con un **lector de pantalla** (NVDA o Orca en escritorio, VoiceOver o TalkBack en móvil): los anuncios, el chat, el diálogo de la imagen y la lectura resaltada.
- [ ] Revisar el diseño con **zoom al 200 %** y en un ancho de 360 px (el lector pasa a una columna).
- [ ] **Permiso del micrófono en un navegador real** (Chrome, Edge, Safari): que el aviso del navegador aparezca después del diálogo «Antes de usar el micrófono», una sola vez, y qué pasa si se lo deniega.
- [ ] **Reconocimiento en el dispositivo o en la nube:** confirmar con el paquete de idioma `es-AR` instalado y sin instalar que el consentimiento dice la verdad (`processLocally`).
- [ ] **Tonos de aviso:** que se oigan en parlantes y auriculares, con el volumen habitual, y no se confundan con los sonidos del sistema.
- [ ] **Autoplay de la guía por voz:** que una respuesta del asistente que llega después de un pedido asíncrono se lea (la política del navegador puede dejarla muda hasta que haya habido un gesto en la página).
- [ ] **Conflictos de `Alt+tecla` en Firefox y otros navegadores:** `Alt+H`, `Alt+B`, `Alt+M`, `Alt+S` y `Alt+T` pueden abrir menús del navegador. Si alguno lo hace, anotarlo acá y proponer otra tecla.
- [ ] **Dos reconocedores superpuestos un instante** al terminar un dictado: que los comandos en manos libres se reanuden sin oír dos veces ni quedar mudos. Verificarlo en Chrome real, donde el dictado acaba de cerrarse cuando el reconocedor de comandos vuelve a abrirse.
- [ ] **Con NVDA, comandos en modo `push`:** que al tocar el micrófono el lector de pantalla ya no diga «Escuchando…» ni nada con el micrófono abierto, y que la única frase captada sea la de la persona.
- [ ] **Con NVDA, JAWS y VoiceOver** (Windows y macOS, Chrome y Firefox): `H` y `G` los resuelve el lector, y `Alt+H`, `Alt+G`, `Alt+↓` y `Alt+↑` funcionan en la app; la guía por voz **apagada** no pisa la voz del lector; «Escuchar respuesta» deja la lectura en pausa y «Continuar» retoma.
- [ ] **Comandos por voz en Chrome:** el consentimiento aparece una vez, los tonos suenan y «siguiente párrafo» avanza; en manos libres, que «asistente resumí» funcione y que un «resumí» suelto no gaste cuota.
- [ ] Probar la **lectura en voz alta** en Chrome, Firefox y Safari: la calidad y la disponibilidad de la voz en español dependen del navegador y del sistema operativo.
- [ ] Subir un **PDF y un Word reales** con imágenes y confirmar que el texto y las figuras se extraen bien (los tests usan archivos mínimos generados).
- [ ] Probar el modo **Alto contraste** y **Sepia** con el contenido de un documento real.
- [ ] Recorrer **«Configurar IA»** con teclado y lector de pantalla: el anuncio de «Key válida», el selector de modelos (OpenRouter puede listar muchos) y el enlace para crear la key, que abre una pestaña nueva.
- [ ] Recorrer **«Configurar IA»** con una key ya sellada con lector de pantalla: el aviso «guardada de forma segura y no se puede ver», el botón «Ver los modelos de mi key guardada», la casilla «Recordar» deshabilitada y el aviso que queda al guardar en el modo de respaldo (botón «Listo»).
- [ ] Leer la **guía de API keys** (`/ayuda/ia`) con lector de pantalla: la tabla comparativa, los pasos numerados y los enlaces que abren otra pestaña.
- [ ] Correr una herramienta automática (axe DevTools o Lighthouse) sobre las 3 vistas.
