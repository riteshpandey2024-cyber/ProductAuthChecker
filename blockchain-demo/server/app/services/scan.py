"""The Authenticity check run on a Scan: server database, then the shared record, then the stored record."""
from typing import TYPE_CHECKING, Any, Optional

from app.chain.hashing import digest
from app.constants import AttackKind, EventType, TxType
from app.contract.rules import ContractError, ProductContract, TagData, check_read_counter

if TYPE_CHECKING:
    from app.network.engine import NetworkEngine


COUNTER_WAIT_SECONDS = 10.0


class ScanService:
    def __init__(self, engine: "NetworkEngine") -> None:
        self.engine = engine
        self.counter_wait = COUNTER_WAIT_SECONDS  # how long a scan waits for the network to agree

    async def check(self, tag: TagData, node_id: Optional[str] = None, trust_database: bool = True) -> dict[str, Any]:
        engine = self.engine
        layers: list[dict[str, Any]] = []
        result: dict[str, Any] = {"layers": layers, "attack": AttackKind.NONE.value}

        node = engine.node(node_id) if node_id else engine.reference_node()
        if node is None or not node.online:
            raise ValueError("the chosen node is offline")
        result["answered_by"] = {"id": node.id, "name": node.name, "height": node.head_block.index}

        # Layer 1: the server's own database (cheap, but only as trustworthy as the server)
        if trust_database:
            failure = self._database_layer(tag, node.state.tolerance)
            layers.append({"name": "Server database", **failure})
            if not failure["ok"]:
                return await self._fail(result, failure["attack"], failure["detail"], tag)
        else:
            layers.append({"name": "Server database", "ok": None, "detail": "skipped: treating the database as untrusted"})

        # Layer 2: the contract, as a READ answered by ONE node (no agreement involved)
        validation = node.read_call(ProductContract.validate_tag, tag)
        layers.append(
            {
                "name": "Contract (read from one node)",
                "ok": validation.ok,
                "detail": validation.reason
                or "signature recovers to the registered signer; tag identifier and counters match",
                "recovered_signer": engine.name_of(validation.recovered_signer) if validation.recovered_signer else None,
                "registered_signer": engine.name_of(validation.registered_signer) if validation.registered_signer else None,
            }
        )
        if not validation.ok:
            return await self._fail(result, validation.attack.value, validation.reason, tag)

        # Layer 3: the stored product record against the hash kept on the chain
        record_problem = self._record_layer(node, tag)
        layers.append({"name": "Product record (IPFS + hash)", **record_problem})
        if not record_problem["ok"]:
            return await self._fail(result, AttackKind.RECORD_MISMATCH.value, record_problem["detail"], tag)

        # Counter update: a TRANSACTION, so every node must agree before it counts
        try:
            tx = engine.submit(node.state.admin, TxType.BUMP_READ, {"tag": tag.model_dump()}, entry_node=node.id)
        except ContractError as exc:
            layers.append({"name": "Counter update (consensus)", "ok": False, "detail": str(exc)})
            return await self._fail(result, AttackKind.REAPPLICATION.value, str(exc), tag)
        status = await engine.wait_final(tx.hash, timeout=self.counter_wait)
        if status["status"] == "pending":
            # The tag passed every check; the network simply cannot agree right now (for example
            # too few validators are reachable). That is not evidence of an attack.
            layers.append(
                {
                    "name": "Counter update (consensus)",
                    "ok": None,
                    "detail": "the network has not agreed yet; the update stays queued and applies once it can",
                    "tx": tx.hash,
                }
            )
            result.update(
                verdict="unconfirmed",
                summary="Not confirmed: the tag looks fine, but the network could not agree in time. Try again shortly.",
                tx=tx.hash,
            )
            engine.emit(EventType.SCAN, node.id, product=tag.product_id, verdict="unconfirmed")
            return result
        ok = status["status"] == "final"
        layers.append(
            {
                "name": "Counter update (consensus)",
                "ok": ok,
                "detail": f"agreed in block {status.get('block')}" if ok else status.get("reason", "not agreed in time"),
                "tx": tx.hash,
            }
        )
        if not ok:
            return await self._fail(result, AttackKind.REAPPLICATION.value, status.get("reason", "counter update was not agreed"), tag)

        engine.records.set_read_counter(tag.product_id, tag.read_counter + 1)  # same value the contract now holds
        product = node.state.products.get(tag.product_id)
        result.update(verdict="genuine", summary="Genuine: every layer agrees.", tx=tx.hash, block=status.get("block"))
        if product is not None:
            result["sold"] = product.status == "sold"
            result["owner"] = engine.name_of(product.owner)
        engine.emit(EventType.SCAN, node.id, product=tag.product_id, verdict="genuine")
        return result

    # ---- layers ----------------------------------------------------------------------
    def _database_layer(self, tag: TagData, tolerance: int) -> dict[str, Any]:
        stored = self.engine.records.get(tag.product_id)
        if stored is None or not stored.tag:
            return {"ok": False, "attack": AttackKind.MODIFICATION.value, "detail": "product not found in the database"}
        saved = stored.tag
        if saved["signature"] != tag.signature:
            return {"ok": False, "attack": AttackKind.MODIFICATION.value, "detail": "signature differs from the one written on the tag"}
        if saved["tag_id"] != tag.tag_id:
            return {"ok": False, "attack": AttackKind.CLONING.value, "detail": "tag identifier differs from the registered chip"}
        if saved["write_counter"] != tag.write_counter:
            return {"ok": False, "attack": AttackKind.REAPPLICATION.value, "detail": "write counter differs from the database"}
        problem = check_read_counter(saved["read_counter"], tag.read_counter, tolerance)
        if problem:
            return {"ok": False, "attack": AttackKind.REAPPLICATION.value, "detail": problem}
        return {"ok": True, "detail": "tag matches the database entry"}

    def _record_layer(self, node, tag: TagData) -> dict[str, Any]:
        engine = self.engine
        product = node.state.products[tag.product_id]
        on_ipfs = engine.ipfs.get(product.record_hash)
        stored = engine.records.get(tag.product_id)
        if on_ipfs is None or stored is None:
            return {"ok": False, "detail": "the stored product record could not be found"}
        if digest(on_ipfs) != product.record_hash:
            return {"ok": False, "detail": "IPFS content does not match the hash on the chain"}
        if digest(stored.record) != product.record_hash:
            return {"ok": False, "detail": "the database record was changed after registration (its hash no longer matches the chain)"}
        return {"ok": True, "detail": "database record, IPFS copy and on-chain hash all agree"}

    async def _fail(self, result: dict[str, Any], attack: str, reason: str, tag: TagData) -> dict[str, Any]:
        engine = self.engine
        result.update(verdict="suspicious", attack=attack, summary=f"Suspicious: {reason}")
        reference = engine.reference_node()
        try:
            tx = engine.submit(
                reference.state.admin, TxType.LOG_FAILURE,
                {"product_id": tag.product_id, "kind": attack, "reason": reason},
            )
            result["failure_logged_tx"] = tx.hash
        except Exception:  # logging is best-effort; the verdict stands either way
            result["failure_logged_tx"] = None
        engine.emit(EventType.SCAN, result["answered_by"]["id"], product=tag.product_id, verdict="suspicious", attack=attack)
        return result
