"""The smart-contract rules: a deterministic state machine every node runs identically."""
from dataclasses import dataclass
from typing import Any, Callable, Optional

from pydantic import BaseModel

from app.chain.hashing import digest_text
from app.chain.signing import recover_signer
from app.chain.tx import Tx
from app.constants import CONTRACT_ADDRESS, AttackKind, ProductStatus, TxType
from app.contract.state import ContractState, Product


class ContractError(Exception):
    """A rule was broken; the transaction is rejected."""


class TagData(BaseModel):
    """What a phone reads off a Tag. The counters are NOT signed."""
    product_id: str
    tag_id: str
    write_counter: int
    read_counter: int
    signature: str


@dataclass
class ValidationResult:
    ok: bool
    attack: AttackKind = AttackKind.NONE
    reason: str = ""
    recovered_signer: Optional[str] = None
    registered_signer: Optional[str] = None
    status: Optional[str] = None


def tag_message_digest(product_id: str, tag_id: str) -> str:
    """The signed label: Product ID and Tag identifier (bound to this contract)."""
    return digest_text(f"{product_id}|{tag_id}|{CONTRACT_ADDRESS}")


def check_read_counter(stored: int, scanned: int, tolerance: int) -> Optional[str]:
    """Return a problem description, or None if the scanned read counter is acceptable.

    A genuine scan sends the counter exactly as the tag shows it, which equals the record. After an
    accepted scan the record (and the tag) move up by one, so an old payload is then stale.
    """
    if scanned < stored:
        return f"stale read counter {scanned} (record is at {stored}): replayed or copied tag"
    if scanned > stored + tolerance:
        return f"read counter {scanned} is too far ahead of the record ({stored}, tolerance {tolerance})"
    return None


class ProductContract:
    """Stateless rule set. All data lives in the ContractState passed in."""

    # ---- read-only: runs on ONE node, changes nothing -------------------------------
    @staticmethod
    def validate_tag(state: ContractState, tag: TagData) -> ValidationResult:
        product = state.products.get(tag.product_id)
        if product is None:
            return ValidationResult(False, AttackKind.MODIFICATION, "unknown product ID")

        # Rebuild the signed label from the STORED tag identifier, then recover the signer.
        digest = tag_message_digest(product.product_id, product.tag_id)
        recovered = recover_signer(digest, tag.signature)
        result = ValidationResult(
            True, recovered_signer=recovered, registered_signer=product.producer, status=product.status
        )
        if recovered != product.producer:
            result.ok, result.attack = False, AttackKind.MODIFICATION
            result.reason = "signature does not recover to the registered signer"
            return result
        if tag.tag_id != product.tag_id:
            result.ok, result.attack = False, AttackKind.CLONING
            result.reason = "tag identifier differs from the registered chip"
            return result
        if tag.write_counter != product.write_counter:
            result.ok, result.attack = False, AttackKind.REAPPLICATION
            result.reason = f"write counter {tag.write_counter} differs from the record ({product.write_counter})"
            return result
        problem = check_read_counter(product.read_counter, tag.read_counter, state.tolerance)
        if problem:
            result.ok, result.attack, result.reason = False, AttackKind.REAPPLICATION, problem
        return result

    # ---- transactions: agreed by consensus -------------------------------------------
    @classmethod
    def apply_tx(cls, state: ContractState, tx: Tx, block_index: int) -> None:
        """Apply `tx` to `state` in place. Raises ContractError if any rule is broken."""
        if not tx.signature_valid():
            raise ContractError("transaction signature does not match the sender")
        nonce_key = f"{tx.sender}:{tx.nonce}"
        if nonce_key in state.used_nonces:
            raise ContractError("transaction already used (replay)")

        handlers: dict[TxType, Callable[[ContractState, Tx, int], None]] = {
            TxType.REGISTER_VALIDATOR: cls._register_validator,
            TxType.REGISTER_PRODUCER: cls._register_producer,
            TxType.REGISTER_PARTICIPANT: cls._register_participant,
            TxType.CREATE_PRODUCT: cls._create_product,
            TxType.TRANSFER: cls._transfer,
            TxType.SELL: cls._sell,
            TxType.BUMP_READ: cls._bump_read,
            TxType.LOG_FAILURE: cls._log_failure,
            TxType.SET_TOLERANCE: cls._set_tolerance,
        }
        handlers[tx.type](state, tx, block_index)
        state.used_nonces.add(nonce_key)

    # ---- helpers ---------------------------------------------------------------------
    @staticmethod
    def _require_admin(state: ContractState, tx: Tx) -> None:
        if tx.sender != state.admin:
            raise ContractError("only the administrator may do this")

    @staticmethod
    def _field(tx: Tx, name: str) -> Any:
        if name not in tx.payload:
            raise ContractError(f"missing field '{name}'")
        return tx.payload[name]

    @staticmethod
    def _product(state: ContractState, product_id: str) -> Product:
        product = state.products.get(product_id)
        if product is None:
            raise ContractError(f"unknown product {product_id}")
        return product

    @staticmethod
    def _known_party(state: ContractState, address: str) -> bool:
        return (
            address == state.admin
            or address in state.producers
            or address in state.participants
            or address in state.validators
        )

    # ---- handlers --------------------------------------------------------------------
    @classmethod
    def _register_validator(cls, state: ContractState, tx: Tx, block_index: int) -> None:
        cls._require_admin(state, tx)
        address, name = cls._field(tx, "address"), cls._field(tx, "name")
        if address in state.validators:
            raise ContractError("already a validator")
        state.validators.append(address)
        state.names[address] = name

    @classmethod
    def _register_producer(cls, state: ContractState, tx: Tx, block_index: int) -> None:
        cls._require_admin(state, tx)
        address, name = cls._field(tx, "address"), cls._field(tx, "name")
        if address in state.producers:
            raise ContractError("already a producer")
        state.producers.add(address)
        state.names[address] = name

    @classmethod
    def _register_participant(cls, state: ContractState, tx: Tx, block_index: int) -> None:
        cls._require_admin(state, tx)
        address, name = cls._field(tx, "address"), cls._field(tx, "name")
        if address in state.participants:
            raise ContractError("already a participant")
        state.participants.add(address)
        state.names[address] = name

    @classmethod
    def _create_product(cls, state: ContractState, tx: Tx, block_index: int) -> None:
        if tx.sender not in state.producers:
            raise ContractError("only an approved producer may register a product")
        product_id = cls._field(tx, "product_id")
        tag_id = cls._field(tx, "tag_id")
        if product_id in state.products:
            raise ContractError(f"product {product_id} already registered")
        if any(p.tag_id == tag_id for p in state.products.values()):
            raise ContractError("this tag identifier is already bound to another product")
        state.products[product_id] = Product(
            product_id=product_id,
            name=cls._field(tx, "name"),
            record_hash=cls._field(tx, "record_hash"),
            producer=tx.sender,
            owner=tx.sender,
            tag_id=tag_id,
            write_counter=1,
            read_counter=0,
            history=[{"type": "registered", "by": tx.sender, "block": block_index}],
        )

    @classmethod
    def _transfer(cls, state: ContractState, tx: Tx, block_index: int) -> None:
        product = cls._product(state, cls._field(tx, "product_id"))
        to = cls._field(tx, "to")
        if tx.sender != product.owner:
            raise ContractError("only the current owner may hand a product over")
        if product.status == ProductStatus.SOLD.value:
            raise ContractError("a sold product cannot be handed over")
        if to not in state.producers and to not in state.participants:
            raise ContractError("the receiver is not an approved participant")
        if to == product.owner:
            raise ContractError("already the owner")
        product.history.append({"type": "handover", "from": product.owner, "to": to, "block": block_index})
        product.owner = to  # the Signer (producer) and the Tag are unchanged

    @classmethod
    def _sell(cls, state: ContractState, tx: Tx, block_index: int) -> None:
        product = cls._product(state, cls._field(tx, "product_id"))
        buyer = cls._field(tx, "buyer")
        if tx.sender != product.owner:
            raise ContractError("only the current owner may sell a product")
        if product.status == ProductStatus.SOLD.value:
            raise ContractError("product already sold")
        product.history.append({"type": "sold", "from": product.owner, "to": buyer, "block": block_index})
        product.owner = buyer
        product.status = ProductStatus.SOLD.value

    @classmethod
    def _bump_read(cls, state: ContractState, tx: Tx, block_index: int) -> None:
        if not cls._known_party(state, tx.sender):
            raise ContractError("sender is not a registered party")
        try:
            tag = TagData(**cls._field(tx, "tag"))
        except (TypeError, ValueError) as exc:
            raise ContractError(f"malformed tag data: {exc}") from exc
        result = cls.validate_tag(state, tag)
        if not result.ok:
            raise ContractError(f"{result.attack.value}: {result.reason}")
        product = state.products[tag.product_id]
        product.read_counter = tag.read_counter + 1  # the next scan must show this value
        product.history.append({"type": "scan", "read_counter": tag.read_counter, "block": block_index})

    @classmethod
    def _log_failure(cls, state: ContractState, tx: Tx, block_index: int) -> None:
        if not cls._known_party(state, tx.sender):
            raise ContractError("sender is not a registered party")
        entry = {
            "kind": cls._field(tx, "kind"),
            "reason": cls._field(tx, "reason"),
            "block": block_index,
        }
        product = state.products.get(cls._field(tx, "product_id"))
        (product.failures if product else state.unlinked_failures).append(entry)

    @classmethod
    def _set_tolerance(cls, state: ContractState, tx: Tx, block_index: int) -> None:
        cls._require_admin(state, tx)
        value = cls._field(tx, "value")
        if not isinstance(value, int) or value < 0 or value > 50:
            raise ContractError("tolerance must be an integer between 0 and 50")
        state.tolerance = value
