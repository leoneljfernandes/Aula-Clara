import pytest

from app.errors import RateLimitedError
from app.rate_limit import RateLimiter


def test_allows_up_to_the_limit_then_blocks_with_retry_after() -> None:
    limiter = RateLimiter(2)
    limiter.check("ip-1")
    limiter.check("ip-1")
    with pytest.raises(RateLimitedError) as exc:
        limiter.check("ip-1")
    assert int(exc.value.headers["Retry-After"]) >= 1


def test_each_ip_has_its_own_budget() -> None:
    limiter = RateLimiter(1)
    limiter.check("ip-1")
    limiter.check("ip-2")


def test_window_slides() -> None:
    limiter = RateLimiter(1, window_seconds=0.0)
    limiter.check("ip-1")
    limiter.check("ip-1")  # la ventana de 0 s ya venció
