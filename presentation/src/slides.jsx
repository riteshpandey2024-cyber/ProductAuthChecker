import { R, Verdict, Paper, Ours, Qr, Card, Head, CaseSlide, Src, Arrow, Node } from "./components.jsx";
import { LifecycleAnim, TagCountersAnim, LayersAnim, HashAnim, AuthAnim, AttackAnim, CombinedFlowAnim, GapsAnim } from "./research.jsx";
import { HeroArt, IconDb, IconNodes, IconFactory, IconShop, IconPerson, AppMock, WatchPair, DividerScene, ClosingScene } from "./art.jsx";

export const TEAM = [
  { name: "Anu Priya", roll: "2023BCY0008" },
  { name: "Ritesh Pandey", roll: "2023BCY0022" },
  { name: "Aditya Karn", roll: "2023BCY0025" },
  { name: "Satyam Narayan", roll: "2023BCY0027" },
  { name: "Atharv Bhatade", roll: "2022BCY0005" },
];

const initials = (name) => name.split(" ").map((w) => w[0]).slice(0, 2).join("");

/** The five team members as bold cards with an initials badge. */
function TeamRow() {
  return (
    <div className="team">
      {TEAM.map((m) => (
        <div key={m.roll} className="member">
          <div className="avatar">{initials(m.name)}</div>
          <div className="mtext">
            <div className="mname">{m.name}</div>
            <div className="mroll">{m.roll}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Section opening slides: each part of the talk opens like its own short deck.
const DIVIDERS = {
  "Fake products look real": { kind: "problem", title: "The problem", sub: "Why a tag alone cannot prove a product is genuine" },
  "Four papers we built on": { kind: "research", title: "The research", sub: "The papers behind our design" },
  "The big picture": { kind: "how", title: "How it works", sub: "Signed tags, a shared record and four checks" },
  "What we built": { kind: "demo", title: "Live demo", sub: "Six cases, from a genuine watch to a fake one" },
  "The biggest limit: the blockchain can't see the product": { kind: "limits", title: "Limitations", sub: "What this system cannot do" },
};

// New click steps -> the fully built step of the original slide. Slides not listed show everything at once.
// A click is kept only where revealing the next part helps the speaker (a demo result, a replay, an argument).
const CLICK_PLAN = {
  "The biggest limit: the blockchain can't see the product": [1, 3],
};

function planClicks(sl) {
  const map = sl.title.startsWith("Case ") ? [0, 1] : (CLICK_PLAN[sl.title] || [sl.steps]);
  const render = sl.render;
  return { ...sl, steps: map.length - 1, render: (s) => render(map[Math.min(s, map.length - 1)]) };
}

// Short names for the "in this part" list on each section opener.
const TOPIC = {
  "Why not just use a normal database?": "Why not a normal database?",
  "Ho Dac et al.: the product lifecycle": "Ho Dac et al. · the lifecycle",
  "dNAS: the signed tag and counters": "dNAS · tag and counters",
  "dNAS: the layered validation": "dNAS · layered validation",
  "Musamih et al.: rules and off-chain data": "Musamih et al. · rules and data",
  "Toward: the attacks we test": "Toward… · the attacks",
  "How the papers fill each other's gaps": "How the papers fill gaps",
  "Case 1: A genuine watch reaches a buyer": "Six live cases",
  "Case 2: A fake label with a made-up signature": "Six live cases",
  "Case 3: A saved scan is used again": "Six live cases",
  "Case 4: A cloned chip, shop database not trusted": "Six live cases",
  "Case 5: An insider edits the company record": "Six live cases",
  "Case 6: A real tag moved onto a fake item": "Six live cases",
  "The biggest limit: the blockchain can't see the product": "The biggest limit",
  "Limits of the papers: scale, trust and keys": "Limits of the papers · scale and trust",
  "Limits of the papers: privacy and data": "Limits of the papers · privacy and data",
};

function withDividers(list) {
  const planned = list.map(planClicks);
  const out = [];
  planned.forEach((sl, idx) => {
    const d = DIVIDERS[sl.title];
    if (d) {
      // Everything up to the next section opener (or the appendix) belongs to this part.
      const topics = [];
      for (let j = idx; j < planned.length; j += 1) {
        const nx = planned[j];
        if (j > idx && DIVIDERS[nx.title]) break;
        if (nx.section === "Appendix") break;
        const label = TOPIC[nx.title] || nx.title;
        if (!topics.includes(label)) topics.push(label);
      }
      out.push({
        section: d.title, part: sl.part, steps: 0, divider: true, title: d.title,
        notes: "Section opener.",
        render: () => (
          <>
            <DividerScene kind={d.kind} />
            <div className="divider-body">
              <h1>{d.title}</h1>
              <p>{d.sub}</p>
              <div className="agenda-label">In this part</div>
              <div className="agenda">
                {topics.map((x) => <span className="achip" key={x}>{x}</span>)}
              </div>
            </div>
          </>
        ),
      });
    }
    out.push(sl);
  });
  return out;
}

const CASES = {
  1: {
    n: 1, title: "A genuine watch reaches a buyer",
    story: "AcmeWatches sends a watch to ShopOne. A customer checks the tag.",
    screen: "Scan, hand over to ShopOne, scan again.",
    kind: "genuine", detail: "owner: ShopOne", howLabel: "Why it is genuine",
    how: "The signature recovers to the registered Producer, the chip serial and counters match, and the network agrees to move the counter up.",
    takeaway: "Every hand-over is recorded, and the Producer's signature still checks out.",
  },
  2: {
    n: 2, title: "A fake label with a made-up signature",
    story: "Someone prints a fake label for a counterfeit watch.",
    screen: "Edit the signature on the tag, then send.",
    kind: "suspicious", detail: "modification",
    how: "The signature on the tag does not recover to the registered Producer, so the contract check fails.",
    takeaway: "Only the real Producer's key can sign.",
  },
  3: {
    n: 3, title: "A saved scan is used again",
    story: "Someone keeps a valid scan and tries it a second time.",
    screen: "Scan once, then press “Replay the last scan”.",
    kind: "suspicious", detail: "reapplication",
    how: "After the first scan the record moved up by one. The replayed scan still shows the old counter, which is out of date.",
    takeaway: "Each use moves the counter forward, so an old copy fails.",
  },
  4: {
    n: 4, title: "A cloned chip, shop database not trusted",
    story: "A fake watch carries a copy of the tag on a blank chip. We assume the shop's own database might be compromised.",
    screen: "“Copy onto a blank chip”, untick “Trust the server database”, send.",
    kind: "suspicious", detail: "cloning",
    how: "The blank chip has a different serial number from the registered tag. The contract catches it even with the server database switched off.",
    takeaway: "The shared record catches it on its own.",
  },
  5: {
    n: 5, title: "An insider edits the company record",
    story: "Someone changes the product details in the company database.",
    screen: "Use the “edit the record in the database” button, then scan.",
    kind: "suspicious", detail: "record mismatch",
    how: "The record's fingerprint no longer matches the fingerprint stored on the chain, so check 3 fails.",
    takeaway: "Edits to a stored record are exposed by its fingerprint on the chain.",
  },
  6: {
    n: 6, title: "A real tag moved onto a fake item",
    story: "A thief peels a genuine tag off one watch and sticks it on a fake.",
    screen: "“Move the real tag to a fake item”, then send.",
    kind: "genuine", detail: "with a warning", warn: "tag may now be on a fake item", howLabel: "Why it passes",
    how: "The signature, serial number and counter are all genuine, so every check passes. Nothing digital links the tag to the item it sits on.",
    takeaway: "The blockchain cannot see what the tag is stuck on. This is our main limitation.",
  },
};

function CasePair({ section, a, b, s }) {
  return (
    <>
      <Head section={section} title={`Cases ${a.n} and ${b.n}`} />
      <div className="grid2 body">
        <CaseColumn c={a} s={s} />
        <CaseColumn c={b} s={s} />
      </div>
    </>
  );
}

// part: which of the five parts of the talk (picks its look). steps: number of extra clicks (0-3) on that slide.
const rawSlides = [
  /* ---------------- Title ---------------- */
  {
    section: "Title", part: 0, steps: 0, title: "Blockchain-Based Product Authenticity Checker",
    notes: "Introduce the topic and the team.",
    render: () => (
      <div className="title-slide">
        <div className="title-main">
          <div className="title-copy">
            <div className="title-rule" />
            <h1 className="hero">Blockchain-Based Product Authenticity Checker</h1>
          </div>
          <HeroArt />
        </div>
        <TeamRow />
      </div>
    ),
  },
  {
    section: "The problem", part: 0, steps: 3, title: "Fake products look real",
    notes: "About 1.5 minutes. A tag that can be copied proves nothing. The USD 467 billion figure comes from an OECD and EUIPO press release (May 2025); we only saw the press-release summary, not the full report.",
    render: (s) => (
      <>
        <Head section="The problem" title="Fake products look real" />
        <div className="row body" style={{ gap: 56, alignItems: "stretch" }}>
          <div className="row" style={{ gap: 28, alignItems: "stretch" }}>
            <div className="label"><div className="tagline" style={{ color: "var(--genuine)" }}>REAL</div><Qr /></div>
            <div className="eq">=</div>
            <div className="label"><div className="tagline" style={{ color: "var(--suspicious)" }}>COPY</div><Qr /></div>
          </div>
          <div style={{ flex: 1 }}>
            <R at={1} s={s}><p style={{ fontSize: 36, lineHeight: 1.4 }}>Plain barcodes, QR codes and NFC tags <b>can be copied</b>.</p></R>
            <div className="gap" />
            <R at={2} s={s}>
              <div className="stat">USD 467 billion</div>
              <div className="cap">Counterfeit trade in 2021, 2.3% of world imports · OECD & EUIPO press release, May 2025 (press-release figure)</div>
            </R>
            <div className="gap" />
            <R at={3} s={s}><p style={{ fontSize: 34, lineHeight: 1.4, fontWeight: 600 }}>A copied tag on a fake product can pass a simple check.</p></R>
          </div>
        </div>
      </>
    ),
  },
  {
    section: "The problem", part: 0, steps: 3, title: "Three ways a tag is attacked",
    notes: "About 1.5 minutes. These three attack types come from Yiu's threat analysis, an arXiv preprint. We use them as the test cases in our demo.",
    render: (s) => (
      <>
        <Head section="The problem" title="Three ways a tag is attacked" />
        <div className="grid3 body">
          <R at={1} s={s}><Card num="1 · MODIFICATION" title="Change the record">Someone alters the data stored in a tag, such as the product identifier.</Card></R>
          <R at={2} s={s}><Card num="2 · CLONING" title="Copy the tag">A genuine tag's data is copied onto a fake product's chip.</Card></R>
          <R at={3} s={s}><Card num="3 · REAPPLICATION" title="Reuse a real tag">A genuine tag is removed and stuck on a fake product.</Card></R>
        </div>
        <p className="cap" style={{ marginTop: 40 }}>Source: Yiu, “Toward Blockchain-Enabled Supply Chain Anti-Counterfeiting and Traceability”, arXiv preprint, 2021</p>
      </>
    ),
  },
  {
    section: "The problem", part: 0, steps: 3, title: "Why not just use a normal database?",
    notes: "About 1.5 minutes. Be honest: if one company ran everything, a normal database could be simpler. The blockchain helps when several organizations share one record and no one should edit it alone.",
    render: (s) => (
      <>
        <Head section="The problem" title="Why not just use a normal database?" />
        <div className="grid2 body">
          <R at={1} s={s}><Card title="A single-company database" icon={<IconDb />}>One company can edit its own records alone, and nobody else can tell. Simpler and faster to run.</Card></R>
          <R at={2} s={s}><Card title="A blockchain record" accent icon={<IconNodes />}>Shared by several organizations. Hard to change quietly. Slower and more complex.</Card></R>
        </div>
        <R at={3} s={s}>
          <p className="big-statement" style={{ marginTop: 48, fontSize: 40, fontWeight: 500 }}>
            If one company runs everything, a normal database may be simpler. A blockchain makes sense when several organizations must share one record that none of them can edit alone.
          </p>
        </R>
      </>
    ),
  },
  /* ---------------- Part 2: the research ---------------- */
  {
    section: "The research", part: 1, steps: 3, title: "Four papers we built on",
    notes: "About 2 minutes. Two are peer-reviewed journal papers and two are arXiv preprints.",
    render: (s) => (
      <>
        <Head section="The research" title="Four papers we built on" />
        <div className="grid2 body" style={{ rowGap: 28 }}>
          <R at={1} s={s}>
            <Card title="Ho Dac et al., 2023">
              Product lifecycle from register to sold, with roles. CTU J. Innovation & Sustainable Development 15. <Paper>JOURNAL</Paper>
            </Card>
          </R>
          <R at={2} s={s}>
            <Card title="Yiu, 2021 · “dNAS”">
              Signed tags and counters checked against the blockchain. arXiv:2102.01456. <Paper>PREPRINT</Paper>
            </Card>
          </R>
          <R at={3} s={s}>
            <Card title="Musamih et al., 2021">
              Owner-only rules; hash on the chain, data off-chain. IEEE Access 9. <Paper>JOURNAL</Paper>
            </Card>
          </R>
          <R at={3} s={s}>
            <Card title="Yiu, 2021 · “Toward…”">
              Threat analysis of NFC anti-counterfeiting. arXiv:2102.00459. <Paper>PREPRINT</Paper>
            </Card>
          </R>
        </div>
      </>
    ),
  },
  {
    section: "The research", part: 1, steps: 0, title: "Ho Dac et al.: the product lifecycle",
    notes: "Ho Dac et al. (2023), peer-reviewed. It gives the full product lifecycle and the roles. We took the four steps and the three rules, but not Hyperledger Fabric or the certifying agency. Its weak point is the barcode, which can be copied; it also measured speed only (63 to 88 blocks a minute on 20 nodes on one PC).",
    render: () => (
      <>
        <Head section="The research" title="Ho Dac et al. · the product lifecycle" lede="a product's life is a chain of recorded hand-overs, and every step has a rule about who may do it." />
        <LifecycleAnim />
      </>
    ),
  },
  {
    section: "The research", part: 1, steps: 0, title: "dNAS: the signed tag and counters",
    notes: "Yiu's dNAS is the heart of our tag design. The tag carries a signed label and two counters; the server and the chain each keep their own copy, and every scan compares all three. In our demo the server holds every party's signing key, and the NFC chip is simulated.",
    render: () => (
      <>
        <Head section="The research" title="dNAS · the signed tag and counters" lede="the tag, the server and the chain each keep a copy of the facts. If the copies disagree, something is wrong." />
        <TagCountersAnim />
      </>
    ),
  },
  {
    section: "The research", part: 1, steps: 0, title: "dNAS: the layered validation",
    notes: "dNAS describes three layers: the database, the chain, and the stored record. The error names modification, reapplication and cloning come from dNAS. In our own demo we run a fourth step, where the network agrees to move the counter; that is ours and is covered in the demo.",
    render: () => (
      <>
        <Head section="The research" title="dNAS · the layered validation" lede="every scan is checked several ways, one after another. One failed check is enough to call the tag suspicious." />
        <LayersAnim />
      </>
    ),
  },
  {
    section: "The research", part: 1, steps: 0, title: "Musamih et al.: fingerprint on the chain",
    notes: "Musamih et al. (2021, IEEE Access) is a drug-tracing system on Ethereum. The first idea we took: keep the data off-chain and put only its hash, a fingerprint, on the chain. We did not use its Solidity code, gas costs, payments for buying lots or its QR-to-address mapping.",
    render: () => (
      <>
        <Head section="The research" title="Musamih et al. · fingerprint on the chain" lede="keep big data off the chain, and store only its fingerprint there. If anyone edits the data, the fingerprint stops matching." />
        <HashAnim />
      </>
    ),
  },
  {
    section: "The research", part: 1, steps: 0, title: "Musamih et al.: only the right person can act",
    notes: "The second idea we took from Musamih et al.: functions that only permitted callers can run. In our system only the current owner can hand a product over or sell it, and only an approved Producer can register one.",
    render: () => (
      <>
        <Head section="The research" title="Musamih et al. · only the right person can act" lede="before a change is made, the system checks who is asking. The wrong person is simply refused." />
        <AuthAnim />
      </>
    ),
  },
  {
    section: "The research", part: 1, steps: 0, title: "Toward: the attacks we test",
    notes: "Yiu's second paper is a threat analysis. We use its attack types as our test cases, and map each one to the check that catches it and to the demo case that shows it. The last row is honest: a real tag moved onto a fake item passes every digital check. Relay attacks (T08), denial of service (T11) and record spoofing (T14) are in the paper but not addressed in our demo.",
    render: () => (
      <>
        <Head section="The research" title="Toward… · the attacks we test" lede="three ways someone might cheat a tag, and the check in our system that stops each one." />
        <AttackAnim />
      </>
    ),
  },
  {
    section: "The research", part: 1, steps: 0, title: "All four papers in one flow",
    notes: "This is the combined design. The highlight walks through the watch's life; each line shows which paper the idea came from. Ho Dac gives the lifecycle and rules, Musamih the owner-only checks and the hash and off-chain split, dNAS the signed tag, counters and layered validation, Toward the attack list we test against. The grey Ours label marks what we added.",
    render: () => (
      <>
        <Head section="The research" title="All four papers in one flow" lede="our system is the four papers stacked together: the lifecycle, the owner rules, the signed tag and the attacks to test against." />
        <CombinedFlowAnim />
      </>
    ),
  },
  {
    section: "The research", part: 1, steps: 0, title: "How the papers fill each other's gaps",
    notes: "This is why we combined four papers rather than copying one. Each paper left a gap that another one covers. The last row is honest about what stays open: the relay, denial-of-service and spoofing threats from the Toward paper are not addressed.",
    render: () => (
      <>
        <Head section="The research" title="How the papers fill each other's gaps" />
        <GapsAnim />
      </>
    ),
  },
  {
    section: "How it works", part: 2, steps: 0, title: "The big picture",
    notes: "Three parties pass a product along: the Producer makes it, a Participant such as a shop receives and sells it, and the Customer checks it.",
    render: () => (
      <>
        <Head section="How it works" title="The big picture · who is involved" />
        <div className="flow">
          <Card title="Producer" style={{ flex: 1 }} icon={<IconFactory />}>e.g. AcmeWatches. Makes the product and is its first owner.</Card>
          <div className="arrow">→</div>
          <Card title="Participant" style={{ flex: 1 }} icon={<IconShop />}>e.g. ShopOne. Receives the product and sells it.</Card>
          <div className="arrow">→</div>
          <Card title="Customer" style={{ flex: 1 }} icon={<IconPerson />}>Scans the tag to check it.</Card>
        </div>
      </>
    ),
  },
  {
    section: "How it works", part: 2, steps: 0, title: "The three parts of the system",
    notes: "The tag proves who made the product. The chain proves what has happened since. In our demo the server holds every party's signing key.",
    render: () => (
      <>
        <Head section="How it works" title="The big picture · the three parts" />
        <div className="grid3">
          <Card num="THE TAG" title="Signed label" accent>Product ID and the chip's serial number, signed. The counters are not signed.</Card>
          <Card num="THE SERVER" title="Record + key">Keeps the full product record and the Producer's signing key.</Card>
          <Card num="THE CHAIN" title="Shared record">Record hash, owner, history and counters.</Card>
        </div>
        <p className="big-statement" style={{ marginTop: 48, fontSize: 44, fontWeight: 500 }}>
          The tag proves <b>who made it</b>. The chain proves <b>what has happened since</b>.
        </p>
      </>
    ),
  },
  {
    section: "How it works", part: 2, steps: 3, title: "How the counter stops copies",
    notes: "About 1.5 minutes. This exact-match rule is our own design: the scan sends the counter exactly as the tag shows it, and after an accepted scan the record and tag both move up by one. Reading is answered by one node; changing the counter needs the whole network.",
    render: (s) => (
      <>
        <Head section="How it works" title="How the counter stops copies" />
        <R at={1} s={s}>
          <div className="flow wrap" style={{ marginTop: 48, alignItems: "center" }}>
            <div className="stateBox">Tag shows <b>0</b><br />Record holds <b>0</b></div>
            <div className="arrow">→</div>
            <div><span className="pill">scan sends 0, exactly as shown</span></div>
            <div className="arrow">→</div>
            <div className="stateBox">Tag shows <b>1</b><br />Record holds <b>1</b></div>
            <Verdict kind="genuine" />
          </div>
        </R>
        <R at={2} s={s}>
          <div className="flow wrap" style={{ marginTop: 44, alignItems: "center" }}>
            <div className="stateBox">Old copy says <b>0</b></div>
            <div className="arrow">→</div>
            <div className="stateBox">Record is at <b>1</b> <span className="cross">✕ stale</span></div>
            <Verdict kind="suspicious" detail="reapplication" />
          </div>
        </R>
        <R at={3} s={s}>
          <p className="lede" style={{ marginTop: 40 }}>
            Reading is answered by <b>one node</b>. Changing the counter needs the <b>whole network</b> to agree. <Ours />
          </p>
        </R>
      </>
    ),
  },

  /* ---------------- Part 4: the demo ---------------- */
  {
    section: "Live demo", part: 3, steps: 3, title: "What we built",
    notes: "A working simulation of the whole system: virtual company computers in one program, with real digital signatures. Built with Python (FastAPI) and a React page. Its backend tests pass (25 tests).",
    render: (s) => (
      <>
        <Head section="Live demo" title="What we built" lede="A working simulation of the whole system." />
        <div className="split">
          <div className="grow">
            <div className="grid2" style={{ gap: 22 }}>
              <R at={1} s={s}><Card title="Network">See each node's blocks. Split and heal the network. Make a node misbehave.</Card></R>
              <R at={1} s={s}><Card title="Parties">Add Producers, shops and customers.</Card></R>
              <R at={2} s={s}><Card title="Products">Register, hand over, sell. See history and failed checks.</Card></R>
              <R at={2} s={s}><Card title="Scan" accent>A virtual tag a phone can read, with buttons to try attacks.</Card></R>
              <R at={3} s={s}><Card title="Monitor">Which nodes agree, and where they differ.</Card></R>
              <R at={3} s={s}><Card title="Events">A live log of what the network is doing.</Card></R>
            </div>
          </div>
          <div style={{ width: 640, flex: "none" }}><AppMock /></div>
        </div>
        <p className="cap" style={{ marginTop: 28 }}>A simulation: virtual nodes in one program, real digital signatures · 25 backend tests pass</p>
      </>
    ),
  },
  ...[1, 2, 3, 4, 5, 6].map((n) => ({
    section: "Live demo", part: 3, steps: 1, title: `Case ${n}: ${CASES[n].title}`,
    notes: "If the live demo fails, show the screenshot or recording for this case.",
    render: (s) => <CaseSlide c={CASES[n]} s={s} />,
  })),
  {
    section: "Limitations", part: 4, steps: 3, title: "The biggest limit: the blockchain can't see the product",
    notes: "This is the oracle problem. Link back to case 6. We did not solve it; tamper-evident tags are only an idea. Background reading: Caldarelli et al. 2020 and Powell et al. (abstract-level).",
    render: (s) => (
      <>
        <Head section="Limitations" title="The biggest limit" />
        <R at={1} s={s}><p className="big-statement">A blockchain proves a record <b>was not changed after it was written</b>.</p></R>
        <R at={2} s={s}><p className="big-statement" style={{ marginTop: 16 }}>It cannot prove the record <b>matches the physical product</b>.</p></R>
        <div style={{ marginTop: 28 }}><WatchPair /></div>
        <R at={3} s={s}>
          <div className="row" style={{ marginTop: 20, alignItems: "center", gap: 28, flexWrap: "wrap" }}>
            <Verdict kind="genuine" detail="wrongly, on a fake item" />
            <span className="lede" style={{ margin: 0 }}>We did not solve this.</span>
          </div>
        </R>
      </>
    ),
  },
  {
    section: "Limitations", part: 4, steps: 0, title: "Limits of the papers: scale, trust and keys",
    notes: "These are limits the papers describe themselves. Scalability: Yiu's Toward paper says decentralised systems are generally less scalable because consensus is needed for every state change, extra validation layers add steps, and new nodes take a long time to sync as the chain grows; Ho Dac tested 20 nodes on one PC. Trust: in dNAS there is one elected administrator, the first nodes are added without a vote, and upgrading contracts needs trust in the administrator. Keys: the Toward paper notes keys are reused with no rotation, so a stolen key could be used to flood the network.",
    render: () => (
      <>
        <Head section="Limitations" title="Limits of the papers" lede="Real limits that the papers describe themselves, and that carry over to our system." />
        <div className="grid3">
          <Card title="Scalability"><Src k="toward" /><Src k="hodac" /><br />Consensus is needed for every change, extra validation layers add steps, and new nodes sync slowly as the chain grows. Ho Dac tested 20 nodes on one PC.</Card>
          <Card title="Trust in one administrator"><Src k="dnas" /><br />A single elected administrator. The first nodes join without a vote, and contract upgrades depend on trusting the administrator.</Card>
          <Card title="Keys are never rotated"><Src k="toward" /><br />The same keys are used again and again. A stolen key could be used to flood the network with transactions.</Card>
        </div>
      </>
    ),
  },
  {
    section: "Limitations", part: 4, steps: 0, title: "Limits of the papers: privacy and data",
    notes: "More limits the papers describe. Musamih et al.: blockchain entries are immutable, so mistakes cannot be corrected, and the people recording data can still make errors. Yiu's Toward paper: reused public addresses can be mapped to real companies, emitted events let competitors work out transaction volumes, tag data can leak if tags are not deactivated, and smart-contract code is visible to every node so attackers can look for mistakes.",
    render: () => (
      <>
        <Head section="Limitations" title="Limits of the papers · privacy and data" lede="More limits from the same papers." />
        <div className="grid3">
          <Card title="Mistakes are permanent"><Src k="musamih" /><br />Entries can't be corrected or removed, yet the people recording them can still make errors.</Card>
          <Card title="Privacy can leak"><Src k="toward" /><br />Reused addresses can be traced to real companies, and events show how much each one trades.</Card>
          <Card title="Contract code is public"><Src k="toward" /><br />Every node can read the contract code, so attackers can look for mistakes in it.</Card>
        </div>
      </>
    ),
  },
  {
    section: "Questions", part: 4, steps: 0, title: "References",
    notes: "Two of the papers (Musamih, Yiu “Toward…”) were only skimmed; Ho Dac was read in full. Likely questions: why a blockchain rather than a database; transaction vs read; why QR is weaker than NFC; what is not built; what has been tested.",
    render: () => (
      <>
        <Head section="Questions" title="References" />
        <div style={{ fontSize: 30, lineHeight: 1.5, display: "grid", gap: 20 }}>
          <p>[1] Ho Dac et al., “A practical blockchain-based framework for anti-counterfeiting and traceability”, CTU J. Innovation and Sustainable Development 15, 2023. doi:10.22144/ctujoisd.2023.043</p>
          <p>[2] N. C. K. Yiu, “Decentralizing Supply Chain Anti-Counterfeiting Systems Using Blockchain Technology”, arXiv:2102.01456, 2021.</p>
          <p>[3] Musamih et al., “A Blockchain-Based Approach for Drug Traceability in Healthcare Supply Chain”, IEEE Access 9, 2021. doi:10.1109/ACCESS.2021.3049920</p>
          <p>[4] N. C. K. Yiu, “Toward Blockchain-Enabled Supply Chain Anti-Counterfeiting and Traceability”, arXiv:2102.00459, 2021.</p>
          <p>[5] OECD & EUIPO, press release on global trade in fake goods, 7 May 2025 (figure taken from the press release).</p>
        </div>
      </>
    ),
  },
  {
    section: "Thank you", part: 0, steps: 0, divider: true, closing: true, title: "Thank you",
    notes: "Thank the audience and take questions.",
    render: () => (
      <>
        <ClosingScene />
        <div className="closing">
          <h1>Thank you</h1>
          <TeamRow />
        </div>
      </>
    ),
  },
];

export const slides = withDividers(rawSlides);
