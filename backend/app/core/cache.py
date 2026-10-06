import time
from typing import Any, Generic, TypeVar

T = TypeVar("T")

# Returned by `get` when nothing (valid) is stored. Lets callers cache `None` as a real value,
# e.g. "adsbdb has no data for this callsign".
MISS: Any = object()


class TTLCache(Generic[T]):
    """Tiny in-memory cache: entries expire after their TTL.

    Each entry may have its own TTL (`set(..., ttl=...)`); otherwise the cache default is used.
    """

    def __init__(self, ttl: float):
        self.ttl = ttl
        # key -> (stored_at, ttl, value)
        self._items: dict[object, tuple[float, float, T]] = {}

    def get(self, key: object, default: Any = None) -> Any:
        entry = self._items.get(key)
        if entry is None:
            return default
        stored_at, ttl, value = entry
        if time.monotonic() - stored_at >= ttl:
            del self._items[key]
            return default
        return value

    def set(self, key: object, value: T, ttl: float | None = None) -> None:
        # Drop expired entries so the dict cannot grow without bound.
        now = time.monotonic()
        self._items = {k: v for k, v in self._items.items() if now - v[0] < v[1]}
        self._items[key] = (now, self.ttl if ttl is None else ttl, value)

    def clear(self) -> None:
        self._items.clear()
