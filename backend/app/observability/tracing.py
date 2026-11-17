"""Tracing en modo mínimo (skill tracing-with-opentelemetry, variante Vercel).

Solo usa `opentelemetry-api`: sin TracerProvider no hay traza activa y `current_trace_id()`
devuelve None, así que el campo simplemente no aparece en logs ni en errores. Si más adelante
se suma un colector (o `vercel-tracing`), los ids aparecen sin cambiar este contrato.
"""

from opentelemetry import trace


def current_trace_id() -> str | None:
    ctx = trace.get_current_span().get_span_context()
    return format(ctx.trace_id, "032x") if ctx.is_valid else None


def current_span_id() -> str | None:
    ctx = trace.get_current_span().get_span_context()
    return format(ctx.span_id, "016x") if ctx.is_valid else None
