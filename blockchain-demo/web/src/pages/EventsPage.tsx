import { useEffect, useMemo, useRef, useState } from "react";
import type { Ctx } from "../App";
import type { ChainEvent } from "../types";

const LABEL: Record<string, string> = {
  tx_submitted: "transaction sent", tx_rejected: "transaction rejected", tx_dropped: "transaction dropped",
  tx_final: "transaction agreed", block_proposed: "block proposed", block_accepted: "block accepted",
  block_rejected: "block REJECTED", reorg: "switched chain", sync: "synced",
  node_added: "node joined", node_mode: "behaviour changed",
  partition: "network split", heal: "network healed", network: "network", scan: "scan",
};

export default function EventsPage({ ctx }: { ctx: Ctx }) {
  const [events, setEvents] = useState<ChainEvent[]>([]);
  const [type, setType] = useState("");
  const [node, setNode] = useState("");
  const [live, setLive] = useState(false);
  const retry = useRef<number | undefined>(undefined);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let closed = false;
    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${proto}://${location.host}/ws/events`);
      socket.onopen = () => setLive(true);
      socket.onmessage = (m) => {
        const ev: ChainEvent = JSON.parse(m.data);
        setEvents((prev) => (prev.some((p) => p.id === ev.id) ? prev : [...prev.slice(-399), ev]));
      };
      socket.onclose = () => {
        setLive(false);
        if (!closed) retry.current = window.setTimeout(connect, 1500);
      };
    };
    connect();
    return () => {
      closed = true;
      window.clearTimeout(retry.current);
      socket?.close();
    };
  }, []);

  const shown = useMemo(
    () => events.filter((e) => (!type || e.type === type) && (!node || e.node === node)).slice(-200).reverse(),
    [events, type, node],
  );
  const nameOf = (id: string | null) => (id ? ctx.monitor?.nodes.find((n) => n.id === id)?.name ?? id : "network");

  const describe = (e: ChainEvent) => {
    const d = e.data;
    switch (e.type) {
      case "block_proposed": return `#${d.index} ${String(d.hash).slice(2, 8)}${d.note ? ` — ${d.note}` : ""}`;
      case "block_accepted": return `#${d.index} ${String(d.hash).slice(2, 8)} by ${ctx.monitor?.nodes.find((n) => n.address === d.proposer)?.name ?? "?"}, ${d.txs} tx`;
      case "block_rejected": return `#${d.index} ${String(d.hash).slice(2, 8)}: ${d.reason}`;
      case "reorg": return `abandoned ${d.abandoned} block(s) for a heavier chain`;
      case "sync": return `copied ${d.blocks} block(s) from ${nameOf(d.source)}`;
      case "tx_submitted": return `${d.type} by ${d.sender}`;
      case "tx_final": return `in block ${d.block}`;
      case "tx_dropped": return d.reason;
      case "node_mode": return d.mode;
      case "partition": return (d.groups as string[][]).map((g) => g.join("+")).join(" | ");
      case "scan": return `${d.product}: ${d.verdict}${d.attack ? ` (${d.attack})` : ""}`;
      default: return d.message ?? JSON.stringify(d);
    }
  };

  return (
    <div className="card stack">
      <div className="row between">
        <h2>Event log {live ? <span className="pill good">live</span> : <span className="pill bad">disconnected</span>}</h2>
        <div className="row">
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">all events</option>
            {Object.entries(LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={node} onChange={(e) => setNode(e.target.value)}>
            <option value="">all nodes</option>
            {(ctx.monitor?.nodes ?? []).map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
          <button className="btn" onClick={() => setEvents([])}>Clear view</button>
        </div>
      </div>
      <div className="events">
        {shown.map((e) => (
          <div className="ev" key={e.id}>
            <span className="muted">t{e.tick}</span>
            <span style={{ color: e.type.includes("reject") ? "var(--bad)" : undefined }}>
              {nameOf(e.node)} · {LABEL[e.type] ?? e.type}
            </span>
            <span className="mono">{describe(e)}</span>
          </div>
        ))}
        {shown.length === 0 && <div className="muted">No events yet.</div>}
      </div>
    </div>
  );
}
