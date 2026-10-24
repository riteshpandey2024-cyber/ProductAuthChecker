"""Blocks: batches of transactions linked by hash."""
from pydantic import BaseModel, Field

from app.chain.hashing import digest
from app.chain.signing import recover_signer, sign_digest
from app.chain.tx import Tx
from app.constants import ZERO_HASH


class Block(BaseModel):
    index: int
    prev_hash: str
    tick: int
    proposer: str
    weight: int
    txs: list[Tx] = Field(default_factory=list)
    state_root: str
    extra: str = ""
    hash: str = ""
    proposer_sig: str = ""

    def header(self) -> dict:
        return {
            "index": self.index,
            "prev_hash": self.prev_hash,
            "tick": self.tick,
            "proposer": self.proposer,
            "weight": self.weight,
            "tx_hashes": [tx.hash for tx in self.txs],
            "state_root": self.state_root,
            "extra": self.extra,
        }

    def compute_hash(self) -> str:
        return digest(self.header())

    def seal(self, private_key: str) -> "Block":
        """Fill in the hash and the proposer's signature over it."""
        self.hash = self.compute_hash()
        self.proposer_sig = sign_digest(private_key, self.hash)
        return self

    def hash_valid(self) -> bool:
        return self.hash == self.compute_hash()

    def proposer_sig_valid(self) -> bool:
        return recover_signer(self.hash, self.proposer_sig) == self.proposer


def make_genesis(state_root: str) -> Block:
    block = Block(index=0, prev_hash=ZERO_HASH, tick=0, proposer="0x0", weight=0, state_root=state_root)
    block.hash = block.compute_hash()
    return block
