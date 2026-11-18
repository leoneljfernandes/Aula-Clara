import base64
import json

import pytest
from cryptography.fernet import Fernet

from app.services.key_sealing import KeySealer, SealedKeyError

KEY = "AIza-clave-secreta-0123456789"
SECRET = Fernet.generate_key().decode()


class Clock:
    def __init__(self, now: float = 1_000_000.0) -> None:
        self.now = now

    def __call__(self) -> float:
        return self.now


def _sealer(*keys: str, clock: Clock | None = None) -> KeySealer:
    return KeySealer(
        list(keys) or [SECRET], session_seconds=3600, remember_seconds=86_400, clock=clock or Clock()
    )


def test_a_sealed_key_opens_to_the_same_provider_and_key() -> None:
    token, ttl = _sealer().seal("gemini", KEY, remember=False)
    opened = _sealer().open(token)
    assert (opened.provider, opened.api_key, opened.remember) == ("gemini", KEY, False)
    assert ttl == 3600


def test_the_token_does_not_contain_the_key_in_any_encoding() -> None:
    token, _ = _sealer().seal("gemini", KEY, remember=True)
    decoded = base64.urlsafe_b64decode(token + "=" * (-len(token) % 4))
    assert KEY not in token and KEY.encode() not in decoded and b"gemini" not in decoded


def test_remember_lives_longer_than_a_session() -> None:
    _, session = _sealer().seal("groq", KEY, remember=False)
    _, remembered = _sealer().seal("groq", KEY, remember=True)
    assert (session, remembered) == (3600, 86_400)


def test_it_expires_on_the_server_even_if_the_browser_keeps_the_cookie() -> None:
    clock = Clock()
    sealer = _sealer(clock=clock)
    token, _ = sealer.seal("gemini", KEY, remember=False)
    clock.now += 3599
    assert sealer.open(token).api_key == KEY
    clock.now += 2
    with pytest.raises(SealedKeyError, match="expired"):
        sealer.open(token)


def test_remaining_seconds_counts_down() -> None:
    clock = Clock()
    sealer = _sealer(clock=clock)
    token, _ = sealer.seal("gemini", KEY, remember=False)
    clock.now += 600
    assert sealer.remaining_seconds(sealer.open(token)) == 3000


def test_a_token_from_another_secret_cannot_be_opened() -> None:
    token, _ = _sealer(Fernet.generate_key().decode()).seal("gemini", KEY, remember=False)
    with pytest.raises(SealedKeyError):
        _sealer().open(token)


def test_a_tampered_token_cannot_be_opened() -> None:
    token, _ = _sealer().seal("gemini", KEY, remember=False)
    flipped = token[:-6] + ("A" if token[-6] != "A" else "B") + token[-5:]
    for bad in (flipped, token[:-4], "", "no-es-un-token", "ñ" * 20):
        with pytest.raises(SealedKeyError):
            _sealer().open(bad)


def test_an_attacker_cannot_extend_the_expiry_by_editing_the_payload() -> None:
    # Con otra clave arma un payload «válido» y largo: sin SEALING_KEY no se puede firmar.
    forged = Fernet(Fernet.generate_key()).encrypt(
        json.dumps({"p": "gemini", "k": KEY, "r": True, "e": 9_999_999_999}).encode()
    )
    with pytest.raises(SealedKeyError):
        _sealer().open(forged.decode())


def test_rotation_reads_tokens_sealed_with_the_previous_secret_and_seals_with_the_new_one() -> None:
    old, new = Fernet.generate_key().decode(), Fernet.generate_key().decode()
    token, _ = _sealer(old).seal("gemini", KEY, remember=False)
    rotated = _sealer(new, old)
    assert rotated.open(token).api_key == KEY  # todavía abre lo de antes
    fresh, _ = rotated.seal("groq", KEY, remember=False)
    with pytest.raises(SealedKeyError):
        _sealer(old).open(fresh)  # lo nuevo ya no es de la clave vieja
    assert _sealer(new).open(fresh).provider == "groq"


@pytest.mark.parametrize(
    "payload",
    [{}, {"p": "x"}, {"p": "x", "k": "y", "r": True}, {"p": "x", "k": "y", "r": True, "e": "pronto"}],
)
def test_an_incomplete_payload_is_rejected(payload: dict[str, object]) -> None:
    token = Fernet(SECRET.encode()).encrypt(json.dumps(payload).encode()).decode()
    with pytest.raises(SealedKeyError):
        _sealer().open(token)
