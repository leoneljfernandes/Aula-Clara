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
    context = ai_rules.build_context("palabra " * 10_000, None, max_chars=500)
    assert len(context) < 700
    assert "<documento>" in context


def test_build_context_puts_selection_first() -> None:
    context = ai_rules.build_context("texto del documento", "fragmento elegido", max_chars=1_000)
    assert context.index("<seleccion>") < context.index("<documento>")


@pytest.mark.parametrize("action", ["free", "summarize", "key_concepts", "quiz", "simplify"])
def test_every_action_has_an_instruction(action: ChatAction) -> None:
    assert ai_rules.ACTION_INSTRUCTIONS[action]


def test_quiz_instruction_demands_exactly_three_questions() -> None:
    assert "3 preguntas" in ai_rules.ACTION_INSTRUCTIONS["quiz"]


def test_cache_key_differs_by_action_and_is_stable() -> None:
    a = ai_rules.cache_key("chat", "summarize", None, None, "texto")
    assert a == ai_rules.cache_key("chat", "summarize", None, None, "texto")
    assert a != ai_rules.cache_key("chat", "quiz", None, None, "texto")
