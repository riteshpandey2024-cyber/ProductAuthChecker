from app.constants import NodeMode, Role, TxType
from tests.conftest import make_party, settle


def heads(engine):
    return {n.id: n.head for n in engine.nodes.values()}


def run(engine, ticks):
    for _ in range(ticks):
        engine.step()


def register_producer_tx(engine, name, entry=None):
    party = engine.vault.create(name, Role.PRODUCER)
    admin = engine.reference_node().state.admin
    tx = engine.submit(admin, TxType.REGISTER_PRODUCER, {"address": party.address, "name": name}, entry_node=entry)
    return party, tx


def test_poa_all_nodes_agree_and_rotate_proposers(engine):
    for i in range(4):
        make_party(engine, f"P{i}", Role.PRODUCER)
    assert len(set(heads(engine).values())) == 1
    chain = engine.nodes["node-a"].chain()
    proposers = {b.proposer for b in chain[1:]}
    assert len(proposers) > 1, "validators should take turns"
    assert all(b.weight == 2 for b in chain[1:]), "all blocks in a healthy network are in-turn"


def test_poa_partition_forks_then_heal_converges_and_keeps_both_transactions(engine):
    engine.set_partition([["node-a", "node-b"], ["node-c", "node-d"]])
    _, tx_left = register_producer_tx(engine, "Left", entry="node-a")
    _, tx_right = register_producer_tx(engine, "Right", entry="node-c")
    run(engine, 40)
    snap = engine.monitor.snapshot()
    assert snap["forked"], "two isolated groups must build different chains"
    assert heads(engine)["node-a"] == heads(engine)["node-b"]
    assert heads(engine)["node-a"] != heads(engine)["node-c"]

    engine.heal()
    run(engine, 60)
    assert len(set(heads(engine).values())) == 1, "after healing every node follows the heaviest chain"
    producers = engine.reference_node().state.producers
    assert len(producers) == 2, "the transaction on the abandoned branch must be re-included"


def test_poa_tampered_blocks_are_rejected_by_honest_nodes(engine):
    engine.set_mode("node-b", NodeMode.TAMPER)  # node-b is the in-turn proposer for block 1
    for i in range(3):
        make_party(engine, f"P{i}", Role.PRODUCER)
    rejected = [e for e in engine.events.recent(500) if e["type"] == "block_rejected"]
    assert any("state root" in e["data"]["reason"] for e in rejected)
    assert len({n.head for n in engine.nodes.values()}) == 1, "honest validators step in and the chain continues"
    assert all(b.proposer != engine.nodes["node-b"].address for b in engine.nodes["node-a"].chain()[1:])


def test_poa_equivocation_does_not_split_the_network_for_good(engine):
    engine.set_mode("node-a", NodeMode.EQUIVOCATE)
    for i in range(4):
        make_party(engine, f"P{i}", Role.PRODUCER)
    run(engine, 30)
    assert len(set(heads(engine).values())) == 1


def test_offline_node_catches_up_when_it_returns(engine):
    engine.set_mode("node-d", NodeMode.OFFLINE)
    for i in range(3):
        make_party(engine, f"P{i}", Role.PRODUCER)
    assert engine.nodes["node-d"].head_block.index == 0
    engine.set_mode("node-d", NodeMode.HONEST)
    run(engine, 20)
    assert len(set(heads(engine).values())) == 1


def test_added_node_copies_the_chain_and_joins_the_validator_list(engine):
    make_party(engine, "P0", Role.PRODUCER)
    node, tx = engine.add_node("Node E")
    assert node.head_block.index == engine.nodes["node-a"].head_block.index
    settle(engine, tx)
    run(engine, 6)
    assert node.is_validator
    assert node.address in engine.nodes["node-a"].state.validators


def test_idle_heartbeat_is_proposed_by_the_in_turn_validator_only(engine):
    run(engine, 45)
    proposals = [e for e in engine.events.recent(500) if e["type"] == "block_proposed"]
    indexes = [e["data"]["index"] for e in proposals]
    assert len(indexes) == len(set(indexes)) and indexes, "exactly one proposal per block when nobody is silent"
    assert all(e["data"]["weight"] == 2 for e in proposals), "every heartbeat block is in turn"
    assert not [e for e in engine.events.recent(500) if e["type"] == "reorg"], "no false forks while idle"
    assert len(set(heads(engine).values())) == 1


def test_transaction_after_a_long_idle_gap_is_proposed_by_the_in_turn_validator_only():
    from app.network.engine import NetworkEngine

    engine = NetworkEngine(2)
    run(engine, 40)  # idle for longer than any out-of-turn wait
    seen = len(engine.events.recent(500))
    party, tx = register_producer_tx(engine, "Late")
    run(engine, 12)
    new = engine.events.recent(500)[seen:]
    proposals = [e for e in new if e["type"] == "block_proposed"]
    assert len(proposals) == 1 and proposals[0]["data"]["weight"] == 2
    assert not [e for e in new if e["type"] == "reorg"]
    assert engine.tx_status[tx.hash]["status"] == "final"
