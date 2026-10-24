"""Proof-of-Authority: approved validators take turns; the heaviest chain wins.

An in-turn block carries weight 2, an out-of-turn block weight 1. Out-of-turn validators
may step in after a delay, which keeps each side of a network partition producing blocks
and is what creates visible forks that later resolve by weight.
"""
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from app.chain.block import Block
from app.constants import (
    BLOCK_PERIOD_TICKS,
    IDLE_HEARTBEAT_TICKS,
    OUT_OF_TURN_STEP_TICKS,
    ConsensusKind,
    EventType,
    NodeMode,
)
from app.consensus.base import BlockRejected, Consensus
from app.consensus.proposing import split_peers, tampered_block
from app.contract.state import ContractState

if TYPE_CHECKING:
    from app.node.node import Node


@dataclass
class PoaNodeState:
    proposed_on: set[str] = field(default_factory=set)  # parents this node already built on
    work_since: dict[str, int] = field(default_factory=dict)  # head hash -> tick work first appeared


class ProofOfAuthority(Consensus):
    kind = ConsensusKind.POA

    def new_node_state(self) -> PoaNodeState:
        return PoaNodeState()

    @staticmethod
    def expected_weight(validators: list[str], proposer: str, index: int) -> int:
        return 2 if validators[index % len(validators)] == proposer else 1

    def validate_block(self, node: "Node", block: Block, parent: Block, parent_state: ContractState) -> None:
        validators = parent_state.validators
        if block.proposer not in validators:
            raise BlockRejected("proposer is not an approved validator")
        expected = self.expected_weight(validators, block.proposer, block.index)
        if block.weight != expected:
            raise BlockRejected(f"claimed weight {block.weight}, expected {expected}")

    def on_tick(self, node: "Node", tick: int) -> None:
        if not node.online or not node.is_validator:
            return
        state: PoaNodeState = node.cstate
        head = node.head_block
        if head.hash in state.proposed_on:
            return
        if node.mempool:
            # Count the wait from the moment work appeared (or the last block, if later), so a long idle
            # gap does not let every validator's wait run out at once.
            start = max(head.tick, state.work_since.setdefault(head.hash, tick))
        else:
            state.work_since.clear()
            start = head.tick + IDLE_HEARTBEAT_TICKS  # nothing waiting: hold back for a heartbeat
        validators = node.state.validators
        rank = (validators.index(node.address) - (head.index + 1) % len(validators)) % len(validators)
        if tick - start < BLOCK_PERIOD_TICKS + OUT_OF_TURN_STEP_TICKS * rank:
            return
        state.proposed_on.add(head.hash)
        self._propose(node, weight=2 if rank == 0 else 1)

    def _propose(self, node: "Node", weight: int) -> None:
        env = node.env
        if node.mode == NodeMode.TAMPER:
            block = tampered_block(node, weight)
            env.emit(EventType.BLOCK_PROPOSED, node.id, index=block.index, hash=block.hash, note="tampered state root")
            env.bus.broadcast(node.id, ("block", block))
            return
        if node.mode == NodeMode.EQUIVOCATE:
            first, second = node.build_block(weight, extra="a"), node.build_block(weight, extra="b")
            left, right = split_peers(node)
            env.emit(EventType.BLOCK_PROPOSED, node.id, index=first.index, hash=first.hash, note="equivocation: two blocks")
            node.add_block(first)
            for peer in left:
                env.bus.send(node.id, peer, ("block", first))
            for peer in right:
                env.bus.send(node.id, peer, ("block", second))
            return
        block = node.build_block(weight)
        env.emit(EventType.BLOCK_PROPOSED, node.id, index=block.index, hash=block.hash, weight=weight, txs=len(block.txs))
        node.add_block(block)
        env.bus.broadcast(node.id, ("block", block))

    def describe(self, node: "Node") -> dict[str, Any]:
        validators = node.state.validators
        next_index = node.head_block.index + 1
        return {
            "kind": self.kind.value,
            "in_turn": validators[next_index % len(validators)] if validators else None,
            "rule": "in-turn block weight 2, out-of-turn weight 1; heaviest chain wins",
        }
