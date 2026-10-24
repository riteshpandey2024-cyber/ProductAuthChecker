"""Business flows for products: register, hand over, sell, and list."""
import secrets
from typing import TYPE_CHECKING, Any, Optional

from app.chain.hashing import digest
from app.chain.signing import sign_digest
from app.constants import Role, TxType
from app.contract.rules import TagData, tag_message_digest

if TYPE_CHECKING:
    from app.network.engine import NetworkEngine


class TxFailed(Exception):
    """The transaction was rejected, or never settled in time."""

    def __init__(self, message: str, status: str = "rejected") -> None:
        super().__init__(message)
        self.status = status


class PartyService:
    def __init__(self, engine: "NetworkEngine") -> None:
        self.engine = engine

    async def create(self, name: str, role: Role) -> dict[str, Any]:
        """Create a party. Producers and participants are approved on the chain by the admin."""
        engine = self.engine
        party = engine.vault.create(name, role)
        tx_hash: Optional[str] = None
        tx_types = {Role.PRODUCER: TxType.REGISTER_PRODUCER, Role.PARTICIPANT: TxType.REGISTER_PARTICIPANT}
        if role in tx_types:
            tx = engine.submit(engine.reference_node().state.admin, tx_types[role], {"address": party.address, "name": name})
            tx_hash = tx.hash
            status = await engine.wait_final(tx.hash)
            if status["status"] != "final":
                raise TxFailed(status.get("reason", "approval did not settle in time"), status["status"])
        return {**party.public(), "approval_tx": tx_hash}

    def list(self) -> list[dict[str, Any]]:
        reference = self.engine.reference_node()
        approved = set()
        if reference:
            approved = reference.state.producers | reference.state.participants | set(reference.state.validators)
        out = []
        for party in self.engine.vault.list():
            approved_flag = party.role in (Role.ADMIN, Role.CUSTOMER) or party.address in approved
            out.append({**party.public(), "approved": approved_flag})
        return out


class ProductService:
    def __init__(self, engine: "NetworkEngine") -> None:
        self.engine = engine

    @staticmethod
    def _chip_serial() -> str:
        return ":".join(f"{b:02X}" for b in secrets.token_bytes(7))

    async def register(self, producer: str, name: str, details: dict[str, Any]) -> dict[str, Any]:
        engine = self.engine
        engine._product_seq += 1
        product_id = f"P-{engine._product_seq}"
        tag_id = self._chip_serial()
        record = {"product_id": product_id, "name": name, "details": details, "producer": producer}
        record_hash = engine.ipfs.put(record)  # off-chain copy; only its hash goes on the chain
        engine.records.save(product_id, record, {})
        try:
            tx = engine.submit(
                producer, TxType.CREATE_PRODUCT,
                {"product_id": product_id, "name": name, "record_hash": record_hash, "tag_id": tag_id},
            )
            status = await engine.wait_final(tx.hash)
        except Exception:
            engine.records.remove(product_id)
            raise
        if status["status"] != "final":
            engine.records.remove(product_id)
            raise TxFailed(status.get("reason", "registration did not settle in time"), status["status"])
        tag = self.issue_tag(producer, product_id, tag_id)
        engine.records.save(product_id, record, tag.model_dump())
        return {"product_id": product_id, "record_hash": record_hash, "tx": tx.hash, "block": status["block"], "tag": tag.model_dump()}

    def issue_tag(self, producer: str, product_id: str, tag_id: str) -> TagData:
        """Sign the Signed label (Product ID + Tag identifier) with the producer's key."""
        key = self.engine.vault.get(producer).private_key
        signature = sign_digest(key, tag_message_digest(product_id, tag_id))
        return TagData(product_id=product_id, tag_id=tag_id, write_counter=1, read_counter=0, signature=signature)

    async def handover(self, actor: str, product_id: str, to: str) -> dict[str, Any]:
        return await self._settle(actor, TxType.TRANSFER, {"product_id": product_id, "to": to})

    async def sell(self, actor: str, product_id: str, buyer: str) -> dict[str, Any]:
        return await self._settle(actor, TxType.SELL, {"product_id": product_id, "buyer": buyer})

    async def set_tolerance(self, value: int) -> dict[str, Any]:
        admin = self.engine.reference_node().state.admin
        return await self._settle(admin, TxType.SET_TOLERANCE, {"value": value})

    async def _settle(self, actor: str, tx_type: TxType, payload: dict[str, Any]) -> dict[str, Any]:
        tx = self.engine.submit(actor, tx_type, payload)
        status = await self.engine.wait_final(tx.hash)
        if status["status"] != "final":
            raise TxFailed(status.get("reason", "transaction did not settle in time"), status["status"])
        return {"tx": tx.hash, "block": status["block"]}

    # ---- reads -----------------------------------------------------------------------
    def list(self) -> list[dict[str, Any]]:
        reference = self.engine.reference_node()
        if reference is None:
            return []
        name = self.engine.name_of
        out = []
        for product in reference.state.products.values():
            stored = self.engine.records.get(product.product_id)
            out.append(
                {
                    "product_id": product.product_id,
                    "name": product.name,
                    "producer": product.producer,
                    "producer_name": name(product.producer),
                    "owner": product.owner,
                    "owner_name": name(product.owner),
                    "status": product.status,
                    "tag_id": product.tag_id,
                    "write_counter": product.write_counter,
                    "read_counter": product.read_counter,
                    "record_hash": product.record_hash,
                    "tag": self._current_tag(product, stored),
                    "history": [self._named(h) for h in product.history],
                    "failures": product.failures,
                    "db_edits": stored.log if stored else [],
                }
            )
        return out

    def _named(self, entry: dict[str, Any]) -> dict[str, Any]:
        out = dict(entry)
        for key in ("by", "from", "to"):
            if key in out:
                out[key] = self.engine.name_of(out[key])
        return out

    @staticmethod
    def _current_tag(product, stored) -> Optional[dict[str, Any]]:
        """The tag as issued, for the demo's virtual tag."""
        return dict(stored.tag) if stored and stored.tag else None
