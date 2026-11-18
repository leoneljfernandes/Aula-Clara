from datetime import UTC, datetime

import pytest

from app.providers.llm.base import (
    ProviderAuthError,
    ProviderContentBlocked,
    ProviderError,
    ProviderImageRejected,
    ProviderModelNotFound,
    ProviderPayloadTooLarge,
    ProviderPermissionDenied,
    ProviderQuotaError,
    ProviderRejected,
    ProviderTimeout,
    ProviderUnavailable,
)
from app.providers.llm.http_errors import (
    MAX_PROVIDER_MESSAGE,
    classify,
    parse_error_body,
    parse_retry_after,
    sanitize_message,
)

KEY = "sk-test-0123456789abcdef"


def _classify(status: int, message: str | None = None, **kw: object) -> ProviderError:
    return classify("groq", status, message=message, api_key=KEY, **kw)  # type: ignore[arg-type]


@pytest.mark.parametrize(
    ("status", "message", "expected", "reason"),
    [
        # --- key
        (401, "Invalid API Key", ProviderAuthError, None),
        (400, "API key not valid. Please pass a valid API key.", ProviderAuthError, None),
        (400, "API key expired. Please renew the API key.", ProviderAuthError, None),
        (403, "Your API key was reported as leaked.", ProviderAuthError, None),
        (403, "Authentication failed", ProviderAuthError, None),
        # --- cuota y saldo: el 429 manda aunque el texto hable de la key o del plan
        (
            429,
            "Rate limit reached for model in organization on requests per minute",
            ProviderQuotaError,
            "rate",
        ),
        (429, "Rate limit reached ... tokens per day (TPD): Limit 100000", ProviderQuotaError, "daily"),
        (
            429,
            "You exceeded your current quota, please check your plan and billing details.",
            ProviderQuotaError,
            "rate",
        ),
        (429, "Quota exceeded for this API key", ProviderQuotaError, "rate"),
        (429, "Insufficient credits. Add more credits to continue.", ProviderQuotaError, "credit"),
        (402, "Payment Required", ProviderQuotaError, "credit"),
        # --- tamaño: el 413 y la ventana de contexto
        (413, None, ProviderPayloadTooLarge, "size"),
        (
            400,
            "This model's maximum context length is 8192 tokens. Please reduce the length of the messages.",
            ProviderPayloadTooLarge,
            "context",
        ),
        (
            400,
            "The input token count (50000) exceeds the maximum number of tokens allowed (32768).",
            ProviderPayloadTooLarge,
            "context",
        ),
        (400, "Prompt is too long", ProviderPayloadTooLarge, "context"),
        # --- filtros de seguridad
        (400, "The prompt was blocked for safety reasons", ProviderContentBlocked, None),
        (
            403,
            "Your chosen model requires moderation and your input was flagged",
            ProviderContentBlocked,
            None,
        ),
        # --- permisos, región, modelo
        (400, "User location is not supported for the API use.", ProviderPermissionDenied, "region"),
        (403, "Permission denied on model", ProviderPermissionDenied, "access"),
        (404, "models/foo is not found for API version v1", ProviderModelNotFound, None),
        (404, "Function 'abc': Not found for account 'x'", ProviderModelNotFound, None),
        (400, "The model `old-model` does not exist or has been decommissioned", ProviderModelNotFound, None),
        # --- genéricos
        (400, "Invalid value for temperature", ProviderRejected, None),
        (422, "Unprocessable entity", ProviderRejected, None),
        # --- caídas
        (408, "Request timeout", ProviderTimeout, "timeout"),
        (504, "Gateway timeout", ProviderTimeout, "timeout"),
        (500, "Internal error", ProviderUnavailable, "provider_error"),
        (502, "Bad gateway", ProviderUnavailable, "provider_error"),
        (503, "The model is overloaded", ProviderUnavailable, "overloaded"),
        (529, "Overloaded", ProviderUnavailable, "overloaded"),
    ],
)
def test_classification(status: int, message: str, expected: type[ProviderError], reason: str | None) -> None:
    error = _classify(status, message)
    assert type(error) is expected
    assert error.reason == reason
    assert error.status == status


def test_a_400_about_images_is_an_image_rejection_only_when_describing_an_image() -> None:
    message = "This model does not support image input"
    assert type(_classify(400, message, operation="chat")) is ProviderRejected
    assert type(_classify(400, message, operation="image")) is ProviderImageRejected


def test_gemini_quota_details_decide_per_day() -> None:
    error = classify(
        "gemini",
        429,
        message="Quota exceeded",
        code="RESOURCE_EXHAUSTED",
        api_key=KEY,
        hint='[{"violations": [{"quotaId": "GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}]',
    )
    assert isinstance(error, ProviderQuotaError) and error.reason == "daily"


def test_retry_after_travels_with_the_error() -> None:
    error = _classify(429, "slow down", retry_after=34.0)
    assert error.retry_after == 34.0


def test_the_key_is_never_part_of_what_the_person_sees() -> None:
    shown = _classify(400, f"Incorrect value near {KEY} and again {KEY}").provider_message
    assert shown is not None and KEY not in shown and "[tu key]" in shown
    assert _classify(401, f"bad key {KEY}").provider_message is None  # el 401 ni siquiera lleva texto


class TestSanitize:
    def test_redacts_the_key_and_key_like_leftovers(self) -> None:
        text = f"bad {KEY} and also AIzaSyD-0123456789abcdefghijklmnopqrstuv"
        cleaned = sanitize_message(text, KEY)
        assert cleaned is not None
        assert KEY not in cleaned and "AIzaSyD" not in cleaned

    def test_long_messages_are_cut_on_one_line(self) -> None:
        cleaned = sanitize_message("palabra\n" * 500, KEY)
        assert cleaned is not None
        assert "\n" not in cleaned and len(cleaned) <= MAX_PROVIDER_MESSAGE + 1 and cleaned.endswith("…")

    @pytest.mark.parametrize("empty", [None, "", "   \n "])
    def test_empty_is_none(self, empty: str | None) -> None:
        assert sanitize_message(empty, KEY) is None


class TestParseErrorBody:
    @pytest.mark.parametrize(
        ("body", "expected"),
        [
            (
                {"error": {"message": "boom", "code": "context_length_exceeded"}},
                ("boom", "context_length_exceeded"),
            ),  # OpenAI, Groq
            ({"error": {"message": "x", "code": 402}}, ("x", "402")),  # OpenRouter
            (
                {"object": "error", "message": "Rate limit", "type": "rate_limited"},
                ("Rate limit", "rate_limited"),
            ),  # Mistral
            ({"detail": "Authentication failed"}, ("Authentication failed", None)),  # NVIDIA
            ({"error": "texto plano"}, ("texto plano", None)),
            (
                {"error": {"message": {"detail": [{"loc": ["body"]}]}}},
                ('{"detail": [{"loc": ["body"]}]}', None),
            ),
            ("<html>502</html>", ("<html>502</html>", None)),
            (None, (None, None)),
            ([1, 2], (None, None)),
        ],
    )
    def test_known_shapes(self, body: object, expected: tuple[str | None, str | None]) -> None:
        assert parse_error_body(body) == expected


class TestRetryAfter:
    @pytest.mark.parametrize(
        ("value", "expected"),
        [
            ("34", 34.0),
            ("34.5s", 34.5),
            ("0", 0.0),
            ("-5", 0.0),
            ("99999", 3600.0),
            (None, None),
            ("", None),
            ("pronto", None),
        ],
    )
    def test_seconds_and_gemini_delays(self, value: str | None, expected: float | None) -> None:
        assert parse_retry_after(value) == expected

    def test_http_date(self) -> None:
        now = datetime(2026, 11, 18, 12, 0, 0, tzinfo=UTC)
        assert parse_retry_after("Wed, 18 Nov 2026 12:01:30 GMT", now=now) == 90.0
