import json
import logging

from app.observability.logging import JsonFormatter
from app.observability.redaction import REDACTED, remember_key, scrub

KEY = "AIza-clave-secreta-0123456789"


def _line(msg: str, *, exc: Exception | None = None) -> str:
    record = logging.LogRecord("t", logging.ERROR, __file__, 1, msg, (), None)
    if exc is not None:
        try:
            raise exc
        except Exception:
            import sys

            record.exc_info = sys.exc_info()
    return JsonFormatter(service="svc", environment="test").format(record)


def test_the_key_of_the_current_request_is_redacted_in_log_lines() -> None:
    remember_key(KEY)
    line = _line(f"provider said: bad key {KEY}", exc=RuntimeError(f"boom {KEY}"))
    assert KEY not in line
    assert REDACTED in json.loads(line)["msg"]
    assert REDACTED in json.loads(line)["exc"]


def test_short_values_are_not_redacted_so_logs_do_not_get_mangled() -> None:
    remember_key("abc")
    assert scrub("abc abc") == "abc abc"


def test_without_a_key_nothing_changes() -> None:
    remember_key("")
    assert scrub("hola mundo") == "hola mundo"
