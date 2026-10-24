import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { Monitor, NetState, Notify, Party, Product, ShelfTag } from "./types";
import { usePoll } from "./util";
import NetworkPage from "./pages/NetworkPage";
import PartiesPage from "./pages/PartiesPage";
import ProductsPage from "./pages/ProductsPage";
import ScanPage from "./pages/ScanPage";
import MonitorPage from "./pages/MonitorPage";
import EventsPage from "./pages/EventsPage";

export interface Ctx {
  state: NetState | null;
  monitor: Monitor | null;
  parties: Party[];
  products: Product[];
  notify: Notify;
  refresh: () => void;
  shelf: ShelfTag[];
  setShelf: (updater: (prev: ShelfTag[]) => ShelfTag[]) => void;
  goto: (tab: string) => void;
}

const TABS = ["Network", "Parties", "Products", "Scan", "Monitor", "Events"] as const;
const SHELF_KEY = "authenticity-demo-shelf";
const NETWORK_KEY = "authenticity-demo-network";

function loadShelf(): ShelfTag[] {
  try {
    return JSON.parse(localStorage.getItem(SHELF_KEY) || "[]");
  } catch {
    return [];
  }
}

export default function App() {
  const [tab, setTabState] = useState<string>(() => {
    const fromHash = decodeURIComponent(location.hash.slice(1));
    return (TABS as readonly string[]).includes(fromHash) ? fromHash : "Network";
  });
  const setTab = useCallback((t: string) => {
    location.hash = t;
    setTabState(t);
  }, []);
  const [toast, setToast] = useState<{ message: string; kind: "ok" | "error" } | null>(null);
  const [bump, setBump] = useState(0);
  const [shelf, setShelfState] = useState<ShelfTag[]>(loadShelf);

  const state = usePoll(() => api<NetState>("/state"), 1000);
  const monitor = usePoll(() => api<Monitor>("/monitor"), 1000);
  const parties = usePoll(() => api<Party[]>("/parties"), 2000, [bump]);
  const products = usePoll(() => api<Product[]>("/products"), 1500, [bump]);

  useEffect(() => {
    const onHash = () => {
      const t = decodeURIComponent(location.hash.slice(1));
      if ((TABS as readonly string[]).includes(t)) setTabState(t);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const notify: Notify = useCallback((message, kind = "ok") => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), kind === "error" ? 6000 : 3000);
  }, []);

  const setShelf = useCallback((updater: (prev: ShelfTag[]) => ShelfTag[]) => {
    setShelfState((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(SHELF_KEY, JSON.stringify(next));
      } catch {
        /* storage may be unavailable; the shelf then lives for this session only */
      }
      return next;
    });
  }, []);

  // Every fresh network has new keys, so a tag saved from another network can never validate here.
  // The shelf is remembered per network and dropped when the network id changes.
  useEffect(() => {
    if (!state?.network_id) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(NETWORK_KEY);
    } catch {
      /* storage unavailable: treat the shelf as belonging to an unknown network */
    }
    if (saved !== state.network_id) {
      setShelf(() => []);
      try {
        localStorage.setItem(NETWORK_KEY, state.network_id);
      } catch {
        /* nothing to do: the shelf then only lives for this session */
      }
    }
  }, [state?.network_id, setShelf]);

  const ctx: Ctx = useMemo(
    () => ({
      state, monitor, parties: parties ?? [], products: products ?? [], notify,
      refresh: () => setBump((b) => b + 1), shelf, setShelf, goto: setTab,
    }),
    [state, monitor, parties, products, notify, shelf, setShelf, setTab],
  );

  return (
    <div className="shell">
      <header className="top">
        <h1>Authenticity Chain Demo</h1>
        <nav>
          {TABS.map((t) => (
            <button key={t} className={t === tab ? "active" : ""} onClick={() => setTab(t)}>{t}</button>
          ))}
        </nav>
        <div className="statusbar">
          {state ? (
            <>
              <span className="pill">Proof-of-Authority</span>
              <span className="pill">tick {state.tick}</span>
              {state.paused && <span className="pill warn">paused</span>}
              {state.partition && <span className="pill bad">partitioned</span>}
              {monitor && (monitor.forked ? <span className="pill bad">forked</span> : <span className="pill good">in sync</span>)}
              {state.pending_txs > 0 && <span className="pill warn">{state.pending_txs} pending</span>}
            </>
          ) : (
            <span className="pill bad">backend not reachable</span>
          )}
        </div>
      </header>
      {tab === "Network" && <NetworkPage ctx={ctx} />}
      {tab === "Parties" && <PartiesPage ctx={ctx} />}
      {tab === "Products" && <ProductsPage ctx={ctx} />}
      {tab === "Scan" && <ScanPage ctx={ctx} />}
      {tab === "Monitor" && <MonitorPage ctx={ctx} />}
      {tab === "Events" && <EventsPage ctx={ctx} />}
      {toast && <div className={`toast ${toast.kind === "error" ? "error" : ""}`}>{toast.message}</div>}
    </div>
  );
}
