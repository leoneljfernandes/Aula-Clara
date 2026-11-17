/** Respuestas simuladas del prototipo: modo de respaldo cuando no hay backend o la IA falla. */
export type ChatAction = "free" | "summarize" | "key_concepts" | "quiz" | "simplify";

export const MOCK_NOTE = "\n\n(Respuesta simulada para el MVP)";

export const IMAGE_ANALYSIS =
  "Este gráfico de barras muestra la evolución de la matrícula de estudiantes con discapacidad entre 2019 y 2024. Hay seis barras verticales, una por año, que crecen de izquierda a derecha: de unos 1.240 estudiantes en 2019 a unos 3.350 en 2024, es decir, casi el triple. El salto más grande ocurre entre 2020 y 2021, con unos 570 estudiantes más. Idea principal: la matrícula crece de forma sostenida y se acelera a partir de 2021.";

const SUMMARY =
  "Resumen de esta página:\n• Un material digital no es accesible solo por ser digital: muchos PDF escaneados no se pueden leer con lector de pantalla.\n• Hay normas (WCAG 2.2 y Ley 26.653), pero casi no se aplican al material de cátedra.\n• Cada año hay más estudiantes con discapacidad y los recursos de adaptación no alcanzan.\n• El Diseño Universal para el Aprendizaje y la IA permiten que el material sea accesible desde el inicio.";
const CONCEPTS =
  "Conceptos clave:\n• WCAG 2.2: pautas internacionales. El contenido debe ser perceptible, operable, comprensible y robusto.\n• Ley 26.653: obliga a los organismos públicos, como las universidades nacionales, a cumplir esas pautas.\n• Estructura semántica: títulos, listas y tablas marcados para que un lector de pantalla los reconozca.\n• DUA (Diseño Universal para el Aprendizaje): pensar el material para todos desde el principio, en vez de adaptarlo caso por caso.";
const QUIZ =
  "Preguntas de repaso:\n1. ¿Cuáles son los cuatro principios de las WCAG 2.2?\n2. ¿Por qué el cumplimiento de la Ley 26.653 no alcanza al material de cátedra?\n3. ¿Qué diferencia hay entre adaptar un material caso por caso y aplicar el Diseño Universal para el Aprendizaje?";

function simplify(text: string): string {
  const words = text.split(/\s+/);
  const short = words.slice(0, 14).join(" ") + (words.length > 14 ? "…" : "");
  return `En palabras más simples:\nEl fragmento «${short}» quiere decir que los materiales de estudio tendrían que poder usarlos todos los estudiantes desde el primer momento, sin esperar a que otra persona los adapte. Lo importante es la autonomía: que cada estudiante pueda leer, escuchar y entender el contenido por su cuenta.`;
}

function free(question: string): string {
  const q = question.toLowerCase();
  let body =
    "el documento sostiene que la accesibilidad tiene que pensarse desde el diseño del material y no como una adaptación posterior. Si querés, seleccioná un párrafo y te lo explico con palabras más simples.";
  if (q.includes("wcag") || q.includes("principio"))
    body =
      "las WCAG 2.2 piden que el contenido sea perceptible, operable, comprensible y robusto (sección 2, «Marco normativo»).";
  else if (q.includes("dua") || q.includes("universal"))
    body =
      "el DUA propone ofrecer varias formas de representar la información, de participar y de motivarse, para que el material sirva a todos desde el inicio (sección 4).";
  else if (q.includes("gráfico") || q.includes("grafico") || q.includes("matr"))
    body =
      "la matrícula de estudiantes con discapacidad pasó de unos 1.240 en 2019 a unos 3.350 en 2024, con el mayor salto entre 2020 y 2021 (sección 3, Gráfico 1).";
  else if (q.includes("ley"))
    body =
      "la Ley 26.653 obliga a los organismos públicos, incluidas las universidades nacionales, a respetar las pautas de accesibilidad web (sección 2).";
  return `Basado en el texto actual, la respuesta a tu consulta es: ${body}`;
}

export function mockChat(action: ChatAction, text: string): string {
  switch (action) {
    case "summarize":
      return SUMMARY + MOCK_NOTE;
    case "key_concepts":
      return CONCEPTS + MOCK_NOTE;
    case "quiz":
      return QUIZ + MOCK_NOTE;
    case "simplify":
      return simplify(text) + MOCK_NOTE;
    case "free":
      return free(text) + MOCK_NOTE;
  }
}

/** Solo el gráfico del documento de ejemplo tiene una descripción redactada; el resto, un aviso claro. */
export function mockDescription(isSampleChart: boolean): string {
  return isSampleChart
    ? `Descripción simulada: ${IMAGE_ANALYSIS}${MOCK_NOTE}`
    : `No pudimos conectarnos con la IA para describir esta imagen, así que no hay una descripción disponible ahora.${MOCK_NOTE}`;
}
