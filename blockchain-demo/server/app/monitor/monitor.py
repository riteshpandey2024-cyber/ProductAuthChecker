"""The central monitor: compares every node's chain and shows where they differ."""
from collections import defaultdict
from typing import TYPE_CHECKING, Any, Optional

from app.node.node import Node

if TYPE_CHECKING:
    from app.network.engine import NetworkEngine

RECENT_BLOCKS_PER_NODE = 8
BLOCK_ROWS = 12


class Monitor:
    def __init__(self, engine: "NetworkEngine") -> None:
        self.engine = engine

    def head_groups(self, online_only: bool = False) -> dict[str, list[Node]]:
        groups: dict[str, list[Node]] = defaultdict(list)
        for node in self.engine.nodes.values():
            if online_only and not node.online:
                continue
            groups[node.head].append(node)
        return groups

    def majority_node(self) -> Optional[Node]:
        """A node from the largest group of online nodes that agree on the head."""
        groups = self.head_groups(online_only=True)
        if not groups:
            return None
        best = max(groups.values(), key=lambda g: (len(g), g[0].total_weight[g[0].head]))
        return best[0]

    def _block_summary(self, node: Node, block) -> dict[str, Any]:
        return {
            "index": block.index,
            "hash": block.hash,
            "proposer": self.engine.name_of(block.proposer) if block.index else "genesis",
            "weight": block.weight,
            "txs": len(block.txs),
        }

    def snapshot(self) -> dict[str, Any]:
        engine = self.engine
        majority = self.majority_node()
        majority_hash = majority.head if majority else None
        majority_chain = {b.index: b.hash for b in majority.chain()} if majority else {}

        nodes_info: list[dict[str, Any]] = []
        chains: dict[str, dict[int, str]] = {}
        for node in engine.nodes.values():
            chain = node.chain()
            chains[node.id] = {b.index: b.hash for b in chain}
            first_diff = next(
                (b.index for b in chain if majority_chain.get(b.index) != b.hash), None
            )
            nodes_info.append(
                {
                    "id": node.id,
                    "name": node.name,
                    "address": node.address,
                    "joining": not node.is_validator,  # approval to join the validator list not agreed yet
                    "mode": node.mode.value,
                    "online": node.online,
                    "height": node.head_block.index,
                    "head_hash": node.head,
                    "head_weight": node.total_weight[node.head],
                    "mempool": len(node.mempool),
                    "known_blocks": len(node.blocks),
                    "diverges": node.head != majority_hash,
                    "first_divergent_index": first_diff,
                    "recent": [self._block_summary(node, b) for b in chain[-RECENT_BLOCKS_PER_NODE:]],
                    "consensus": engine.consensus.describe(node),
                }
            )

        top = max((n["height"] for n in nodes_info), default=0)
        rows: list[dict[str, Any]] = []
        for index in range(max(0, top - BLOCK_ROWS + 1), top + 1):
            variants: dict[str, dict[str, Any]] = {}
            for node in engine.nodes.values():
                block_hash = chains[node.id].get(index)
                if block_hash is None:
                    continue
                if block_hash not in variants:
                    block = node.blocks[block_hash]
                    variants[block_hash] = {**self._block_summary(node, block), "nodes": []}
                variants[block_hash]["nodes"].append(node.id)
            rows.append({"index": index, "variants": list(variants.values()), "forked": len(variants) > 1})

        groups = self.head_groups()
        online_sizes = sorted((len(g) for g in self.head_groups(online_only=True).values()), reverse=True)
        tie = len(online_sizes) > 1 and online_sizes[0] == online_sizes[1]
        divergent = [n["id"] for n in nodes_info if n["diverges"]]
        return {
            "forked": len(groups) > 1,
            "tie": tie,  # the largest groups are the same size, so there is no true majority
            "majority_head": majority_hash,
            "majority_nodes": [n.id for n in groups.get(majority_hash, [])] if majority_hash else [],
            "divergent_nodes": divergent,
            "groups": [{"head": h, "nodes": [n.id for n in g]} for h, g in groups.items()],
            "first_divergent_index": min(
                (n["first_divergent_index"] for n in nodes_info if n["first_divergent_index"] is not None),
                default=None,
            ),
            "rows": rows,
            "nodes": nodes_info,
        }
