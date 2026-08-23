"""Fixed-window rate limiting.

docs/02-backend-architecture.md §4 calls for tighter limits on `/auth/*` and
`/sos` than on general traffic. The reason is specific to each: the auth
endpoints are where credential stuffing and email enumeration are attempted, and
`/sos` fans out to every guard in the society over push and SMS, so a loop on it
is both a cost and an alert-fatigue problem.

**Fixed window, not sliding.** A fixed window admits a burst spanning a boundary
— up to twice the limit across two adjacent windows — which is a real weakness.
It is chosen anyway because it costs one `INCR` per request against Redis, where
a sliding-window log costs a sorted-set write plus a range trim, and because the
threat being defended against here is a sustained loop rather than a precisely
timed burst. The tradeoff is recorded so it is a decision rather than an
oversight.

Keyed on the client IP. Behind a proxy, `X-Forwarded-For` is honoured only when
`TRUST_PROXY_HEADERS` is on, because a client can set that header themselves —
trusting it unconditionally would let anyone bypass the limiter by varying it.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass

from app.core.config import settings
from app.core.redis_client import get_redis


@dataclass(frozen=True)
class Decision:
    allowed: bool
    limit: int
    remaining: int
    retry_after: int


class _InProcessWindows:
    """Fallback counter store: `{key: (window_start, count)}`.

    Correct for one process. With several workers each keeps its own counters,
    so the effective limit multiplies — see the module docstring in
    `redis_client.py`.
    """

    def __init__(self) -> None:
        self._counts: dict[str, tuple[int, int]] = {}
        self._lock = threading.Lock()

    def incr(self, key: str, window: int) -> int:
        now = int(time.time())
        bucket = now - (now % window)
        with self._lock:
            start, count = self._counts.get(key, (bucket, 0))
            if start != bucket:
                start, count = bucket, 0
            count += 1
            self._counts[key] = (start, count)

            # Opportunistic cleanup so a long-running process does not retain a
            # counter for every IP it has ever seen.
            if len(self._counts) > 8192:
                self._counts = {
                    k: v for k, v in self._counts.items() if v[0] == bucket
                }
            return count

    def clear(self) -> None:
        with self._lock:
            self._counts.clear()


_windows = _InProcessWindows()


def reset_for_tests() -> None:
    """Clear in-process counters between tests."""
    _windows.clear()


def limit_for(path: str) -> int:
    """Requests allowed per window for this path."""
    if path.startswith(f"{settings.API_V1_PREFIX}/auth"):
        return settings.RATE_LIMIT_AUTH
    if path.startswith(f"{settings.API_V1_PREFIX}/sos"):
        return settings.RATE_LIMIT_SOS
    return settings.RATE_LIMIT_DEFAULT


def _bucket_name(path: str) -> str:
    if path.startswith(f"{settings.API_V1_PREFIX}/auth"):
        return "auth"
    if path.startswith(f"{settings.API_V1_PREFIX}/sos"):
        return "sos"
    return "default"


def check(client_id: str, path: str) -> Decision:
    """Count this request and decide whether it is allowed."""
    window = settings.RATE_LIMIT_WINDOW_SECONDS
    limit = limit_for(path)
    now = int(time.time())
    bucket_start = now - (now % window)
    retry_after = max(1, (bucket_start + window) - now)

    key = f"rl:{_bucket_name(path)}:{client_id}:{bucket_start}"

    redis = get_redis()
    if redis is not None:
        try:
            pipe = redis.pipeline()
            pipe.incr(key, 1)
            # Expire slightly past the window so the key cannot outlive its
            # bucket if the process dies between INCR and EXPIRE.
            pipe.expire(key, window + 1)
            count = int(pipe.execute()[0])
        except Exception:  # noqa: BLE001
            # Redis went away mid-flight. Rate limiting is a safety control, not
            # a correctness one — degrade to the local counter rather than
            # failing the request.
            count = _windows.incr(key, window)
    else:
        count = _windows.incr(key, window)

    return Decision(
        allowed=count <= limit,
        limit=limit,
        remaining=max(0, limit - count),
        retry_after=retry_after,
    )


def client_id_for(request) -> str:
    """Identify the caller for limiting purposes.

    `X-Forwarded-For` is only believed behind a proxy we have been told to
    trust; otherwise a caller could rotate the header to reset their own counter.
    """
    if settings.TRUST_PROXY_HEADERS:
        forwarded = request.headers.get("X-Forwarded-For", "")
        if forwarded:
            return forwarded.split(",")[0].strip()
    client = request.client
    return client.host if client else "unknown"
