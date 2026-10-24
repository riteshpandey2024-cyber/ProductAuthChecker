"""A node: its own copy of the chain, its own contract state, and its own mempool."""
import copy
import logging
from typing import TYPE_CHECKING, Any, Optional

from app.chain.block import Block
from app.chain.tx import Tx
from app.consensus.base import BlockRejected
from app.constants import MAX_TXS_PER_BLOCK, EventType, NodeMode
from app.contract.rules import ContractError, ProductContract
from app.contract.state import ContractState

if TYPE_CHECKING:
    from app.network.engine import NetworkEngine

logger = logging.getLogger(__name__)


class Node:
    def __init__(
        self,
        node_id: str,
        name: str,
        address: str,
        private_key: str,
        genesis: Block,
        genesis_state: ContractState,
        env: "NetworkEngine",
    ) -> None:
        self.id = node_id
        self.name = name
        self.address = address
        self.private_key = private_key
        self.env = env
        self.mode = NodeMode.HONEST
        self.mempool: dict[str, Tx] = {}
        self.cstate: Any = env.consensus.new_node_state()

        # A block tree, because different branches can exist at once (forks).
        self.blocks: dict[str, Block] = {genesis.hash: genesis}
        self.states: dict[str, ContractState] = {genesis.hash: genesis_state}
        self.total_weight: dict[str, int] = {genesis.hash: 0}
        self.included: dict[str, frozenset[str]] = {genesis.hash: frozenset()}
        self.head: str = genesis.hash

    # ---- views -----------------------------------------------------------------------
    @property
    def head_block(self) -> Block:
        return self.blocks[self.head]

    @property
    def state(self) -> ContractState:
        return self.states[self.head]

    @property
    def online(self) -> bool:
        return self.mode != NodeMode.OFFLINE

    @property
    def is_validator(self) -> bool:
        return self.address in self.state.validators

    def chain(self, limit: Optional[int] = None) -> list[Block]:
        """Blocks from genesis to this node's head (or the last `limit` of them)."""
        path: list[Block] = []
        cursor: Optional[Block] = self.head_block
        while cursor is not None and (limit is None or len(path) < limit):
            path.append(cursor)
            cursor = self.blocks.get(cursor.prev_hash) if cursor.index > 0 else None
        path.reverse()
        return path

    def ancestors(self, block_hash: str) -> list[str]:
        """Hashes from `block_hash` back to genesis, newest first."""
        out: list[str] = []
        cursor: Optional[Block] = self.blocks.get(block_hash)
        while cursor is not None:
            out.append(cursor.hash)
            cursor = self.blocks.get(cursor.prev_hash) if cursor.index > 0 else None
        return out

    def read_call(self, fn, *args):
        """A read: answered from THIS node's state alone, with no agreement involved."""
        return fn(self.state, *args)

    # ---- messages --------------------------------------------------------------------
    def receive(self, msg: tuple, sender_id: str) -> None:
        if not self.online:
            return
        kind = msg[0]
        if kind == "tx":
            self.receive_tx(msg[1])
        elif kind == "block":
            self.add_block(msg[1], sender_id)
        elif kind == "head":
            if msg[1] not in self.blocks and sender_id in self.env.nodes:
                self.sync_from(self.env.nodes[sender_id])

    # ---- transactions ----------------------------------------------------------------
    def submit_tx(self, tx: Tx) -> None:
        """Entry point for a transaction sent to this node. Raises ContractError if invalid."""
        self._precheck(tx)
        self.mempool[tx.hash] = tx
        self.env.bus.broadcast(self.id, ("tx", tx))

    def receive_tx(self, tx: Tx) -> None:
        if tx.hash in self.mempool or tx.hash in self.included[self.head]:
            return
        try:
            self._precheck(tx)
        except ContractError:
            return
        self.mempool[tx.hash] = tx

    def _precheck(self, tx: Tx) -> None:
        ProductContract.apply_tx(copy.deepcopy(self.state), tx, self.head_block.index + 1)

    # ---- producing blocks ------------------------------------------------------------
    def build_block(self, weight: int, extra: str = "") -> Block:
        parent = self.head_block
        working = copy.deepcopy(self.state)
        picked: list[Tx] = []
        for tx in list(self.mempool.values()):
            if len(picked) >= MAX_TXS_PER_BLOCK:
                break
            try:
                ProductContract.apply_tx(working, tx, parent.index + 1)
                picked.append(tx)
            except ContractError as exc:
                self.mempool.pop(tx.hash, None)
                self.env.on_tx_dropped(tx.hash, str(exc))
        block = Block(
            index=parent.index + 1,
            prev_hash=parent.hash,
            tick=self.env.tick,
            proposer=self.address,
            weight=weight,
            txs=picked,
            state_root=working.root(),
            extra=extra,
        )
        return self.sign_block(block)

    def sign_block(self, block: Block) -> Block:
        return block.seal(self.private_key)

    # ---- receiving blocks ------------------------------------------------------------
    def add_block(self, block: Block, sender_id: Optional[str] = None) -> bool:
        """Validate `block` independently and add it to this node's block tree."""
        if block.hash in self.blocks:
            return False
        if block.prev_hash not in self.states:
            # We are missing the parent: ask the sender for what we lack, then retry once.
            sender = self.env.nodes.get(sender_id) if sender_id else None
            if sender is not None and self.sync_from(sender) and block.prev_hash in self.states:
                return self.add_block(block, None)
            return False
        try:
            new_state = self._validate(block)
        except BlockRejected as exc:
            self.env.emit(
                EventType.BLOCK_REJECTED, self.id, index=block.index, hash=block.hash,
                proposer=block.proposer, reason=str(exc),
            )
            return False
        self._store(block, new_state)
        return True

    def _validate(self, block: Block) -> ContractState:
        parent = self.blocks[block.prev_hash]
        parent_state = self.states[block.prev_hash]
        if block.index != parent.index + 1:
            raise BlockRejected("wrong block number")
        if not block.hash_valid():
            raise BlockRejected("block hash does not match its contents")
        if not block.proposer_sig_valid():
            raise BlockRejected("proposer signature is invalid")
        self.env.consensus.validate_block(self, block, parent, parent_state)
        state = copy.deepcopy(parent_state)
        for tx in block.txs:
            try:
                ProductContract.apply_tx(state, tx, block.index)
            except ContractError as exc:
                raise BlockRejected(f"contains an invalid transaction: {exc}") from exc
        if state.root() != block.state_root:
            raise BlockRejected("state root mismatch: the block claims a result the contract does not produce")
        return state

    def _store(self, block: Block, state: ContractState) -> None:
        self.blocks[block.hash] = block
        self.states[block.hash] = state
        weight = self.total_weight[block.prev_hash] + block.weight
        self.total_weight[block.hash] = weight
        self.included[block.hash] = self.included[block.prev_hash] | frozenset(t.hash for t in block.txs)
        self.env.emit(
            EventType.BLOCK_ACCEPTED, self.id, index=block.index, hash=block.hash,
            proposer=block.proposer, weight=block.weight, txs=len(block.txs),
        )
        current = self.total_weight[self.head]
        if weight > current or (weight == current and block.hash < self.head):
            self._switch_head(block.hash)

    def _switch_head(self, new_hash: str) -> None:
        old_hash = self.head
        extends = self.blocks[new_hash].prev_hash == old_hash
        abandoned: list[Block] = []
        if not extends:
            keep = set(self.ancestors(new_hash))
            cursor: Optional[Block] = self.blocks[old_hash]
            while cursor is not None and cursor.hash not in keep:
                abandoned.append(cursor)
                cursor = self.blocks.get(cursor.prev_hash) if cursor.index > 0 else None
            self.env.emit(
                EventType.REORG, self.id, old_head=old_hash, new_head=new_hash, abandoned=len(abandoned),
            )
        self.head = new_hash
        for tx_hash in self.included[new_hash]:
            self.mempool.pop(tx_hash, None)
        for block in abandoned:  # transactions on the dropped branch go back to waiting
            for tx in block.txs:
                if tx.hash not in self.included[new_hash]:
                    self.mempool.setdefault(tx.hash, tx)

    # ---- syncing ---------------------------------------------------------------------
    def sync_from(self, other: "Node") -> bool:
        """Copy the blocks we lack from `other`'s chain, validating each one."""
        if other is self or not other.online or not self.env.bus.reachable(other.id, self.id):
            return False
        added = 0
        for block in other.chain():
            if block.hash not in self.blocks and self.add_block(block, None):
                added += 1
        if added:
            self.env.emit(EventType.SYNC, self.id, source=other.id, blocks=added)
        return added > 0
