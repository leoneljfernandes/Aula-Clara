"""Key sellada en cookie: guardar, consultar y borrar la sesión de IA de la persona.

La cookie lleva la API key cifrada con `SEALING_KEY` y es `HttpOnly`: el JavaScript de la página no puede
leerla. Estos endpoints nunca devuelven la key. Ver docs/adr/0003-key-sellada-en-cookie.md.
"""

from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field

from app.api.deps import (
    COOKIE_NAME,
    KeySealerDep,
    _user_credentials,
    open_sealed,
    require_marker,
)
from app.errors import AICredentialsRequiredError, AISessionsDisabledError
from app.models import AIProviderName

router = APIRouter(
    prefix="/ai/session",
    tags=["ai-session"],
    dependencies=[Depends(require_marker)],  # los tres exigen X-Aula-Clara
)


class SessionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider: AIProviderName
    api_key: Annotated[str, Field(min_length=8, max_length=400)]
    remember: bool = False


class SessionRead(BaseModel):
    provider: str
    remember: bool
    expires_in_seconds: int


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"  # nada de esto se guarda en cachés intermedias


@router.post("")
async def create_session(data: SessionCreate, response: Response, sealer: KeySealerDep) -> SessionRead:
    """Sella la key y la deja en una cookie. La key viaja una sola vez, en el cuerpo de este pedido."""
    if sealer is None:
        raise AISessionsDisabledError("This server does not keep sealed keys; send X-AI-Key instead")
    provider, api_key = _user_credentials(data.provider, data.api_key)  # valida y tacha de los logs
    token, ttl = sealer.seal(provider, api_key, remember=data.remember)
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=ttl if data.remember else None,  # sin «recordar»: cookie de sesión del navegador
        path="/",
        secure=True,
        httponly=True,
        samesite="strict",
    )
    _no_store(response)
    return SessionRead(provider=provider, remember=data.remember, expires_in_seconds=ttl)


@router.get("")
async def read_session(
    response: Response,
    sealer: KeySealerDep,
    sealed: Annotated[str | None, Cookie(alias=COOKIE_NAME)] = None,
) -> SessionRead:
    """¿La cookie llegó y se puede abrir? Sirve para comprobar que el navegador la acepta (en un sitio
    distinto al del backend muchos navegadores la bloquean)."""
    if sealed is None:
        raise AICredentialsRequiredError("No saved AI session", extra={"reason": "no_session"})
    opened = open_sealed(sealer, sealed)
    _no_store(response)
    assert sealer is not None  # open_sealed ya falló si no había sealer
    return SessionRead(
        provider=opened.provider,
        remember=opened.remember,
        expires_in_seconds=sealer.remaining_seconds(opened),
    )


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(request: Request) -> Response:
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(COOKIE_NAME, path="/", secure=True, httponly=True, samesite="strict")
    _no_store(response)
    return response
