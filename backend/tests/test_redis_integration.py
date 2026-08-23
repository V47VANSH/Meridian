"""The Redis paths against a real Redis.

`tests/test_redis_paths.py` covers the same logic with a fake, which is what
makes the suite runnable with nothing installed. A fake proves the code issues
the commands it means to; it cannot prove Redis agrees with our reading of them
— that `SET NX PX` really is atomic, that the release script really is
compare-and-delete, that a TTL really expires.

These run only when `TEST_REDIS_URL` is set, and skip otherwise. CI sets it from
a Redis service container (`.github/workflows/ci-backend.yml`); locally, start
one and run:

    REDIS_URL=redis://localhost:6379/0 pytest tests/test_redis_integration.py
"""

from __future__ import annotations

import os
import threading
import time
import uuid

import pytest

from app.core import ratelimit, slotlock
from app.core.config import settings

TEST_REDIS_URL = os.environ.get("TEST_REDIS_URL", "")

pytestmark = pytest.mark.skipif(
    not TEST_REDIS_URL, reason="TEST_REDIS_URL not set; no live Redis to test against"
)


@pytest.fixture
def redis_client():
    """A real client, on a key prefix unique to this run."""
    import redis as redis_lib

    client = redis_lib.Redis.from_url(TEST_REDIS_URL, decode_responses=True)
    client.ping()
    yield client

    # Leave nothing behind, so repeated runs and parallel jobs do not collide.
    for pattern in ("lock:slot:it-*", "rl:*:it-*:*"):
        keys = list(client.scan_iter(match=pattern, count=500))
        if keys:
            client.delete(*keys)
    client.close()


def _unique(prefix: str) -> str:
    return f"it-{prefix}-{uuid.uuid4().hex[:8]}"


# --- Slot lock --------------------------------------------------------------


def test_lock_is_visible_in_redis_and_cleared_after(redis_client, monkeypatch):
    monkeypatch.setattr(slotlock, "get_redis", lambda: redis_client)
    slot = _unique("slot")

    with slotlock.slot_lock(slot):
        assert redis_client.get(f"lock:slot:{slot}") is not None

    assert redis_client.get(f"lock:slot:{slot}") is None


def test_lock_carries_a_ttl_so_a_crashed_worker_cannot_strand_a_slot(
    redis_client, monkeypatch
):
    """Without a TTL, a worker dying mid-booking would block that slot forever."""
    monkeypatch.setattr(slotlock, "get_redis", lambda: redis_client)
    slot = _unique("ttl")

    with slotlock.slot_lock(slot):
        ttl_ms = redis_client.pttl(f"lock:slot:{slot}")
        assert 0 < ttl_ms <= settings.SLOT_LOCK_TTL_MS


def test_a_second_holder_is_excluded_while_the_first_holds_it(
    redis_client, monkeypatch
):
    """`SET NX` must actually be atomic — this is the claim a fake cannot verify."""
    monkeypatch.setattr(slotlock, "get_redis", lambda: redis_client)
    slot = _unique("excl")
    key = f"lock:slot:{slot}"

    with slotlock.slot_lock(slot):
        # A competing acquire, issued exactly as the lock does it.
        second = redis_client.set(key, "other", nx=True, px=1000)
        assert second is None, "Redis granted the lock twice"


def test_release_does_not_delete_a_lock_someone_else_now_holds(
    redis_client, monkeypatch
):
    """The compare-and-delete script is what makes an expired TTL safe."""
    monkeypatch.setattr(slotlock, "get_redis", lambda: redis_client)
    slot = _unique("cas")
    key = f"lock:slot:{slot}"

    with slotlock.slot_lock(slot):
        # Simulate our TTL lapsing and another worker taking over.
        redis_client.set(key, "someone-elses-token", px=5000)

    assert redis_client.get(key) == "someone-elses-token"
    redis_client.delete(key)


def test_concurrent_threads_serialise_through_redis(redis_client, monkeypatch):
    """Only one thread at a time inside the critical section."""
    monkeypatch.setattr(slotlock, "get_redis", lambda: redis_client)
    slot = _unique("race")

    concurrent = 0
    peak = 0
    guard = threading.Lock()
    barrier = threading.Barrier(6)

    def worker():
        nonlocal concurrent, peak
        barrier.wait(timeout=10)
        with slotlock.slot_lock(slot):
            with guard:
                concurrent += 1
                peak = max(peak, concurrent)
            time.sleep(0.02)
            with guard:
                concurrent -= 1

    threads = [threading.Thread(target=worker) for _ in range(6)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=15)

    assert peak == 1, f"{peak} threads were inside the lock at once"


# --- Rate limiter -----------------------------------------------------------


def test_counter_lives_in_redis_and_expires(redis_client, monkeypatch):
    monkeypatch.setattr(ratelimit, "get_redis", lambda: redis_client)
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT", 3)
    caller = _unique("rl")

    for expected in (True, True, True, False):
        assert ratelimit.check(caller, "/api/v1/complaints").allowed is expected

    keys = list(redis_client.scan_iter(match=f"rl:default:{caller}:*"))
    assert keys, "no counter was written to Redis"
    assert redis_client.ttl(keys[0]) > 0, "the counter would never expire"


def test_the_counter_is_shared_rather_than_per_process(redis_client, monkeypatch):
    """The whole point of Redis here: two workers must share one allowance.

    Simulated by resetting the in-process store between calls — if the count
    were local, that reset would restore the allowance. It must not.
    """
    monkeypatch.setattr(ratelimit, "get_redis", lambda: redis_client)
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT", 2)
    caller = _unique("shared")

    assert ratelimit.check(caller, "/api/v1/complaints").allowed is True
    ratelimit.reset_for_tests()  # stand in for a different worker process
    assert ratelimit.check(caller, "/api/v1/complaints").allowed is True
    ratelimit.reset_for_tests()
    assert ratelimit.check(caller, "/api/v1/complaints").allowed is False
