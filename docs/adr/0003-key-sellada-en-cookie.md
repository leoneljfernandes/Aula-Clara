# ADR-0003: La API key de cada persona va sellada en una cookie `HttpOnly`

- **Fecha:** 2026-11-18
- **Estado:** aceptada
- **Complementa:** [ADR 0002](0002-api-key-por-usuario.md). Cada persona sigue usando su propia key; cambia dónde vive entre consulta y consulta.

## Contexto

En el ADR 0002 la key vivía en el navegador (`sessionStorage` o `localStorage`) y viajaba en el header `X-AI-Key` en cada consulta. El riesgo que quedaba abierto: si la página sufriera una inyección de scripts (XSS), el código malicioso podría leer la key y llevársela.

La superficie de XSS de la app ya es chica (no usa `innerHTML`, `eval` ni HTML crudo; el contenido de los documentos se muestra como texto; no carga scripts de terceros; 8 dependencias de runtime) y la CSP bloquea scripts inyectados y el envío de datos a otros sitios. Aun así, **ninguna defensa que deje la key legible por JavaScript elimina el riesgo**. Una dependencia comprometida, por ejemplo, entra en el propio script de la app y la CSP no la distingue.

## Decisión

1. **La key se sella en el servidor y vive en una cookie `HttpOnly`.** Al guardar en «Configurar IA», el navegador manda la key una sola vez (`POST /api/v1/ai/session`). El servidor la cifra y autentica con `SEALING_KEY` (Fernet: AES más HMAC) y la devuelve en la cookie `__Host-aula_ai`, con `HttpOnly; Secure; SameSite=Strict; Path=/`. El JavaScript de la página no puede leerla.
2. **No hay base de datos ni estado en el servidor.** El sello lleva adentro, cifrado, el proveedor, la key y el vencimiento; solo se puede abrir con `SEALING_KEY`. El vencimiento no se puede alargar desde afuera.
3. **Cada consulta manda la cookie sola.** El navegador no manda `X-AI-Key`: el servidor abre la cookie, arma el proveedor y hace el pedido. La página conserva solo proveedor y modelo, que no son secretos.
4. **Protección contra CSRF** (que otro sitio use la cookie de la persona): `SameSite=Strict`, el prefijo `__Host-` y un header obligatorio `X-Aula-Clara: 1` en todo pedido que use la cookie. Un `fetch` desde otro sitio lo convierte en una verificación CORS que el servidor no autoriza.
5. **El modo de headers sigue existiendo como respaldo.** Si el servidor no tiene `SEALING_KEY`, o el navegador no acepta la cookie, la app guarda la key en el navegador como antes. Un pedido con `X-AI-Key` gana sobre la cookie. Para saber cuál usar, al guardar la app sella y comprueba con `GET /api/v1/ai/session` que la cookie vuelve; si no, usa el respaldo y lo explica.
6. **Vida de la cookie:** sin «Recordar en este dispositivo», cookie de sesión del navegador y como máximo 12 horas en el servidor (`AI_SESSION_HOURS`); con «recordar», 30 días (`AI_SESSION_REMEMBER_DAYS`).
7. **Rotación:** `SEALING_KEY_PREVIOUS` permite abrir lo sellado con la clave anterior mientras todo lo nuevo se sella con la actual, sin cerrar la sesión de nadie.

## Qué se gana

- Un script malicioso en la página **ya no puede leer ni llevarse la key**: no está en `document.cookie`, `localStorage`, `sessionStorage` ni en el DOM. Lo verifica un test en un navegador real.
- Lo máximo que puede hacer ese script es **usar la sesión mientras la pestaña esté abierta**, con el límite de consultas por IP que ya existe, y no puede conservar nada para usar después.
- No se suma confianza nueva en el servidor: **ya veía la key en cada consulta** (ADR 0002).

## Qué no se resuelve

- Quien controle el servidor o su `SEALING_KEY` puede abrir las cookies. Es la misma confianza que ya hacía falta.
- Mientras la persona escribe la key en el diálogo, está en la página. Un XSS activo en ese momento podría capturarla; la ventana es de segundos y una sola vez, y no la de todo el uso.
- Una dependencia comprometida que consiga ejecutarse en la página puede hacer consultas con la sesión abierta. Se reduce con pocas dependencias, `npm audit` y Dependabot (ver `docs/seguridad.md`), no con el lugar donde está la key.

## Limitaciones conocidas

- **La web y el backend deben compartir sitio** (como en Vercel con un solo proyecto). Con la web en GitHub Pages y el backend en Vercel la cookie es de otro sitio y Safari, Firefox y, cada vez más, Chrome la bloquean; el servidor no habilita CORS con credenciales a propósito. Ese caso cae solo en el modo de headers.
- **Una variable de entorno más** (`SEALING_KEY`). Si se cambia sin `SEALING_KEY_PREVIOUS`, quienes tengan una key sellada ven «tu sesión de IA venció» y la cargan de nuevo.
- **La key sellada no se puede mostrar.** El diálogo permite cambiar el modelo, pegar una key nueva o borrarla; para cambiar «Recordar» hay que volver a pegar la key.
- **Probado** en Chromium (servidor de pruebas con los mismos headers de `vercel.json` y servidor de desarrollo de Vite). **Sin probar** en Safari ni Firefox; si la cookie no vuelve, la comprobación detecta el problema y se usa el respaldo.

## Alternativas descartadas

- **Guardar las keys en una base de datos, con cuentas.** Obliga a custodiar keys ajenas durante meses y a depender de la parte 2.
- **Cifrar la key en el navegador con una contraseña.** Protege contra alguien que mire el disco, no contra un script en la página, que puede esperar a que la persona la tipee.
- **Trusted Types.** Se probó: rompe la importación de Word y bloquea una URL de script, para proteger de algo que la app no hace (no inserta HTML). No aporta.
- **Key solo en memoria.** Un script inyectado también puede interceptar los pedidos.
