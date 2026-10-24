# Installation and Use: the `blockchain-demo` folder

`blockchain-demo/` is a working simulation of the product-authenticity system. This guide shows how to install it, start it, check that it works, and use it. For what the demo is and how it is built, see [IMPLEMENTATION.md](IMPLEMENTATION.md); for the idea behind it, see [PROJECT_DESIGN_EXPLAINED.md](PROJECT_DESIGN_EXPLAINED.md).

**Quick start (Docker):** from `blockchain-demo/`, run `docker compose up --build`, then open <http://127.0.0.1:8000>.

---

## 1. What you will end up with

One program that serves both the backend (a FastAPI service that simulates several blockchain nodes) and the web interface. Everything runs on your own machine at `http://127.0.0.1:8000`. There is no database and no external service. All state is kept in memory, so restarting the program starts a fresh network.

## 2. Requirements

Choose **one** way to run it.

| Way | You need | Good for |
| --- | --- | --- |
| **A. Docker** (recommended) | Docker with Docker Compose | The shortest path; nothing else to install |
| **B. Without Docker** | Python 3.12, and Node.js 18 or newer with npm | Reading, changing or debugging the code |

A modern browser (Chrome, Edge, Firefox or Safari) is needed to use the interface.

> **Check your Node version first** (`node -v`). Node 18 or newer is required to build the web interface. An older Node fails with errors such as `SyntaxError: Unexpected token` or `?` during `npm install` or `npm run build`. If you use `nvm`, run `nvm install 20 && nvm use 20`. On macOS with Homebrew, put it first on your path: `export PATH=/opt/homebrew/bin:$PATH`.

## 3. Get the code

Open a terminal and go to the repository, then into the demo folder:

```bash
cd <path-to-repository>/blockchain-demo
```

All commands below are run from `blockchain-demo/` unless stated otherwise.

## 4. Way A: Docker

```bash
docker compose up --build
```

The first run downloads the base images and builds the web interface inside the image, so it takes a few minutes. When it prints that the server has started, open <http://127.0.0.1:8000>.

| Task | Command |
| --- | --- |
| Use a different port | `HOST_PORT=8080 docker compose up --build`, then open `http://127.0.0.1:8080` |
| Run in the background | `docker compose up --build -d` |
| Stop and remove the container | `docker compose down` |
| Run the backend tests during the build | `docker build --target test .` (the build fails if a test fails) |

The container runs as a non-root user and has a health check on `/api/state`. Like the local run, its state is in memory, so a restart creates a new network.

## 5. Way B: without Docker

### 5.1 Backend

```bash
cd server
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
```

`requirements-dev.txt` installs the runtime dependencies (FastAPI, Uvicorn, `eth-account`, Pydantic) plus the test tools. On **Windows**, use `.venv\Scripts\python` instead of `.venv/bin/python` in every command in this guide.

### 5.2 Web interface

```bash
cd ../web
npm install
npm run build
```

This type-checks the interface and writes the finished files to `web/dist/`. The backend serves them.

### 5.3 Start it

```bash
cd ../server
.venv/bin/python -m uvicorn app.main:app --port 8000
```

Open <http://127.0.0.1:8000>. Stop it with `Ctrl+C`.

If `web/dist/` does not exist, the API still works at `/api/...`, but the page at `/` will not load. Run the build in 5.2.

### 5.4 Optional: development mode with live reload

Run the backend as in 5.3, then in a second terminal:

```bash
cd web
npm run dev
```

Open <http://127.0.0.1:5173>. This serves the interface with hot reload and forwards `/api` and `/ws` to the backend on port 8000.

## 6. Check that it works

With the program running:

```bash
curl http://127.0.0.1:8000/api/state
```

You should get a small JSON answer that includes `"consensus":"poa"`, `"nodes":4` and `"tick"`. The `tick` number rises about every 0.6 seconds while the network is running. In the browser, the **Network** tab should show four node cards ("Node A" to "Node D") building blocks.

To run the automated tests (25 tests, about a minute):

```bash
cd server
.venv/bin/python -m pytest tests
```

## 7. Using the demo

### 7.1 The six tabs

| Tab | What you do there |
| --- | --- |
| **Network** | See every node's own blocks side by side. Pause or step the clock, change message delay, **split the network** into groups and heal it, add nodes, and set a node's behaviour (Honest, Offline, Sends two different blocks, Proposes a forged block) |
| **Parties** | Add producers, participants (shops) and customers. Producers and participants are approved on the chain by the administrator |
| **Products** | Register a product, hand it over, sell it. See its history, failed checks logged on it, and edit its record directly in the server database to simulate tampering |
| **Scan** | Work with virtual tags: tap one to run the authenticity check, edit its fields, copy it onto a blank chip, replay the last scan, or move it to a fake item |
| **Monitor** | See which nodes agree on the chain and where the others differ |
| **Events** | Watch a live log of transactions, proposals, accepted and rejected blocks and chain switches |

### 7.2 A guided walkthrough

Follow these steps in order. Each says what you should see.

1. **Parties.** Add a producer named `AcmeWatches` and a participant named `ShopOne`. Both appear as approved once the network agrees (a second or two).
2. **Products.** Register a watch as `AcmeWatches`. A product such as `P-1001` appears, and its tag shows up on the Scan tab.
3. **Scan.** Select the tag and press **Tap the tag**. Four layers pass: server database, contract (read from one node), stored record, and the counter update agreed by the network. The verdict is **genuine**, and the tag's read counter moves from 0 to 1.
4. **Attack: edited label.** Change the `signature` field on the Scan tab and press **Send exactly as shown**. The verdict is **suspicious: modification**.
5. **Attack: replay.** Tap the tag once, then press **Replay the last scan**. The verdict is **suspicious: reapplication**, because the record has already moved on.
6. **Attack: clone.** Press **Copy onto a blank chip**, untick **Trust the server database**, and send. The verdict is **suspicious: cloning**, caught by the shared record on its own.
7. **Hand over.** On Products, hand the watch over to `ShopOne`, then scan again. Still **genuine**, and the owner is now `ShopOne`. The tag is not rewritten.
8. **Not the owner.** On Products, use **Acting as** to try a hand-over as someone who is not the owner. The contract refuses it.
9. **Edited record.** Use the button on the product to edit its record in the server database, then scan. The verdict is **suspicious: record mismatch**, because the record no longer matches its fingerprint on the chain.
10. **Real tag on a fake item.** Press **Move the real tag to a fake item** and send. The verdict is **genuine**, with a warning that the tag may now be on a fake item. The system cannot see the physical object; this is its main limitation.
11. **Network trouble.** On Network, pause the clock and scan a genuine tag: the verdict is **unconfirmed** (not suspicious), because the network cannot agree while paused. Resume the clock. Then split the nodes into two groups, watch the **Monitor** tab show different blocks at the same positions, and heal the network: the lighter chain is abandoned and its transactions are included again.
12. **Misbehaving nodes.** Set one node's behaviour to **Proposes a forged block** and watch the Events tab show the other nodes rejecting it. Set another to **Sends two different blocks** and watch a brief split resolve.

### 7.3 Settings

| Setting | Where | Default | Notes |
| --- | --- | --- | --- |
| Port | `HOST_PORT` (Docker) or `--port` (uvicorn) | 8000 | |
| Number of nodes | **Start fresh network** in the Network tab (set "start with N nodes" first; this erases everything), or `POST /api/network/reset` | 4 | 1 to 9 nodes |
| Message delay | Network tab | 1 tick | 0 to 10 ticks |
| Read-counter tolerance | `POST /api/network/tolerance` | 2 | 0 means a scan must match the record exactly |
| Clock speed | `TICK_SECONDS` in `server/app/main.py` | 0.6 s per tick | Change the value and restart |

## 8. Troubleshooting

| Problem | Likely cause and fix |
| --- | --- |
| `SyntaxError: Unexpected token` while running `npm install` or `npm run build` | Node is too old. Use Node 18 or newer (section 2) |
| `ModuleNotFoundError: No module named 'eth_utils'` (or `fastapi`) | The backend dependencies are not installed in the Python you are running. Re-run section 5.1 and start the server with `.venv/bin/python` |
| The page at `/` is blank or says "Not Found", but `/api/state` works | `web/dist/` is missing. Run `npm run build` in `web/` and restart |
| `Address already in use` | Another program is using the port. Choose another with `--port 8001` (or `HOST_PORT=8001`) |
| Tags from an earlier session no longer work | The network is fresh after every restart (new keys, new genesis block). Use **Reload from products** on the Scan tab to get tags for the current network |
| Everything is "unconfirmed" | The clock is paused, or too many nodes are offline or split apart for the network to agree. Resume the clock and heal the network |
| `docker compose` cannot connect | Start Docker Desktop (or the Docker service) first |
| `python3 -m venv` fails | Install Python 3.12 (or use `pyenv`) and try again |

## 9. Uninstall

- **Docker:** `docker compose down`, then `docker image rm authenticity-chain-demo`.
- **Without Docker:** delete `server/.venv/`, `web/node_modules/` and `web/dist/`. Nothing else is written outside the folder.
