"""Transactions: signed requests that change the shared record."""
import secrets
from typing import Any

from pydantic import BaseModel, Field

from app.chain.hashing import digest
from app.chain.signing import recover_signer, sign_digest
from app.constants import TxType


class Tx(BaseModel):
    type: TxType
    payload: dict[str, Any] = Field(default_factory=dict)
    sender: str
    nonce: int
    sig: str = ""

    def signing_digest(self) -> str:
        return digest(
            {"type": self.type.value, "payload": self.payload, "sender": self.sender, "nonce": self.nonce}
        )

    @property
    def hash(self) -> str:
        return self.signing_digest()

    def signature_valid(self) -> bool:
        return recover_signer(self.signing_digest(), self.sig) == self.sender


def make_tx(tx_type: TxType, payload: dict[str, Any], sender: str, private_key: str) -> Tx:
    tx = Tx(type=tx_type, payload=payload, sender=sender, nonce=secrets.randbits(48))
    tx.sig = sign_digest(private_key, tx.signing_digest())
    return tx
