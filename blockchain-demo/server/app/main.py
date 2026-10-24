"""FastAPI application: wires the engine, the services and the live clock."""
import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.contract.rules import ContractError
from app.network.engine import NetworkEngine, NodeOfflineError, UnknownNodeError
from app.services.products import PartyService, ProductService, TxFailed
from app.services.scan import ScanService
from app.services.vault import UnknownPartyError

logger = logging.getLogger(__name__)

TICK_SECONDS = 0.6
WEB_DIST = Path(__file__).resolve().parents[2] / "web" / "dist"


async def run_clock(engine: NetworkEngine) -> None:
    while True:
        await asyncio.sleep(TICK_SECONDS)
        if not engine.paused:
            try:
                engine.step()
            except Exception:  # keep the clock alive; the failure is logged for debugging
                logger.exception("network step failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine = NetworkEngine()
    app.state.engine = engine
    app.state.parties = PartyService(engine)
    app.state.products = ProductService(engine)
    app.state.scans = ScanService(engine)
    clock = asyncio.create_task(run_clock(engine))
    try:
        yield
    finally:
        clock.cancel()


app = FastAPI(title="Product Authenticity Demo", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(router)


def _problem(status: int, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"detail": message})


@app.exception_handler(ContractError)
async def on_contract_error(_: Request, exc: ContractError) -> JSONResponse:
    return _problem(400, str(exc))


@app.exception_handler(UnknownNodeError)
async def on_unknown_node(_: Request, exc: UnknownNodeError) -> JSONResponse:
    return _problem(404, f"unknown node {exc}")


@app.exception_handler(UnknownPartyError)
async def on_unknown_party(_: Request, exc: UnknownPartyError) -> JSONResponse:
    return _problem(404, f"unknown party {exc}")


@app.exception_handler(NodeOfflineError)
async def on_node_offline(_: Request, exc: NodeOfflineError) -> JSONResponse:
    return _problem(409, f"node is offline: {exc}")


@app.exception_handler(TxFailed)
async def on_tx_failed(_: Request, exc: TxFailed) -> JSONResponse:
    return _problem(409 if exc.status == "rejected" else 504, str(exc))


@app.exception_handler(ValueError)
async def on_value_error(_: Request, exc: ValueError) -> JSONResponse:
    return _problem(400, str(exc))


@app.websocket("/ws/events")
async def events_socket(socket: WebSocket) -> None:
    engine: NetworkEngine = socket.app.state.engine
    await socket.accept()
    queue = engine.events.subscribe()
    try:
        for event in engine.events.recent(40):
            await socket.send_json(event)
        while True:
            await socket.send_json(await queue.get())
    except WebSocketDisconnect:
        pass
    finally:
        engine.events.unsubscribe(queue)


if WEB_DIST.is_dir():
    app.mount("/", StaticFiles(directory=WEB_DIST, html=True), name="web")
