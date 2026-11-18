"""Respuestas simuladas del prototipo original (`mockReply` e `IMAGE_ANALYSIS`)."""

from collections.abc import Sequence

from app.models import ChatAction, ChatMessage

NOTE = "\n\n(Respuesta simulada para el MVP)"

IMAGE_ANALYSIS = (
    "Este gráfico de barras muestra la evolución de la matrícula de estudiantes con discapacidad entre 2019 y 2024. "
    "Hay seis barras verticales, una por año, que crecen de izquierda a derecha: de unos 1.240 estudiantes en 2019 "
    "a unos 3.350 en 2024, es decir, casi el triple. El salto más grande ocurre entre 2020 y 2021, con unos 570 "
    "estudiantes más. Idea principal: la matrícula crece de forma sostenida y se acelera a partir de 2021."
)

_SUMMARY = (
    "Resumen de esta página:\n"
    "• Un material digital no es accesible solo por ser digital: muchos PDF escaneados no se pueden leer con lector de pantalla.\n"
    "• Hay normas (WCAG 2.2 y Ley 26.653), pero casi no se aplican al material de cátedra.\n"
    "• Cada año hay más estudiantes con discapacidad y los recursos de adaptación no alcanzan.\n"
    "• El Diseño Universal para el Aprendizaje y la IA permiten que el material sea accesible desde el inicio."
)
_CONCEPTS = (
    "Conceptos clave:\n"
    "• WCAG 2.2: pautas internacionales. El contenido debe ser perceptible, operable, comprensible y robusto.\n"
    "• Ley 26.653: obliga a los organismos públicos, como las universidades nacionales, a cumplir esas pautas.\n"
    "• Estructura semántica: títulos, listas y tablas marcados para que un lector de pantalla los reconozca.\n"
    "• DUA (Diseño Universal para el Aprendizaje): pensar el material para todos desde el principio, "
    "en vez de adaptarlo caso por caso."
)
_QUIZ = (
    "Preguntas de repaso:\n"
    "1. ¿Cuáles son los cuatro principios de las WCAG 2.2?\n"
    "2. ¿Por qué el cumplimiento de la Ley 26.653 no alcanza al material de cátedra?\n"
    "3. ¿Qué diferencia hay entre adaptar un material caso por caso y aplicar el Diseño Universal para el Aprendizaje?"
)


def _simplify(text: str) -> str:
    words = text.split()
    short = " ".join(words[:14]) + ("…" if len(words) > 14 else "")
    return (
        f"En palabras más simples:\nEl fragmento «{short}» quiere decir que los materiales de estudio tendrían que "
        "poder usarlos todos los estudiantes desde el primer momento, sin esperar a que otra persona los adapte. "
        "Lo importante es la autonomía: que cada estudiante pueda leer, escuchar y entender el contenido por su cuenta."
    )


def _free(question: str) -> str:
    q = question.lower()
    body = (
        "el documento sostiene que la accesibilidad tiene que pensarse desde el diseño del material y no como una "
        "adaptación posterior. Si querés, seleccioná un párrafo y te lo explico con palabras más simples."
    )
    if "wcag" in q or "principio" in q:
        body = "las WCAG 2.2 piden que el contenido sea perceptible, operable, comprensible y robusto (sección 2, «Marco normativo»)."
    elif "dua" in q or "universal" in q:
        body = (
            "el DUA propone ofrecer varias formas de representar la información, de participar y de motivarse, "
            "para que el material sirva a todos desde el inicio (sección 4)."
        )
    elif "gráfico" in q or "grafico" in q or "matr" in q:
        body = (
            "la matrícula de estudiantes con discapacidad pasó de unos 1.240 en 2019 a unos 3.350 en 2024, "
            "con el mayor salto entre 2020 y 2021 (sección 3, Gráfico 1)."
        )
    elif "ley" in q:
        body = (
            "la Ley 26.653 obliga a los organismos públicos, incluidas las universidades nacionales, "
            "a respetar las pautas de accesibilidad web (sección 2)."
        )
    return f"Basado en el texto actual, la respuesta a tu consulta es: {body}"


class MockProvider:
    name = "mock"
    supports_images = True

    async def chat(self, system: str, messages: Sequence[ChatMessage], *, action: ChatAction = "free") -> str:
        last = next((m.content for m in reversed(messages) if m.role == "user"), "")
        match action:
            case "summarize":
                return _SUMMARY + NOTE
            case "key_concepts":
                return _CONCEPTS + NOTE
            case "quiz":
                return _QUIZ + NOTE
            case "simplify":
                return _simplify(last) + NOTE
            case "free":
                return _free(last) + NOTE

    async def describe_image(self, image: bytes, mime: str, context: str, *, system: str = "") -> str:
        return "Descripción simulada: " + IMAGE_ANALYSIS + NOTE
