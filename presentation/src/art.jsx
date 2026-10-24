// Inline SVG artwork: no image files, so the deck works offline and follows the light and dark themes.

const S = { fill: "none", stroke: "currentColor", strokeWidth: 3.2, strokeLinecap: "round", strokeLinejoin: "round" };

/** Title-slide illustration: a signed tag, a chain of blocks, and a phone that says "genuine". */
export function HeroArt() {
  const grid = [];
  const pattern = "1110101110101011010111010";
  pattern.split("").forEach((c, i) => {
    if (c === "1") grid.push(<rect key={i} x={100 + (i % 5) * 30} y={110 + Math.floor(i / 5) * 30} width="22" height="22" rx="4" fill="var(--text)" />);
  });
  return (
    <svg className="art hero-art" viewBox="0 0 760 760" aria-hidden="true">
      <circle cx="380" cy="380" r="340" fill="var(--primary)" opacity="0.07" />
      {/* signed tag */}
      <g transform="rotate(-6 200 180)">
        <rect x="64" y="56" width="290" height="230" rx="28" fill="var(--surface)" stroke="var(--line)" strokeWidth="4" />
        {grid}
        <path d="M256 112h70M256 148h54M256 184h70" stroke="var(--muted)" strokeWidth="9" strokeLinecap="round" opacity="0.55" />
        <path d="M96 258c30-26 54 20 84-6s48-8 78-16" stroke="var(--primary)" strokeWidth="6" strokeLinecap="round" fill="none" />
      </g>
      {/* chain of blocks */}
      <g stroke="var(--primary)" strokeWidth="6" fill="var(--surface)">
        <rect x="70" y="470" width="190" height="130" rx="22" />
        <rect x="285" y="400" width="190" height="130" rx="22" />
        <rect x="500" y="330" width="190" height="130" rx="22" />
      </g>
      <g stroke="var(--primary)" strokeWidth="6" strokeLinecap="round" strokeDasharray="2 14">
        <path d="M260 520L285 475" /><path d="M475 450L500 405" />
      </g>
      <g fill="var(--primary)" opacity="0.55">
        <rect x="92" y="494" width="96" height="12" rx="6" /><rect x="92" y="522" width="140" height="12" rx="6" /><rect x="92" y="550" width="70" height="12" rx="6" />
        <rect x="307" y="424" width="96" height="12" rx="6" /><rect x="307" y="452" width="140" height="12" rx="6" /><rect x="307" y="480" width="70" height="12" rx="6" />
        <rect x="522" y="354" width="96" height="12" rx="6" /><rect x="522" y="382" width="140" height="12" rx="6" />
      </g>
      {/* verdict badge on the newest block */}
      <circle cx="650" cy="330" r="38" fill="var(--genuine)" />
      <path d="M632 331l13 13 24-26" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* phone */}
      <g transform="translate(500 520)">
        <rect x="0" y="0" width="170" height="226" rx="30" fill="var(--surface)" stroke="var(--text)" strokeWidth="6" />
        <rect x="62" y="14" width="46" height="8" rx="4" fill="var(--text)" opacity="0.5" />
        <circle cx="85" cy="112" r="38" fill="none" stroke="var(--genuine)" strokeWidth="8" />
        <path d="M68 113l12 12 22-24" stroke="var(--genuine)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <rect x="36" y="168" width="98" height="12" rx="6" fill="var(--muted)" opacity="0.5" />
      </g>
    </svg>
  );
}

const ico = (size, children) => (
  <svg width={size} height={size} viewBox="0 0 64 64" {...S} aria-hidden="true">{children}</svg>
);
export const IconDb = ({ size = 92 }) => ico(size, <><ellipse cx="32" cy="14" rx="20" ry="8" /><path d="M12 14v36c0 4.4 9 8 20 8s20-3.6 20-8V14" /><path d="M12 32c0 4.4 9 8 20 8s20-3.6 20-8" /></>);
export const IconNodes = ({ size = 92 }) => ico(size, <><circle cx="14" cy="48" r="8" /><circle cx="50" cy="48" r="8" /><circle cx="32" cy="14" r="8" /><path d="M20 42l8-20M44 42l-8-20M22 48h20" /></>);
export const IconFactory = ({ size = 92 }) => ico(size, <><path d="M8 54V30l16 10V30l16 10V12h16v42z" /><path d="M8 54h48M44 24h4M44 34h4" /></>);
export const IconShop = ({ size = 92 }) => ico(size, <><path d="M8 28l5-16h38l5 16z" /><path d="M12 28v26h40V28" /><path d="M26 54V40h12v14" /></>);
export const IconPerson = ({ size = 92 }) => ico(size, <><circle cx="32" cy="20" r="10" /><path d="M12 56c0-12 9-20 20-20s20 8 20 20" /></>);

/** A simplified picture of the demo window: tabs, a few nodes and a verdict. */
export function AppMock() {
  const tabs = ["Network", "Parties", "Products", "Scan", "Monitor", "Events"];
  return (
    <svg className="art" viewBox="0 0 720 500" aria-hidden="true">
      <rect x="6" y="6" width="708" height="488" rx="24" fill="var(--surface)" stroke="var(--line)" strokeWidth="4" />
      <path d="M6 60h708" stroke="var(--line)" strokeWidth="3" />
      <circle cx="40" cy="33" r="8" fill="var(--suspicious)" opacity="0.8" /><circle cx="68" cy="33" r="8" fill="var(--unconfirmed)" opacity="0.8" /><circle cx="96" cy="33" r="8" fill="var(--genuine)" opacity="0.8" />
      {tabs.map((t, i) => (
        <g key={t}>
          <rect x={30 + i * 111} y="78" width="100" height="34" rx="17" fill={t === "Scan" ? "var(--primary)" : "none"} stroke="var(--primary)" strokeWidth="2.5" />
          <text x={80 + i * 111} y="101" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="16" fill={t === "Scan" ? "var(--surface)" : "var(--primary)"}>{t}</text>
        </g>
      ))}
      {/* tag card */}
      <rect x="40" y="140" width="290" height="320" rx="20" fill="var(--bg)" stroke="var(--line)" strokeWidth="3" />
      <text x="62" y="176" fontFamily="JetBrains Mono, monospace" fontSize="17" fill="var(--muted)">product_id   W-1001</text>
      <text x="62" y="208" fontFamily="JetBrains Mono, monospace" fontSize="17" fill="var(--muted)">tag_id       04:A2:…</text>
      <text x="62" y="240" fontFamily="JetBrains Mono, monospace" fontSize="17" fill="var(--muted)">read_counter 0</text>
      <rect x="62" y="262" width="246" height="42" rx="12" fill="var(--primary)" />
      <text x="185" y="290" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="19" fill="var(--surface)">Tap the tag</text>
      <rect x="62" y="318" width="246" height="42" rx="12" fill="none" stroke="var(--primary)" strokeWidth="3" />
      <text x="185" y="346" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="17" fill="var(--primary)">Copy onto a blank chip</text>
      <rect x="62" y="374" width="246" height="42" rx="12" fill="none" stroke="var(--primary)" strokeWidth="3" />
      <text x="185" y="402" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="17" fill="var(--primary)">Replay the last scan</text>
      {/* result */}
      <rect x="360" y="140" width="320" height="64" rx="32" fill="var(--genuine)" opacity="0.16" stroke="var(--genuine)" strokeWidth="3.5" />
      <circle cx="394" cy="172" r="14" fill="none" stroke="var(--genuine)" strokeWidth="3.5" /><path d="M387 172l5 5 9-10" stroke="var(--genuine)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <text x="422" y="180" fontFamily="JetBrains Mono, monospace" fontSize="22" fontWeight="600" fill="var(--genuine)">GENUINE</text>
      {["Server database", "Contract (one node)", "Stored record", "Counter update"].map((l, i) => (
        <g key={l}>
          <circle cx="380" cy={240 + i * 40} r="11" fill="var(--genuine)" /><path d={`M374 ${240 + i * 40}l4 4 8-9`} stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <text x="404" y={246 + i * 40} fontFamily="Inter, sans-serif" fontSize="19" fill="var(--text)">{l}</text>
        </g>
      ))}
      {/* tiny network */}
      <g stroke="var(--primary)" strokeWidth="3" fill="var(--surface)">
        <path d="M420 430l60-24 60 24M480 406v-0" fill="none" /><circle cx="420" cy="430" r="14" /><circle cx="480" cy="406" r="14" /><circle cx="540" cy="430" r="14" /><circle cx="600" cy="406" r="14" />
        <path d="M494 410l32 16M554 428l32-18" fill="none" />
      </g>
    </svg>
  );
}

function Watch({ x, fake }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <rect x="-34" y="10" width="68" height="70" rx="12" fill="var(--bg)" stroke="var(--muted)" strokeWidth="5" />
      <rect x="-34" y="250" width="68" height="70" rx="12" fill="var(--bg)" stroke="var(--muted)" strokeWidth="5" />
      <circle cx="0" cy="165" r="92" fill="var(--surface)" stroke={fake ? "var(--suspicious)" : "var(--genuine)"} strokeWidth="9" />
      <path d="M0 165V112M0 165l36 22" stroke="var(--text)" strokeWidth="8" strokeLinecap="round" />
      <circle cx="0" cy="165" r="9" fill="var(--text)" />
      {[0, 90, 180, 270].map((a) => <rect key={a} x="-3" y="82" width="6" height="14" rx="3" fill="var(--muted)" transform={`rotate(${a} 0 165)`} />)}
    </g>
  );
}

/** The key limitation as a picture: the same genuine tag, first on a real watch, then on a fake. */
export function WatchPair() {
  const pattern = "1110101110101011010111010";
  const qr = (ox, oy) => pattern.split("").map((c, i) => c === "1" ? <rect key={i} x={ox + (i % 5) * 12} y={oy + Math.floor(i / 5) * 12} width="9" height="9" rx="2" fill="var(--text)" /> : null);
  return (
    <svg className="art" viewBox="0 0 1500 392" aria-hidden="true">
      <Watch x={170} />
      <text x="170" y="376" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="28" fill="var(--genuine)">REAL WATCH</text>
      <g transform="translate(340 200)">
        <rect width="86" height="86" rx="14" fill="var(--surface)" stroke="var(--primary)" strokeWidth="5" />
        {qr(13, 13)}
      </g>
      <g stroke="var(--primary)" strokeWidth="7" fill="none" strokeLinecap="round" strokeDasharray="3 16">
        <path d="M440 240c180-110 380-110 560 0" />
      </g>
      <path d="M980 228l24 14-28 8" stroke="var(--primary)" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <text x="720" y="110" textAnchor="middle" fontFamily="Space Grotesk, sans-serif" fontSize="34" fill="var(--muted)">the tag is moved</text>
      <Watch x={1230} fake />
      <g transform="translate(1292 210)">
        <rect width="86" height="86" rx="14" fill="var(--surface)" stroke="var(--primary)" strokeWidth="5" />
        {qr(13, 13)}
      </g>
      <text x="1230" y="376" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="28" fill="var(--suspicious)">FAKE WATCH</text>
    </svg>
  );
}

/** Large outline icon shown on each section opener. */
export function DividerArt({ kind }) {
  const p = {
    problem: <><rect x="8" y="18" width="48" height="30" rx="6" /><path d="M32 18l-6 10 10 4-6 10" /><path d="M16 26h6M42 38h6" /></>,
    research: <><rect x="14" y="8" width="30" height="40" rx="4" /><rect x="22" y="16" width="30" height="40" rx="4" /><path d="M29 28h16M29 36h16M29 44h10" /></>,
    how: <><rect x="4" y="24" width="16" height="16" rx="3" /><rect x="24" y="24" width="16" height="16" rx="3" /><rect x="44" y="24" width="16" height="16" rx="3" /><path d="M20 32h4M40 32h4" /></>,
    demo: <><rect x="6" y="10" width="52" height="38" rx="6" /><path d="M6 20h52" /><path d="M27 28l12 7-12 7z" /><path d="M20 56h24" /></>,
    limits: <><path d="M4 32c8-14 18-20 28-20s20 6 28 20c-8 14-18 20-28 20S12 46 4 32z" /><circle cx="32" cy="32" r="8" /><path d="M10 54L54 10" /></>,
  }[kind];
  return <svg className="div-art" viewBox="0 0 64 64" {...S} strokeWidth="1.6" aria-hidden="true">{p}</svg>;
}

const G = {
  tag: <><rect x="8" y="14" width="40" height="30" rx="6" /><circle cx="18" cy="24" r="3" /><path d="M26 24h14M18 34h22" /></>,
  copy: <><rect x="10" y="14" width="30" height="30" rx="5" /><rect x="24" y="24" width="30" height="30" rx="5" /></>,
  warn: <><path d="M32 8L58 52H6z" /><path d="M32 24v14M32 44v1" /></>,
  magnifier: <><circle cx="28" cy="28" r="16" /><path d="M40 40l16 16" /></>,
  docs: <><rect x="14" y="8" width="30" height="40" rx="4" /><rect x="22" y="16" width="30" height="40" rx="4" /><path d="M29 28h16M29 36h16M29 44h10" /></>,
  book: <><path d="M6 14c10-4 18-2 26 4v36c-8-6-16-8-26-4z" /><path d="M58 14c-10-4-18-2-26 4v36c8-6 16-8 26-4z" /></>,
  bars: <><path d="M10 54V30M24 54V16M38 54V36M52 54V8M6 56h52" /></>,
  nodes: <><circle cx="14" cy="48" r="8" /><circle cx="50" cy="48" r="8" /><circle cx="32" cy="14" r="8" /><path d="M20 42l8-20M44 42l-8-20M22 48h20" /></>,
  chain: <><rect x="4" y="24" width="16" height="16" rx="3" /><rect x="24" y="24" width="16" height="16" rx="3" /><rect x="44" y="24" width="16" height="16" rx="3" /><path d="M20 32h4M40 32h4" /></>,
  key: <><circle cx="20" cy="32" r="12" /><path d="M32 32h26M48 32v10M56 32v8" /></>,
  shield: <><path d="M32 6l22 8v16c0 14-9 24-22 28C19 54 10 44 10 30V14z" /><path d="M22 32l8 8 14-16" /></>,
  db: <><ellipse cx="32" cy="14" rx="20" ry="8" /><path d="M12 14v36c0 4.4 9 8 20 8s20-3.6 20-8V14" /><path d="M12 32c0 4.4 9 8 20 8s20-3.6 20-8" /></>,
  play: <><rect x="6" y="10" width="52" height="38" rx="6" /><path d="M6 20h52" /><path d="M27 28l12 7-12 7z" /><path d="M20 56h24" /></>,
  phone: <><rect x="18" y="4" width="28" height="56" rx="6" /><path d="M28 52h8" /><circle cx="32" cy="30" r="8" /><path d="M28 30l3 3 5-6" /></>,
  terminal: <><rect x="6" y="10" width="52" height="44" rx="6" /><path d="M16 26l8 6-8 6M30 40h14" /></>,
  cursor: <><path d="M16 8l32 22-14 3 8 16-8 4-8-16-10 10z" /></>,
  eyeoff: <><path d="M4 32c8-14 18-20 28-20s20 6 28 20c-8 14-18 20-28 20S12 46 4 32z" /><circle cx="32" cy="32" r="8" /><path d="M10 54L54 10" /></>,
  question: <><circle cx="32" cy="32" r="24" /><path d="M24 25c1-6 6-9 11-8 5 1 8 6 6 10-2 4-9 5-9 11M32 45v1" /></>,
  broken: <><rect x="4" y="22" width="20" height="20" rx="4" /><rect x="40" y="22" width="20" height="20" rx="4" /><path d="M24 28l8 6-4 4 8 6" /></>,
  hourglass: <><path d="M16 6h32M16 58h32M20 6c0 14 24 14 24 26S20 44 20 58M44 6c0 14-24 14-24 26" /></>,
};
const SCENES = {
  problem: ["tag", "copy", "warn", "magnifier", "broken", "eyeoff"],
  research: ["docs", "book", "bars", "nodes", "magnifier", "key"],
  how: ["chain", "key", "shield", "db", "nodes", "phone"],
  demo: ["play", "phone", "terminal", "cursor", "shield", "chain"],
  limits: ["eyeoff", "question", "warn", "hourglass", "broken", "magnifier"],
};
// x, y, size, tilt, drift delay: arranged around the centred title
const SPOTS = [[230, 215, 190, -8, 0], [1690, 205, 160, 9, 1.2], [175, 560, 130, 6, 2.4], [1745, 575, 140, -6, 0.6], [330, 885, 160, 8, 1.8], [1590, 890, 170, -10, 3]];

/** Rings and six section icons drawn around a centred title (used on the section openers). */
export function DividerScene({ kind, bare = false }) {
  return (
    <svg className="dscene" viewBox="0 0 1920 1080" aria-hidden="true">
      {[330, 480, 640, 800].map((r, i) => (
        <circle key={r} cx="960" cy="540" r={r} fill="none" stroke="currentColor" strokeWidth={i === 1 ? 3 : 2} strokeDasharray={i % 2 ? "4 18" : "none"} opacity={0.16 - i * 0.02} />
      ))}
      {[[960, 210], [1290, 540], [640, 870], [270, 540], [1560, 380], [380, 380]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="9" fill="currentColor" opacity="0.35" />
      ))}
      {!bare && SCENES[kind].map((name, i) => {
        const [x, y, size, tilt, delay] = SPOTS[i];
        return (
          <g key={name} className="dfloat" style={{ animationDelay: `${delay}s` }}>
            <g transform={`translate(${x - size / 2} ${y - size / 2}) rotate(${tilt} ${size / 2} ${size / 2}) scale(${size / 64})`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.55">
              {G[name]}
            </g>
          </g>
        );
      })}
    </svg>
  );
}

/** One of the line icons above, sized for use inside a card. */
export function Glyph({ name, size = 84 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {G[name]}
    </svg>
  );
}

/** Calm background for the closing slide: ripples, orbiting dots and drifting blocks. */
export function ClosingScene() {
  const orbit = (r, n, phase) => Array.from({ length: n }, (_, i) => {
    const th = phase + (i * 2 * Math.PI) / n;
    return [960 + r * Math.cos(th), 540 + r * Math.sin(th)];
  });
  const blocks = [[250, 220, 70], [1680, 230, 56], [170, 760, 60], [1740, 800, 76], [560, 930, 50], [1380, 120, 54]];
  return (
    <svg className="dscene" viewBox="0 0 1920 1080" aria-hidden="true">
      {[0, 2.4, 4.8].map((d) => (
        <circle key={d} className="ripple" cx="960" cy="540" r="520" fill="none" stroke="currentColor" strokeWidth="3" style={{ animationDelay: `${d}s` }} />
      ))}
      <g className="orbit">
        <circle cx="960" cy="540" r="430" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 16" opacity="0.2" />
        {orbit(430, 3, 0.4).map(([x, y]) => <circle key={`a${x}`} cx={x} cy={y} r="11" fill="currentColor" opacity="0.5" />)}
      </g>
      <g className="orbit rev">
        <circle cx="960" cy="540" r="640" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.14" />
        {orbit(640, 4, 1.1).map(([x, y]) => <circle key={`b${x}`} cx={x} cy={y} r="9" fill="currentColor" opacity="0.4" />)}
      </g>
      {blocks.map(([x, y, s], i) => (
        <g key={`${x}-${y}`} className="dfloat" style={{ animationDelay: `${i * 0.9}s` }}>
          <rect x={x - s / 2} y={y - s / 2} width={s} height={s} rx={s / 5} fill="none" stroke="currentColor" strokeWidth="4" opacity="0.38" transform={`rotate(${i % 2 ? 12 : -10} ${x} ${y})`} />
        </g>
      ))}
    </svg>
  );
}
