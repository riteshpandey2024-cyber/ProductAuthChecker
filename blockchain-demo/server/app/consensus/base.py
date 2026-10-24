"""Consensus interface: the rule by which nodes agree on which blocks count."""
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Any

from app.chain.block import Block
from app.constants import ConsensusKind
from app.contract.state import ContractState

if TYPE_CHECKING:
    from app.node.node import Node


class BlockRejected(Exception):
    """A node refuses a block; the message says why."""


class Consensus(ABC):
    kind: ConsensusKind

    def new_node_state(self) -> Any:
        """Per-node scratch data this consensus needs."""
        return None

    @abstractmethod
    def validate_block(self, node: "Node", block: Block, parent: Block, parent_state: ContractState) -> None:
        """Raise BlockRejected if the block breaks this consensus's rules."""

    @abstractmethod
    def on_tick(self, node: "Node", tick: int) -> None:
        """Called once per tick for every node: propose a block when it is this node's turn."""

    def describe(self, node: "Node") -> dict[str, Any]:
        return {}
