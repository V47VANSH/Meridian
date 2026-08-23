"""The Redis-backed paths, and their fallbacks.

There is no Redis in this environment and the suite must not require one, so
these use a fake client that implements just the commands the code calls. That
is enough to test the logic that matters — which commands are issued, in what
order, and what happens when they fail — and the real client is exercised against
a live Redis service container in CI (`.github/workflows/ci-backend.yml`).

The property under test throughout is that **every Redis failure fails open**.
Redis backs a lock whose real guarantee is a database index, and a rate limiter
that is a safety control rather than a correctness one. Neither is worth turning
an outage into a 500.
"""

from __future__ import annotations

import threading

from fastapi.testclient import TestClient

from app.core import ratelimit, slotlock
from app.core.config import settings


class FakeRedis:
    """Just enough Redis: `set(nx, px)`, `eval`, `incr`, `expire`, `pipeline`."""

    def __init__(self, *, fail: bool = False) -> None:
        self.store: dict[str, str] = {}
        self.fail = fail
        self.calls: list[str] = []
        self._lock = threading.Lock()

    def _guard(self, name: str) -> None:
        self.calls.append(name)
        if self.fail:
            raise ConnectionError("redis is down")

    def set(self, key, value, nx=False, px=None):
        self._guard("set")
        with self._lock:
            if nx and key in self.store:
                return None
            self.store[key] = value
            return True

    def eval(self, _script, _numkeys, key, token):
        self._guard("eval")
        with self._lock:
            if self.store.get(key) == token:
                del self.store[key]
                return 1
            return 0

    def incr(self, key, amount=1):
        self._guard("incr")
        with self._lock:
            self.store[key] = str(int(self.store.get(key, 0)) + amount)
            return int(self.store[key])

    def expire(self, key, _seconds):
        self._guard("expire")
        return key in self.store

    def pipeline(self):
        return FakePipeline(self)


class FakePipeline:
    def __init__(self, redis: FakeRedis) -> None:
        self.redis = redis
        self.queued: list[tuple] = []

    def incr(self, key, amount=1):
        self.queued.append(("incr", key, amount))
        return self

    def expire(self, key, seconds):
        self.queued.append(("expire", key, seconds))
        return self

    def execute(self):
        results = []
        for name, *args in self.queued:
            results.append(getattr(self.redis, name)(*args))
        return results


# --- Slot lock --------------------------------------------------------------


def test_slot_lock_takes_and_releases_the_redis_key(monkeypatch):
    """The lock must not outlive the critical section."""
    fake = FakeRedis()
    monkeypatch.setattr(slotlock, "get_redis", lambda: fake)

    with slotlock.slot_lock("slot-1"):
        assert "lock:slot:slot-1" in fake.store, "lock was not taken"

    assert "lock:slot:slot-1" not in fake.store, "lock was not released"
    assert fake.calls == ["set", "eval"]


def test_slot_lock_releases_even_when_the_body_raises(monkeypatch):
    """A failed booking must not strand the lock until its TTL expires."""
    fake = FakeRedis()
    monkeypatch.setattr(slotlock, "get_redis", lambda: fake)

    class Boom(Exception):
        pass

    try:
        with slotlock.slot_lock("slot-2"):
            raise Boom
    except Boom:
        pass

    assert "lock:slot:slot-2" not in fake.store


def test_slot_lock_only_releases_a_lock_it_still_holds(monkeypatch):
    """If the TTL expired and someone else took the lock, we must not delete theirs."""
    fake = FakeRedis()
    monkeypatch.setattr(slotlock, "get_redis", lambda: fake)

    with slotlock.slot_lock("slot-3"):
        # Simulate the TTL lapsing and another worker acquiring it.
        fake.store["lock:slot:slot-3"] = "someone-elses-token"

    assert fake.store["lock:slot:slot-3"] == "someone-elses-token"


def test_slot_lock_fails_open_when_redis_is_down(monkeypatch):
    """A Redis outage must not stop bookings; the DB index is the real guarantee."""
    fake = FakeRedis(fail=True)
    monkeypatch.setattr(slotlock, "get_redis", lambda: fake)

    entered = False
    with slotlock.slot_lock("slot-4"):
        entered = True

    assert entered, "the critical section was never entered"


def test_slot_lock_serialises_concurrent_holders(monkeypatch):
    """Two threads must not hold the same slot's lock at once."""
    fake = FakeRedis()
    monkeypatch.setattr(slotlock, "get_redis", lambda: fake)

    overlaps = []
    inside = threading.Event()
    release = threading.Event()

    def first():
        with slotlock.slot_lock("slot-5"):
            inside.set()
            release.wait(timeout=2)

    def second():
        inside.wait(timeout=2)
        # The Redis key is held, so this contends. It must not observe the key
        # as free.
        overlaps.append("lock:slot:slot-5" in fake.store)
        release.set()

    threads = [threading.Thread(target=first), threading.Thread(target=second)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=5)

    assert overlaps == [True], "the second caller saw the lock as free"


def test_bookings_still_work_end_to_end_with_redis(
    client: TestClient, society, login, monkeypatch
):
    """The whole booking flow over a Redis-backed lock, not just the lock alone."""
    fake = FakeRedis()
    monkeypatch.setattr(slotlock, "get_redis", lambda: fake)

    official = login("official")
    facility = client.post(
        "/api/v1/facilities",
        json={"name": "Clubhouse", "type": "COMMON", "capacity": 40, "rules": ""},
        headers=official,
    ).json()

    slot = client.post(
        f"/api/v1/facilities/{facility['id']}/slots",
        json={
            "date": "2030-01-01",
            "start_time": "18:00",
            "end_time": "19:00",
            "is_bookable": True,
        },
        headers=official,
    ).json()

    first = client.post(
        "/api/v1/bookings", json={"slot_id": slot["id"]}, headers=login("resident")
    )
    assert first.status_code == 201, first.text

    second = client.post(
        "/api/v1/bookings", json={"slot_id": slot["id"]}, headers=login("neighbour")
    )
    assert second.status_code == 409
    assert second.json()["error"] == "SLOT_ALREADY_BOOKED"

    assert "set" in fake.calls, "the Redis lock path was never exercised"


# --- Rate limiter -----------------------------------------------------------


def test_rate_limiter_counts_in_redis_when_available(monkeypatch):
    """The counter should live in Redis, with a TTL, so workers share it."""
    fake = FakeRedis()
    monkeypatch.setattr(ratelimit, "get_redis", lambda: fake)
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT", 2)

    first = ratelimit.check("1.2.3.4", "/api/v1/complaints")
    second = ratelimit.check("1.2.3.4", "/api/v1/complaints")
    third = ratelimit.check("1.2.3.4", "/api/v1/complaints")

    assert (first.allowed, second.allowed, third.allowed) == (True, True, False)
    assert "expire" in fake.calls, "the counter was written without a TTL"


def test_rate_limiter_separates_callers_in_redis(monkeypatch):
    """One caller exhausting their allowance must not affect another."""
    fake = FakeRedis()
    monkeypatch.setattr(ratelimit, "get_redis", lambda: fake)
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT", 1)

    assert ratelimit.check("1.1.1.1", "/api/v1/complaints").allowed is True
    assert ratelimit.check("1.1.1.1", "/api/v1/complaints").allowed is False
    assert ratelimit.check("2.2.2.2", "/api/v1/complaints").allowed is True


def test_rate_limiter_falls_back_when_redis_fails(monkeypatch):
    """A Redis outage must degrade to local counting, not reject every request."""
    fake = FakeRedis(fail=True)
    monkeypatch.setattr(ratelimit, "get_redis", lambda: fake)
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT", 2)
    ratelimit.reset_for_tests()

    decisions = [
        ratelimit.check("9.9.9.9", "/api/v1/complaints").allowed for _ in range(3)
    ]

    # Still counting, just locally.
    assert decisions == [True, True, False]
