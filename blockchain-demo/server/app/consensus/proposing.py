"""Helpers shared by the consensus modes for producing (possibly faulty) blocks."""
from typing import TYPE_CHECKING

from app.chain.block import Block
from app.chain.hashing import digest_text
from app.constants import NodeMode

if TYPE_CHECKING:
    from app.node.node import Node


def tampered_block(node: "Node", weight: int, extra: str = "") -> Block:
    """A block whose claimed state root is false; every honest node must reject it."""
    block = node.build_block(weight, extra=extra)
    block.state_root = digest_text("forged-state-root")
    return node.sign_block(block)


def split_peers(node: "Node") -> tuple[list[str], list[str]]:
    """Divide the other nodes in two halves for equivocation."""
    peers = [nid for nid in node.env.nodes if nid != node.id]
    half = len(peers) // 2
    return peers[:half], peers[half:]


def is_faulty(node: "Node") -> bool:
    return node.mode in (NodeMode.EQUIVOCATE, NodeMode.TAMPER)
