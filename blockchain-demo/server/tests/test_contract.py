import pytest

from app.constants import AttackKind, Role, TxType
from app.contract.rules import ContractError, TagData
from app.contract.rules import ProductContract
from app.services.products import ProductService
from tests.conftest import make_party, settle


async def register(engine):
    acme = make_party(engine, "Acme", Role.PRODUCER)
    shop = make_party(engine, "ShopOne", Role.PARTICIPANT)
    created = await _register(engine, acme)
    return acme, shop, created


async def _register(engine, acme):
    import asyncio

    task = asyncio.create_task(ProductService(engine).register(acme.address, "Watch", {"colour": "black"}))
    while not task.done():
        engine.step()
        await asyncio.sleep(0)
    return task.result()


async def test_genuine_tag_validates(engine):
    acme, _, created = await register(engine)
    tag = TagData(**{**created["tag"]})
    result = engine.reference_node().read_call(ProductContract.validate_tag, tag)
    assert result.ok
    assert result.recovered_signer == acme.address


async def test_edited_product_id_is_a_modification(engine):
    acme, _, created = await register(engine)
    other = await _register(engine, acme)
    tag = TagData(**{**created["tag"], "product_id": other["product_id"]})
    result = engine.reference_node().read_call(ProductContract.validate_tag, tag)
    assert not result.ok and result.attack == AttackKind.MODIFICATION


async def test_forged_signature_is_a_modification(engine):
    _, _, created = await register(engine)
    forger = engine.vault.create("Forger", Role.CUSTOMER)
    from app.chain.signing import sign_digest
    from app.contract.rules import tag_message_digest

    sig = sign_digest(forger.private_key, tag_message_digest(created["product_id"], created["tag"]["tag_id"]))
    tag = TagData(**{**created["tag"], "signature": sig})
    result = engine.reference_node().read_call(ProductContract.validate_tag, tag)
    assert not result.ok and result.attack == AttackKind.MODIFICATION


async def test_clone_on_blank_chip_is_cloning(engine):
    _, _, created = await register(engine)
    tag = TagData(**{**created["tag"], "tag_id": "AA:BB:CC:DD:EE:FF:00"})
    result = engine.reference_node().read_call(ProductContract.validate_tag, tag)
    assert not result.ok and result.attack == AttackKind.CLONING


async def test_stale_read_counter_is_flagged(engine):
    _, _, created = await register(engine)
    tag = TagData(**created["tag"])
    node = engine.reference_node()
    assert node.read_call(ProductContract.validate_tag, tag).ok  # shown value == record: genuine
    settle(engine, engine.submit(node.state.admin, TxType.BUMP_READ, {"tag": tag.model_dump()}))
    assert node.state.products[created["product_id"]].read_counter == tag.read_counter + 1
    result = node.read_call(ProductContract.validate_tag, tag)  # the same payload again is now stale
    assert not result.ok and result.attack == AttackKind.REAPPLICATION


async def test_handover_changes_owner_but_not_signer(engine):
    acme, shop, created = await register(engine)
    pid = created["product_id"]
    settle(engine, engine.submit(acme.address, TxType.TRANSFER, {"product_id": pid, "to": shop.address}))
    product = engine.reference_node().state.products[pid]
    assert product.owner == shop.address and product.producer == acme.address
    tag = TagData(**{**created["tag"]})
    assert engine.reference_node().read_call(ProductContract.validate_tag, tag).ok


async def test_non_owner_cannot_hand_over(engine):
    acme, shop, created = await register(engine)
    with pytest.raises(ContractError):
        engine.submit(shop.address, TxType.TRANSFER, {"product_id": created["product_id"], "to": acme.address})


async def test_sold_product_cannot_be_sold_again(engine):
    acme, _, created = await register(engine)
    buyer = engine.vault.create("Buyer", Role.CUSTOMER)
    pid = created["product_id"]
    settle(engine, engine.submit(acme.address, TxType.SELL, {"product_id": pid, "buyer": buyer.address}))
    with pytest.raises(ContractError):
        engine.submit(buyer.address, TxType.SELL, {"product_id": pid, "buyer": acme.address})


async def test_only_admin_registers_producers(engine):
    outsider = engine.vault.create("Outsider", Role.CUSTOMER)
    with pytest.raises(ContractError):
        engine.submit(outsider.address, TxType.REGISTER_PRODUCER, {"address": outsider.address, "name": "x"})
