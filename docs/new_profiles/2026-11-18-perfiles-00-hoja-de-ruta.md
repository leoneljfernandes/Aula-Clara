# Nuevos perfiles de accesibilidad · Hoja de ruta

Índice de los seis planes de implementación de los perfiles **Ceguera**, **Discapacidad motriz**, **Sordera e hipoacusia** y **Daltonismo**, con el catálogo de presets servido por el backend.

Cada plan produce software que funciona y se prueba por sí solo. Se ejecutan en orden, en una rama por plan (`feat/perfiles-0N-<nombre>`), y cada uno termina con los chequeos de [arquitectura.md §9](../arquitectura.md#9-chequeos-obligatorios-antes-de-integrar-no-hay-ci) en verde.

| Plan | Qué entrega | Depende de |
|---|---|---|
| [01 · Catálogo y preferencias](2026-11-18-perfiles-01-catalogo-y-preferencias.md) | `GET /api/v1/presets`, onboarding dinámico, ajustes versionados, registro de controles, `Stepper` | — |
| [02 · Teclado y voz](2026-11-18-perfiles-02-teclado-y-voz.md) | Atajos únicos, árbitro de voz, navegación por bloques, guía por voz, comandos por voz, preset **Ceguera** | 01 |
| [03 · Braille](2026-11-18-perfiles-03-braille.md) | Traductor Braille español, `.BRF`, vista en pantalla, impresión en relieve, descripciones de figuras guardadas | 02 |
| [04 · Motriz](2026-11-18-perfiles-04-motriz.md) | Interfaz grande, filtro de doble clic, selección de párrafo con un clic, barra simplificada, preset **Motriz** | 02 |
| [05 · Sordera](2026-11-18-perfiles-05-sordera.md) | Lenguaje claro, glosario, esquema visual, interfaz sin audio, avisos visuales, subtítulos en vivo, preset **Sordera** | 02 (reconocimiento de voz) |
| [06 · Daltonismo](2026-11-18-perfiles-06-daltonismo.md) | Colores con nombre, simulación y realce, inspector de colores, IA con guía de color, preset **Daltonismo** | 01 |

Los planes 03, 04 y 05 se pueden ejecutar en cualquier orden después del 02. El 06 se puede ejecutar en cualquier momento después del 01.

---

## 1. Decisiones (2026-11-18)

1. **El catálogo de presets vive en el backend y el frontend lo pide en runtime.** El último catálogo bueno queda en `localStorage`. Sin backend ni caché, el onboarding ofrece solo «Personalizado». Frontend y backend se despliegan juntos en Vercel. Esto reemplaza la decisión de [arquitectura.md §11](../arquitectura.md#11-qué-cambió-respecto-del-plan-inicial) («el frontend usa su propia copia»). Queda registrado en el ADR 0004 (plan 01).
2. **Daltonismo se incluye completo** (plan 06).
3. **Subtítulos en vivo con micrófono**, con aviso de privacidad y pedido de consentimiento (plan 05).
4. **Braille con tabla propia en TypeScript** y casos de prueba validados contra la Signografía básica de la CBE (plan 03).

## 2. ¿Renombrar `Profile` a `Preset` resuelve que los perfiles sean dinámicos?

**No: el renombre es solo de nombres.** Los perfiles se vuelven dinámicos porque cada parte del sistema tiene una sola responsabilidad:

| Qué | Dueño | Agregar o cambiar algo significa |
|---|---|---|
| **Catálogo**: qué presets existen, con qué textos y qué valores | backend: `backend/app/seed/presets.json` | Editar el JSON. El frontend lo muestra sin ningún cambio de código. |
| **Capacidades**: qué ajustes existen y cómo se comportan (`voiceGuide`, `uiScale`…) | frontend: `features/preferences/settings.ts` y la feature que implementa cada uno | Código en el frontend. El backend no cambia: guarda los ajustes de un preset como pares clave-valor sin interpretarlos. |
| **Vocabulario visual**: temas y tipografías | frontend: `features/preferences/config.ts` | Código en el frontend. |
| **Contrato** entre catálogo y capacidades | `frontend/src/features/preferences/presets.contract.test.ts` | Falla si `presets.json` usa un ajuste o un valor que el frontend no conoce. |

Consecuencias:

- **Un preset nuevo que combina capacidades existentes** solo toca `presets.json`.
- **Una capacidad nueva** se programa en el frontend (una entrada en `settings.ts`, su control en `controls.ts` y su comportamiento). Recién después un preset la puede usar.
- El frontend **valida todo lo que llega** con la misma función que valida `localStorage` (`sanitizePatch`). Un valor desconocido se descarta, nunca rompe la app.

## 3. Qué se guarda en el navegador

- `aulaclara.settings`: `{ "schemaVersion": 2, "settings": { …ajustes en camelCase } }`.
- `aulaclara.onboarded`: `true` cuando se terminó el onboarding.
- `aulaclara.presets`: la caché del catálogo.
- **Ya no se guarda qué perfil se eligió.** Que alguien elija «Ceguera» o «Sordera» revela una discapacidad, que es un dato sensible según la Ley 25.326 ([mejoras-pendientes.md, Fase 2.4](../mejoras-pendientes.md)). La clave vieja `aulaclara.profile` se migra y se borra.

## 4. Ajustes nuevos (estado final)

| Ajuste (frontend) | Clave en `presets.json` | Valores | Por defecto | Plan |
|---|---|---|---|---|
| `singleKeyShortcuts` | `single_key_shortcuts` | `boolean` | `false` | 02 |
| `voiceGuide` | `voice_guide` | `boolean` | `false` | 02 |
| `voiceCommands` | `voice_commands` | `"off" \| "push" \| "continuous"` | `"off"` | 02 |
| `brailleTools` | `braille_tools` | `boolean` | `false` | 03 |
| `uiScale` | `ui_scale` | `"normal" \| "large"` | `"normal"` | 04 |
| `clickToSelect` | `click_to_select` | `boolean` | `false` | 04 |
| `clickGuard` | `click_guard` | `"off" \| "normal" \| "strong"` | `"off"` | 04 |
| `aiLanguage` | `ai_language` | `"standard" \| "plain" \| "easy"` | `"standard"` | 05 |
| `hideAudio` | `hide_audio` | `boolean` | `false` | 05 |
| `visualAlerts` | `visual_alerts` | `boolean` | `false` | 05 |
| `liveCaptions` | `live_captions` | `boolean` | `false` | 05 |
| `cvdType` | `cvd_type` | `"none" \| "unsure" \| "protan" \| "deutan" \| "tritan" \| "achromat"` | `"none"` | 06 |

## 5. Atajos de teclado (tabla única)

La define `frontend/src/lib/keymap.ts` (plan 02). El diálogo de atajos y el panel de herramientas la leen de ahí.

| Acción | Con Alt | Una tecla (si `singleKeyShortcuts`) |
|---|---|---|
| Leer / pausar | `Alt+P` | `Espacio` |
| Detener | `Alt+S` | — |
| Agrandar / achicar texto | `Alt+=` / `Alt+−` | — |
| Cambiar tema | `Alt+T` | — |
| Ir al asistente | `Alt+A` | — |
| Bloque siguiente / anterior | `Alt+↓` / `Alt+↑` | `J` / `K` |
| Título siguiente | `Alt+H` | `H` |
| Gráfico siguiente | `Alt+G` | `G` |
| Micrófono | `Alt+M` | `M` |
| Braille | `Alt+B` | `B` |
| Resumir · Conceptos · Preguntas · Explicar el bloque | — | `1` · `2` · `3` · `4` |
| Silenciar la voz | `Esc` (siempre) | — |

`Alt+←` y `Alt+→` no se usan: son «Atrás» y «Adelante» en todos los navegadores.

## 6. Restricciones globales (valen para todos los planes)

- **Chequeos obligatorios antes de cada commit final de plan** (no hay CI):
  - `backend/`: `uv run pytest && uv run mypy app tests && uv run ruff check && uv run ruff format --check && uv run lint-imports`
  - `frontend/`: `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`
- **Capas:** las del backend en [arquitectura.md §4.1](../arquitectura.md#41-capas) (import-linter). En el frontend, `components/` y `lib/` nunca importan `features/` (regla `noFeatures` de `eslint.config.js`).
- **Sin dependencias nuevas de runtime.** Todo lo nuevo es TypeScript o Python propio.
- **CSP sin cambios.** Solo cambia `Permissions-Policy` a `microphone=(self)` (plan 02).
- **Textos de la interfaz en español rioplatense** (voseo), como el resto de la app.
- **WCAG 2.2 nivel AA** como piso. Los criterios citados en los planes son: 1.4.1, 1.4.13, 2.1.1, 2.1.4, 2.2.1, 2.4.11, 2.5.5 (AAA), 2.5.7 y 2.5.8.
- **Después de modificar código, `graphify update .`** (lo pide `CLAUDE.md`).
- Al terminar cada plan, actualizar el documento de `docs/new_profiles/` correspondiente para que describa lo construido, no lo propuesto.

## 7. Correcciones a `docs/new_profiles/` que los planes ya aplican

| Documento | Decía | Se corrige a |
|---|---|---|
| 01 Ceguera | `.` = `⠲` | `.` = `⠄` (punto 3). `⠲` es el punto del Braille inglés. |
| 01 Ceguera | `(` = `⠷`, `)` = `⠾` | `(` = `⠣` (1-2-6), `)` = `⠜` (3-4-5). `⠷` y `⠾` son **á** y **ú**. |
| 01 Ceguera | `voice_guide: true` en el preset | `false` por defecto: con NVDA o VoiceOver habría dos voces. Se activa a mano en el paso 2. |
| 01 Ceguera | `Alt+←` / `Alt+→` | `Alt+↑` / `Alt+↓`: las flechas con Alt navegan el historial. |
| 01 Ceguera | `Control` silencia la voz | Solo `Esc`: `Control` se usa en combinaciones como `Ctrl+C`. |
| 01 Ceguera | `libraryApi.saveFigureDescription` | `libraryApi.saveFigureAlt`, que guarda en el campo `alt` que ya tiene el bloque `figure`. |
| 02 Motriz | WCAG 2.5.8 nivel AAA | 2.5.8 es AA (24 px). El AAA es 2.5.5 (44 px). 64 px es una decisión de diseño. |
| 02 Motriz | Cada párrafo con `tabIndex=0` y `role="region"` | Cursor de bloque con `tabIndex=-1`: ninguna parada de `Tab` extra. |
| 02 Motriz | Flechas como atajos de una tecla | Solo `J` / `K`: las flechas hacen scroll y las usan los lectores de pantalla. |
| 02 Motriz | `Button.tsx` lee `uiScale` | `components/` no puede leer preferencias. Variante de Tailwind `large-ui:` y atributo `data-ui-scale`. |
| 02 Motriz | Anti-rebote en todo clic | Solo clics de puntero sobre el mismo elemento, configurable. Enter y Espacio no se filtran. |
| 03 Sordera | «Español Claro / Lectura Fácil» como una sola cosa | Tres niveles: estándar, lenguaje claro (ISO 24495-1) y Lectura Fácil. |
| 03 Sordera | Oculta controles de audio | También el botón «Escuchar descripción» de las figuras, que el plan omitía. |
| 04 Daltonismo | Okabe-Ito «validada para acromatopsia» | No lo está. La acromatopsia se trata con redundancia sin color y el perfil Visión reducida. |
| 04 Daltonismo | Tema `okabe` | Los temas actuales ya evitan rojo/verde. Se verifican bajo simulación y el tema `okabe` queda como tarea opcional (plan 06, tarea 8). |
| 04 Daltonismo | «24 colores» | Una tabla de 18 nombres, con distancia CIEDE2000. |
| 04 Daltonismo | Inspector de color al pasar el mouse | También con teclado (criterios 2.1.1 y 1.4.13). |
| README | `cvdSimulation.ts` y `daltonize.ts` | Un solo `lib/color/cvd.ts`. |

## 8. Fuera de alcance

- **Estructura fina del documento** (listas, tablas, niveles de título): el extractor solo genera `h2` y párrafos. Es la Fase 3.5 de [mejoras-pendientes.md](../mejoras-pendientes.md).
- **Signografía matemática y química en Braille.** Los símbolos que no estén en la tabla se informan a la persona.
- **Videos o avatares en Lengua de Señas Argentina.**
- **Exportar e importar el perfil** (resto de la Fase 2.1).
