# BlockChainAuth: Blockchain-Based Product Authenticity Checker

A system that lets a buyer check whether a product is genuine. Each product carries a digitally signed Tag. A shared, tamper-evident record kept by several independent organizations holds the facts that must not change: which products exist, who owns them, a fingerprint of each product's details, and how often each Tag has been read. Every scan is checked in layers against the Tag, the server's records and the shared record.

This repository contains the design, a working simulation of the system, a slide deck and the research it builds on.

## Team

| Name | Roll number |
| --- | --- |
| Anu Priya | 2023BCY0008 |
| Ritesh Pandey | 2023BCY0022 |
| Aditya Karn | 2023BCY0025 |
| Satyam Narayan | 2023BCY0027 |
| Atharv Bhatade | 2022BCY0005 |

## The project at a glance

**Problem.** Barcodes, QR codes and NFC tags can be copied, so a copied code on a fake product can pass a simple check. Three attacks are common: modifying a Tag's data, cloning it onto another chip, and re-applying a genuine Tag's data.

**Approach.** The Producer signs the Tag. The ledger stores the product's owner, a hash of its record and counters. On every scan the system runs four checks, cheapest first:

1. the server's database copy of the Tag;
2. the smart contract (a read, answered by one node): the recovered signer must equal the registered signer, and the Tag identifier and counters must match;
3. the stored product record against its hash on the chain;
4. a counter update that the whole network must agree to.

The answer is **genuine**, **suspicious** (with the reason: modification, cloning, re-application or record mismatch), or **unconfirmed** when the network cannot agree in time.

**What it cannot do.** The ledger cannot see the physical product. A genuine Tag moved onto a fake item still passes every digital check (the oracle problem). The design documents the other limits too, including limits that the source papers describe themselves.

**What is built.** A simulation with several nodes, a controllable network, Proof-of-Authority consensus, faulty-node behaviours, a central monitor and a web interface, backed by 25 automated tests. The chain is simulated in one process so that forks, delays and misbehaving nodes can be shown.

**Research.** The design combines four papers:

| Paper | Contribution to the design |
| --- | --- |
| Ho Dac et al. (2023), *CTU Journal of Innovation and Sustainable Development* | The product lifecycle, roles and rules |
| Yiu, "Decentralizing Supply Chain Anti-Counterfeiting Systems Using Blockchain Technology" (dNAS), arXiv:2102.01456 | The signed Tag, counters and layered validation |
| Musamih et al. (2021), *IEEE Access* 9 | Owner-only functions; hash on-chain, data off-chain |
| Yiu, "Toward Blockchain-Enabled Supply Chain Anti-Counterfeiting and Traceability", arXiv:2102.00459 | The attacks to defend against, and the threat analysis |

The four PDFs are in [`papers/`](papers/). Other papers used for background are in [`papers_other/`](papers_other/). Full citations are in [Appendix A of the design document](PROJECT_DESIGN_EXPLAINED.md#appendix-a-sources).

## Where to look

| To learn... | Read |
| --- | --- |
| Why the system is designed this way, how a scan works, and its limits | [PROJECT_DESIGN_EXPLAINED.md](PROJECT_DESIGN_EXPLAINED.md) |
| How the demo is built, file by file, with the API and tests | [IMPLEMENTATION.md](IMPLEMENTATION.md) |
| How to install and use the demo, with a guided walkthrough and troubleshooting | [INSTALLATION.md](INSTALLATION.md) |
| What each project term means (Producer, Signer, Signed label, ...) | [GLOSSARY.md](GLOSSARY.md) |
| The demo's own short readme | [blockchain-demo/README.md](blockchain-demo/README.md) |
| How to run or edit the slide deck | [presentation/README.md](presentation/README.md) |

## Repository layout

```
blockchain-demo/     the working simulation: FastAPI backend (server/), React interface (web/), Dockerfile
presentation/        the slide deck: a React website that behaves like a presentation
papers/              the four source papers (PDF)
papers_other/        further papers kept for reference
PROJECT_DESIGN_EXPLAINED.md   the design, explained from the basics
IMPLEMENTATION.md             how the demo is built
INSTALLATION.md               how to install and use the demo
GLOSSARY.md                   the project's vocabulary
```

## Quick start

With Docker installed, from the `blockchain-demo/` folder:

```bash
docker compose up --build
```

Then open <http://127.0.0.1:8000>. To run without Docker, see [INSTALLATION.md](INSTALLATION.md).

The slide deck runs separately: from `presentation/`, run `npm install`, `npm run build` and `npm run preview`, then open <http://127.0.0.1:5180> (Node 18 or newer; see its README).

## Technology

| Part | Technology |
| --- | --- |
| Backend | Python 3.12, FastAPI, `eth-account` (secp256k1 signing and signer recovery), Pydantic |
| Interface | React 18, Vite, TypeScript |
| Slide deck | React, Vite, JavaScript |
| Packaging | Docker |
# ProductAuthChecker
