import { type ApiError, isApiRequestError, type ProblemDetails } from "@/lib/http";

import { providerLabel } from "./providers";

/** No hay key configurada: no se llega a llamar a la API. */
export class MissingCredentialsError extends Error {
  override readonly name = "MissingCredentialsError";
  constructor() {
    super("No AI credentials configured");
  }
}

/** No se pudo armar la imagen para enviarla (antes de tocar la red). */
export class ImageUnavailableError extends Error {
  override readonly name = "ImageUnavailableError";
  constructor() {
    super("Could not prepare the image");
  }
}

/** Topes que el backend valida (schemas/ai.py): la interfaz los respeta para no mandar pedidos que fallarían. */
export const LIMITS = { message: 2_000, selection: 20_000 } as const;

const SETUP = "«Configurar IA»";
const GENERIC = "Algo salió mal con el asistente. Probá de nuevo.";

/** Errores cuya solución está en «Configurar IA»: falta la key, la rechazaron, o el modelo o la cuenta no sirven. */
const SETUP_CODES = new Set([
  "ai_credentials_required",
  "ai_key_invalid",
  "ai_quota_exceeded",
  "ai_model_rejected",
  "ai_model_not_found",
  "ai_image_rejected",
  "ai_permission_denied",
  "ai_response_empty",
]);

/** Errores donde conviene mostrar lo que dijo el proveedor: es lo que explica el motivo exacto. */
const SHOW_PROVIDER_MESSAGE = new Set([
  "ai_quota_exceeded",
  "ai_input_too_large",
  "ai_content_blocked",
  "ai_response_empty",
  "ai_permission_denied",
  "ai_model_not_found",
  "ai_image_rejected",
  "ai_model_rejected",
  "ai_unavailable",
]);

function problemOf(error: unknown): ProblemDetails | null {
  if (!isApiRequestError(error)) return null;
  return "problem" in error.error ? error.error.problem : null;
}

/** true si la solución está en «Configurar IA». */
export function needsAISetup(error: unknown): boolean {
  return error instanceof MissingCredentialsError || SETUP_CODES.has(problemOf(error)?.code ?? "");
}

/** «34 segundos», «unos 3 minutos», «más de una hora». */
export function formatWait(seconds: number): string {
  if (seconds < 90) {
    const n = Math.max(1, Math.ceil(seconds));
    return n === 1 ? "1 segundo" : `${n} segundos`;
  }
  if (seconds < 3_600) return `unos ${Math.ceil(seconds / 60)} minutos`;
  return "más de una hora";
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function describeProblem(problem: ProblemDetails, retryAfterMs: number | null): string | null {
  const reason = str(problem.reason);
  const provider = str(problem.provider);
  const name = provider ? providerLabel(provider) : "el proveedor";
  const model = str(problem.model);
  const seconds =
    typeof problem.retry_after_seconds === "number"
      ? problem.retry_after_seconds
      : retryAfterMs
        ? retryAfterMs / 1000
        : null;
  const wait = seconds ? ` Probá de nuevo en ${formatWait(seconds)}.` : "";

  let text: string | null;
  switch (problem.code) {
    case "ai_credentials_required":
      text =
        reason === "session_expired"
          ? `Tu sesión de IA venció o ya no es válida. Volvé a cargar tu key en ${SETUP}.`
          : `Para usar la IA, cargá tu API key y elegí un modelo en ${SETUP}.`;
      break;
    case "forbidden":
      text = "El servidor rechazó la consulta por seguridad. Recargá la página e intentá de nuevo.";
      break;
    case "ai_key_invalid":
      text = `${name === "el proveedor" ? "El proveedor" : name} rechazó tu API key. Revisá que la copiaste completa y que no esté vencida o borrada, o creá una nueva (la guía está en ${SETUP}).`;
      break;
    case "ai_quota_exceeded":
      text =
        reason === "credit"
          ? `Tu cuenta de ${name} no tiene saldo para este modelo. Elegí uno gratuito en ${SETUP} o cargá crédito en el proveedor.`
          : reason === "daily"
            ? `Llegaste al límite diario de ${name}.${wait || " Probá mañana"} O elegí otro modelo o proveedor en ${SETUP}.`
            : `Superaste el límite de consultas por minuto de ${name}.${wait || " Esperá un momento y probá de nuevo."}`;
      break;
    case "ai_input_too_large":
      text = `Lo que mandaste es demasiado grande para este modelo (texto largo o imagen pesada). Seleccioná un fragmento más corto, usá una imagen más chica o elegí un modelo con más capacidad.`;
      break;
    case "ai_content_blocked":
      text = `El filtro de seguridad de ${name} bloqueó esta consulta o su respuesta. Probá con otra pregunta, otro fragmento u otro modelo.`;
      break;
    case "ai_response_empty":
      text =
        reason === "length"
          ? `El modelo gastó todo su límite de respuesta «pensando» y no llegó a contestar. Probá con una pregunta más simple o elegí en ${SETUP} un modelo que no sea de razonamiento.`
          : "El modelo no devolvió ninguna respuesta. Probá de nuevo o elegí otro modelo.";
      break;
    case "ai_permission_denied":
      text =
        reason === "region"
          ? `${name === "el proveedor" ? "El proveedor" : name} no está disponible en tu región con esta cuenta.`
          : `Tu cuenta de ${name} no tiene acceso a este modelo. Elegí otro en ${SETUP}.`;
      break;
    case "ai_model_not_found":
      text = `El modelo ${model ? `«${model}» ` : ""}no existe, fue dado de baja o tu cuenta no tiene acceso. Elegí otro en ${SETUP}.`;
      break;
    case "ai_image_rejected":
      text = `Este modelo no pudo leer la imagen: puede que no lea imágenes o que el formato no sea compatible. Elegí uno que diga «lee imágenes» en ${SETUP}.`;
      break;
    case "ai_model_rejected":
      text = `${name === "el proveedor" ? "El proveedor" : name} no aceptó la consulta. Probá con otro modelo en ${SETUP}.`;
      break;
    case "ai_unavailable":
      text =
        reason === "timeout"
          ? `${name === "el proveedor" ? "El proveedor" : name} tardó demasiado en responder. Probá de nuevo, con un fragmento más corto o con un modelo más rápido.`
          : reason === "overloaded"
            ? `${name === "el proveedor" ? "El proveedor" : name} está saturado ahora. Probá de nuevo en unos minutos o elegí otro modelo.`
            : reason === "unreachable"
              ? `No pudimos comunicarnos con ${name}. Probá de nuevo en unos minutos.`
              : `${name === "el proveedor" ? "El proveedor" : name} no respondió. Probá de nuevo en unos minutos.`;
      break;
    case "rate_limited":
      text = `Hiciste muchas consultas seguidas.${wait}`;
      break;
    case "validation_error":
      text = describeValidation(problem);
      break;
    case "http_413":
      text = "La imagen es demasiado grande (máximo 4 MB). Probá con una más chica.";
      break;
    case "http_415":
      text = "Ese formato de imagen no es compatible. Se admiten JPEG, PNG, WebP y GIF.";
      break;
    case "http_422":
      text = "La imagen está vacía o no se pudo leer. Probá con otra.";
      break;
    case "internal_error":
      text = "Hubo un error interno en el servidor. Probá de nuevo; si sigue pasando, avisanos.";
      break;
    default:
      text = null;
  }
  const detail = str(problem.provider_message);
  if (text && detail && SHOW_PROVIDER_MESSAGE.has(problem.code)) {
    return `${text} Detalle del proveedor: «${detail}»`;
  }
  return text;
}

/** Qué campo falló en la validación del pedido, con un mensaje que la persona pueda resolver. */
function describeValidation(problem: ProblemDetails): string {
  const fields = new Set((problem.errors ?? []).map((e) => String(e.loc[e.loc.length - 1])));
  if (fields.has("message"))
    return `La pregunta es demasiado larga (máximo ${LIMITS.message.toLocaleString("es-AR")} caracteres).`;
  if (fields.has("selection") || fields.has("document_text"))
    return "El texto es demasiado largo para enviarlo. Seleccioná un fragmento más corto.";
  return "No pudimos procesar esa consulta. Probá con otra pregunta.";
}

/** Errores sin código del backend: los de la red, de Vercel o de un servidor que no es el nuestro. */
function describeTransport(e: ApiError): string {
  switch (e.kind) {
    case "canceled":
      return "Se canceló la consulta.";
    case "network":
      return "No pudimos conectar con el servidor. Revisá tu conexión y que el backend esté en marcha; si el backend está en otra dirección, puede que no permita este sitio.";
    case "timeout":
      return "El servidor tardó demasiado en responder. Probá de nuevo.";
    case "forbidden":
      return "No tenés permiso para hacer esta consulta.";
    case "not_found":
      return "No encontramos el servidor de la IA. Si usás la versión de GitHub Pages, falta configurar la URL del backend (VITE_API_URL).";
    case "rate_limited":
      return `Hiciste muchas consultas seguidas.${e.retryAfterMs ? ` Probá de nuevo en ${formatWait(e.retryAfterMs / 1000)}.` : ""}`;
    case "validation":
      return "No pudimos procesar esa consulta. Probá con otra pregunta.";
    case "server":
    case "unknown": {
      const status = e.status;
      if (status === 504)
        return "El servidor tardó demasiado en responder (el límite es de 30 segundos). Probá con un fragmento más corto o con un modelo más rápido.";
      if (status === 502 || status === 503)
        return "El servidor no está disponible ahora. Probá de nuevo en unos minutos.";
      if (status === 413)
        return "Lo que mandaste es demasiado grande para el servidor. Probá con un fragmento más corto o una imagen más chica.";
      if (status === 404 || status === 405)
        return "No encontramos el servidor de la IA. Si usás la versión de GitHub Pages, falta configurar la URL del backend (VITE_API_URL).";
      if (status !== null && status >= 500)
        return "Hubo un error en el servidor. Probá de nuevo en unos minutos.";
      return GENERIC;
    }
    default:
      return GENERIC;
  }
}

/** Mensaje claro y accionable para cualquier error del asistente. Nunca se inventa una respuesta. */
export function describeApiError(error: unknown): string {
  if (error instanceof MissingCredentialsError)
    return `Para usar la IA, cargá tu API key y elegí un modelo en ${SETUP}.`;
  if (error instanceof ImageUnavailableError)
    return "No pudimos preparar la imagen para analizarla. Probá con otra.";
  if (!isApiRequestError(error)) return GENERIC;
  const e = error.error;
  const problem = "problem" in e ? e.problem : null;
  const retryAfterMs = e.kind === "rate_limited" ? e.retryAfterMs : null;
  return (problem && describeProblem(problem, retryAfterMs)) || describeTransport(e);
}
