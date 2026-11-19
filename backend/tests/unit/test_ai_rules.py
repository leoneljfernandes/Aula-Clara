import pytest

from app.models import ChatAction
from app.services import ai_rules


def test_trim_text_keeps_short_text_untouched() -> None:
    assert ai_rules.trim_text("hola mundo", 50) == "hola mundo"


def test_trim_text_cuts_on_a_word_boundary_and_marks_the_cut() -> None:
    result = ai_rules.trim_text("uno dos tres cuatro", 10)
    assert result.startswith("uno dos")
    assert "tres" not in result.split("[")[0]
    assert "recortado" in result


def test_build_context_never_sends_a_huge_document_whole() -> None:
    context = ai_rules.build_context("palabra " * 10_000, None, max_chars=500, nonce="deadbeef")
    assert len(context) < 700
    assert "<documento_deadbeef>" in context
    assert "</documento_deadbeef>" in context


def test_build_context_puts_selection_first() -> None:
    context = ai_rules.build_context(
        "texto del documento", "fragmento elegido", max_chars=1_000, nonce="deadbeef"
    )
    assert context.index("<seleccion_deadbeef>") < context.index("<documento_deadbeef>")


@pytest.mark.parametrize(
    "action", ["free", "summarize", "key_concepts", "quiz", "simplify", "glossary", "visual_outline"]
)
def test_every_action_has_an_instruction(action: ChatAction) -> None:
    assert ai_rules.ACTION_INSTRUCTIONS[action]


def test_quiz_instruction_demands_exactly_three_questions() -> None:
    assert "3 preguntas" in ai_rules.ACTION_INSTRUCTIONS["quiz"]


def test_cache_key_differs_by_action_and_is_stable() -> None:
    a = ai_rules.cache_key("chat", "summarize", None, None, "texto")
    assert a == ai_rules.cache_key("chat", "summarize", None, None, "texto")
    assert a != ai_rules.cache_key("chat", "quiz", None, None, "texto")


def test_plain_language_adds_its_rules_and_standard_adds_nothing() -> None:
    plain = ai_rules.build_user_message("summarize", None, "<documento>x</documento>", "plain")
    assert ai_rules.LANGUAGE_INSTRUCTIONS["plain"] in plain
    standard = ai_rules.build_user_message("summarize", None, "<documento>x</documento>")
    assert "lenguaje claro" not in standard and "Lectura Fácil" not in standard


def test_glossary_and_outline_have_their_own_instructions() -> None:
    assert "«Término: …»" in ai_rules.build_user_message("glossary", None, "ctx")
    assert "«→»" in ai_rules.build_user_message("visual_outline", None, "ctx")


def test_language_instruction_goes_after_the_action_and_before_the_context() -> None:
    message = ai_rules.build_user_message(
        "summarize", "¿qué?", "<documento_abc12345>x</documento_abc12345>", "easy", nonce="abc12345"
    )
    assert (
        message.index(ai_rules.ACTION_INSTRUCTIONS["summarize"])
        < message.index(ai_rules.LANGUAGE_INSTRUCTIONS["easy"])
        < message.index("<pregunta_abc12345>")
        < message.index("<documento_abc12345>")
        < message.index("Recordatorio obligatorio:")
    )
