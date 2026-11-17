import type { Article, LibraryDocument } from "./types";

/** Documento de ejemplo: el mismo texto y gráfico del prototipo. */
export const SAMPLE_FIGURE_ID = "sample-chart";

export const SAMPLE_ARTICLE: Article = {
  title: "Accesibilidad digital en la educación superior: barreras y oportunidades",
  meta: "Unidad 3 · Cátedra de Tecnología Educativa · Material de lectura obligatoria",
  blocks: [
    { type: "h2", text: "1. Introducción" },
    {
      type: "p",
      text: "La incorporación de entornos virtuales de aprendizaje en la universidad amplió el acceso a los materiales de estudio, pero también reprodujo barreras que afectan de manera desigual a estudiantes con discapacidad visual, dislexia u otras dificultades en el procesamiento de la información. Un documento digital no es accesible por el solo hecho de estar en formato electrónico.",
    },
    {
      type: "p",
      text: "Diversos relevamientos señalan que la mayor parte del material académico circula como PDF escaneado o como presentaciones sin estructura semántica. Esto impide que los lectores de pantalla identifiquen títulos, listas o tablas, y obliga al estudiante a depender de terceros para acceder al contenido.",
    },
    { type: "h2", text: "2. Marco normativo" },
    {
      type: "p",
      text: "Las Pautas de Accesibilidad para el Contenido Web (WCAG 2.2) establecen cuatro principios: el contenido debe ser perceptible, operable, comprensible y robusto. En el ámbito nacional, la Ley 26.653 de Accesibilidad de la Información en las Páginas Web obliga a los organismos públicos, incluidas las universidades nacionales, a respetar estas pautas.",
    },
    {
      type: "p",
      text: "Sin embargo, el cumplimiento normativo suele concentrarse en los sitios institucionales y no alcanza al material de cátedra, que es producido de forma descentralizada por cada docente, con herramientas y criterios heterogéneos.",
    },
    { type: "h2", text: "3. Evolución de la matrícula" },
    {
      type: "p",
      text: "Como se observa en el Gráfico 1, la cantidad de estudiantes que declaran alguna discapacidad creció de manera sostenida entre 2019 y 2024. El incremento más pronunciado se registra a partir de 2021, en coincidencia con la expansión de la modalidad virtual y de los programas de ingreso con acompañamiento.",
    },
    { type: "figure", id: SAMPLE_FIGURE_ID },
    {
      type: "p",
      text: "Este crecimiento no fue acompañado por un aumento proporcional de los recursos de adaptación: la relación entre estudiantes que requieren apoyo y personal técnico especializado se duplicó en el mismo período, con demoras de hasta tres semanas en la entrega de materiales adaptados.",
    },
    { type: "h2", text: "4. Diseño Universal para el Aprendizaje" },
    {
      type: "p",
      text: "El Diseño Universal para el Aprendizaje (DUA) propone anticipar la diversidad desde el origen, ofreciendo múltiples formas de representación, de acción y expresión, y de implicación. En lugar de adaptar el material caso por caso, se busca que cada recurso sea flexible desde su concepción.",
    },
    {
      type: "p",
      text: "Las herramientas basadas en inteligencia artificial abren una oportunidad concreta para este enfoque: permiten describir imágenes, reformular textos complejos y convertir contenido a audio de manera inmediata, devolviendo al estudiante la autonomía sobre su propio proceso de estudio.",
    },
    { type: "h2", text: "5. Conclusiones" },
    {
      type: "p",
      text: "La accesibilidad no debe entenderse como una adaptación excepcional, sino como una condición de calidad del material educativo. Las instituciones que integren herramientas de adaptación automática podrán reducir la dependencia de terceros y la fragmentación de recursos que hoy caracteriza la experiencia de los estudiantes con discapacidad.",
    },
  ],
};

export const SAMPLE_CHART: ReadonlyArray<readonly [string, number]> = [
  ["2019", 1240],
  ["2020", 1410],
  ["2021", 1980],
  ["2022", 2460],
  ["2023", 2910],
  ["2024", 3350],
];

export const SEED_DOCUMENTS: readonly LibraryDocument[] = [
  {
    id: "d1",
    title: "Accesibilidad digital en la educación superior",
    subject: "Tecnología Educativa",
    type: "PDF",
    date: "2026-11-11",
    progress: 0.42,
  },
  {
    id: "d2",
    title: "Introducción a la Epidemiología – Unidad 2",
    subject: "Salud Pública",
    type: "Word",
    date: "2026-11-08",
    progress: 0.85,
  },
  {
    id: "d3",
    title: "Metodología de la investigación: diseño de encuestas",
    subject: "Metodología",
    type: "PowerPoint",
    date: "2026-11-02",
    progress: 0.1,
  },
];
