"""The contract's stored data (what every node keeps in its copy)."""
from dataclasses import dataclass, field
from typing import Any

from app.chain.hashing import digest
from app.constants import DEFAULT_READ_TOLERANCE, ProductStatus


@dataclass
class Product:
    product_id: str
    name: str
    record_hash: str
    producer: str            # the Signer: only this key signs the product's Tag
    owner: str
    tag_id: str
    write_counter: int
    read_counter: int
    status: str = ProductStatus.REGISTERED.value
    history: list[dict[str, Any]] = field(default_factory=list)
    failures: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class ContractState:
    admin: str
    validators: list[str] = field(default_factory=list)       # order matters for PoA turns
    names: dict[str, str] = field(default_factory=dict)       # address -> display name
    producers: set[str] = field(default_factory=set)
    participants: set[str] = field(default_factory=set)
    products: dict[str, Product] = field(default_factory=dict)
    used_nonces: set[str] = field(default_factory=set)
    unlinked_failures: list[dict[str, Any]] = field(default_factory=list)
    tolerance: int = DEFAULT_READ_TOLERANCE

    def to_dict(self) -> dict[str, Any]:
        return {
            "admin": self.admin,
            "validators": self.validators,
            "names": self.names,
            "producers": sorted(self.producers),
            "participants": sorted(self.participants),
            "products": {pid: vars(p) for pid, p in sorted(self.products.items())},
            "used_nonces": sorted(self.used_nonces),
            "unlinked_failures": self.unlinked_failures,
            "tolerance": self.tolerance,
        }

    def root(self) -> str:
        return digest(self.to_dict())
