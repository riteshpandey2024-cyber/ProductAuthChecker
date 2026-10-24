import asyncio

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app, lifespan


@pytest.fixture
async def client():
    async with lifespan(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            yield c


async def setup_product(client):
    acme = (await client.post("/api/parties", json={"name": "Acme", "role": "producer"})).json()
    shop = (await client.post("/api/parties", json={"name": "ShopOne", "role": "participant"})).json()
    made = (await client.post("/api/products", json={"producer": acme["address"], "name": "Watch"})).json()
    return acme, shop, made


async def test_full_flow_genuine_then_attacks(client):
    acme, shop, made = await setup_product(client)
    tag = made["tag"]

    ok = (await client.post("/api/scan", json={"tag": {**tag, "read_counter": 0}})).json()
    assert ok["verdict"] == "genuine", ok

    # modified product id / signature
    forged = (await client.post("/api/scan", json={"tag": {**tag, "read_counter": 0, "signature": "0x" + "11" * 65}})).json()
    assert forged["verdict"] == "suspicious" and forged["attack"] == "modification"

    # cloned onto a blank chip, with the database not trusted so the chain must catch it alone
    clone = (await client.post("/api/scan", json={"tag": {**tag, "tag_id": "AA:BB:CC:DD:EE:FF:00", "read_counter": 0}, "trust_database": False})).json()
    assert clone["verdict"] == "suspicious" and clone["attack"] == "cloning"

    # replaying the first scan
    replay = (await client.post("/api/scan", json={"tag": {**tag, "read_counter": 0}})).json()
    assert replay["verdict"] == "suspicious" and replay["attack"] == "reapplication"


async def test_handover_then_scan_still_genuine_and_failures_are_logged(client):
    acme, shop, made = await setup_product(client)
    r = await client.post(f"/api/products/{made['product_id']}/handover", json={"actor": acme["address"], "to": shop["address"]})
    assert r.status_code == 200
    ok = (await client.post("/api/scan", json={"tag": {**made["tag"], "read_counter": 0}})).json()
    assert ok["verdict"] == "genuine" and ok["owner"] == "ShopOne"

    await client.post("/api/scan", json={"tag": {**made["tag"], "read_counter": 0}})  # replay -> logged
    await asyncio.sleep(2.5)
    product = next(p for p in (await client.get("/api/products")).json() if p["product_id"] == made["product_id"])
    assert product["failures"], "failed checks are recorded on the product"


async def test_non_owner_handover_is_rejected(client):
    acme, shop, made = await setup_product(client)
    r = await client.post(f"/api/products/{made['product_id']}/handover", json={"actor": shop["address"], "to": acme["address"]})
    assert r.status_code == 400 and "owner" in r.json()["detail"]


async def test_tampered_database_record_is_caught(client):
    acme, shop, made = await setup_product(client)
    await client.post("/api/debug/tamper-record", json={"product_id": made["product_id"], "field": "name", "value": "Fake watch"})
    res = (await client.post("/api/scan", json={"tag": {**made["tag"], "read_counter": 0}})).json()
    assert res["verdict"] == "suspicious" and res["attack"] == "record_mismatch"


async def test_monitor_and_partition_endpoints(client):
    await client.post("/api/network/partition", json={"groups": [["node-a", "node-b"], ["node-c", "node-d"]]})
    state = (await client.get("/api/state")).json()
    assert state["partition"] == [["node-a", "node-b"], ["node-c", "node-d"]]
    await client.post("/api/network/heal")
    snap = (await client.get("/api/monitor")).json()
    assert len(snap["nodes"]) == 4 and snap["forked"] is False


async def test_scan_while_the_network_is_paused_is_unconfirmed_not_suspicious(client):
    acme, shop, made = await setup_product(client)
    app.state.scans.counter_wait = 1.0
    await client.post("/api/network/pause")  # no ticks, so the network cannot agree on anything
    res = (await client.post("/api/scan", json={"tag": {**made["tag"], "read_counter": 0}})).json()
    assert res["verdict"] == "unconfirmed", res
    assert res["attack"] == "none"


async def test_block_listing_shows_where_each_transaction_was_first_sent(client):
    acme, shop, made = await setup_product(client)
    blocks = (await client.get("/api/nodes/node-a/blocks?limit=30")).json()
    txs = [t for b in blocks for t in b["txs"]]
    created = next(t for t in txs if t["type"] == "CREATE_PRODUCT")
    assert created["entry_node"] and isinstance(created["sent_tick"], int)
    assert created["sender"] == "Acme"
    holder = next(b for b in blocks if created in b["txs"])
    assert holder["proposer"].startswith("Node ") and holder["weight"] in (1, 2)


async def test_network_id_changes_when_a_fresh_network_starts(client):
    first = (await client.get("/api/state")).json()["network_id"]
    assert first == (await client.get("/api/state")).json()["network_id"]
    await client.post("/api/network/reset", json={"nodes": 4})
    assert (await client.get("/api/state")).json()["network_id"] != first
