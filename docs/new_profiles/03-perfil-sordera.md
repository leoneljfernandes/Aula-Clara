# 03 · Perfil Sordera / Hipoacusia (`id: "sordera"`)

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

## 3. Plan de implementación paso a paso

### Paso 1: Preset `sordera` en Preferencias y Backend
- **Archivos a modificar:**
  - [`frontend/src/features/preferences/config.ts`](../../frontend/src/features/preferences/config.ts)
  - [`backend/app/seed/profiles.json`](../../backend/app/seed/profiles.json)
  - [`backend/app/models/profile.py`](../../backend/app/models/profile.py) y [`backend/app/schemas/profile.py`](../../backend/app/models/profile.py)
- **Configuración del preset:**
  ```json
  {
    "id": "sordera",
    "title": "Sordera / Hipoacusia",
    "icon": "👁",
    "description": "Explicaciones en Español Claro (Lectura Fácil), glosario visual, esquemas y subtítulos en vivo.",
    "tags": ["Español Claro (L2)", "Glosario y esquemas", "Subtítulos en vivo"],
    "preset": {
      "font": "atkinson",
      "font_size": 20,
      "line_height": 1.8,
      "theme": "claro",
      "audio_focus": false,
      "plain_language_ai": true,
      "hide_audio_controls": true
    }
  }
  ```

### Paso 2: Ampliación de Acciones y Prompts de IA en el Backend
- **Archivos a modificar:**
  - [`backend/app/models/chat.py`](../../backend/app/models/chat.py) y [`backend/app/schemas/ai.py`](../../backend/app/schemas/ai.py):
    - Ampliar `ChatAction` (`Literal["free", "summarize", "key_concepts", "quiz", "simplify", "glossary", "visual_outline"]`).
    - Agregar campo opcional `plain_language: bool = False` en `ChatRequest`.
  - [`backend/app/services/ai_rules.py`](../../backend/app/services/ai_rules.py) y [`backend/app/prompts/study_assistant.md`](../../backend/app/prompts/study_assistant.md):
    - Definir las instrucciones para `glossary` (tabla/fichas de vocabulario con definición simple + ejemplo concreto) y `visual_outline` (esquema jerárquico visual).
    - Cuando `plain_language=True`, inyectar la directiva de **Lectura Fácil / Español Claro (ISO 24495-1)** aplicable a todas las respuestas.

### Paso 3: Adaptación Visual del Lector y del Panel del Asistente
- **Archivos a modificar:**
  - [`frontend/src/features/reader/ToolsPanel.tsx`](../../frontend/src/features/reader/ToolsPanel.tsx) y [`frontend/src/features/reader/DocumentView.tsx`](../../frontend/src/features/reader/DocumentView.tsx): respetar `settings.hideAudioControls` para ocultar los controles de voz.
  - [`frontend/src/features/assistant/AssistantPanel.tsx`](../../frontend/src/features/assistant/AssistantPanel.tsx) y [`frontend/src/features/assistant/useChat.ts`](../../frontend/src/features/assistant/useChat.ts):
    - Mostrar los botones rápidos **«📖 Glosario fácil»** y **«🗺 Esquema visual»**.
    - Enviar `plain_language: settings.plainLanguageAI` en los pedidos a `/api/v1/ai/chat`.
    - Al seleccionar una sola palabra o término corto en el texto (bajar el umbral mínimo de selección de 12 a 3 caracteres cuando `plainLanguageAI` está activo), mostrar el botón flotante **«📖 Definir término simple»**.

### Paso 4: Componente de Subtítulos en Vivo (`frontend/src/features/assistant/LiveCaptions.tsx`)
- Panel desplegable en el lector que usa `SpeechRecognition` en modo continuo (`interimResults: true`) para mostrar subtítulos en vivo con las preferencias visuales del usuario (`readingStyle(settings)`) y botón para enviar el fragmento transcripto al asistente de IA.

---

## 4. Criterios de aceptación y pruebas automatizadas

1. **Tests unitarios de Backend (`backend/tests/unit/test_ai_rules.py` y `backend/tests/api/test_ai.py`):**
   - Verificar que `action="glossary"` y `action="visual_outline"` sean aceptados por `/api/v1/ai/chat`.
   - Verificar que `plain_language=True` incluya las reglas de Español Claro / Lectura Fácil en el prompt construido y forme parte de la clave de caché (`answer_cache.py`) para no mezclar respuestas estándar con respuestas en Lectura Fácil.
2. **Tests de Frontend (`frontend/src/app.test.tsx`):**
   - Al elegir el perfil **Sordera / Hipoacusia**, comprobar que los botones de reproducción de voz (`Reproducir lectura`) no se renderizan, que aparecen las acciones **«Glosario fácil»** y **«Esquema visual»**, y que las llamadas a `/api/v1/ai/chat` envían `plain_language: true`.
