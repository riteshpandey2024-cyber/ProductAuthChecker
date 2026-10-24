// Small building blocks shared by the slides.

/** Shows its children once the slide has reached click-step `at`. Always laid out, so nothing jumps. */
export function R({ at = 1, s, className = "", children }) {
  return <div className={`reveal ${s >= at ? "show" : ""} ${className}`}>{children}</div>;
}

const ICONS = {
  genuine: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" /><path d="M7.5 12.5l3 3 6-6.5" />
    </svg>
  ),
  suspicious: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.2L22 20.5H2L12 3.2z" /><path d="M12 10v5M12 17.8v.2" />
    </svg>
  ),
  unconfirmed: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" /><path d="M9.3 9.4a2.8 2.8 0 015.3 1.2c0 1.8-2.6 2.2-2.6 3.8M12 17.4v.2" />
    </svg>
  ),
};

const WORDS = { genuine: "GENUINE", suspicious: "SUSPICIOUS", unconfirmed: "UNCONFIRMED" };

/** A verdict is never shown by colour alone: icon + word + (optional) detail. */
export function Verdict({ kind, detail }) {
  return (
    <span className={`chip ${kind}`}>
      {ICONS[kind]}
      <span>{WORDS[kind]}</span>
      {detail && <span className="detail">· {detail}</span>}
    </span>
  );
}

export const Paper = ({ children = "PAPER" }) => <span className="badge paper">{children}</span>;
export const Ours = ({ children = "OUR WORK" }) => <span className="badge ours">{children}</span>;

/** A fixed pattern that looks like a code; the "copy" label uses the identical pattern on purpose. */
const PATTERN = "111010111100000101011101001110101110010000111101011010101110101001110101011010011";
export function Qr() {
  return (
    <div className="qr" aria-hidden="true">
      {PATTERN.split("").map((c, i) => <i key={i} className={c === "1" ? "" : "off"} />)}
    </div>
  );
}

export function Card({ num, title, children, accent, style, icon }) {
  return (
    <div className={`card ${accent ? "accent" : ""}`} style={style}>
      {icon && <div className="cardicon">{icon}</div>}
      {num && <span className="num">{num}</span>}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}

/** Header used by every slide: section label + title (+ optional lede). */
export function Head({ section, title, lede }) {
  return (
    <div className="head">
      <div className="kicker">{section}</div>
      <h1>{title}</h1>
      {lede && <p className="lede">{lede.charAt(0).toUpperCase() + lede.slice(1)}</p>}
    </div>
  );
}

/** One demo case: story, what we do on screen, what the audience sees, takeaway. Reveals in 3 clicks. */
export function CaseColumn({ c, s }) {
  return (
    <div className="case">
      <div>
        <div className="lbl">Case {c.n}</div>
        <h3>{c.title}</h3>
      </div>
      <R at={1} s={s}>
        <p>{c.story}</p>
        <p className="muted" style={{ marginTop: 14 }}><b>On screen:</b> {c.screen}</p>
      </R>
      <R at={2} s={s}>
        <div style={{ marginBottom: 18 }}>
          <Verdict kind={c.kind} detail={c.detail} />
          {c.warn && <span className="warn-note">⚠ {c.warn}</span>}
        </div>
        {c.how && <p className="muted" style={{ marginTop: 0 }}><b>{c.howLabel || "How it is caught"}:</b> {c.how}</p>}
      </R>
      <R at={3} s={s}>
        <p className="takeaway">{c.takeaway}</p>
      </R>
    </div>
  );
}

// ---- diagram pieces for the paper slides ----
const SRC = { hodac: "Ho Dac", dnas: "dNAS", musamih: "Musamih", toward: "Toward…", ours: "Ours" };
/** A small coloured label saying which paper an idea came from ("Ours" = our own addition). */
export const Src = ({ k }) => <span className={`src ${k}`}>{SRC[k]}</span>;

export const Arrow = ({ label, lit }) => (
  <div className={`arrowcol ${lit ? "lit" : ""}`}>
    <div className="arrow">→</div>
    {label && <div className="arrowlabel">{label}</div>}
  </div>
);

/** One box in a flow diagram: a title, a line of text and an optional rule pill. */
export function Node({ title, children, rule, accent, state }) {
  return (
    <div className={`fnode ${accent ? "accent" : ""} ${state || ""}`}>
      <h4>{title}</h4>
      {children && <p>{children}</p>}
      {rule && <span className="rule">{rule}</span>}
    </div>
  );
}

export { SRC };

/** One demo case on its own slide: the story on the left, the result (after one click) on the right. */
export function CaseSlide({ c, s }) {
  return (
    <>
      <Head section="Live demo" title={`Case ${c.n} · ${c.title}`} />
      <div className="casegrid">
        <div className="casepanel">
          <div className="lbl">What happens</div>
          <p className="bigp">{c.story}</p>
          <div className="lbl" style={{ marginTop: 34 }}>On screen</div>
          <p className="bigp muted">{c.screen}</p>
        </div>
        <R at={1} s={s} className="casepanel result">
          <div className="lbl">What you will see</div>
          <div style={{ margin: "14px 0 26px" }}>
            <Verdict kind={c.kind} detail={c.detail} />
            {c.warn && <div className="warn-note" style={{ display: "block", margin: "14px 0 0" }}>⚠ {c.warn}</div>}
          </div>
          {c.how && <p className="bigp"><b>{c.howLabel || "How it is caught"}:</b> {c.how}</p>}
          <p className="takeaway">{c.takeaway}</p>
        </R>
      </div>
    </>
  );
}
