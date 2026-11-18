# ADR-0004: El catálogo de presets vive en el backend y las capacidades, en el frontend

- **Fecha:** 2026-11-18
- **Estado:** aceptada
- **Reemplaza:** la decisión de [arquitectura.md §11](../arquitectura.md#11-qué-cambió-respecto-del-plan-inicial) según la cual el frontend usaba su propia copia de los perfiles y `GET /profiles` solo «demostraba la arquitectura».

## Contexto

Hasta ahora había dos copias de los perfiles: `PROFILES` en el frontend y `profiles.json` en el backend, que el frontend nunca consultaba. Agregar un perfil obligaba a editar las dos y a desplegar el frontend, y nada garantizaba que coincidieran.

Se suman perfiles para ceguera, discapacidad motriz, sordera y daltonismo ([hoja de ruta](../new_profiles/2026-11-18-perfiles-00-hoja-de-ruta.md)). Cada uno combina ajustes que ya existen con otros nuevos, y el catálogo va a seguir creciendo. Hace falta separar dos cosas que cambian a distinto ritmo: **qué presets existen** (textos y valores) y **qué sabe hacer la app** (los ajustes y su comportamiento).

Además, que alguien elija «Ceguera» o «Sordera» revela una discapacidad, que es un dato sensible según la Ley 25.326 (ver [mejoras-pendientes.md, Fase 2.4](../mejoras-pendientes.md)). La app guardaba qué perfil se había elegido (`aulaclara.profile`) y la biblioteca lo mostraba en una caja «Perfil activo».

## Decisión

1. **El catálogo está en el backend.** `backend/app/seed/presets.json` define los presets y `GET /api/v1/presets` los devuelve (sin paginar, `list[PresetRead]`). El backend guarda los ajustes de cada preset como pares clave-valor y no los interpreta. `Profile` pasa a llamarse `Preset` y `/api/v1/profiles` se elimina (el frontend nunca lo usó).
2. **Las capacidades están en el frontend.** Qué ajustes existen y cómo se validan lo define un único validador `FIELDS` en `features/preferences/settings.ts`. Cada ajuste tiene su control en el registro `CONTROLS` (`controls.ts`), y `SettingsControls` genera la interfaz de ajustes a partir de ese registro, tanto en el onboarding como en el lector.
3. **Contrato por test.** `presets.contract.test.ts` lee `presets.json` y falla si un preset usa un ajuste o un valor que el frontend no conoce.
4. **El frontend pide el catálogo en runtime** (`features/preferences/presets.ts`) y valida todo lo que llega con la misma función que valida `localStorage` (`sanitizePatch`): un valor desconocido se descarta y nunca rompe la app. El pedido tiene un timeout de 5 s y no reintenta, para que el onboarding no espere.
5. **Caché y respaldo.** El último catálogo bueno queda en `localStorage` (`aulaclara.presets`). Una respuesta vacía o toda inválida no pisa una caché buena. Sin backend y sin caché, el onboarding ofrece solo **«Personalizado»**, una opción fija del frontend, con un aviso. El id `custom` está reservado: un preset del catálogo con ese id se descarta.
6. **Ajustes versionados.** `aulaclara.settings` guarda `{ "schemaVersion": 2, "settings": { … } }`. Se sigue leyendo el objeto plano de la versión 1, y cada campo se valida por separado.
7. **No se guarda qué preset se eligió.** Solo se guardan los ajustes y la marca `aulaclara.onboarded`. Quien tiene la clave vieja `aulaclara.profile` entra directo a la biblioteca: se migra a `aulaclara.onboarded` y la clave se borra. La guarda `requireOnboarding` reemplaza a `requireProfile`, y las rutas tienen `hydrateFallbackElement` mientras se lee lo guardado.
8. **Se quitó la caja «Perfil activo» de la biblioteca.** Mostrar el preset elegido en pantalla exponía una categoría sensible a cualquiera que mire el monitor, y para el uso de la app no aporta: los ajustes ya están aplicados. Es una decisión de producto, no un faltante. Cuando alguien vuelve a `/perfil`, el wizard marca el preset cuyos valores coinciden con los ajustes guardados (`matchPreset`), sin guardar nada más.
9. **`Stepper` en lugar de controles deslizantes.** El tamaño y el interlineado se ajustan con botones «−» y «+», sin arrastrar, por el criterio 2.5.7 de WCAG 2.2.

## Qué se gana

- **Un preset nuevo que combina capacidades existentes no requiere desplegar el frontend:** se edita `presets.json`, se despliega el backend y el frontend lo muestra. El contrato por test avisa antes de que se publique algo que la app no entiende.
- **Una sola fuente de verdad** para el catálogo y una sola para qué es un ajuste válido.
- **Menos datos sensibles en el navegador:** la discapacidad que alguien declara no queda registrada ni visible.
- **Una capacidad nueva tiene un camino corto:** un campo en `ReadingSettings`, su entrada en `FIELDS`, su valor por defecto y una entrada en `CONTROLS`.

## Consecuencias

- **Una capacidad nueva sí requiere código y un despliegue del frontend.** Un preset no puede inventar un ajuste: lo que el frontend no conoce se descarta.
- **En GitHub Pages, el catálogo necesita `VITE_API_URL`** (variable de repositorio que lee `pages.yml`) apuntando al backend, **y el origen de Pages (`https://<usuario>.github.io`) tiene que estar en `CORS_ORIGINS`** del backend. Sin eso, el pedido falla y el onboarding ofrece solo «Personalizado» (o el último catálogo en caché). En Vercel, con la web y el backend en el mismo sitio, no hace falta configurar nada.
- **El catálogo depende de la red la primera vez.** Con un navegador sin caché y el backend caído, no hay presets; «Personalizado» siempre funciona.
- **Lo que no se guarda no se puede mostrar:** la app no sabe, y no va a saber, con qué preset empezó cada persona.
- **El catálogo se queda en memoria en el servidor,** como los documentos, hasta que haya base de datos. Es de solo lectura.

## Alternativas descartadas

- **Dejar el catálogo en el frontend.** Era lo que había. Cada preset obliga a un despliegue y a mantener dos copias.
- **Que el backend entienda los ajustes** (esquema fuerte en Python). Duplica el conocimiento de las capacidades y obliga a tocar el backend por cada capacidad nueva. Un mapa clave-valor y un test de contrato alcanzan.
- **Guardar el preset elegido** para mostrarlo en la biblioteca. Mantiene un dato sensible sin necesidad.
