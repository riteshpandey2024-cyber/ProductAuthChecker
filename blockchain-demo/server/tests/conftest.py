import pytest

from app.constants import Role, TxType
from app.network.engine import NetworkEngine


def settle(engine: NetworkEngine, tx):
    status = engine.run_until_final(tx.hash)
    assert status["status"] == "final", status
    return status


def make_party(engine: NetworkEngine, name: str, role: Role):
    party = engine.vault.create(name, role)
    kind = {Role.PRODUCER: TxType.REGISTER_PRODUCER, Role.PARTICIPANT: TxType.REGISTER_PARTICIPANT}[role]
    admin = engine.reference_node().state.admin
    settle(engine, engine.submit(admin, kind, {"address": party.address, "name": name}))
    return party


@pytest.fixture
def engine():
    return NetworkEngine(4)
