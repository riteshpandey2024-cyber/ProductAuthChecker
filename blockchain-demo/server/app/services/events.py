"""An in-memory event log that the UI can read and subscribe to."""
import asyncio
from collections import deque
from typing import Any, Optional

from app.constants import EVENT_LOG_LIMIT


class EventLog:
    def __init__(self) -> None:
        self._events: deque[dict[str, Any]] = deque(maxlen=EVENT_LOG_LIMIT)
        self._seq = 0
        self._subscribers: set[asyncio.Queue] = set()

    def add(self, event_type: str, tick: int, node: Optional[str], data: dict[str, Any]) -> dict[str, Any]:
        self._seq += 1
        event = {"id": self._seq, "type": event_type, "tick": tick, "node": node, "data": data}
        self._events.append(event)
        for queue in list(self._subscribers):
            queue.put_nowait(event)
        return event

    def recent(self, limit: int = 100, node: Optional[str] = None) -> list[dict[str, Any]]:
        items = [e for e in self._events if node is None or e["node"] == node]
        return items[-limit:]

    def clear(self) -> None:
        self._events.clear()

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=1000)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        self._subscribers.discard(queue)
