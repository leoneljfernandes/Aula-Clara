/** Proveedores de IA que el backend admite. Cada persona usa su propia key: casi todos tienen un uso gratuito. */
export type ProviderId = "gemini" | "anthropic" | "openai" | "groq" | "openrouter" | "mistral" | "nvidia";

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  /** Página donde se crea la key (requiere haber iniciado sesión). */
  keyUrl: string;
  /** Página para crear la cuenta o iniciar sesión. */
  signupUrl: string;
  /** Una línea para elegir entre proveedores. */
  note: string;
  /** `true` si no tiene uso gratuito: la API se paga por uso y la key necesita saldo. */
  paid: boolean;
  /** Qué incluye el uso gratuito, en palabras simples (o que no lo tiene). */
  free: string;
  /** Lo que hace falta para registrarse. */
  needs: string;
  /** Cómo se reconoce la key, para no pegar otra cosa. */
  keyHint: string;
  /** Paso a paso, desde crear la cuenta hasta pegar la key en Aula Clara. */
  steps: readonly string[];
  /** Advertencias importantes (privacidad, límites). */
  warnings: readonly string[];
}

const PASTE_STEP =
  "Volvé a Aula Clara, abrí «Configurar IA», elegí este proveedor, pegá la key y tocá «Probar key y ver modelos».";

export const PROVIDERS: readonly ProviderInfo[] = [
  {
    id: "gemini",
    label: "Google Gemini",
    keyUrl: "https://aistudio.google.com/apikey",
    signupUrl: "https://aistudio.google.com",
    note: "Lee texto e imágenes. Nivel gratuito con un límite de consultas por día.",
    paid: false,
    free: "Gratis con límites diarios por modelo. No pide tarjeta.",
    needs: "Una cuenta de Google (la de Gmail sirve).",
    keyHint: "Empieza con «AIza».",
    steps: [
      "Entrá a Google AI Studio (aistudio.google.com) e iniciá sesión con tu cuenta de Google. Si no tenés una, creala gratis desde el mismo botón.",
      "La primera vez, aceptá las condiciones de uso de Google AI Studio.",
      "Abrí la sección «Get API key» (Obtener clave de API) o andá directo a aistudio.google.com/apikey.",
      "Tocá «Create API key» (Crear clave de API). Si te pide un proyecto, dejá que cree uno nuevo.",
      "Copiá la key que aparece.",
      PASTE_STEP,
    ],
    warnings: [
      "No actives la facturación (Cloud Billing) en el proyecto de esta key: sin facturación, lo máximo que alguien podría gastar con ella es tu cuota gratuita.",
      "En el nivel gratuito, Google puede usar lo que envíes para mejorar sus productos.",
      "Los límites del nivel gratuito se ven en aistudio.google.com/rate-limit.",
    ],
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    keyUrl: "https://console.anthropic.com/settings/keys",
    signupUrl: "https://console.anthropic.com",
    note: "Los modelos Claude. Leen texto e imágenes. Se paga por uso: no tiene nivel gratuito.",
    paid: true,
    free: "No tiene nivel gratuito: la API se paga por uso con crédito prepago. La suscripción a Claude (claude.ai) es otra cosa y no sirve para esto.",
    needs: "Una cuenta de Anthropic (email o Google) y una tarjeta para comprar crédito.",
    keyHint: "Empieza con «sk-ant-».",
    steps: [
      "Entrá a console.anthropic.com (no a claude.ai: es otro servicio) y creá tu cuenta con email o con Google.",
      "Verificá tu email y, si te lo pide, tu número de teléfono.",
      "Abrí «Plans & Billing» (Planes y facturación) y comprá crédito: el mínimo suele ser de unos 5 dólares. Sin crédito, la key no funciona.",
      "En «Limits» (Límites), poné un límite de gasto mensual bajo, por ejemplo de 5 dólares.",
      "Abrí «API Keys» o andá directo a console.anthropic.com/settings/keys, y tocá «Create Key».",
      "Poné un nombre que te ayude a recordarla (por ejemplo, «Aula Clara») y copiá la key: se muestra una sola vez.",
      PASTE_STEP,
    ],
    warnings: [
      "Cada consulta cuesta. Los modelos «Haiku» son los más baratos; los «Opus» son los más caros.",
      "Poné siempre un límite de gasto mensual bajo: si la key se pierde, cualquiera podría gastar tu crédito hasta ese límite.",
      "Si ves consumo que no reconocés, borrá la key en console.anthropic.com/settings/keys.",
      "Pagar Claude (claude.ai) no da crédito de API: son cuentas de cobro separadas.",
    ],
  },
  {
    id: "openai",
    label: "OpenAI (ChatGPT)",
    keyUrl: "https://platform.openai.com/api-keys",
    signupUrl: "https://platform.openai.com",
    note: "Los modelos de ChatGPT. Leen texto e imágenes. Se paga por uso: no tiene nivel gratuito.",
    paid: true,
    free: "No tiene nivel gratuito: la API se paga por uso con saldo prepago. La suscripción a ChatGPT (chatgpt.com) es otra cosa y no sirve para esto.",
    needs: "Una cuenta de OpenAI (email o Google) y una tarjeta para cargar saldo.",
    keyHint: "Empieza con «sk-».",
    steps: [
      "Entrá a platform.openai.com (no a chatgpt.com: es otro servicio) e iniciá sesión, o creá tu cuenta con email o con Google.",
      "Abrí «Billing» (Facturación) y cargá saldo prepago: el mínimo suele ser de unos 5 dólares. Sin saldo, la key no funciona.",
      "En «Limits» (Límites), poné un límite de gasto mensual bajo, por ejemplo de 5 dólares, y activá el aviso por email.",
      "Abrí «API keys» o andá directo a platform.openai.com/api-keys, y tocá «Create new secret key».",
      "Poné un nombre que te ayude a recordarla (por ejemplo, «Aula Clara») y copiá la key: se muestra una sola vez.",
      PASTE_STEP,
    ],
    warnings: [
      "Cada consulta cuesta. Los modelos «mini» son los más baratos.",
      "Poné siempre un límite de gasto mensual bajo: si la key se pierde, cualquiera podría gastar tu saldo hasta ese límite.",
      "Los modelos de razonamiento (o3, o4, gpt-5) a veces gastan toda la respuesta «pensando»: si pasa, elegí uno «mini» o «4o».",
      "Pagar ChatGPT Plus o Pro no da saldo de API: son cuentas de cobro separadas.",
    ],
  },
  {
    id: "groq",
    label: "Groq",
    keyUrl: "https://console.groq.com/keys",
    signupUrl: "https://console.groq.com",
    note: "Responde muy rápido. Nivel gratuito por cuenta; la mayoría de sus modelos solo leen texto.",
    paid: false,
    free: "Gratis con límites por minuto y por día. No pide tarjeta.",
    needs: "Un email, o una cuenta de Google o GitHub.",
    keyHint: "Empieza con «gsk_».",
    steps: [
      "Entrá a console.groq.com y tocá «Sign up» (Registrarse). Podés usar tu email o entrar con Google o GitHub.",
      "Si te registraste con email, abrí el mensaje de confirmación que te llega y seguí el enlace.",
      "Ya adentro, abrí «API Keys» en el menú, o andá directo a console.groq.com/keys.",
      "Tocá «Create API Key», escribí un nombre que te ayude a recordarla (por ejemplo, «Aula Clara») y confirmá.",
      "Copiá la key en ese momento: Groq la muestra una sola vez.",
      PASTE_STEP,
    ],
    warnings: [
      "Quedate en el plan gratuito y no cargues una tarjeta si no la necesitás: así la key solo puede gastar tu cuota gratuita.",
      "Si perdés la key, no se puede recuperar: borrala y creá otra.",
    ],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    keyUrl: "https://openrouter.ai/settings/keys",
    signupUrl: "https://openrouter.ai",
    note: "Reúne modelos de muchas empresas. Los gratuitos se indican en la lista.",
    paid: false,
    free: "Los modelos marcados como gratuitos («free») no cuestan nada, con un límite diario de consultas.",
    needs: "Un email, o una cuenta de Google o GitHub.",
    keyHint: "Empieza con «sk-or-».",
    steps: [
      "Entrá a openrouter.ai y tocá «Sign in» (Iniciar sesión). Podés crear la cuenta con email, Google o GitHub.",
      "Abrí el menú de tu cuenta, entrá a «Keys» o andá directo a openrouter.ai/settings/keys.",
      "Tocá «Create Key», poné un nombre (por ejemplo, «Aula Clara») y poné el límite de crédito de la key (Credit limit) en 0: así esta key nunca puede gastar plata.",
      "Copiá la key en ese momento: OpenRouter la muestra una sola vez.",
      PASTE_STEP,
      "En «Configurar IA», dejá marcado «Mostrar solo modelos gratuitos».",
    ],
    warnings: [
      "No cargues saldo si solo vas a usar modelos gratuitos: sin crédito, la key no puede gastar nada.",
      "Los modelos que no dicen «gratis» cobran: solo funcionan si cargaste crédito.",
      "Algunos modelos gratuitos pueden usar lo que envíes para entrenarse; lo indica la página de cada modelo.",
    ],
  },
  {
    id: "mistral",
    label: "Mistral AI",
    keyUrl: "https://console.mistral.ai/api-keys",
    signupUrl: "https://console.mistral.ai",
    note: "Empresa europea con buenos modelos en español; algunos leen imágenes. Plan gratuito «Experiment».",
    paid: false,
    free: "El plan «Experiment» es gratuito, con límites de uso. No pide tarjeta.",
    needs: "Un email (o cuenta de Google) y un número de teléfono para verificar la cuenta.",
    keyHint: "Una cadena larga de letras y números, sin prefijo fijo.",
    steps: [
      "Entrá a console.mistral.ai y creá tu cuenta con email o con Google.",
      "Verificá tu número de teléfono cuando te lo pida: te llega un código por SMS.",
      "Elegí el plan gratuito «Experiment» (en la sección de suscripción o «Billing») y aceptá las condiciones.",
      "Abrí «API Keys» en el menú, o andá directo a console.mistral.ai/api-keys.",
      "Tocá «Create new key», poné un nombre (por ejemplo, «Aula Clara») y copiá la key: se muestra una sola vez.",
      "Si al probarla dice que la key no es válida, esperá unos minutos: a veces tarda en activarse.",
      PASTE_STEP,
    ],
    warnings: [
      "Quedate en el plan gratuito «Experiment» y no pases a uno pago si no lo necesitás.",
      "En el plan «Experiment», Mistral puede usar lo que envíes para entrenar sus modelos.",
    ],
  },
  {
    id: "nvidia",
    label: "NVIDIA Build",
    keyUrl: "https://build.nvidia.com/settings/api-keys",
    signupUrl: "https://build.nvidia.com",
    note: "Catálogo de modelos abiertos alojados por NVIDIA. Créditos gratuitos limitados.",
    paid: false,
    free: "Al registrarte recibís créditos gratuitos para probar, con un límite de consultas por minuto. No pide tarjeta.",
    needs: "Un email para crear una cuenta de NVIDIA (se suma gratis al NVIDIA Developer Program).",
    keyHint: "Empieza con «nvapi-».",
    steps: [
      "Entrá a build.nvidia.com y tocá «Login» (Iniciar sesión). Si no tenés cuenta de NVIDIA, creala con tu email.",
      "Confirmá tu email con el mensaje que te llega y completá los datos que pide el registro.",
      "Andá a build.nvidia.com/settings/api-keys (o, desde cualquier modelo, al botón «Get API Key»).",
      "Tocá «Generate API Key» (Generar clave) y copiala: se muestra una sola vez.",
      PASTE_STEP,
    ],
    warnings: [
      "Son créditos de prueba, sin tarjeta asociada: lo máximo que se puede perder con esta key son esos créditos.",
      "NVIDIA no permite comprobar la key de antemano: si está mal, lo vas a ver en la primera consulta.",
      "Los créditos gratuitos se terminan; cuando se agoten, la app te lo va a avisar.",
    ],
  },
];

export function providerInfo(id: string): ProviderInfo | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export function providerLabel(id: string): string {
  return providerInfo(id)?.label ?? id;
}
