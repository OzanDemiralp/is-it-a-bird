import time

from app.core.cache import MISS, TTLCache


def test_returns_default_when_missing():
    cache: TTLCache[int] = TTLCache(60)
    assert cache.get("a") is None
    assert cache.get("a", MISS) is MISS


def test_stores_and_returns_values():
    cache: TTLCache[int] = TTLCache(60)
    cache.set("a", 1)
    assert cache.get("a") == 1


def test_none_can_be_cached_as_a_real_value():
    cache: TTLCache[int | None] = TTLCache(60)
    cache.set("a", None)
    assert cache.get("a", MISS) is None  # a hit with value None, not a miss


def test_default_ttl_expires_entries():
    cache: TTLCache[int] = TTLCache(0.0)
    cache.set("a", 1)
    assert cache.get("a", MISS) is MISS


def test_per_entry_ttl_overrides_the_default():
    cache: TTLCache[int] = TTLCache(0.0)  # default would expire immediately
    cache.set("long", 1, ttl=60)
    cache.set("short", 2, ttl=0.0)
    assert cache.get("long") == 1
    assert cache.get("short", MISS) is MISS


def test_entry_expires_after_its_own_ttl():
    cache: TTLCache[int] = TTLCache(60)
    cache.set("a", 1, ttl=0.05)
    assert cache.get("a") == 1
    time.sleep(0.06)
    assert cache.get("a", MISS) is MISS


def test_expired_entries_are_purged_on_set():
    cache: TTLCache[int] = TTLCache(60)
    cache.set("old", 1, ttl=0.0)
    cache.set("new", 2)
    assert list(cache._items) == ["new"]
