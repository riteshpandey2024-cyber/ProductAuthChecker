"""Off-chain storage: a content-addressed IPFS stand-in and the server's database."""
from dataclasses import dataclass, field
from typing import Any, Optional

from app.chain.hashing import digest


class IpfsMock:
    """Content-addressed: the key IS the hash of the content, so content cannot be swapped."""

    def __init__(self) -> None:
        self._objects: dict[str, dict[str, Any]] = {}

    def put(self, record: dict[str, Any]) -> str:
        cid = digest(record)
        self._objects[cid] = dict(record)
        return cid

    def get(self, cid: str) -> Optional[dict[str, Any]]:
        record = self._objects.get(cid)
        return dict(record) if record is not None else None


@dataclass
class StoredProduct:
    record: dict[str, Any]
    tag: dict[str, Any]   # the server's copy of what it wrote on the tag, and the last read counter
    log: list[str] = field(default_factory=list)


class RecordStore:
    """The server's own database. Unlike the chain, whoever runs the server can edit it."""

    def __init__(self) -> None:
        self._products: dict[str, StoredProduct] = {}

    def save(self, product_id: str, record: dict[str, Any], tag: dict[str, Any]) -> None:
        self._products[product_id] = StoredProduct(record=dict(record), tag=dict(tag))

    def get(self, product_id: str) -> Optional[StoredProduct]:
        return self._products.get(product_id)

    def remove(self, product_id: str) -> None:
        self._products.pop(product_id, None)

    def set_read_counter(self, product_id: str, value: int) -> None:
        stored = self._products.get(product_id)
        if stored:
            stored.tag["read_counter"] = value

    def tamper(self, product_id: str, field_name: str, value: Any) -> bool:
        stored = self._products.get(product_id)
        if stored is None:
            return False
        stored.record[field_name] = value
        stored.log.append(f"record field '{field_name}' edited directly in the database")
        return True
