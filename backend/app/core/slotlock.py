"""The per-slot booking lock.

docs/02-backend-architecture.md §7. Double-booking is defended twice, and the
two defences are not interchangeable:

1. **This lock** serialises concurrent attempts on the same slot, so the loser
   gets a clean `409` instead of a database integrity error, and the database
   is not asked to arbitrate every collision.
2. **The partial unique index** on `slot_id WHERE status = 'CONFIRMED'` is what
   actually makes a second confirmed booking impossible. It holds whatever this
   lock does.

Because (2) is the guarantee, this lock is allowed to fail open: the worst
outcome is a losing request surfacing as an `IntegrityError`, which the router
already converts to the same `409`. A Redis outage must not stop a society
booking its clubhouse.

Two failure modes are handled differently, and conflating them is a bug:

- **Contended** — someone else holds the lock. Wait for it, briefly. Barging in
  would make the lock pointless.
- **Unavailable** — Redis is unreachable or rejects the command. Fall back to
  the in-process lock and let the index be the backstop.
"""

from __future__ import annotations

import logging
import threading
import time
import uuid
from collections import defaultdict
from contextlib import contextmanager

from app.core.config import settings
from app.core.redis_client import get_redis

logger = logging.getLogger(__name__)

_local_locks: dict[str, threading.Lock] = defaultdict(threading.Lock)

# Compare-and-delete: only remove the lock if we still hold it. Without this, a
# caller whose TTL had lapsed could delete a lock a different caller now owns.
_RELEASE = """
if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
else
    return 0
end
"""

_RETRY_INTERVAL_SECONDS = 0.01


class _Unavailable(Exception):
    """Redis could not be used at all — distinct from the lock being held."""


def _acquire(redis, key: str, token: str) -> bool:
    """Try to take the lock, waiting while it is merely contended.

    Returns True if held. Returns False if the wait ran out — the caller then
    proceeds and lets the database decide. Raises `_Unavailable` if Redis itself
    is not usable, which is a different situation entirely.
    """
    deadline = time.monotonic() + (settings.SLOT_LOCK_WAIT_MS / 1000)

    while True:
        try:
            if redis.set(key, token, nx=True, px=settings.SLOT_LOCK_TTL_MS):
                return True
        except Exception as exc:  # noqa: BLE001
            raise _Unavailable(str(exc)) from exc

        if time.monotonic() >= deadline:
            # Held by someone slow. Proceed: the unique index is the guarantee,
            # and blocking longer would just turn contention into a timeout.
            logger.warning("slot lock %s still held after waiting; proceeding", key)
            return False

        time.sleep(_RETRY_INTERVAL_SECONDS)


def _release(redis, key: str, token: str) -> None:
    """Release the lock, preferring the atomic script.

    `EVAL` is not universally available — some managed Redis offerings disable
    scripting. Falling back to a read-then-delete reintroduces a small race, but
    the alternative is stranding the lock for its whole TTL and serialising
    every booking for that slot behind it. Given the database index is the real
    guarantee, a rare mistaken release is much cheaper than a guaranteed stall.
    """
    try:
        redis.eval(_RELEASE, 1, key, token)
        return
    except Exception as exc:  # noqa: BLE001
        logger.debug("EVAL unavailable for lock release (%s); using GET+DEL", exc)

    try:
        if redis.get(key) == token:
            redis.delete(key)
    except Exception as exc:  # noqa: BLE001
        # Leave it to expire; the TTL is the backstop.
        logger.warning("could not release slot lock %s (%s)", key, exc)


@contextmanager
def slot_lock(slot_id: str):
    """Hold the lock for `slot_id` for the duration of the block."""
    redis = get_redis()

    if redis is None:
        with _local_locks[slot_id]:
            yield
        return

    key = f"lock:slot:{slot_id}"
    token = uuid.uuid4().hex

    try:
        acquired = _acquire(redis, key, token)
    except _Unavailable as exc:
        logger.warning("slot lock unavailable (%s); relying on the unique index", exc)
        with _local_locks[slot_id]:
            yield
        return

    if not acquired:
        yield
        return

    try:
        yield
    finally:
        _release(redis, key, token)
