// The research part: self-playing diagrams. Each one loops through a few steps, lights up the part being
// explained and says it in a sentence. With animations off (key A) or reduced motion, each rests on its final,
// fully explained state.
import { useEffect, useState } from "react";
import { Src, Arrow, Node, Verdict } from "./components.jsx";
import { Glyph } from "./art.jsx";

function motionAllowed() {
  const off = document.documentElement.dataset.motion === "off";
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return !off && !reduce;
}

/** Steps 0..len-1 forever; `round` counts completed loops. With animation off it rests on the last step. */
export function useCycle(len, ms) {
  const [tick, setTick] = useState(0);
  const [on, setOn] = useState(motionAllowed);
  useEffect(() => {
    const obs = new MutationObserver(() => setOn(motionAllowed()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    if (!on) return undefined;
    const id = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [on, ms]);
  return on ? { step: tick % len, round: Math.floor(tick / len) } : { step: len - 1, round: 0 };
}

/** The sentence that explains the step currently shown. Re-keyed so it fades in on every change. */
export const Caption = ({ children, id }) => <div className="caption" key={id}>{children}</div>;

/** One plain-English sentence under the title, with the paper's label. */
export const Plain = ({ k, children }) => (
  <div className="plainline"><Src k={k} /><b>In plain words:</b> {children}</div>
);

/* ---------- Ho Dac: the lifecycle ---------- */
export function LifecycleAnim() {
  const { step } = useCycle(4, 2800);
  const nodes = [
    ["Register", "only an approved Producer", "The Producer creates it."],
    ["Hand over", "only the current owner", "Producer to shop."],
    ["Sell", "a sold item can't be resold", "Shop to customer."],
    ["Check", null, "The customer scans the tag."],
  ];
  const caps = [
    "The Producer registers the watch. Only an approved Producer is allowed to.",
    "The watch is handed to the shop. Only its current owner can do that, and the history grows.",
    "The shop sells it to a customer. From now on it can't be sold again.",
    "A customer scans the tag and can see who owns the watch and that it is sold.",
  ];
  const parts = [];
  nodes.forEach(([t, rule, text], i) => {
    parts.push(<Node key={t} title={t} rule={rule} state={i === step ? "on" : i < step ? "done" : ""}>{text}</Node>);
    if (i < 3) parts.push(<Arrow key={`a${i}`} lit={i < step} />);
  });
  return (
    <>
      <div className="flow">{parts}</div>
      <Caption id={step}>{caps[step]}</Caption>
    </>
  );
}

/* ---------- dNAS: the tag, the server and the chain keep matching copies ---------- */
export function TagCountersAnim() {
  const { step, round } = useCycle(5, 2600);
  const n = round % 3;
  const shown = step === 4 ? n + 1 : n;
  const caps = [
    `A customer taps the tag. The tag shows its read counter: ${n}.`,
    `The phone sends exactly what the tag shows: ${n}.`,
    "The server compares it with its own copy of the tag.",
    "The chain compares it too, and checks who signed the label.",
    `All three agree, so every copy moves up to ${n + 1}.`,
  ];
  return (
    <>
      <div className="flow" style={{ alignItems: "stretch" }}>
        <Node title="The tag" state={step <= 1 ? "on" : step === 4 ? "ok" : ""}>
          Signed label<br />Read counter <span className="bignum">{shown}</span>
        </Node>
        <Arrow label="same?" lit={step >= 2} />
        <Node title="The server" state={step === 2 ? "on" : step === 4 ? "ok" : ""}>
          Full record and key<br />Read counter <span className="bignum">{shown}</span>
        </Node>
        <Arrow label="same?" lit={step >= 3} />
        <Node title="The chain" state={step === 3 ? "on" : step === 4 ? "ok" : ""}>
          Signer and fingerprint<br />Read counter <span className="bignum">{shown}</span>
        </Node>
      </div>
      <Caption id={step}>{caps[step]}</Caption>
    </>
  );
}

/* ---------- dNAS: the layered validation, with a good scan and a forged one ---------- */
export function LayersAnim() {
  const { step, round } = useCycle(5, 2400);
  const fail = round % 2 === 1;
  const layers = [
    ["1 · Database", "Does the tag match the server's record?"],
    ["2 · On the chain", "Is the signer right? Do the counters match?"],
    ["3 · Stored record", "Does the record match its fingerprint?"],
  ];
  const state = (i) => {
    if (fail) return i === 0 && step >= 1 ? "bad" : "";
    if (step === i + 1) return "on";
    return step > i + 1 ? "ok" : "";
  };
  const passCaps = [
    "A genuine tag is scanned.",
    "Layer 1: the tag matches the server's record.",
    "Layer 2: the signer is the registered Producer, and the counters match.",
    "Layer 3: the stored record still matches its fingerprint on the chain.",
    "Every layer agrees: the product is genuine.",
  ];
  const failCaps = [
    "A tag with a forged signature is scanned.",
    "Layer 1: the signature is not the one written on the tag. The check fails.",
    "One failed layer is enough. The failure is logged on the product.",
    "One failed layer is enough. The failure is logged on the product.",
    "The tag is called suspicious: a modification.",
  ];
  return (
    <>
      <div className="flow">
        {layers.flatMap(([t, text], i) => {
          const out = [<Node key={t} title={t} state={state(i)}>{text}</Node>];
          if (i < 2) out.push(<Arrow key={`a${i}`} lit={!fail && step > i + 1} />);
          return out;
        })}
      </div>
      <div className="verdictslot">
        <div className={`vslot ${step === 4 ? "show" : ""}`}>
          {fail ? <Verdict kind="suspicious" detail="modification" /> : <Verdict kind="genuine" />}
        </div>
      </div>
      <Caption id={`${round}-${step}`}>{(fail ? failCaps : passCaps)[step]}</Caption>
    </>
  );
}

/* ---------- Musamih, idea 1: fingerprint on the chain, record off-chain ---------- */
export function HashAnim() {
  const { step } = useCycle(4, 2900);
  const edited = step >= 1;
  const mismatch = step >= 2;
  const caps = [
    "The full record stays off-chain. Only its fingerprint is on the chain, and the two match.",
    "Someone edits the record.",
    "The edited record has a different fingerprint.",
    "It no longer matches the chain, so the edit is exposed.",
  ];
  return (
    <>
      <div className="flow">
        <Node title="Full record" state={step === 1 ? "on" : ""}><span className={edited ? "edit" : ""}>Watch · {edited ? "red" : "black"}</span></Node>
        <Arrow label="hash" lit={step === 2} />
        <Node title="Fingerprint" state={mismatch ? "bad" : "ok"}><span className="mono">{mismatch ? "7c21…" : "a3f9…"}</span></Node>
        <Arrow label="compare" lit={step >= 2} />
        <Node title="On the chain"><span className="mono">a3f9…</span></Node>
      </div>
      <Caption id={step}>{caps[step]}</Caption>
      <p className="cap" style={{ marginTop: 10 }}>Fingerprint values are illustrative.</p>
    </>
  );
}

/* ---------- Musamih, idea 2: only permitted callers can act ---------- */
export function AuthAnim() {
  const { step } = useCycle(4, 2900);
  const stranger = step >= 2;
  const caps = [
    "ShopOne, the current owner, asks to hand the watch over.",
    "The check passes: the caller is the owner.",
    "A stranger asks to hand the same watch over.",
    "The check fails: the request is refused.",
  ];
  return (
    <>
      <div className="flow">
        <Node title="Caller" state={step === 0 || step === 2 ? "on" : ""}>{stranger ? "A stranger" : "ShopOne (the owner)"}</Node>
        <Arrow lit={step === 1 || step === 3} />
        <Node title="Check" state={step === 1 ? "ok" : step === 3 ? "bad" : ""}>Right role? Current owner?</Node>
        <Arrow lit={step === 1 || step === 3} />
        <Node title="Result">
          <div className="resultslot">
            <div className={`vslot ${step === 1 ? "show" : ""}`}><Verdict kind="genuine" detail="allowed" /></div>
            <div className={`vslot ${step === 3 ? "show" : ""}`}><Verdict kind="suspicious" detail="refused" /></div>
          </div>
        </Node>
      </div>
      <Caption id={step}>{caps[step]}</Caption>
    </>
  );
}

/* ---------- Toward: the attacks we test ---------- */
const ATTACKS = [
  ["Modification", "The signature no longer matches the Producer", "Case 2",
    "Someone edits the data on a tag. The signature no longer matches the registered Producer, so the check fails."],
  ["Cloning", "The chip's serial number is not the registered one", "Case 4",
    "A fake chip carries a copy of the data, but its serial number is not the registered one."],
  ["Reapplication", "The counter is out of date", "Case 3",
    "A saved scan is replayed. The record has already moved on, so the old counter is out of date."],
];
export function AttackAnim() {
  const { step } = useCycle(3, 3400);
  return (
    <>
      <div className="atkbox">
        <div className="atk head"><span>Attack</span><span>How we catch it</span><span>Demo case</span></div>
        {ATTACKS.map(([a, catch_, c], i) => (
          <div className={`atk ${i === step ? "on" : ""} ${i < step ? "seen" : ""}`} key={a}>
            <b>{a}</b>
            <span>{catch_}</span><span>{c}</span>
          </div>
        ))}
      </div>
      <Caption id={step}>{ATTACKS[step][3]}</Caption>
    </>
  );
}

/* ---------- All four papers in one flow ---------- */
const LANES = [
  ["Register", [["hodac", "Approved Producers only"], ["musamih", "Fingerprint on chain"]],
    "A Producer registers the watch. Ho Dac gives the rule, and Musamih the idea of keeping the record off-chain with only its fingerprint on the chain."],
  ["Sign the tag", [["dnas", "Signed label"], ["dnas", "Counters start"]],
    "The Producer's key signs the label and the counters start. This is all from dNAS."],
  ["Hand over", [["hodac", "Owner-only"], ["musamih", "Permitted callers"]],
    "Only the owner can hand the watch over (Ho Dac, Musamih), and the history grows."],
  ["Sell", [["hodac", "Sold only once"]],
    "A sold watch can't be sold again. That rule comes from Ho Dac."],
  ["Scan", [["dnas", "Layered checks"], ["toward", "Attack tests"]],
    "A customer scans. dNAS's layered checks run, and the Toward paper's attacks are what we test them against."],
];
export function CombinedFlowAnim() {
  const { step } = useCycle(5, 3400);
  return (
    <>
      <div className="progbar"><div style={{ width: `${((step + 1) / 5) * 100}%` }} /></div>
      <div className="lanes">
        {LANES.map(([title, lines], i) => (
          <div className={`lane ${i === step ? "on" : ""} ${i < step ? "done" : ""}`} key={title}>
            <h4>{i + 1} · {title}</h4>
            {lines.map(([k, text]) => <div className="ln" key={text}><Src k={k} />{text}</div>)}
          </div>
        ))}
      </div>
      <Caption id={step}>{LANES[step][2]}</Caption>
    </>
  );
}

/* ---------- Who contributed what ---------- */
const COLS = ["hodac", "dnas", "musamih", "toward"];
const MATRIX = [
  ["Register, hand over, sell lifecycle", ["hodac"]],
  ["Owner-only hand-over, sold-once rule", ["hodac", "musamih"]],
  ["Only an approved Producer registers", ["hodac", "musamih"]],
  ["Signed tag, signer recovered from it", ["dnas"]],
  ["Write and read counters", ["dnas"]],
  ["Record hash on chain, record off-chain", ["musamih", "dnas"]],
  ["Layered validation and failure log", ["dnas"]],
  ["Attack types used as test cases", ["toward"]],
];
const COLCAPS = {
  hodac: "Ho Dac et al. give us the lifecycle and its three rules.",
  dnas: "dNAS gives us the signed tag, the counters and the layered validation.",
  musamih: "Musamih et al. give us the owner-only checks and the idea of a fingerprint on the chain with the record off-chain.",
  toward: "The Toward paper gives us the attack types we test against.",
};
export function MatrixAnim() {
  const { step } = useCycle(4, 3400);
  const active = COLS[step];
  return (
    <>
      <div className="matrix">
        <div className="mrow head">
          <span className="sectionlabel" style={{ margin: 0 }}>Idea in our system</span>
          {COLS.map((k) => <span key={k} className={`mh ${k === active ? "on" : ""}`}><Src k={k} /></span>)}
        </div>
        {MATRIX.map(([label, who]) => (
          <div className="mrow" key={label}>
            <span>{label}</span>
            {COLS.map((k) => <span key={k} className={`mark ${k} ${k === active ? "on" : ""}`}>{who.includes(k) ? "●" : ""}</span>)}
          </div>
        ))}
      </div>
      <Caption id={active}>{COLCAPS[active]}</Caption>
    </>
  );
}

/* ---------- Gaps filled ---------- */
const GAPS = [
  [["hodac", "Checks a barcode that is easy to copy"], ["dnas", "A signed tag plus counters"], "A barcode can be copied, so dNAS's signed tag and counters replace it."],
  [["hodac", "Never tested against attacks"], ["toward", "Its attack list becomes our test cases"], "Ho Dac tested speed, not attacks, so the Toward paper's attacks become our test cases."],
  [["dnas", "Built for wine"], ["ours", "The same checks on a watch"], "dNAS was built for wine, so we apply the same checks to a watch."],
  [["toward", "Analysis, not a working system"], ["ours", "Detection for three of its attacks"], "The Toward paper is analysis only, so we built detection for three of its attacks."],
];
export function GapsAnim() {
  const { step } = useCycle(4, 3400);
  return (
    <>
      <div className="fitrow headrow">
        <span className="sectionlabel" style={{ margin: 0 }}>A gap in one paper</span><span />
        <span className="sectionlabel" style={{ margin: 0 }}>How our system covers it</span>
      </div>
      {GAPS.map(([a, b], i) => (
        <div className={`fitrow ${i === step ? "on" : ""} ${i < step ? "seen" : ""}`} key={i}>
          <div className="card"><p><Src k={a[0]} />{a[1]}</p></div>
          <div className="arrow">→</div>
          <div className="card accent"><p><Src k={b[0]} />{b[1]}</p></div>
        </div>
      ))}
      <Caption id={step}>{GAPS[step][2]}</Caption>
    </>
  );
}

/* ---------- Closing slide: a chain growing block by block ---------- */
const HASHES = ["a3f9", "7c21", "e08b", "5d4a", "91ce"];
export function ChainAnim({ horizontal = false }) {
  const { step } = useCycle(8, 1100);
  const shown = horizontal ? Math.max(1, Math.min(step, 5)) : Math.min(step, 5);
  const blocks = [];
  HASHES.forEach((h, i) => {
    const visible = i < shown;
    const latest = i === shown - 1;
    if (i > 0) blocks.push(<div key={`l${i}`} className={`clink ${visible ? "in" : ""}`} />);
    blocks.push(
      <div key={h} className={`cblock ${visible ? "in" : ""} ${latest ? "latest" : ""}`}>
        <div className="cb-title">Block {i + 1}{latest && step >= 5 && <span className="cb-ok">✓</span>}</div>
        <div>hash {h}…<span className="cb-prev">  ←  {i === 0 ? "0000" : HASHES[i - 1]}…</span></div>
      </div>,
    );
  });
  return <div className={`chainanim ${horizontal ? "row" : ""}`} aria-hidden="true">{blocks}</div>;
}

/* ---------- Closing slide: the whole project in one loop ---------- */
export function ClosingAnim() {
  const { step } = useCycle(7, 1600);
  const lit = (n) => step >= n + 2; // blocks light up one by one during steps 2, 3, 4
  const caps = [
    "A product carries a signed tag.",
    "A customer scans the tag with a phone.",
    "The shared record on the chain is checked, block by block.",
    "The shared record on the chain is checked, block by block.",
    "The shared record on the chain is checked, block by block.",
    "Every check agrees: the product is genuine.",
    "Every check agrees: the product is genuine.",
  ];
  const state = (i) => {
    const active = step === 0 ? 0 : step === 1 ? 1 : step <= 4 ? 2 : 3;
    return i === active ? "on" : i < active ? "done" : "";
  };
  return (
    <>
      <div className="cflow">
        <div className={`ccard ${state(0)}`}><span className="cglyph"><Glyph name="tag" /></span><h4>The tag</h4></div>
        <div className={`carrow ${step >= 1 ? "lit" : ""}`}>→</div>
        <div className={`ccard ${state(1)}`}><span className="cglyph"><Glyph name="phone" /></span><h4>The scan</h4></div>
        <div className={`carrow ${step >= 2 ? "lit" : ""}`}>→</div>
        <div className={`ccard ${state(2)}`}>
          <div className="mblocks">{[0, 1, 2].map((n) => <i key={n} className={`mblock ${lit(n) ? "lit" : ""}`} />)}</div>
          <h4>The chain</h4>
        </div>
        <div className={`carrow ${step >= 5 ? "lit" : ""}`}>→</div>
        <div className={`ccard ${state(3)}`}>
          <div className={`ans ${step >= 5 ? "show" : ""}`}><Verdict kind="genuine" /></div>
          <h4>The answer</h4>
        </div>
      </div>
      <div className="ccap" key={caps[step]}>{caps[step]}</div>
    </>
  );
}
