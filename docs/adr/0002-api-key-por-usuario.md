# ADR-0002: Cada persona usa su propia API key y elige el modelo

- **Fecha:** 2026-11-17
- **Estado:** aceptada
- **Reemplaza:** la configuración de IA del servidor (`AI_PROVIDER`, `GEMINI_*`, `GROQ_*` en `.env`)

## Contexto

Hasta ahora el backend usaba una sola key de Gemini (y una de Groq como respaldo) cargadas en el `.env` del servidor. Para publicar Aula Clara en Vercel y que cualquiera la pruebe eso no escala: todas las personas comparten la cuota gratuita de una sola cuenta, el dueño del despliegue paga o se queda sin servicio, y los modelos quedan fijos en una variable de entorno aunque los proveedores los cambian seguido. Por ejemplo, `llama-3.3-70b-versatile`, configurado en el MVP, ya no figura en la lista de Groq.

## Decisión

1. **El servidor no tiene keys ni modelos de IA.** Se retiraron de `Settings` y de `.env.example`.
2. **La persona configura la IA en la app** («Configurar IA»): elige entre Gemini, Groq, OpenRouter, Mistral o NVIDIA Build (estos dos se sumaron el mismo día), pega su key, la app la valida contra el proveedor y le muestra los modelos que esa key puede usar.
3. **La key vive en el navegador**: en `sessionStorage` por defecto y en `localStorage` solo si la persona marca «Recordar en este dispositivo».
4. **El navegador manda la key al backend en cada consulta**, en los headers `X-AI-Provider`, `X-AI-Model` y `X-AI-Key`. El backend crea el proveedor para ese pedido, no la guarda y no la loguea.
5. **Proveedores con URL base cerrada.** Gemini usa su SDK; Groq, OpenRouter, Mistral y NVIDIA Build comparten `OpenAICompatibleProvider`, con sus diferencias declaradas en `SPECS`. La persona elige un proveedor, nunca una URL.
6. **Errores separados**, porque ahora la persona puede resolverlos: key rechazada, cuota (por minuto, por día o sin saldo), texto o imagen demasiado grandes, filtros de seguridad, modelo inexistente o sin visión, cuenta sin acceso o región no admitida, respuesta vacía, proveedor caído o lento, y falta de configuración. Cada uno tiene su código, un `reason` y, si el proveedor lo informa, cuánto esperar. La lista completa está en `docs/arquitectura.md` §4.3. Los textos del proveedor se muestran solo después de tachar la key.
7. **Validación honesta de la key.** Groq, Mistral y Gemini exigen key para listar modelos, así que listar ya la valida. OpenRouter publica su lista, y por eso se valida antes con `GET /key`. NVIDIA Build publica su lista y no tiene forma de validar la key sin gastar una consulta: la respuesta dice `key_verified: false` y la app lo avisa.
8. **Guía para conseguir la key** (`/ayuda/ia`, pública), enlazada desde «Configurar IA», con el paso a paso de cada proveedor.

## Alternativas descartadas

- **Que el navegador llame directo al proveedor.** La key nunca pasaría por el servidor, lo que mejora la privacidad. Se descartó por ahora: habría que duplicar en el frontend los prompts, el recorte del texto y la clasificación de errores, y no todos los proveedores aceptan pedidos desde un navegador (CORS). Queda como opción si la confianza en el servidor pasa a ser un problema.
- **Guardar las keys en el servidor** (con cuentas de usuario). Obliga a cifrarlas y a custodiar la clave de cifrado. No vale la pena para un proyecto open source. Ver `docs/mejoras-pendientes.md`.
- **Mantener una key del servidor como respaldo.** Se descartó a pedido: el despliegue público no debe gastar la cuota de nadie más que la de quien consulta.

## Consecuencias

- Sin key configurada, el asistente y «Interpretar con IA» no funcionan; el resto de la app (biblioteca, lector, voz) sí.
- **Un XSS podría robar la key** mientras vive en el navegador. Por eso `vercel.json` agrega una CSP estricta y otros headers de seguridad, y el [ADR 0003](0003-key-sellada-en-cookie.md) la saca de la página: queda sellada en una cookie `HttpOnly`.
- La key **pasa por el servidor**. La app lo dice en «Configurar IA», y un test verifica que no aparece en las respuestas ni en los logs.
- La caché de respuestas se separa por una huella (hash SHA-256) de proveedor, modelo y key, así que nadie recibe una respuesta pagada con la cuota de otra persona.
- El límite por IP sigue: protege el tiempo de función de Vercel, no la cuota de los proveedores.
- Con «Interpretar con IA» hay que elegir un modelo que lea imágenes; si no, el proveedor rechaza el pedido y la app lo explica.
- GitHub Pages sigue necesitando `VITE_API_URL`. Los headers `X-AI-*` están permitidos en CORS.
