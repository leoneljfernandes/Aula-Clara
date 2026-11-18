# Mejoras pendientes

Plan de trabajo para después del MVP. La parte 1 (cada persona usa su propia API key y elige el modelo) ya está hecha: ver [ADR 0002](adr/0002-api-key-por-usuario.md). Este documento detalla las **partes 2 y 3**, más lo que quedó pendiente de la parte 1.

Orden recomendado:

1. **Parte 3, fases 3.1 a 3.3:** que el asistente busque en todo el documento (RAG en el navegador). No necesita base de datos y es la mejora que más se nota.
2. **Parte 2, fase 2.1:** perfil versionado y exportable, todavía sin servidor.
3. **Parte 2, fases 2.2 a 2.4 y parte 3, fases 3.4 a 3.6:** cuentas, base de datos y archivos en el servidor, hechos juntos, porque comparten la infraestructura.

Los nombres de modelos, los precios y los límites gratuitos cambian seguido: **verificalos en la documentación oficial antes de implementar** cada fase.

---

## Parte 2. Perfiles y usuarios (hacia una base de datos)

### Situación actual

- El perfil y las preferencias de lectura viven en `localStorage` (`features/preferences/storage.ts`), los documentos en IndexedDB, y la key de IA en `sessionStorage` o `localStorage`.
- No hay cuentas: borrar los datos del sitio borra todo, y no se puede pasar de un dispositivo a otro.
- En el backend, el catálogo de **presets** («Baja visión», «Dislexia»…) se sirve en `GET /api/v1/presets` y el frontend lo pide en runtime ([ADR 0004](adr/0004-catalogo-de-presets.md)); el CRUD de documentos guarda en memoria (`InMemoryRepository`) y nadie lo usa.

### Objetivo

Que cada persona tenga una cuenta con sus preferencias y su biblioteca, y que los datos pasen del navegador a una base de datos sin rehacer la app.

### Fase 2.1: perfil versionado y exportable, sin servidor (chica)

1. ✅ **Hecho** (2026-11-18). Los ajustes se guardan versionados: `aulaclara.settings` = `{ schemaVersion: 2, settings }`, con un único validador `FIELDS` en `features/preferences/settings.ts` y la lectura en `storage.ts` (que también acepta el objeto plano de la versión 1 y migra la clave `aulaclara.profile`). En lugar de un `UserProfile` con `migrate`, cada cambio de forma suma una versión y se valida campo a campo, con test. Cuando haya cuentas habrá que sumarle lo que no son ajustes de lectura.
2. **Exportar e importar** el perfil y las preferencias como JSON desde la pantalla de perfil. Sirve de copia de seguridad y para cambiar de dispositivo. La key de IA queda afuera por defecto; incluirla tiene que ser una opción explícita, con aviso.
3. ✅ **Hecho** (2026-11-18). En el backend `Profile` pasó a `Preset` (modelo, esquema, servicio, `seed/presets.json` y endpoint `/api/v1/presets`; `/api/v1/profiles` se eliminó), así «perfil de usuario» queda libre.

**Terminado cuando:** exportar en un navegador e importar en otro reproduce exactamente las preferencias, y un perfil guardado con la versión anterior se migra solo. (Falta el punto 2, exportar e importar; la migración de la versión anterior ya funciona.)

### Fase 2.2: base de datos y cuentas (grande)

**Propuesta: Supabase** en su nivel gratuito. Un solo servicio cubre autenticación, PostgreSQL, almacenamiento de archivos y búsqueda por vectores (pgvector), que es justo lo que piden las partes 2 y 3. Alternativas: Neon (solo Postgres) más Auth.js; o Vercel Postgres, que hoy es Neon.

1. **Autenticación por enlace mágico** (email con un link, sin contraseña). Es lo más accesible: no hay que recordar ni tipear contraseñas, ni resolver captchas.
2. **Backend:** FastAPI verifica el JWT de Supabase en una dependencia `get_current_user` de `api/deps.py`. Los services reciben el `user_id`; ningún service conoce Supabase.
3. **Persistencia:** seguir las skills `configuring-sqlalchemy-sessions`, `modeling-postgres-with-sqlalchemy` y `migrating-with-alembic` de `.skills/`. Se agrega `SqlAlchemyRepository` con la misma interfaz `Repository[T]`, y solo cambia `deps.py`.
4. **Esquema inicial:**

   | Tabla | Contenido |
   |---|---|
   | `users` | id (el de Supabase), email, creado, último acceso |
   | `user_preferences` | `user_id`, `schema_version`, `preferences` (JSONB: tipografía, tamaño, interlineado, tema, velocidad de voz) |
   | `documents` | id, `user_id`, título, materia, tipo, progreso, ruta del archivo original, estado del procesamiento |
   | `document_blocks` | `document_id`, orden, tipo (título, párrafo, lista, tabla, figura), texto, página, sección |
   | `document_chunks` | ver parte 3 |
   | `conversations` (opcional) | historial del chat por documento |

5. **Seguridad por fila** (Row Level Security): cada persona ve solo sus filas, también si alguien llama directo a Supabase.

**Terminado cuando:** una persona inicia sesión en dos dispositivos y ve las mismas preferencias y documentos.

### Fase 2.3: migrar los datos del navegador (mediana)

Al iniciar sesión por primera vez, ofrecer «Subir mis datos de este dispositivo»: preferencias, documentos y progreso de IndexedDB. Si hay conflicto, gana lo más reciente, y se pregunta antes de pisar algo. El modo sin cuenta sigue existiendo.

### Fase 2.4: privacidad y datos sensibles (obligatoria antes de producción)

- **Que alguien elija «Dislexia» o «Baja visión» revela una discapacidad: es un dato sensible** según la Ley 25.326 de Argentina. Hay que guardar solo las preferencias de lectura, no la etiqueta del preset (✅ **hecho** el 2026-11-18: el frontend no guarda qué preset se eligió, migra y borra `aulaclara.profile`, y la biblioteca ya no muestra «Perfil activo»; ver [ADR 0004](adr/0004-catalogo-de-presets.md)), y pedir consentimiento explícito e informado (pendiente, junto con las cuentas).
- Política de privacidad, borrado de cuenta con todos sus datos, y exportación de todos los datos.
- **Las API keys de IA siguen fuera de la base de datos**, también con cuentas: viven sellada en una cookie `HttpOnly` (ADR 0003), no en el servidor. Guardarlas en el servidor obliga a cifrarlas (envelope encryption) y a custodiar la clave de cifrado. Solo se justificaría si se pide sincronizarlas entre dispositivos, y aun así como opción.

### Riesgos

- Los límites del nivel gratuito de Supabase (proyectos que se pausan por inactividad, tamaño de la base y del storage): verificarlos antes de elegir.
- Las conexiones de Vercel Functions a Postgres: usar el pooler de Supabase (modo transacción) y sesiones cortas.

---

## Parte 3. Archivos, texto para la IA y RAG

### Situación actual

- PDF y Word se procesan en el navegador (pdf.js y mammoth), y los bloques extraídos se guardan en IndexedDB.
- **El asistente recibe el comienzo del documento**, recortado a `MAX_INPUT_CHARS` (12.000 caracteres), más la selección. En un apunte largo, una pregunta sobre el capítulo 5 no tiene respuesta.
- Cada «Interpretar con IA» vuelve a gastar cuota, aunque la imagen ya se haya descrito.
- Los PDF escaneados no se pueden leer (no hay reconocimiento de texto, u OCR).

### Objetivo

Que el asistente responda sobre **todo** el documento citando de dónde sacó la respuesta, con un formato de documento que la IA y los lectores de pantalla entiendan bien, y que los archivos queden guardados en la cuenta de cada persona.

### Fase 3.1: fragmentar el documento (chica)

1. A partir de los bloques que ya genera `lib/extractors`, armar fragmentos de unas 300 a 500 palabras que respeten títulos y párrafos, con una superposición de un párrafo.
2. Cada fragmento lleva `documentId`, orden, página, sección (el último título) y el texto.
3. Guardarlos en IndexedDB junto al documento, en un *store* nuevo (`chunks`).

### Fase 3.2: búsqueda por palabras clave en el navegador (chica, sin modelos)

1. Indexar los fragmentos con **MiniSearch** (BM25), configurado para español: minúsculas, sin acentos, sin palabras vacías.
2. Ante una pregunta, tomar los 5 a 8 fragmentos más relevantes, más el de la sección que se está leyendo y la selección.
3. **Cambio de API:** `ChatRequest` recibe `context_chunks: [{text, page, section}]` en lugar de `document_text`. `ai_rules.build_context` los arma con etiquetas `<fragmento pagina="12">` y el recorte por `MAX_INPUT_CHARS` se mantiene.
4. Para «Resumir» y «Conceptos clave», que necesitan una visión global, mandar el comienzo del documento más un fragmento por sección.

**Terminado cuando:** en un documento de prueba de 50 páginas, una pregunta sobre un tema de la última sección se responde bien. Agregar ese caso como test con un documento sintético.

### Fase 3.3: embeddings y búsqueda híbrida, todavía en el navegador (mediana)

El RAG es «dinámico» porque el índice se arma al importar y se actualiza solo si el documento cambia, no en cada pregunta.

- **Opción A, local y gratis (recomendada por defecto):** transformers.js con un modelo multilingüe chico (por ejemplo, de la familia e5-small, cuantizado). Funciona sin conexión y el texto no sale del navegador. Costo: la primera vez descarga el modelo, del orden de decenas de MB; hay que medir el tamaño real y avisarlo antes. Corre en un Web Worker para no trabar la interfaz.
- **Opción B, con la key de la persona:** el endpoint de embeddings de Gemini, mediante un `POST /api/v1/ai/embed` nuevo con los mismos headers `X-AI-*`. No hay descarga, pero gasta cuota y el texto viaja al proveedor. Groq no ofrece embeddings: no contar con él.

Los vectores se guardan en IndexedDB (`Float32Array`), junto con **el nombre del modelo que los generó**, porque vectores de modelos distintos no se pueden comparar. Para un solo documento alcanza con comparar contra todos: unos miles de fragmentos con 384 dimensiones se resuelven en milisegundos. Se combinan los dos rankings (BM25 y vectores) con *reciprocal rank fusion*.

### Fase 3.4: citas y navegación accesible (chica)

- El prompt pide citar la página: «(pág. 12)». La interfaz convierte cada cita en un enlace que lleva al párrafo y lo resalta.
- Para quien usa lector de pantalla, saltar a la fuente es tan importante como la respuesta.

### Fase 3.5: formato canónico del documento (mediana)

- Un solo formato de **bloques estructurados**: título (con nivel), párrafo, lista, tabla y figura (con su texto alternativo). Se exporta a Markdown para la IA y se renderiza para leer.
- **Guardar las descripciones de imágenes**: la primera vez que se usa «Interpretar con IA», la descripción queda como texto alternativo permanente de la figura. El lector de pantalla la lee sin volver a gastar cuota.
- **Tablas:** hoy pdf.js las aplana. Detectarlas es difícil, así que primero hay que conservarlas bien en Word, que sí trae estructura.
- **OCR para PDF escaneados:** Tesseract.js en el navegador, gratis pero lento, o un modelo con visión usando la key de la persona. Ofrecerlo cuando una página no tiene texto extraíble.

### Fase 3.6: archivos en el servidor (grande, junto con la parte 2)

1. **El original** se sube a un almacenamiento privado (Supabase Storage o Vercel Blob), con URLs firmadas de corta duración, en una carpeta por usuario.
2. **La extracción sigue en el navegador:** las funciones de Vercel tienen un tope de alrededor de 4,5 MB por pedido y un tiempo máximo de ejecución. Se suben los bloques ya extraídos y, si se usaron, los vectores.
3. **pgvector:** `document_chunks(document_id, orden, página, sección, texto, embedding vector(n), modelo)` con un índice HNSW, filtrado por `user_id` y con seguridad por fila. La búsqueda pasa al servidor solo si se necesita buscar en varios documentos a la vez («en todos mis apuntes de Historia»). Para un solo documento, el navegador alcanza.
4. **Cuotas por usuario:** tamaño máximo por archivo y espacio total, para no pasarse del nivel gratuito.

### Riesgos

- **Calidad de la extracción:** una mala extracción arruina el RAG. Probar con apuntes reales de cátedra, que suelen ser PDF escaneados o con dos columnas.
- **Peso del modelo de embeddings:** puede ser mucho para conexiones móviles. Hacerlo opcional, avisar el tamaño y caer a búsqueda por palabras clave.
- **Privacidad:** los fragmentos que se mandan al proveedor salen del navegador. Mantener el aviso «No subas documentos con datos personales».

---

## Pendientes de la parte 1 (keys por persona)

- **Probar OpenRouter con una key real.** Está cubierto con dobles; Gemini (chat e imagen) y Groq (chat) se probaron con keys reales en Chromium.
- **Desplegar en Vercel y verificar** que la CSP y la cookie sellada funcionen en producción (con `SEALING_KEY` cargada en las variables de entorno). Se probó localmente sirviendo `dist/` con los mismos headers.
- **Probar la cookie sellada en Safari y Firefox.** Solo se probó en Chromium; si la cookie no vuelve, la app lo detecta y usa el modo de headers, pero no se vio.
- **Cookie con la web en GitHub Pages:** hoy cae al modo de headers. Para evitarlo habría que servir la web desde el mismo sitio que el backend (por ejemplo, un dominio propio con las dos partes).
- **Historial del chat:** hoy cada pregunta viaja sola, así que «explicámelo más simple» no tiene contexto. Mandar los últimos N mensajes.
- **Respuestas en streaming** (SSE): menos espera percibida y menos riesgo de pasar el `maxDuration` de 30 s. Para accesibilidad, anunciar la respuesta por `aria-live` al final, no de a pedazos.
- **Caché y límite por IP compartidos:** en Vercel cada instancia tiene los suyos. Si hace falta un límite estricto, Upstash Redis tiene nivel gratuito.
- **Llamada directa desde el navegador** al proveedor, como modo opcional, para quien no quiera que su key pase por el servidor (ver ADR 0002).
