# Seguridad

Qué protegemos, de qué, con qué, y qué queda sin resolver. Las decisiones están en los ADR [0002](adr/0002-api-key-por-usuario.md) y [0003](adr/0003-key-sellada-en-cookie.md).

## Lo que hay que proteger

1. **La API key de IA de cada persona.** Es lo único valioso que pasa por el sistema. Las keys son gratuitas y sin tarjeta, así que el daño de un robo se acota a gastar la cuota gratuita de esa persona.
2. **El contenido de sus documentos.** Se procesa en el navegador; al servidor llegan solo fragmentos de texto o una imagen, y de ahí al proveedor de IA que la persona eligió.

## Cómo viaja y dónde vive la key

| Momento | Dónde está la key |
|---|---|
| Mientras se escribe en «Configurar IA» | En la página, unos segundos |
| Al probarla («Probar key y ver modelos») | En el header `X-AI-Key`, una vez |
| Al guardarla | En el cuerpo de `POST /ai/session`, una vez; vuelve sellada en una cookie `HttpOnly` |
| Entre consultas (**modo de cookie**) | Solo en la cookie sellada. La página no la tiene |
| Entre consultas (**modo de headers**, respaldo) | En `sessionStorage` o `localStorage`, y en cada consulta en `X-AI-Key` |
| En el servidor | Solo en memoria, durante el pedido. No se guarda; se tacha de los logs |
| En el proveedor | La usa para atender cada consulta |

## Capas de defensa

**Que no haya por dónde inyectar código**
- Sin `innerHTML`, `eval`, `dangerouslySetInnerHTML` ni HTML crudo. El contenido de los documentos (incluido lo que genera mammoth al leer un Word) se convierte en bloques de texto y React lo escapa.
- Sin scripts de terceros. 8 dependencias de runtime.

**Que, aun con una inyección, no se pueda hacer daño** (`vercel.json`)
- CSP: `script-src 'self'` (sin scripts en línea ni inyectados), `connect-src 'self'` (sin enviar datos a otros sitios), `img-src 'self' data: blob:`, `form-action 'self'`, `frame-ancestors 'none'`, `object-src 'none'`.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` sin cámara, micrófono ni ubicación.
- **Límite conocido de la CSP:** no impide que un script redirija la página a otro sitio con datos en la dirección.

**Que la key no esté al alcance de la página** (ADR 0003)
- Cookie `__Host-aula_ai`: `HttpOnly; Secure; SameSite=Strict; Path=/`, cifrada con `SEALING_KEY`.
- Anti-CSRF: `SameSite=Strict` más el header obligatorio `X-Aula-Clara`.

**Que la key no se filtre** (se verifica con tests)
- El detalle de los errores es un texto fijo; los mensajes del proveedor se limpian antes de mostrarse (se tacha la key y lo que parezca una key, y se acotan a 300 caracteres).
- La key del pedido en curso se tacha de cualquier línea de log (`observability/redaction.py`).
- En el navegador, el error que viaja a la consola o a un reporte no lleva la key ni el header `Authorization`.
- La caché de respuestas se separa por una huella de proveedor, modelo y key.
- El proveedor se crea por pedido y se cierra siempre, también si falla.

**Que no se pueda usar el servidor para atacar a otros**
- URL base de cada proveedor fija: la persona elige un proveedor, nunca una dirección (sin SSRF).
- Límite de consultas por IP, tope de tamaño de imagen y de texto, tiempo máximo por llamada.

## Riesgos que quedan

| Riesgo | Por qué queda | Cómo se reduce |
|---|---|---|
| Una **dependencia comprometida** que se ejecute en la página | Entra en nuestro propio script; la CSP no la distingue. Puede usar la sesión mientras la pestaña esté abierta, aunque no llevarse la key | Pocas dependencias, `npm run audit:prod` en cada integración, Dependabot, revisar las actualizaciones mayores |
| El **servidor o `SEALING_KEY` comprometidos** | Quien los controla puede abrir las cookies | Es la misma confianza que ya hacía falta: el servidor veía la key en cada consulta. `SEALING_KEY` solo en variables de entorno, rotación con `SEALING_KEY_PREVIOUS` |
| Un XSS **mientras se escribe la key** | La key está en la página unos segundos | La superficie de XSS es mínima y la CSP bloquea scripts inyectados |
| **Web y backend en sitios distintos** (GitHub Pages con backend en Vercel) | Las cookies de otro sitio se bloquean | Cae solo en el modo de headers, con la key en el navegador (menos protegida) |
| Una key **perdida o robada** | Ninguna defensa es perfecta | Se recomienda una key solo para Aula Clara, en plan gratuito y sin saldo ni tarjeta: lo máximo a perder es la cuota gratuita. La guía explica cómo revocarla |

## Dependencias

**Chequeo:** `npm run audit:prod` (en `frontend/`) falla ante cualquier vulnerabilidad en lo que llega al navegador. Para Python: `uv export --no-dev --no-hashes --no-emit-project | uvx pip-audit -r /dev/stdin`. Dependabot (`.github/dependabot.yml`) abre pull requests semanales de actualización; los de seguridad dependen de activar «Dependabot security updates» en el repositorio.

**Riesgo aceptado (2026-11-18): `picomatch` ≤ 4.0.7, [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf).** Denegación de servicio (ReDoS) con patrones de archivos «extglob» repetidos. `npm audit` lo cuenta como 13 avisos de severidad alta porque `picomatch` llega a través de `vite`, `vitest` y `typescript-eslint`, y las «correcciones» que ofrece son bajar de versión esas herramientas, lo que no tiene sentido. 4.0.7 es la última versión y todavía no existe una corregida.
- **Por qué se acepta:** solo afecta a herramientas de desarrollo (no llega al navegador: `npm audit --omit=dev` da 0), y para explotarlo haría falta que un atacante controle los patrones de archivos que esas herramientas procesan, lo que en este proyecto no ocurre.
- **Cuándo revisarlo:** cuando Dependabot proponga una versión de `picomatch` posterior a 4.0.7, o al actualizar `vite`/`vitest`.
- Fuera de ese aviso, `npm audit` y `pip-audit` no encontraron nada.
