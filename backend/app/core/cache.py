import time
from typing import Generic, TypeVar

T = TypeVar("T")


class TTLCache(Generic[T]):
    """Tiny in-memory cache: entries expire `ttl` seconds after being stored."""

    def __init__(self, ttl: float):
        self.ttl = ttl
        self._items: dict[object, tuple[float, T]] = {}

    def get(self, key: object) -> T | None:
        entry = self._items.get(key)
        if entry is None:
            return None
        stored_at, value = entry
        if time.monotonic() - stored_at >= self.ttl:
            del self._items[key]
            return None
        return value

    def set(self, key: object, value: T) -> None:
        # Drop expired entries so the dict cannot grow without bound.
        now = time.monotonic()
        self._items = {k: v for k, v in self._items.items() if now - v[0] < self.ttl}
        self._items[key] = (now, value)

    def clear(self) -> None:
        self._items.clear()
