"""Logs JSON a stdout, una línea por evento (skill logging-json-to-loki, sin el envío a Loki).

En Vercel los logs de la función se leen en el panel; en local, en la terminal de uvicorn.
Mensajes constantes y datos en `extra`; nunca secretos, API keys ni texto de los documentos.
"""

import json
import logging
import sys
from datetime import UTC, datetime
from typing import Any

from app.config import Settings
from app.observability.redaction import scrub
from app.observability.tracing import current_span_id, current_trace_id

# Atributos estándar de LogRecord: todo lo demás vino por extra={...}.
_RESERVED = frozenset(vars(logging.makeLogRecord({}))) | {"message", "asctime", "taskName"}


class JsonFormatter(logging.Formatter):
    def __init__(self, *, service: str, environment: str) -> None:
        super().__init__()
        self._static = {"service": service, "env": environment}

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname.lower(),
            "logger": record.name,
            "msg": record.getMessage(),
            **self._static,
        }
        if trace_id := current_trace_id():
            payload["trace_id"] = trace_id
            payload["span_id"] = current_span_id()
        payload.update(
            {k: v for k, v in record.__dict__.items() if k not in _RESERVED and not k.startswith("_")}
        )
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return scrub(json.dumps(payload, default=str, ensure_ascii=False))


def configure_logging(settings: Settings) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter(service=settings.APP_NAME, environment=settings.APP_ENV.value))
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(settings.LOG_LEVEL)
    # uvicorn trae sus propios handlers en texto plano: se los quita para que todo salga en JSON.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        uv_logger = logging.getLogger(name)
        uv_logger.handlers.clear()
        uv_logger.propagate = True
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
