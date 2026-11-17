"""Entrypoint de Vercel: expone la app FastAPI de backend/ como una Vercel Function.

Vercel reconoce `api/index.py` con una instancia `app`. El paquete `app` vive en backend/, así que se
agrega esa carpeta al path antes de importarlo (mismos imports que en local: `from app.config import ...`).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.main import app  # noqa: E402

__all__ = ["app"]
