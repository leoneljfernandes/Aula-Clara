# Checklist de accesibilidad (WCAG 2.1 AA)

Estado al 2026-11-17. **Automatizado** = lo verifica un test que corre con `npm test`. **Pendiente** = hay que probarlo a mano antes de dar el MVP por terminado: nadie lo probó todavía con un lector de pantalla ni en un navegador real.

## Verificado por tests

| Requisito | Dónde se prueba |
|---|---|
| Contraste AA en los 4 temas (texto 4,5:1; foco, bordes y acento 3:1) | `features/preferences/config.test.ts` |
| Enlace «Saltar al contenido» en todas las vistas | `app.test.tsx` |
| Diálogos: foco adentro, cierre con Esc y foco de vuelta al disparador | `app.test.tsx` («Interpretar con IA») |
| Chat con `role="log"` y etiqueta; botones con nombre accesible | `app.test.tsx` |
| Atajos Alt+T (tema) y Alt+= (tamaño) | `app.test.tsx` |
| Lectura en voz alta: reproducir, pausar, detener, resaltado y simulación sin voces | `lib/speech.test.ts`, `app.test.tsx` |
| `?next=` no permite redirigir a otro sitio | `app.test.tsx` |
| «Configurar IA»: proveedor con botones de opción, key con etiqueta y ayuda, resultado de la prueba en `role="status"`, error de key con mensaje claro | `app.test.tsx` («IA con la key de cada persona») |
| Diseño que no depende del color: el tema activo se indica con `aria-pressed` y borde | `app.test.tsx` |

## Implementado, sin prueba automática

- Foco visible de 4 px en todos los controles (`index.css`).
- Objetivos táctiles de 48 px como mínimo (`min-h-12` en botones y enlaces).
- `prefers-reduced-motion` desactiva animaciones y transiciones (`index.css`), y el scroll automático del párrafo leído pasa a instantáneo.
- Anuncios por `aria-live` (`lib/announcer.tsx`): tema, tamaño, velocidad, estado de la importación y fin de la lectura.
- Tipografías autoalojadas (OpenDyslexic y Atkinson Hyperlegible, licencia OFL): no dependen de ningún CDN.
- `<html lang="es">` y `lang="es"` en el artículo; título de página distinto en cada vista.

## Pendiente: prueba manual

- [ ] Recorrer las 3 vistas **solo con teclado** (Tab, Shift+Tab, Enter, Espacio, Esc y los atajos Alt+P/S/=/−/T/A).
- [ ] Recorrerlas con un **lector de pantalla** (NVDA o Orca en escritorio, VoiceOver o TalkBack en móvil): los anuncios, el chat, el diálogo de la imagen y la lectura resaltada.
- [ ] Revisar el diseño con **zoom al 200 %** y en un ancho de 360 px (el lector pasa a una columna).
- [ ] Probar la **lectura en voz alta** en Chrome, Firefox y Safari: la calidad y la disponibilidad de la voz en español dependen del navegador y del sistema operativo.
- [ ] Subir un **PDF y un Word reales** con imágenes y confirmar que el texto y las figuras se extraen bien (los tests usan archivos mínimos generados).
- [ ] Probar el modo **Alto contraste** y **Sepia** con el contenido de un documento real.
- [ ] Recorrer **«Configurar IA»** con teclado y lector de pantalla: el anuncio de «Key válida», el selector de modelos (OpenRouter puede listar muchos) y el enlace para crear la key, que abre una pestaña nueva.
- [ ] Recorrer **«Configurar IA»** con una key ya sellada con lector de pantalla: el aviso «guardada de forma segura y no se puede ver», el botón «Ver los modelos de mi key guardada», la casilla «Recordar» deshabilitada y el aviso que queda al guardar en el modo de respaldo (botón «Listo»).
- [ ] Leer la **guía de API keys** (`/ayuda/ia`) con lector de pantalla: la tabla comparativa, los pasos numerados y los enlaces que abren otra pestaña.
- [ ] Correr una herramienta automática (axe DevTools o Lighthouse) sobre las 3 vistas.
