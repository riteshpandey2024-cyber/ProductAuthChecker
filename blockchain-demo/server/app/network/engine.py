"""The network engine: owns the nodes, the bus, the clock and the off-chain services."""
import asyncio
import copy
import logging
from typing import Any, Optional

from app.chain.block import make_genesis
from app.chain.tx import Tx, make_tx
from app.consensus.base import Consensus
from app.consensus.poa import ProofOfAuthority
from app.constants import (
    HEAD_ANNOUNCE_EVERY_TICKS,
    EventType,
    NodeMode,
    Role,
    TxType,
)
from app.contract.rules import ContractError
from app.contract.state import ContractState
from app.monitor.monitor import Monitor
from app.network.bus import Bus
from app.node.node import Node
from app.services.events import EventLog
from app.services.storage import IpfsMock, RecordStore
from app.services.vault import KeyVault

logger = logging.getLogger(__name__)


class UnknownNodeError(KeyError):
    """No node with this id."""


class NodeOfflineError(Exception):
    """The requested node is offline."""


class NetworkEngine:
    def __init__(self, nodes: int = 4) -> None:
        self.events = EventLog()
        self.reset(nodes)

    # ---- lifecycle -------------------------------------------------------------------
    def reset(self, nodes: int) -> None:
        """Start a fresh network: new keys, a new genesis block and `nodes` nodes (all of them validators)."""
        if not 1 <= nodes <= 9:
            raise ValueError("nodes must be between 1 and 9")
        self.events.clear()
        self.tick = 0
        self.paused = False
        self.consensus: Consensus = ProofOfAuthority()
        self.vault = KeyVault()
        self.ipfs = IpfsMock()
        self.records = RecordStore()
        self.bus = Bus(self)
        self.monitor = Monitor(self)
        self.nodes: dict[str, Node] = {}
        self.tx_status: dict[str, dict[str, Any]] = {}
        self._waiters: dict[str, list[asyncio.Future]] = {}
        self._product_seq = 1000

        admin = self.vault.create("Administrator", Role.ADMIN)
        node_parties = [self.vault.create(f"Node {chr(65 + i)}", Role.VALIDATOR) for i in range(nodes)]
        state = ContractState(
            admin=admin.address,
            validators=[p.address for p in node_parties],
            names={admin.address: admin.name, **{p.address: p.name for p in node_parties}},
        )
        self._genesis_state = state
        self._genesis = make_genesis(state.root())
        for party in node_parties:
            self._create_node(party.name, party.address, party.private_key)
        self.emit(EventType.NETWORK, None, message=f"network started: proof-of-authority, {nodes} nodes")

    def _create_node(self, name: str, address: str, private_key: str) -> Node:
        index = len(self.nodes)
        node_id = f"node-{chr(97 + index)}" if index < 26 else f"node-{index}"
        node = Node(node_id, name, address, private_key, self._genesis, copy.deepcopy(self._genesis_state), self)
        self.nodes[node_id] = node
        return node

    # ---- environment used by nodes ---------------------------------------------------
    def emit(self, event_type: EventType, node: Optional[str], **data: Any) -> None:
        self.events.add(event_type.value, self.tick, node, data)

    def on_tx_dropped(self, tx_hash: str, reason: str) -> None:
        status = self.tx_status.get(tx_hash)
        if status is not None and status["status"] == "pending":
            status.update(status="rejected", reason=reason)
            self.emit(EventType.TX_DROPPED, None, hash=tx_hash, reason=reason)
            self._resolve(tx_hash)

    def name_of(self, address: str) -> str:
        reference = self.reference_node()
        if reference is not None and address in reference.state.names:
            return reference.state.names[address]
        return self.vault.name_of(address) or f"{address[:8]}…"

    # ---- nodes -----------------------------------------------------------------------
    def node(self, node_id: str) -> Node:
        try:
            return self.nodes[node_id]
        except KeyError as exc:
            raise UnknownNodeError(node_id) from exc

    def reference_node(self) -> Optional[Node]:
        return self.monitor.majority_node() or next(iter(self.nodes.values()), None)

    def add_node(self, name: str) -> tuple[Node, Tx]:
        """Add a node. It copies the chain at once, and joins the validator list when the
        administrator's approval (sent automatically) is agreed in a block."""
        party = self.vault.create(name, Role.VALIDATOR)
        node = self._create_node(name, party.address, party.private_key)
        for peer in self.nodes.values():
            if peer is not node and node.sync_from(peer):
                break
        tx = self.submit(
            self._genesis_state.admin, TxType.REGISTER_VALIDATOR, {"address": node.address, "name": node.name}
        )
        self.emit(EventType.NODE_ADDED, node.id, name=name, address=node.address)
        return node, tx

    def set_mode(self, node_id: str, mode: NodeMode) -> Node:
        node = self.node(node_id)
        node.mode = mode
        self.emit(EventType.NODE_MODE, node.id, mode=mode.value)
        return node

    def set_partition(self, groups: list[list[str]]) -> None:
        listed: set[str] = set()
        parts: list[set[str]] = []
        for group in groups:
            members = {self.node(nid).id for nid in group}
            if members & listed:
                raise ValueError("a node can only be in one group")
            listed |= members
            parts.append(members)
        rest = set(self.nodes) - listed
        if rest:
            parts.append(rest)
        self.bus.partition(parts)
        self.emit(EventType.PARTITION, None, groups=[sorted(p) for p in parts])

    def heal(self) -> None:
        self.bus.heal()
        self.emit(EventType.HEAL, None, message="network healed: all nodes can talk again")

    def set_latency(self, ticks: int) -> None:
        if not 0 <= ticks <= 10:
            raise ValueError("latency must be between 0 and 10 ticks")
        self.bus.latency = ticks

    # ---- transactions ----------------------------------------------------------------
    def submit(self, actor: str, tx_type: TxType, payload: dict[str, Any], entry_node: Optional[str] = None) -> Tx:
        """Sign a transaction as `actor` (the server holds the key) and send it to one node."""
        party = self.vault.get(actor)
        node = self.node(entry_node) if entry_node else next((n for n in self.nodes.values() if n.online), None)
        if node is None or not node.online:
            raise NodeOfflineError(entry_node or "all nodes are offline")
        tx = make_tx(tx_type, payload, party.address, party.private_key)
        node.submit_tx(tx)  # raises ContractError if this node already sees it is invalid
        self.tx_status[tx.hash] = {"status": "pending", "type": tx_type.value, "sender": party.address, "entry": node.id, "tick": self.tick}
        self.emit(EventType.TX_SUBMITTED, node.id, hash=tx.hash, type=tx_type.value, sender=party.name)
        return tx

    async def wait_final(self, tx_hash: str, timeout: float = 10.0) -> dict[str, Any]:
        status = self.tx_status[tx_hash]
        if status["status"] != "pending":
            return status
        future = asyncio.get_running_loop().create_future()
        self._waiters.setdefault(tx_hash, []).append(future)
        try:
            await asyncio.wait_for(future, timeout)
        except asyncio.TimeoutError:
            pass
        return self.tx_status[tx_hash]

    def run_until_final(self, tx_hash: str, max_ticks: int = 60) -> dict[str, Any]:
        """Synchronous helper for tests and scripts: advance the clock until the tx settles."""
        for _ in range(max_ticks):
            if self.tx_status[tx_hash]["status"] != "pending":
                break
            self.step()
        return self.tx_status[tx_hash]

    def _resolve(self, tx_hash: str) -> None:
        for future in self._waiters.pop(tx_hash, []):
            if not future.done():
                future.set_result(True)

    def _refresh_finality(self) -> None:
        wanted = {h for h, s in self.tx_status.items() if s["status"] == "pending"}
        leader = self.monitor.majority_node()
        if not wanted or leader is None:
            return
        for block in leader.chain():
            for tx in block.txs:
                if tx.hash in wanted:
                    self.tx_status[tx.hash].update(status="final", block=block.index, block_hash=block.hash)
                    self.emit(EventType.TX_FINAL, leader.id, hash=tx.hash, block=block.index)
                    self._resolve(tx.hash)

    # ---- clock -----------------------------------------------------------------------
    def step(self) -> None:
        self.tick += 1
        self.bus.deliver(self.tick)
        for node in list(self.nodes.values()):
            self.consensus.on_tick(node, self.tick)
        if self.tick % HEAD_ANNOUNCE_EVERY_TICKS == 0:
            for node in list(self.nodes.values()):
                if node.online:
                    self.bus.broadcast(node.id, ("head", node.head))
        self._refresh_finality()

    def summary(self) -> dict[str, Any]:
        reference = self.reference_node()
        return {
            "network_id": self._genesis.hash,  # changes on every fresh network (new keys), so saved tags can be told apart
            "consensus": self.consensus.kind.value,
            "tick": self.tick,
            "paused": self.paused,
            "latency": self.bus.latency,
            "partition": [sorted(g) for g in self.bus.groups] if self.bus.groups else None,
            "nodes": len(self.nodes),
            "tolerance": reference.state.tolerance if reference else 0,
            "messages": {"delivered": self.bus.delivered, "dropped": self.bus.dropped},
            "pending_txs": sum(1 for s in self.tx_status.values() if s["status"] == "pending"),
        }
