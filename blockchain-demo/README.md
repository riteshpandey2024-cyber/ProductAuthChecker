# Authenticity Chain Demo

A simulated blockchain that demonstrates the product-authenticity design: registered nodes, producers, consensus, each node's own blocks, a central monitor that shows where chains differ, and the Authenticity check on a scanned tag.

- **Backend:** Python 3.12, FastAPI, `eth-account` (real secp256k1 signing and signer recovery).
- **Frontend:** React + Vite + TypeScript. FastAPI serves the built UI, so one process runs everything.
- **The chain is simulated in code** (several in-process nodes with a controllable network), not real Ethereum nodes. That is what makes forks, faulty nodes and network splits easy to show.

For installation steps with troubleshooting and a guided walkthrough, see [INSTALLATION.md](../INSTALLATION.md). For how the code works, see [IMPLEMENTATION.md](../IMPLEMENTATION.md).

## Run it with Docker (recommended)

One image runs everything: FastAPI serves the API and the built UI.

```bash
docker compose up --build        # then open http://127.0.0.1:8000
docker compose down              # stop and remove the container
```

- Use another port with `HOST_PORT=8080 docker compose up --build`.
- Run the backend tests inside Docker: `docker build --target test .` (the build fails if a test fails).
- The container runs as a non-root user and has a health check on `/api/state`.
- Like the local run, state lives in memory, so restarting the container starts a new network.

## Run it without Docker


```bash
# backend
cd server
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt   # runtime deps plus pytest

# frontend (needs Node 18+; with nvm: nvm use 20)
cd ../web
npm install
npm run build

# start everything, then open http://127.0.0.1:8000
cd ../server
.venv/bin/python -m uvicorn app.main:app --port 8000
```

For frontend development run `npm run dev` in `web/` (port 5173, proxies to the backend on 8000).

Tests: `cd server && .venv/bin/python -m pytest tests`

## What each tab shows

| Tab | Shows |
| --- | --- |
| Network | Every node's own latest blocks side by side, coloured by block hash. Pause and step the clock, change message delay, **split the network** into groups, heal it, add nodes (each new node copies the chain and joins the validator list automatically), and set a node's behaviour (honest, offline, sends two different blocks, proposes a forged block). |
| Parties | Add producers, participants and customers. Producers and participants are approved on the chain by the administrator. |
| Products | Register a product (record off-chain, hash on-chain, tag signed once by the producer), hand over, sell. "Acting as" lets you try a handover as a non-owner and see the contract refuse it. Details show on-chain history, failed checks logged on the product, and a button that edits the record in the server database. |
| Scan | Virtual tags. Tap a tag (the phone sends the read counter exactly as the tag shows it; after an accepted scan the record and the tag move up by one), edit its fields, copy it onto a blank chip, replay the last scan, or move it to a fake item. Choose which node answers the read, and whether to trust the server database. |
| Monitor | The central view: which nodes share a head, which differ, the first different block, and every block position with all competing blocks and who holds them. |
| Events | Live log: transactions, proposals, votes, commits, rejected blocks, chain switches, syncs. |

## Demo script

1. **Parties:** add a producer (AcmeWatches) and a participant (ShopOne).
2. **Products:** register a watch. Its tag appears on the Scan shelf.
3. **Scan:** tap it. Four layers pass: server database, contract (read from one node), stored record, counter update (agreed by the network).
4. **Attacks on Scan:** edit a field and send it; replay the last scan; copy onto a blank chip and untick "Trust the server database" to see the chain catch it alone.
5. **Products:** hand over to ShopOne. The owner changes; the tag is not rewritten and the signer stays the producer. Scan again: still genuine.
6. **Products:** "Edit the record in the database", then scan: caught as a record mismatch.
7. **Network:** split into two groups. In Proof-of-Authority both sides keep building and the **Monitor** shows different blocks at the same numbers. Heal: the lighter chain is abandoned and its transactions are re-included.
8. Set one node to "Proposes a forged block" and watch the other nodes reject it on the Events tab.
9. Set a node to "Sends two different blocks": it briefly splits the network, which the Monitor shows, and the heaviest-chain rule resolves it.

## Design decisions in the code

- **The producer is the only signer.** The tag is written once. A handover changes the owner on the chain; the tag and the registered signer do not change (see [GLOSSARY.md](../GLOSSARY.md) and [PROJECT_DESIGN_EXPLAINED.md](../PROJECT_DESIGN_EXPLAINED.md)).
- **The signed label is the product ID plus the tag identifier**, bound to the contract address. The write and read counters are checked separately and are not signed, so the chip can raise the read counter on every scan.
- **A read is answered by one node; a transaction is agreed by the network.** The scan's contract check is a read. The read-counter update is a transaction.
- **Attack names follow dNAS:** *modification* (signature does not match), *cloning* (tag identifier differs), *reapplication* (counters inconsistent).
- **Verdicts:** `genuine`, `suspicious`, and `unconfirmed` (the tag looked fine but the network could not agree in time, for example while the clock is paused).
- **One consensus rule, Proof-of-Authority:** every node is a validator and they take turns; an in-turn block has weight 2, an out-of-turn block weight 1, and every node follows the heaviest chain. A split network keeps building on both sides, which is what produces visible forks.
- Transaction replay protection uses a random per-transaction nonce recorded in state.

## Known limits

- It is a simulation: one process, in-memory state, no persistence. Restarting the server starts a new network.
- The server holds every party's signing key, as the design proposes. A compromised server could sign valid-looking tags; this demo does not hide that.
- No authentication on the HTTP API and CORS is open. It is meant to run locally.
- Tag hardware is simulated in the browser, so real NFC behaviour (serial number cloning on cheap chips, counter handling) is not tested.
- Not built yet: membership voting (a new node is approved by the administrator, sent automatically), a certifying agency, record updates after registration, key revocation, a customer-facing history page.
