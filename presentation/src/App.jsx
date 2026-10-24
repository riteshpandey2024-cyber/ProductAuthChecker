import { Children, Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { slides } from "./slides.jsx";
import { Head } from "./components.jsx";

const total = slides.length;
const STAGE_W = 1920;
const STAGE_H = 1080;
const IDLE_MS = 2500;

const clamp = (n) => Math.max(0, Math.min(total - 1, n));
const PARTS = ["The problem", "The research", "How it works", "Live demo", "Limitations"];

/** Scales a slide's content up or down so it fills the space under the title, then centres it. */
function FitBody({ children, token }) {
  const hostRef = useRef(null);
  const innerRef = useRef(null);
  useLayoutEffect(() => {
    const host = hostRef.current;
    const inner = innerRef.current;
    if (!host || !inner) return undefined;
    const fit = () => {
      const W = host.clientWidth;
      const H = host.clientHeight;
      // Largest zoom (0.6 to 1.4) at which the scaled content fits both the height and the width.
      const fits = (z) => {
        inner.style.width = `${W / z}px`;
        inner.style.transform = "none";
        return inner.offsetHeight * z <= H * 0.86 && inner.scrollWidth * z <= W + 1;
      };
      let lo = 0.6;
      let hi = 1.8;
      if (fits(hi)) lo = hi;
      else {
        for (let k = 0; k < 9; k += 1) {
          const mid = (lo + hi) / 2;
          if (fits(mid)) lo = mid; else hi = mid;
        }
      }
      const z = lo;
      inner.style.width = `${W / z}px`;
      inner.style.transform = "none";
      const h = inner.offsetHeight;
      inner.style.transform = `scale(${z})`;
      inner.style.top = `${Math.max(0, (H - h * z) / 2)}px`;
    };
    fit();
    document.fonts?.addEventListener?.("loadingdone", fit);
    return () => document.fonts?.removeEventListener?.("loadingdone", fit);
  }, [token]);
  return (
    <div className="bodyfit" ref={hostRef}>
      <div className="bodyfit-inner" ref={innerRef}>{children}</div>
    </div>
  );
}

/** Slides that start with <Head> keep the title fixed and let the rest fit the remaining space. */
function renderSlide(slide, s, token) {
  const content = slide.render(s);
  if (content && content.type === Fragment) {
    const kids = Children.toArray(content.props.children);
    if (kids.length > 1 && kids[0].type === Head) {
      return (
        <>
          {kids[0]}
          <FitBody token={token}>{kids.slice(1)}</FitBody>
        </>
      );
    }
  }
  return content;
}

function readSaved(key, fallback) {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage can be blocked; the deck still works */ }
}

function startPosition() {
  const m = window.location.hash.match(/#\/(\d+)(?:\/(\d+))?/);
  const i = m ? clamp(parseInt(m[1], 10) - 1) : 0;
  const s = m && m[2] ? Math.min(parseInt(m[2], 10), slides[i].steps) : 0; // #/12/3 opens slide 12 at click 3
  return { i, s };
}

export default function App() {
  const [pos, setPos] = useState(startPosition);
  const [theme, setTheme] = useState(() => new URLSearchParams(window.location.search).get("theme") || readSaved("deck-theme", "light"));
  const [motion, setMotion] = useState(() => readSaved("deck-motion", "on"));
  const [overview, setOverview] = useState(false);
  const [help, setHelp] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [idle, setIdle] = useState(false);
  const [box, setBox] = useState({ scale: 1, left: 0, top: 0 });
  const idleTimer = useRef(null);

  const slide = slides[pos.i];

  // Fit the fixed 16:9 stage to the window.
  useEffect(() => {
    const fit = () => {
      const scale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
      setBox({ scale, left: (window.innerWidth - STAGE_W * scale) / 2, top: (window.innerHeight - STAGE_H * scale) / 2 });
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => { document.documentElement.dataset.theme = theme; save("deck-theme", theme); }, [theme]);
  useEffect(() => { document.documentElement.dataset.motion = motion; save("deck-motion", motion); }, [motion]);
  useEffect(() => { window.history.replaceState(null, "", `${window.location.search}#/${pos.i + 1}`); }, [pos.i]);

  // The controls and the mouse pointer disappear when the mouse is still, so the audience only sees slides.
  useEffect(() => {
    const wake = () => {
      setIdle(false);
      clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setIdle(true), IDLE_MS);
    };
    wake();
    window.addEventListener("mousemove", wake);
    window.addEventListener("keydown", wake);
    return () => {
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("keydown", wake);
      clearTimeout(idleTimer.current);
    };
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => { /* the browser may refuse; nothing else to do */ });
  }, []);

  const next = useCallback(() => {
    setPos((p) => {
      if (p.s < slides[p.i].steps) return { i: p.i, s: p.s + 1 };
      if (p.i < total - 1) return { i: p.i + 1, s: 0 };
      return p;
    });
  }, []);
  const prev = useCallback(() => {
    setPos((p) => {
      if (p.s > 0) return { i: p.i, s: p.s - 1 };
      if (p.i > 0) return { i: p.i - 1, s: slides[p.i - 1].steps };
      return p;
    });
  }, []);
  const goTo = useCallback((i) => { setPos({ i: clamp(i), s: 0 }); setOverview(false); }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (overview || help) {
        if (k === "Escape" || ((k === "o" || k === "O") && overview)) { setOverview(false); setHelp(false); }
        return;
      }
      if (k === "ArrowRight" || k === "ArrowDown" || k === "PageDown" || k === " " || k === "Enter") { e.preventDefault(); next(); }
      else if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp" || k === "Backspace") { e.preventDefault(); prev(); }
      else if (k === "Home") goTo(0);
      else if (k === "End") goTo(total - 1);
      else if (k === "o" || k === "O") setOverview(true);
      else if (k === "t" || k === "T") setTheme((t) => (t === "light" ? "dark" : "light"));
      else if (k === "a" || k === "A") setMotion((m) => (m === "on" ? "off" : "on"));
      else if (k === "n" || k === "N") setShowNotes((v) => !v);
      else if (k === "h" || k === "H" || k === "?") setHelp(true);
      else if (k === "f" || k === "F") toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, goTo, toggleFullscreen, overview, help]);

  useEffect(() => {
    let x0 = null;
    const down = (e) => { x0 = e.touches[0].clientX; };
    const up = (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 60) (dx < 0 ? next : prev)();
      x0 = null;
    };
    window.addEventListener("touchstart", down);
    window.addEventListener("touchend", up);
    return () => { window.removeEventListener("touchstart", down); window.removeEventListener("touchend", up); };
  }, [next, prev]);

  useEffect(() => {
    const onHash = () => setPos((p) => { const h = startPosition(); return h.i === p.i ? p : h; });
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const onViewportClick = (e) => {
    if (e.target.closest("button")) return;
    if (e.clientX < window.innerWidth * 0.12) prev(); else next();
  };

  const progress = useMemo(() => {
    const within = slide.steps ? pos.s / (slide.steps + 1) : 0;
    return ((pos.i + within) / (total - 1)) * 100;
  }, [pos, slide]);

  const chromeVisible = !idle || overview || help;
  const upcoming = slides[pos.i + 1];
  const showTrail = pos.i > 0 && slide.section !== "Appendix" && !slide.closing;
  const nextHint = upcoming && upcoming.section !== "Appendix"
    ? (upcoming.divider ? `Next section: ${upcoming.title}` : `Next: ${upcoming.title}`)
    : "";

  return (
    <div className={`viewport ${idle && !overview && !help ? "idle" : ""}`} onClick={onViewportClick}>
      <div
        className="stage"
        data-part={slide.part}
        data-divider={slide.divider ? "true" : "false"}
        style={{ transform: `scale(${box.scale})`, left: box.left, top: box.top }}
      >
        <div className="motif" aria-hidden="true" />
        <div className="progress" style={{ width: `${progress}%` }} />
        <div className={`slide ${slide.divider ? "divider" : ""}`} key={pos.i}>
          <div className="slide-inner">{renderSlide(slide, pos.s, pos.i)}</div>
        </div>
        {showTrail && (
          <div className="tracker">
            {PARTS.map((p, i) => (
              <span key={p} className={`tstep ${i === slide.part ? "on" : i < slide.part ? "past" : ""}`}><i />{p}</span>
            ))}
          </div>
        )}
        {showTrail && <div className="pageno">{pos.i + 1}</div>}
        {showTrail && !slide.divider && nextHint && (
          <div className="footer"><span className="next">{nextHint}<b> →</b></span></div>
        )}
      </div>

      {showNotes && (
        <div className="notes" onClick={(e) => e.stopPropagation()}><b>Notes:</b> {slide.notes}</div>
      )}

      <div className={`controls ${chromeVisible ? "" : "hide"}`} onClick={(e) => e.stopPropagation()}>
        <button onClick={prev} aria-label="Previous" title="Previous (←)">◀</button>
        <span className="count">{pos.i + 1} / {total}</span>
        <button onClick={next} aria-label="Next" title="Next (→ or Space)">▶</button>
        <button onClick={() => setOverview(true)} title="All slides (O)">Slides</button>
        <button onClick={() => setTheme((th) => (th === "light" ? "dark" : "light"))} title="Light / dark (T)">{theme === "light" ? "Dark" : "Light"}</button>
        <button onClick={toggleFullscreen} title="Fullscreen (F)">{fullscreen ? "Exit fullscreen" : "Fullscreen"}</button>
      </div>

      {overview && (
        <div className="overlay" onClick={() => setOverview(false)}>
          <div className="okicker">All slides · click to jump · Esc to close</div>
          <div className="ogrid" onClick={(e) => e.stopPropagation()}>
            {slides.map((sl, i) => (
              <button key={i} className={`ocard ${i === pos.i ? "cur" : ""}`} onClick={() => goTo(i)}>
                <b>{String(i + 1).padStart(2, "0")}</b>
                <div>{sl.title}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {help && (
        <div className="overlay" onClick={(e) => { e.stopPropagation(); setHelp(false); }}>
          <div className="helpbox">
            <h2>Keys</h2>
            <table><tbody>
              <tr><td><kbd>→</kbd> <kbd>Space</kbd> <kbd>Enter</kbd></td><td>Next</td></tr>
              <tr><td><kbd>←</kbd> <kbd>Backspace</kbd></td><td>Back</td></tr>
              <tr><td><kbd>Home</kbd> <kbd>End</kbd></td><td>First / last slide</td></tr>
              <tr><td><kbd>F</kbd></td><td>Full screen on / off</td></tr>
              <tr><td><kbd>O</kbd></td><td>Overview of all slides</td></tr>
              <tr><td><kbd>T</kbd></td><td>Light / dark theme</td></tr>
              <tr><td><kbd>N</kbd></td><td>Speaker notes</td></tr>
              <tr><td><kbd>A</kbd></td><td>Animations off / on</td></tr>
              <tr><td>Click</td><td>Next (left edge of the screen goes back)</td></tr>
            </tbody></table>
          </div>
        </div>
      )}
    </div>
  );
}
