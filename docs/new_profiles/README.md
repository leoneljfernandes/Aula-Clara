# Perfiles de accesibilidad: qué se quiso hacer y dónde quedó

Aula Clara empezó pensada para dificultades de lectura (dislexia, visión reducida, fatiga visual). Esta carpeta documenta los cuatro perfiles que la ampliaron: **Ceguera**, **Discapacidad motriz**, **Sordera e hipoacusia** y **Daltonismo**. Todos están **implementados**. Cada documento tiene dos mitades: lo que se quiso lograr y por qué (la investigación), y cómo quedó construido.

| Documento | Para quién | Qué se quiso lograr | Dónde está el código |
|---|---|---|---|
| [01 · Ceguera](01-perfil-ceguera.md) | Personas que no ven la pantalla | Guía por voz, comandos por voz, navegación por teclado y por bloques, Braille (`.BRF`, vista, impresión en relieve) | `lib/voice/`, `lib/speech.ts`, `lib/braille/`, `features/reader/` (`braille/`, `useVoiceCommands`, `useReaderNavigation`) |
| [02 · Discapacidad motriz](02-perfil-discapacidad-motriz.md) | Personas con poca precisión o fuerza al usar el mouse y el teclado | Botones de 64 px, filtro de clics dobles, elegir un párrafo con un clic, barra simplificada, atajos de una tecla | `index.css` (`large-ui:`), `lib/clickGuard.ts`, `features/reader/ReaderBottomBar.tsx` |
| [03 · Sordera](03-perfil-sordera.md) | Personas sordas o con hipoacusia (muchas con la Lengua de Señas como primera lengua) | Respuestas en lenguaje claro o Lectura Fácil, glosario y esquemas, interfaz sin audio, avisos en pantalla, subtítulos en vivo | `backend/app/services/ai_rules.py`, `features/assistant/LiveCaptions.tsx`, `features/preferences/VisualStatus.tsx` |
| [04 · Daltonismo](04-perfil-daltonismo.md) | Personas que confunden colores | Nombres de color, realce en gráficos, descripciones de IA con color y posición, temas verificados bajo simulación | `lib/color/`, `features/reader/ColorInspector.tsx`, `ColorFilterDefs.tsx` |

La [hoja de ruta](2026-11-18-perfiles-00-hoja-de-ruta.md) guarda las **decisiones** que se tomaron, las **restricciones globales** (chequeos, WCAG, voseo, sin dependencias nuevas) y las **correcciones** que se le hicieron a la primera propuesta.

## Cómo está resuelto, en una página

- **Un perfil no es un tipo de usuario en el código: es un paquete de ajustes con nombre** (un *preset*). Vive en `backend/app/seed/presets.json`, el frontend lo pide a `GET /api/v1/presets`, lo valida y lo guarda en caché. Elegirlo reemplaza los ajustes: no mezcla con los anteriores y no se guarda qué perfil se eligió, solo los ajustes (Ley 25.326). Ver el [ADR 0004](../adr/0004-catalogo-de-presets.md).
- **Todo lo que cambia el comportamiento es un ajuste** de `ReadingSettings` (`features/preferences/settings.ts`), con un validador por campo y una entrada en `CONTROLS` (`controls.ts`): con eso el onboarding y el panel del lector se generan solos. Los componentes leen el ajuste que les importa; ninguno conoce «el perfil».
- **Capacidades compartidas entre perfiles**: la voz (`lib/voice/` y `lib/speech.ts`) la usan Ceguera, Motriz y Sordera; el cursor de bloque del lector, Ceguera y Motriz; el motor de color, Daltonismo y los temas.
- **Lo transversal no toca componentes**: la interfaz grande es un atributo (`data-ui-scale`) y una variante de Tailwind (`large-ui:`); el filtro de clics, un listener del documento; los temas, variables CSS.
- **Todo atajo sale de una sola tabla** (`lib/keymap.ts`), y toda frase de voz, de otra (`PHRASES` en `lib/voice/commands.ts`): las listas de ayuda se arman desde esas tablas.

### Para sumar un perfil nuevo

1. **Ajustes:** un campo en `ReadingSettings` (`settings.ts`) con su valor por defecto y su validador en `FIELDS`, y su control en `CONTROLS`.
2. **Comportamiento:** que el componente que corresponde lea ese ajuste. Si afecta a la interfaz entera, usar un atributo de `ThemeScope` en vez de pasar la preferencia por componentes de `components/`.
3. **Preset:** una entrada al final de `backend/app/seed/presets.json` (las claves de los ajustes van en `snake_case`) y su aserción en `test_presets.py` y `test_seed.py`. El test de contrato del frontend avisa si el preset usa un ajuste que el frontend no conoce.
4. **Pruebas y documentos:** tests con el ajuste prendido y apagado, los chequeos de la [hoja de ruta §6](2026-11-18-perfiles-00-hoja-de-ruta.md), un documento en esta carpeta y la lista de pruebas manuales de [accesibilidad.md](../accesibilidad.md).

## Los planes paso a paso

Cada perfil se construyó con un plan de implementación por tarea (seis en total: catálogo y preferencias, teclado y voz, Braille, motriz, sordera y daltonismo). Ya se ejecutaron y se borraron de la carpeta para no duplicar lo que dicen los documentos de arriba y el código. **Siguen en el historial de git**:

```bash
git show 43653ba:docs/new_profiles/2026-11-18-perfiles-03-braille.md
```

(reemplazá el nombre por `…-01-catalogo-y-preferencias.md`, `…-02-teclado-y-voz.md`, `…-04-motriz.md`, `…-05-sordera.md` o `…-06-daltonismo.md`). Lo que quedó sin hacer está en [mejoras-pendientes.md](../mejoras-pendientes.md).
