# 03 · Perfil Sordera / Hipoacusia (`id: "sordera"`)

> **Estado:** **implementado** (niveles de lenguaje, glosario y esquema, definir término, interfaz sin audio, avisos en pantalla, subtítulos en vivo y preset), con el reconocedor de voz de [Ceguera](01-perfil-ceguera.md). Las secciones 1 y 2 son la investigación y la intención original; las secciones 3 y 4 describen lo construido. Las correcciones a la primera propuesta están en la [hoja de ruta §7](2026-11-18-perfiles-00-hoja-de-ruta.md#7-correcciones-a-docsnew_profiles-que-los-planes-ya-aplican); los archivos citados (`profiles.json`, `models/profile.py`, `schemas/profile.py`) hoy son `presets.json`, `models/preset.py` y `schemas/preset.py`.

## 1. Motivos y objetivos del perfil

A primera vista podría pensarse que, como un PDF o un Word ya son texto escrito, un estudiante con **sordera o hipoacusia** no necesita adaptaciones en una plataforma de lectura. Sin embargo, la evidencia en educación superior e inclusión universitaria muestra tres barreras críticas que **Aula Clara** puede resolver directamente:

1. **El español escrito como segunda lengua (L2) para personas Sordas señantes:**
   - Para muchas personas sordas prelocutivas cuya lengua materna es la **Lengua de Señas Argentina (LSA)** (o LSE/LSC), el español escrito es una **segunda lengua** aprendida sin referencia fonológica.
   - La LSA tiene una gramática visual-espacial, sintaxis concisa y orden tópico-comentario. En cambio, los textos universitarios abusan de oraciones subordinadas largas, voz pasiva, doble negación, conectores arcaicos (*«sin perjuicio de lo cual»*, *«en tanto y en cuanto»*) y jerga abstracta sin ejemplos visuales.
2. **Ruido en la interfaz por herramientas basadas en sonido:**
   - Controles prominentes de *«Lectura en voz alta»*, velocidades de locución (`x0,75`, `x1`, `x1,5`) y botones de *«Escuchar respuesta»* ocupan espacio cognitivo y visual sin aportar valor a quien no utiliza canal auditivo.
3. **Falta de apoyo en clases o explicaciones orales:**
   - En el aula universitaria, mientras el estudiante lee el apunte, el docente explica conceptos oralmente sin subtítulos, dejando al estudiante sordo desconectado entre lo que se dice en clase y el texto del PDF.

El objetivo del perfil **Sordera / Hipoacusia** en Aula Clara es transformar el material académico en **Español Claro / Lectura Fácil con estructura visual**, ofrecer un **glosario visual e inmediato** de términos difíciles, eliminar controles sonoros innecesarios y brindar **subtitulado en vivo con resumen por IA**.

---

## 2. Investigación técnica de las adaptaciones

### 2.1. Adaptación lingüística con IA: Español Claro y Lectura Fácil (`plainLanguageAI: true`)

Basado en la norma internacional **ISO 24495-1 (Lenguaje Claro)** y las pautas europeas y latinoamericanas de **Lectura Fácil (Inclusion Europe / W3C COGA)**:

1. **Modificador de prompt en el Backend (`plain_language: bool`):**
   - Cuando el perfil *Sordera* está activo (`plainLanguageAI: true`), cada consulta a `POST /api/v1/ai/chat` incluye `plain_language: true`.
   - El servicio de prompts (`backend/app/services/prompts.py` y `backend/app/prompts/study_assistant.md`) anexa reglas estrictas de redacción accesible:
     - **Una sola idea por oración** (máximo 15 a 20 palabras por frase).
     - **Estructura directa:** `Sujeto + Verbo + Objeto` en **voz activa** (nunca voz pasiva refleja ni subordinadas encadenadas).
     - **Sin metáforas, ironías ni dobles negaciones.**
     - **Organización altamente visual:** uso sistemático de viñetas, pasos numerados (`1.`, `2.`, `3.`), palabras clave en **negrita** y bloques cortos.
2. **Dos nuevas acciones rápidas en el Asistente de Estudio orientadas al procesamiento visual:**
   - **`glossary` («📖 Glosario fácil»):**
     Extrae los términos técnicos, académicos o poco frecuentes del documento (o del párrafo seleccionado) y genera fichas breves con:
     - **Palabra original**
     - **Qué significa en palabras simples** (1 oración directa)
     - **Ejemplo concreto de la vida real**
   - **`visual_outline` («🗺 Esquema visual»):**
     En lugar de un resumen en prosa larga, genera un **mapa conceptual jerárquico / esquema causa → efecto** (`Tema principal ➔ Idea clave ➔ Consecuencia`) para aprovechar la memoria visual-espacial.

---

### 2.2. Interfaz 100 % visual y libre de dependencia auditiva (`hideAudioControls: true`)

1. **Ocultamiento limpio de controles de voz (TTS):**
   - Cuando `hideAudioControls: true`:
     - Se oculta la sección *«Lectura en voz alta»* en `ToolsPanel.tsx`.
     - Se oculta el botón *«▶ Escuchar este documento»* en `DocumentView.tsx`.
     - Se oculta el botón *«🔊 Escuchar»* en los mensajes del asistente (`AssistantPanel.tsx`).
     - En su lugar, el panel de herramientas destaca los accesos directos a **«📖 Glosario fácil del documento»** y **«🗺 Esquema visual»**.
2. **Alertas y estados 100 % visuales:**
   - Toda notificación que pasa por `useAnnounce()` se refleja también en un **indicador visual de estado (Toast / Banner sutil de alto contraste)** para que ningún cambio de estado (como *«Preferencias guardadas»*, *«Respuesta lista»* o *«Documento importado»*) quede oculto solo en el árbol `sr-only`.

---

### 2.3. Subtitulado en vivo del aula + Resumen con IA (`LiveCaptions.tsx`)

Una funcionalidad diferencial de **costo cero** usando la `Web Speech API (SpeechRecognition)` del navegador:

- **¿Cómo funciona?**
  - Dentro del lector, el estudiante con sordera o hipoacusia puede abrir la pestaña o panel **«💬 Subtítulos en vivo (Clase)»**.
  - Al activarlo, el micrófono de la notebook o celular transcribe en tiempo real (`continuous: true`, `interimResults: true`, `lang: "es-AR"`) lo que está explicando el docente en el aula, mostrándolo con la misma tipografía, tamaño y tema de alto contraste que el estudiante eligió en su perfil.
- **Conexión con el Asistente de IA:**
  - Con un botón **«✦ Explicar en Español Claro lo que dijo el docente»**, el bloque recién transcripto se envía al asistente de IA cruzándolo con el apunte abierto (`document_text`), permitiendo que el estudiante entienda al instante la explicación oral de la clase vinculada con el PDF.

---

## 3. Cómo quedó construido

### Paso 1: Preset `sordera` en el catálogo (hecho, plan 05)
- En [`backend/app/seed/presets.json`](../../backend/app/seed/presets.json), con `ai_language: "plain"`, `hide_audio`, `visual_alerts` y `live_captions` en `true`. Los nombres de los ajustes del frontend son `aiLanguage`, `hideAudio`, `visualAlerts` y `liveCaptions` (no `plainLanguageAI` ni `hideAudioControls`).

### Paso 2: Tres niveles de lenguaje, glosario y esquema (hecho, plan 05)
- **Niveles** (`ChatRequest.language`): `standard` (sin cambios), `plain` (**lenguaje claro**, ISO 24495-1: una idea por oración, 20 palabras como máximo, voz activa) y `easy` (**Lectura Fácil**: 15 palabras como máximo, un ejemplo por idea difícil). Los textos exactos están en `LANGUAGE_INSTRUCTIONS` de `backend/app/services/ai_rules.py`; el nivel entra en la clave de caché.
- **Acciones nuevas:** «Glosario fácil» (`glossary`: hasta 8 términos, tres líneas por término) y «Esquema visual» (`visual_outline`: tema, ideas con «→», causas y consecuencias con «⇒»). Ninguna exige selección y están para todas las personas en los atajos de consulta.
- **Definir término:** con lenguaje claro o Lectura Fácil alcanza con seleccionar 3 caracteres (en estándar, 12), y una selección de 3 palabras o menos muestra «📖 Definir término», que pide un glosario de esa selección.

### Paso 3: Interfaz sin audio y avisos visibles (hecho, plan 05)
- **«Ocultar la lectura en voz alta»** (`hideAudio`) saca la sección de audio del panel de herramientas, «Escuchar este documento», «🔊 Escuchar respuesta», «🔊 Escuchar descripción» (el botón de las figuras que antes se ofrecía), «▶ Leer» y «🔊 Leer desde este párrafo» de la barra, y los atajos de lectura (`Alt+P`, `Espacio`, `Alt+S`). Los comandos de voz de lectura contestan «La lectura en voz alta está oculta».
- **«Mostrar los avisos en pantalla»** (`visualAlerts`): cada anuncio (el que oiría un lector de pantalla) queda en un recuadro arriba a la derecha hasta el siguiente o hasta «Cerrar aviso». No desaparece solo (criterio 2.2.1) y no es una región `aria-live`.

### Paso 4: Subtítulos en vivo de la clase (hecho, plan 05)
- `features/assistant/LiveCaptions.tsx` y `useLiveCaptions.ts`, sobre `createRecognizer` (continuo, con resultados parciales, `es-AR`).
- **Privacidad.** Las últimas 200 líneas se guardan **solo en memoria** y se borran al salir del lector o con «Borrar»: nunca van a `localStorage`, IndexedDB ni al servidor. Piden un consentimiento propio («captions»), que recuerda que hay que pedirle permiso al docente. Que alguien lo haya aceptado puede sugerir una pérdida auditiva (dato sensible, Ley 25.326): se guarda solo en este navegador y se puede retirar con «Revocar permiso del micrófono».
- **No se callan cuando habla la app** (`pauseWhileAppSpeaks: false`): no pueden perderse lo que dice el docente. Con `hideAudio` la app casi no habla.
- «✦ Explicar en lenguaje claro lo último» manda los últimos 1500 caracteres como selección con la acción `simplify` y el nivel de lenguaje elegido (o lenguaje claro si estaba en estándar).
- **Alternativa recomendada:** los subtítulos del sistema operativo son más robustos que el reconocimiento del navegador: «Transcripción instantánea» en Android y los subtítulos en vivo de Windows 11. La app lo dice cuando el navegador no soporta voz.

---

## 4. Criterios de aceptación y pruebas automatizadas

1. **Backend:** `tests/unit/test_ai_rules.py`, `test_ai_service.py` y `tests/api/test_ai.py` (niveles y acciones nuevas, el nivel en la caché, 422 con un lenguaje desconocido); `test_presets.py` y `test_seed.py` (preset `sordera`).
2. **Frontend (`app.test.tsx`):** lenguaje en cada consulta, glosario y esquema, «Definir término», interfaz sin audio (botones, atajos y barra), avisos en pantalla y subtítulos (consentimiento, parciales, explicar, borrar, revocar, salir del lector sin dejar nada).
3. **`lib/voice`, `lib/speech.bus.test.ts`:** pausa opcional del reconocedor, errores de red por sesión limpia, `stop()`/`start()` seguidos y el vigilante de fin de voz.

**Pendiente de prueba manual** (ver [`docs/accesibilidad.md`](../accesibilidad.md)): comparar «Resumir» en estándar y en lenguaje claro con una key real, y medir la precisión de los subtítulos con el micrófono de una notebook a 3 m de distancia. No se hicieron en la construcción (sin navegador con micrófono), así que **no hay una precisión medida**.
