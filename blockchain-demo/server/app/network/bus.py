"""A simulated network between nodes: delivery delay, partitions, offline nodes."""
import heapq
from typing import TYPE_CHECKING, Optional

from app.constants import DEFAULT_LATENCY_TICKS, NodeMode

if TYPE_CHECKING:
    from app.network.engine import NetworkEngine


class Bus:
    def __init__(self, engine: "NetworkEngine") -> None:
        self.engine = engine
        self.latency = DEFAULT_LATENCY_TICKS
        self.groups: Optional[list[set[str]]] = None   # None means everyone can talk
        self._queue: list[tuple[int, int, str, str, tuple]] = []
        self._seq = 0
        self.delivered = 0
        self.dropped = 0

    def reachable(self, a: str, b: str) -> bool:
        if a == b or self.groups is None:
            return True
        return any(a in group and b in group for group in self.groups)

    def send(self, sender: str, receiver: str, msg: tuple) -> None:
        nodes = self.engine.nodes
        if sender not in nodes or receiver not in nodes:
            return
        if nodes[sender].mode == NodeMode.OFFLINE or not self.reachable(sender, receiver):
            self.dropped += 1
            return
        self._seq += 1
        heapq.heappush(self._queue, (self.engine.tick + self.latency, self._seq, sender, receiver, msg))

    def broadcast(self, sender: str, msg: tuple) -> None:
        for receiver in list(self.engine.nodes):
            if receiver != sender:
                self.send(sender, receiver, msg)

    def deliver(self, tick: int) -> None:
        while self._queue and self._queue[0][0] <= tick:
            _, _, sender, receiver, msg = heapq.heappop(self._queue)
            node = self.engine.nodes.get(receiver)
            if node is not None:
                self.delivered += 1
                node.receive(msg, sender)

    def partition(self, groups: list[set[str]]) -> None:
        self.groups = groups

    def heal(self) -> None:
        self.groups = None
