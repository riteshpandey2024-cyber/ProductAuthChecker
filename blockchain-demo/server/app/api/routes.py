"""HTTP routes. Thin on purpose: every rule lives in the engine, contract or services."""
from typing import Any, Optional

from fastapi import APIRouter, Request

from app.constants import Role, TxType
from app.models import schemas
from app.network.engine import NetworkEngine
from app.services.products import PartyService, ProductService
from app.services.scan import ScanService

router = APIRouter(prefix="/api")


def _engine(request: Request) -> NetworkEngine:
    return request.app.state.engine


def _describe_tx(engine: NetworkEngine, tx) -> dict[str, Any]:
    payload = {k: v for k, v in tx.payload.items() if k != "tag"}
    if tx.type == TxType.BUMP_READ and "tag" in tx.payload:
        payload = {"product_id": tx.payload["tag"].get("product_id"), "read_counter": tx.payload["tag"].get("read_counter")}
    for key in ("address", "to", "buyer"):
        if key in payload:
            payload[key] = engine.name_of(payload[key])
    status = engine.tx_status.get(tx.hash, {})
    entry = engine.nodes.get(status.get("entry", ""))
    return {
        "hash": tx.hash,
        "type": tx.type.value,
        "sender": engine.name_of(tx.sender),
        "payload": payload,
        "entry_node": entry.name if entry else None,   # the node that first received it
        "sent_tick": status.get("tick"),
    }


# ---- network ----------------------------------------------------------------------------
@router.get("/state")
async def get_state(request: Request) -> dict[str, Any]:
    return _engine(request).summary()


@router.post("/network/reset")
async def reset_network(body: schemas.ResetRequest, request: Request) -> dict[str, Any]:
    engine = _engine(request)
    engine.reset(body.nodes)
    return engine.summary()


@router.post("/network/pause")
async def pause(request: Request) -> dict[str, Any]:
    engine = _engine(request)
    engine.paused = True
    return engine.summary()


@router.post("/network/resume")
async def resume(request: Request) -> dict[str, Any]:
    engine = _engine(request)
    engine.paused = False
    return engine.summary()


@router.post("/network/step")
async def step(request: Request) -> dict[str, Any]:
    engine = _engine(request)
    engine.step()
    return engine.summary()


@router.post("/network/partition")
async def partition(body: schemas.PartitionRequest, request: Request) -> dict[str, Any]:
    engine = _engine(request)
    engine.set_partition(body.groups)
    return engine.summary()


@router.post("/network/heal")
async def heal(request: Request) -> dict[str, Any]:
    engine = _engine(request)
    engine.heal()
    return engine.summary()


@router.post("/network/latency")
async def latency(body: schemas.LatencyRequest, request: Request) -> dict[str, Any]:
    engine = _engine(request)
    engine.set_latency(body.ticks)
    return engine.summary()


@router.post("/network/tolerance")
async def tolerance(body: schemas.ToleranceRequest, request: Request) -> dict[str, Any]:
    return await request.app.state.products.set_tolerance(body.value)


@router.get("/monitor")
async def monitor(request: Request) -> dict[str, Any]:
    return _engine(request).monitor.snapshot()


@router.get("/events")
async def events(request: Request, limit: int = 100, node: Optional[str] = None) -> list[dict[str, Any]]:
    return _engine(request).events.recent(limit=min(limit, 500), node=node)


# ---- nodes ------------------------------------------------------------------------------
@router.post("/nodes")
async def add_node(body: schemas.NodeCreate, request: Request) -> dict[str, Any]:
    engine = _engine(request)
    node, tx = engine.add_node(body.name)
    status = await engine.wait_final(tx.hash)
    return {"id": node.id, "name": node.name, "address": node.address, "joined": status["status"] == "final"}


@router.post("/nodes/{node_id}/mode")
async def set_mode(node_id: str, body: schemas.NodeModeRequest, request: Request) -> dict[str, Any]:
    node = _engine(request).set_mode(node_id, body.mode)
    return {"id": node.id, "mode": node.mode.value}


@router.get("/nodes/{node_id}/blocks")
async def node_blocks(node_id: str, request: Request, limit: int = 12) -> list[dict[str, Any]]:
    engine = _engine(request)
    node = engine.node(node_id)
    return [
        {
            "index": b.index,
            "hash": b.hash,
            "prev_hash": b.prev_hash,
            "proposer": engine.name_of(b.proposer) if b.index else "genesis",
            "weight": b.weight,
            "tick": b.tick,
            "state_root": b.state_root,
            "txs": [_describe_tx(engine, tx) for tx in b.txs],
        }
        for b in node.chain(limit=min(limit, 50))
    ]


# ---- parties and products ---------------------------------------------------------------
@router.get("/parties")
async def list_parties(request: Request) -> list[dict[str, Any]]:
    return request.app.state.parties.list()


@router.post("/parties")
async def create_party(body: schemas.PartyCreate, request: Request) -> dict[str, Any]:
    return await request.app.state.parties.create(body.name, Role(body.role))


@router.get("/products")
async def list_products(request: Request) -> list[dict[str, Any]]:
    return request.app.state.products.list()


@router.post("/products")
async def create_product(body: schemas.ProductCreate, request: Request) -> dict[str, Any]:
    return await request.app.state.products.register(body.producer, body.name, body.details)


@router.post("/products/{product_id}/handover")
async def handover(product_id: str, body: schemas.HandoverRequest, request: Request) -> dict[str, Any]:
    return await request.app.state.products.handover(body.actor, product_id, body.to)


@router.post("/products/{product_id}/sell")
async def sell(product_id: str, body: schemas.SellRequest, request: Request) -> dict[str, Any]:
    return await request.app.state.products.sell(body.actor, product_id, body.buyer)


# ---- scanning ---------------------------------------------------------------------------
@router.post("/scan")
async def scan(body: schemas.ScanRequest, request: Request) -> dict[str, Any]:
    return await request.app.state.scans.check(body.tag, body.node_id, body.trust_database)


@router.post("/debug/tamper-record")
async def tamper_record(body: schemas.TamperRequest, request: Request) -> dict[str, Any]:
    """Demo control: edit a product record directly in the server database."""
    done = _engine(request).records.tamper(body.product_id, body.field, body.value)
    return {"tampered": done}
