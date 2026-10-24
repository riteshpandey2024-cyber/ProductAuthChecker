# Implementation: Authenticity Chain Demo

This document explains how the demo in [`blockchain-demo/`](blockchain-demo/) is built: what each part does, how the parts fit together, and how a request moves through the code. It describes the system as it exists today. For the reasoning behind the design, read [PROJECT_DESIGN_EXPLAINED.md](PROJECT_DESIGN_EXPLAINED.md); for the vocabulary, read [GLOSSARY.md](GLOSSARY.md); to run it, read [blockchain-demo/README.md](blockchain-demo/README.md).

## 1. What it is

A web application that **simulates** a small permissioned blockchain and runs the product-authenticity design on top of it. Several nodes live inside one Python process. Each node keeps its own chain, its own copy of the contract state and its own pool of waiting transactions. A controllable network sits between them, so a reader can see:

- nodes agreeing on blocks and taking turns;
- the network splitting into groups that build different blocks (a **fork**) and then merging again;
- a faulty node being outvoted;
- a scanned tag passing or failing the **Authenticity check**, with the reason for each layer.

The chain is simulated, not run on real Ethereum or Hyperledger nodes. That is deliberate: a simulation gives full control over forks, delays and misbehaving nodes, which a real local network does not. The signatures are real, though (secp256k1 with signer recovery, as on Ethereum), and every node re-checks everything it receives.

| | |
| --- | --- |
| Backend | Python 3.12, FastAPI, `eth-account` (signing and signer recovery), Pydantic |
| Frontend | React 18, Vite, TypeScript (built once and served by the backend) |
| State | In memory. Restarting the server creates a fresh network with new keys |
| Packaging | One Docker image, or run the backend and the frontend build locally |

## 2. Repository layout

```
blockchain-demo/
  server/app/
    constants.py        enums (transaction types, node modes, roles, attack names) and timing constants
    chain/              hashing.py  signing.py  tx.py  block.py
    contract/           state.py (stored data)  rules.py (the contract's rules)
    node/               node.py (one node: chain, state, mempool, block validation, sync)
    network/            bus.py (simulated network)  engine.py (clock, nodes, transaction tracking)
    consensus/          base.py (interface)  poa.py (Proof-of-Authority)  proposing.py (faulty-block helpers)
    services/           vault.py  storage.py (IPFS stand-in + server database)  products.py  scan.py  events.py
    monitor/            monitor.py (compares every node's chain)
    api/routes.py       HTTP endpoints          models/schemas.py   request bodies
    main.py             FastAPI app, clock task, WebSocket, error mapping
  server/tests/         test_contract.py  test_consensus.py  test_api.py
  web/src/              App.tsx  pages/ (Network, Parties, Products, Scan, Monitor, Events)  components/
```

The layers depend downward only: `chain` and `contract` know nothing about nodes or the network; `node` knows the contract; `network` owns nodes; `services` and `api` sit on top.

## 3. The building blocks (`chain/`)

### Hashing and signing

- **Canonical hashing.** Structured data is turned into JSON with sorted keys and no spaces, then hashed with keccak-256. Every node therefore produces the same hash for the same data.
- **Signing.** `sign_digest(private_key, digest)` signs a digest; `recover_signer(digest, signature)` returns the address that made a signature (or `None` if it is malformed). Addresses are stored in lower case everywhere.

### Transactions (`tx.py`)

A transaction is a signed request that changes the shared record.

| Field | Meaning |
| --- | --- |
| `type` | One of the nine types in section 4 |
| `payload` | The arguments, for example `{"product_id": ..., "to": ...}` |
| `sender` | The address that signed it |
| `nonce` | A random 48-bit number that makes each transaction unique |
| `sig` | Signature over `{type, payload, sender, nonce}` |

The transaction hash is the digest of those fields. `signature_valid()` recovers the signer from `sig` and checks that it equals `sender`.

### Blocks (`block.py`)

A block holds an ordered batch of transactions and points to its parent.

| Field | Meaning |
| --- | --- |
| `index`, `prev_hash` | Position in the chain and the hash of the parent block |
| `tick`, `proposer`, `weight` | When it was proposed, by whom, and how much it counts (section 6) |
| `txs` | The transactions in it |
| `state_root` | Hash of the contract state **after** applying `txs` |
| `extra` | A free field, used to make two different blocks for one slot in the equivocation demo |
| `hash`, `proposer_sig` | Hash of the header, and the proposer's signature over it |

The block hash covers the header, which includes each transaction's hash. Changing any field changes the hash. The genesis block (index 0, weight 0) holds the root of the starting state.

## 4. The contract (`contract/`)

The contract is a **deterministic state machine**. All data lives in a `ContractState` object; the rules in `ProductContract` are pure functions of that state and a transaction. Every node runs the same code on the same data, so honest nodes reach the same result.

### Stored data (`state.py`)

| Item | Holds |
| --- | --- |
| `admin` | The administrator's address |
| `validators` | Approved nodes, **in order** (the order sets who is in turn) |
| `producers`, `participants` | Approved parties |
| `names` | Display names for addresses |
| `products` | One `Product` per product (below) |
| `used_nonces` | Every `sender:nonce` already seen, to reject replayed transactions |
| `tolerance` | How far a scanned read counter may run ahead of the record (0 to 50, default 2) |
| `unlinked_failures` | Failure records for scans that named no known product |

A `Product` stores: `product_id`, `name`, `record_hash`, `producer` (the **Signer**), `owner`, `tag_id` (the chip's serial), `write_counter`, `read_counter`, `status` (`registered` or `sold`), `history` and `failures`.

`ContractState.root()` hashes the whole state. A block's `state_root` must equal the root produced by applying its transactions; this is how a node proves it computed the same result as the proposer.

### Transaction rules

| Transaction | Allowed when | Effect |
| --- | --- | --- |
| `REGISTER_VALIDATOR`, `REGISTER_PRODUCER`, `REGISTER_PARTICIPANT` | Sender is the administrator; address not already registered | Adds the address to the list |
| `CREATE_PRODUCT` | Sender is an approved producer; product ID unused; tag identifier not bound to another product | Stores the product with `owner` and `producer` set to the sender, `write_counter = 1`, `read_counter = 0` |
| `TRANSFER` | Sender is the current owner; product not sold; receiver is a producer or participant; receiver is not already the owner | Changes `owner`, appends to `history`. The `producer` (Signer) and the tag do not change |
| `SELL` | Sender is the current owner; product not sold | Sets `owner` to the buyer and `status` to `sold` |
| `BUMP_READ` | Sender is a known party; the tag passes `validate_tag` | Sets `read_counter` to the scanned value **plus one** and records the scan in `history` |
| `LOG_FAILURE` | Sender is a known party | Appends `{kind, reason, block}` to the product's `failures` (or to `unlinked_failures`) |
| `SET_TOLERANCE` | Sender is the administrator; integer from 0 to 50 | Sets `tolerance` |

Every transaction first needs a valid signature and an unused nonce. A broken rule raises `ContractError`, and the transaction is rejected.

### The tag check: `validate_tag` (a read)

`validate_tag(state, tag)` changes nothing. It runs on **one node's** state and returns a verdict plus the reason. The scanned tag is `{product_id, tag_id, write_counter, read_counter, signature}`. The checks run in this order, and the first failure decides the result:

1. **The product exists.** If not, the result is `modification` ("unknown product ID").
2. **The signature recovers to the registered signer.** The **signed label** is rebuilt as `keccak("{product_id}|{tag_id}|{contract address}")` using the *stored* tag identifier, and the signer is recovered from the scanned signature. If it is not the product's registered Signer, the result is `modification`.
3. **The tag identifier matches the registered chip.** If not, the result is `cloning`.
4. **The write counter matches the record.** If not, the result is `reapplication`.
5. **The read counter is acceptable** (rule below). If not, the result is `reapplication`.

The three attack names (`modification`, `cloning`, `reapplication`) come from the dNAS paper; the code adds a fourth, `record_mismatch`, used by the scan service when the stored product record no longer matches its hash on the chain.

Only the Product ID and the tag identifier are signed. The counters are **not** signed, because the read counter changes on every scan and any change to signed data would break the signature. The contract address is part of the signed message, so a signature made for one contract cannot be replayed against another.

### The read-counter rule

A genuine tag shows a read counter equal to the record. The scan sends it **exactly as shown**, and the rule is:

| Scanned value | Result |
| --- | --- |
| Equal to the record | Accepted |
| Lower than the record | Stale: an old copy or a replay |
| Higher than the record, by no more than `tolerance` | Accepted (allows for scans that never reached the server) |
| Higher by more than `tolerance` | Rejected as too far ahead |

After an accepted scan the `BUMP_READ` transaction sets the record to `scanned + 1`, and the tag the user sees moves up to the same value. A copy made earlier, or the same scan sent again, now carries a value below the record and is rejected. Setting the tolerance to 0 demands an exact match.

## 5. A node (`node/node.py`)

A node is the unit that makes the simulation honest: each one validates everything independently.

| Per node | Meaning |
| --- | --- |
| `blocks` | A **tree** of every block it has seen (different branches can exist at once) |
| `states` | The contract state after each block |
| `total_weight` | The accumulated weight of the branch ending at each block |
| `included` | The transaction hashes already on each branch |
| `mempool` | Valid transactions waiting for a block |
| `head` | The tip of the branch this node currently follows |
| `mode` | `honest`, `offline`, `equivocate` or `tamper` (section 7) |

### Receiving a transaction

`submit_tx` (from the API) and `receive_tx` (from a peer) first run the transaction against a **copy** of the node's current state. If it breaks a rule, it is refused (or silently dropped when it came from a peer). Valid ones enter the mempool and are passed to the other nodes.

### Producing a block

`build_block` takes up to 20 transactions from the mempool, applying each to a working copy of the state and discarding any that fail. It then computes the new `state_root`, builds the block and signs it.

### Validating a block (the core of "every node checks")

`add_block` accepts a block only if **all** of these hold, otherwise it emits a `block_rejected` event with the reason:

1. The block number is the parent's plus one.
2. The hash matches the block's contents.
3. The proposer's signature is valid.
4. The consensus rule holds (the proposer is an approved validator and claimed the correct weight).
5. Every transaction applies cleanly to a copy of the parent state.
6. The resulting state root equals the block's claimed `state_root`.

If the parent is unknown, the node asks the sender for the blocks it lacks and tries again once.

### Choosing the head and handling forks

After storing a valid block, the node follows the branch with the **greater total weight**; on a tie, the branch whose head hash is smaller. When it switches to a branch that does not extend the old one, it emits a `reorg` event, and transactions that were only on the abandoned branch go back into the mempool so they are included again. Every 3 ticks a node announces its head; a node that sees an unknown head copies the missing blocks from that peer (`sync_from`, which validates each block).

### Reads

`read_call(fn, *args)` runs a function against **this node's** state only. Nothing is agreed and nothing changes. The Scan page lets the user choose which node answers, to show that a single node's answer is only as good as that node.

## 6. Network and consensus

### The simulated network (`network/`)

`Bus` carries messages (`tx`, `block`, `head`) between nodes. Each message is delivered after `latency` ticks (default 1, adjustable from 0 to 10). `partition(groups)` makes nodes in different groups unable to hear each other, and `heal()` removes the split. Messages from or to an offline node are dropped and counted.

`NetworkEngine` owns the nodes, the bus, the key vault, the off-chain stores and the event log, and advances a **tick** clock. On each tick it delivers due messages, lets every node's consensus act, and every 3rd tick sends head announcements. A background task calls this every 0.6 seconds unless the clock is paused; the API can also pause, resume and single-step it.

The engine also tracks transactions. A transaction is **pending** until it appears in the chain of the majority node, then **final** (it records the block number). It becomes **rejected** if a node drops it while building a block. `wait_final` lets a request wait up to 10 seconds for the result.

### Proof-of-Authority (`consensus/poa.py`)

All nodes start as validators. A validator list order fixes who is in turn.

- **Who proposes.** For block number *i*, the in-turn validator is `validators[i mod n]`. Its block has **weight 2**. A validator that is not in turn may step in after a delay, with **weight 1**; the delay grows with its rank (each rank adds 2 ticks to a base of 2).
- **Why out-of-turn blocks exist.** When the network splits, each side still needs blocks. Letting out-of-turn validators step in keeps both sides producing, which is what makes forks visible.
- **Idle blocks.** With nothing to include, the in-turn validator still produces an empty block every 15 ticks so the monitor shows the network is alive.
- **One proposal per parent.** A node proposes at most once on a given parent block.
- **Choosing a winner.** The heaviest branch wins (section 5). After a split heals, the lighter branch is abandoned and its transactions are included again.

The `Consensus` base class defines the interface (`validate_block`, `on_tick`, `describe`), so another mechanism could be added without touching nodes or the contract.

## 7. Faulty nodes

An operator can set any node's `mode` to show how the network reacts.

| Mode | What the node does | What happens |
| --- | --- | --- |
| `honest` | Follows the rules | Normal |
| `offline` | Hears and sends nothing | Its chain falls behind; it catches up from peers when it returns |
| `equivocate` | Proposes **two different blocks** for the same slot and sends one half of the peers each | A brief split, then the heaviest-chain rule leaves one chain |
| `tamper` | Proposes a block whose `state_root` is falsified | Every honest node rejects it ("state root mismatch"); it never joins the chain |

## 8. Off-chain services (`services/`)

| Service | Role |
| --- | --- |
| `KeyVault` | Holds the private key of **every** party (administrator, nodes, producers, participants, customers), so the server can sign for them |
| `IpfsMock` | A content-addressed store: the key is the hash of the stored record, so stored content cannot be swapped without changing its key |
| `RecordStore` | The server's own **database**: each product's full record, the tag as issued, and a log of direct edits. Unlike the chain, whoever runs the server can edit it (the demo has a button that does) |
| `EventLog` | A bounded in-memory log (600 events) that the UI reads and subscribes to over a WebSocket |

### Parties and products

- **Creating a party** makes a key pair in the vault. Producers and participants are then **approved on the chain**: the server submits `REGISTER_PRODUCER` or `REGISTER_PARTICIPANT` as the administrator and waits for it to become final.
- **Registering a product** (`ProductService.register`):
  1. choose a product ID (`P-1001`, `P-1002`, ...) and a random 7-byte chip serial for the tag identifier;
  2. store the full record in the IPFS stand-in (its key is the record hash) and in the server database;
  3. submit `CREATE_PRODUCT` as the producer, carrying only the record hash, and wait until it is final;
  4. sign the **signed label** (product ID plus tag identifier) with the producer's key and build the tag `{write_counter: 1, read_counter: 0, signature, ...}`.
- **Handover and sale** submit `TRANSFER` and `SELL` as the acting party and wait for the result. The tag is **not** rewritten and the registered Signer does not change.

## 9. The scan: four layers (`services/scan.py`)

`POST /api/scan` runs the **Authenticity check** and returns every layer's result so the interface can show it.

| Layer | What is checked | A failure means |
| --- | --- | --- |
| 1. Server database | The scanned tag's signature, tag identifier and write counter equal the server's saved copy, and the read counter rule holds. *Skipped if "trust the server database" is off* | `modification`, `cloning` or `reapplication` |
| 2. Contract (a read on one node) | `validate_tag` as in section 4. The user may choose which node answers | The same three attack names |
| 3. Stored record | The record fetched from the IPFS stand-in by the on-chain `record_hash` hashes back to that value, **and** the database copy hashes to it too | `record_mismatch` |
| 4. Counter update (a transaction) | `BUMP_READ` is submitted and must become **final**, which needs the network to agree | A rejected update is reported as `reapplication`; if the network cannot agree in time the verdict is `unconfirmed` |

Layers 1 to 3 are cheap checks and stop at the first failure. Layer 4 is the only step that changes the shared record.

**Verdicts.**

| Verdict | Meaning |
| --- | --- |
| `genuine` | Every layer passed. The response also reports the current owner and whether the product is already sold |
| `suspicious` | A layer failed. The failure is submitted as a `LOG_FAILURE` transaction so it is recorded on the product (best effort) |
| `unconfirmed` | The tag looked fine, but the network could not agree within 10 seconds (for example the clock is paused). This is **not** evidence of an attack |

After a final `BUMP_READ`, the server also sets its own stored read counter to the same value (`scanned + 1`) so that layer 1 agrees on the next scan.

**Why the counter update is a transaction.** Layer 2 alone could be a free read. But raising the counter changes the record, so it must be ordered by the network. If two scans arrive together, the network puts them in one order and only the first can match the counter; a copy replaying an old value is rejected.

## 10. The monitor (`monitor/monitor.py`)

The monitor compares every node's chain. `snapshot()` returns:

- per node: height, head hash, accumulated weight, mempool size, whether it **diverges** from the majority, the first block index where it differs, its last 8 blocks and whether it is still joining;
- per block position (the last 12): every **variant** of the block at that index and which nodes hold each one, plus a `forked` flag;
- overall: whether the network is forked, the majority head and nodes, the divergent nodes, the first divergent index, and whether the two largest groups **tie** (no true majority).

The **majority** is the largest group of online nodes that share a head (ties are broken by weight). The engine uses the majority node as its reference for reads of the shared state and for deciding when a transaction is final.

## 11. HTTP and WebSocket API (`api/routes.py`)

All routes are under `/api`.

| Method | Route | Does |
| --- | --- | --- |
| GET | `/state` | Network summary: tick, latency, partition, tolerance, message counts, pending transactions, a network ID that changes with every fresh network |
| POST | `/network/reset` | Start a fresh network with 1 to 9 nodes (default 4) |
| POST | `/network/pause`, `/resume`, `/step` | Control the clock |
| POST | `/network/partition`, `/heal` | Split the nodes into groups, or rejoin them |
| POST | `/network/latency`, `/tolerance` | Set message delay (0 to 10 ticks) and the read-counter tolerance (0 to 50, as a transaction) |
| GET | `/monitor` | The snapshot from section 10 |
| GET | `/events` | Recent events, optionally for one node |
| POST | `/nodes`, `/nodes/{id}/mode` | Add a node (it copies the chain and is approved as a validator), or set its mode |
| GET | `/nodes/{id}/blocks` | A node's recent blocks with their transactions |
| GET, POST | `/parties` | List parties, or create a producer, participant or customer |
| GET, POST | `/products` | List products, or register one |
| POST | `/products/{id}/handover`, `/sell` | Hand over or sell as a given actor |
| POST | `/scan` | Run the four-layer check (`tag`, optional `node_id`, `trust_database`) |
| POST | `/debug/tamper-record` | Edit a field of a record **in the server database**, to demonstrate record tampering |
| WebSocket | `/ws/events` | Live stream of events |

Errors become plain HTTP answers: a broken contract rule is `400`, an unknown node or party `404`, an offline node `409`, a transaction that was rejected `409` and one that did not settle in time `504`.

## 12. The web interface (`web/`)

A single page with six tabs:

| Tab | Shows | Lets you |
| --- | --- | --- |
| Network | Each node's latest blocks side by side, coloured by block hash | Pause and step the clock, set message delay, split and heal the network, add nodes, set a node's behaviour |
| Parties | Producers, participants and customers and whether each is approved | Add parties |
| Products | Products with owner, counters, on-chain history, failed checks logged on the product and any direct database edits | Register, hand over, sell; try a hand-over as a non-owner; edit a record in the database |
| Scan | Virtual tags with an editable read-out, and the four layers of each result | Tap a tag, edit its fields, copy it onto a blank chip, replay the last scan, move it to a fake item, choose which node answers, trust or distrust the database |
| Monitor | Which nodes share a head and where they differ, every competing block at each position | Watch a fork form and resolve |
| Events | A live log: transactions, proposals, accepted and rejected blocks, chain switches, syncs | Follow what the network is doing |

On the Scan tab a **tap** sends the tag's counter exactly as shown. After an accepted scan the tag's shown counter moves up by one, matching the record.

## 13. Tests

25 backend tests in three files; all pass.

| File | Tests | What they check |
| --- | --- | --- |
| `test_contract.py` | 9 | A genuine tag validates; an edited product ID or forged signature is a modification; a blank-chip copy is cloning; a used counter is stale; a handover changes the owner but not the signer; non-owners cannot hand over; a sold product cannot be sold again; only the administrator registers producers |
| `test_consensus.py` | 8 | Nodes agree and proposers rotate; a split forks and then heals with both sides' transactions kept; tampered blocks are rejected; equivocation does not split the network for good; an offline node catches up; an added node copies the chain and joins; idle blocks come from the in-turn validator only |
| `test_api.py` | 8 | The full flow (genuine scan, then forged signature, clone, replay); handover then scan, with failures logged on the product; non-owner handover refused; a tampered database record is caught; monitor and partition endpoints; a scan while the network is paused is `unconfirmed`; the block listing shows where each transaction was first sent; the network ID changes on a fresh network |

Run them with `cd blockchain-demo/server && python -m pytest tests`, or build the Docker `test` stage.

## 14. How it relates to the design

The demo implements the design in [PROJECT_DESIGN_EXPLAINED.md](PROJECT_DESIGN_EXPLAINED.md). Where it differs, or simplifies:

| Topic | Design | Demo |
| --- | --- | --- |
| Blockchain | A permissioned chain (an Ethereum-compatible Proof-of-Authority network or Hyperledger Fabric) | A simulation in one process, with one consensus rule (Proof-of-Authority) |
| Contract | Smart contract or chaincode | The same rules as plain Python in `ProductContract` |
| Tag | An NFC chip with a read counter | Simulated in the browser |
| Handover | Owner changes on the chain; the tag is written once | Same |
| Membership | Administrator approves organizations and nodes | Same. Membership **voting** (as in dNAS) and a **certifying agency** (as in Ho Dac et al.) are not built |
| Off-chain data | IPFS and a database | An in-memory content-addressed store and an in-memory database |
| Keys | A key vault holds producers' keys | The vault holds **every** party's key |

## 15. Known limits

- **A simulation.** One process, in-memory state, no persistence. On one machine there is no real consensus protection.
- **The server holds every key.** A compromised or dishonest server could sign valid-looking tags. There is no key revocation.
- **No access control on the API.** Authentication is absent and CORS is open; the demo is meant to run locally.
- **Simulated tag hardware.** Real NFC chips (serial-number cloning on cheap chips, counter handling) are untested.
- **Not built:** membership voting, a certifying agency or technology licence, record updates after registration, a customer-facing history page, recovery from network failure and lost off-chain data.
- **Tested only by its own tests.** The 25 tests above are the only verification; there has been no security review or scale test.
