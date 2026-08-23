"""Shared Redis connection, and the rule for what happens without one.

Redis backs two things in this codebase: the per-slot booking lock and the rate
limiter. Both have a working in-process fallback, so `REDIS_URL` being unset is a
supported configuration rather than a broken one — it is what a single-instance
deployment runs, and it is what the test suite runs.

What Redis actually buys is *correctness across processes*. An in-process lock
serialises two requests handled by the same worker; it does nothing about two
requests handled by different workers. The same is true of the rate limiter: a
per-process counter lets a caller multiply their allowance by the number of
workers. Neither fallback is wrong for one instance, and neither is sufficient for
several.

The connection is created lazily and never raises into a request: if Redis is
configured but unreachable, callers fall back to the in-process path and the
failure is logged once rather than on every request.
"""

from __future__ import annotations

import logging
import threading

from app.core.config import settings

logger = logging.getLogger(__name__)

_client = None
_resolved = False
_lock = threading.Lock()
_warned = False


def get_redis():
    """The shared Redis client, or `None` when Redis is not usable.

    `None` is a normal return value. Every caller must have a fallback path.
    """
    global _client, _resolved, _warned

    if _resolved:
        return _client

    with _lock:
        if _resolved:
            return _client
        _resolved = True

        if not settings.REDIS_URL:
            logger.info("REDIS_URL not set; using in-process lock and rate limiting")
            _client = None
            return None

        try:
            import redis

            client = redis.Redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_timeout=settings.REDIS_TIMEOUT_SECONDS,
                socket_connect_timeout=settings.REDIS_TIMEOUT_SECONDS,
            )
            # Fail here, at startup, rather than inside the first request that
            # happens to need a lock.
            client.ping()
            logger.info("Redis connected; using it for booking locks and rate limiting")
            _client = client
        except Exception as exc:  # noqa: BLE001 — any failure means "fall back"
            if not _warned:
                logger.warning(
                    "REDIS_URL is set but Redis is unreachable (%s); "
                    "falling back to in-process lock and rate limiting",
                    exc,
                )
                _warned = True
            _client = None

    return _client


def reset_for_tests() -> None:
    """Drop the memoised client so a test can change `REDIS_URL` and re-resolve."""
    global _client, _resolved, _warned
    with _lock:
        _client = None
        _resolved = False
        _warned = False
