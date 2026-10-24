import { api } from "../api";
import type { BlockDetail, Monitor } from "../types";
import { hashColor, short, usePoll } from "../util";

const fmt = (v: unknown): string => {
  const text = String(v);
  return text.length > 18 ? `${text.slice(0, 10)}…` : text;
};

interface Props {
  nodeId: string;
  hash: string;
  monitor: Monitor;
  onClose: () => void;
}

export default function BlockPanel({ nodeId, hash, monitor, onClose }: Props) {
  const nodeName = (id: string) => monitor.nodes.find((n) => n.id === id)?.name ?? id;
  const detail = usePoll(async () => {
    const blocks = await api<BlockDetail[]>(`/nodes/${nodeId}/blocks?limit=50`);
    return blocks.find((b) => b.hash === hash) ?? null;
  }, 2000, [nodeId, hash]);

  const holders = monitor.rows.flatMap((r) => r.variants).find((v) => v.hash === hash)?.nodes;
  const missing = holders ? monitor.nodes.filter((n) => !holders.includes(n.id)) : [];

  return (
    <div className="card stack">
      <div className="row between">
        <h2 style={{ margin: 0 }}>
          Block #{detail?.index ?? "…"}{" "}
          <span className="variant mono" style={{ background: hashColor(hash) }}>{short(hash, 8)}</span>
        </h2>
        <button className="btn" onClick={onClose}>Close</button>
      </div>

      {detail === null && (
        <div className="muted">This block is no longer on {nodeName(nodeId)}'s chain: the node switched to a heavier chain.</div>
      )}

      {detail && (
        <>
          {detail.index === 0 ? (
            <div className="small">The genesis block. Every node has it from the start and nobody built it.</div>
          ) : (
            <div className="small">
              Built by <b>{detail.proposer}</b> at tick <b>{detail.tick}</b>, weight <b>{detail.weight}</b>{" "}
              <span className="muted">({detail.weight === 2 ? "on its own turn" : "out of turn, as a backup"})</span>
            </div>
          )}
          <div className="small">
            Held by{" "}
            <b>{holders ? holders.map(nodeName).join(", ") : "(older than the monitor window)"}</b>
            {missing.length > 0 && <span style={{ color: "var(--bad)" }}> · not held by {missing.map((n) => n.name).join(", ")}</span>}
          </div>
          <div className="small muted mono">
            previous block {short(detail.prev_hash, 8)} · state fingerprint {short(detail.state_root, 12)}
          </div>

          {detail.txs.length === 0 ? (
            <div className="small muted">
              No transactions: an empty block. Its state fingerprint is the same as the previous block's, because nothing changed.
            </div>
          ) : (
            <table>
              <thead>
                <tr><th>Transaction</th><th>By</th><th>Details</th><th>First sent to</th><th>Sent at tick</th></tr>
              </thead>
              <tbody>
                {detail.txs.map((t) => (
                  <tr key={t.hash}>
                    <td><b>{t.type.replace(/_/g, " ").toLowerCase()}</b></td>
                    <td>{t.sender}</td>
                    <td className="small mono">{Object.entries(t.payload).map(([k, v]) => `${k}: ${fmt(v)}`).join(" · ") || "—"}</td>
                    <td>{t.entry_node ?? "—"}</td>
                    <td>{t.sent_tick ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {detail.txs.length > 0 && detail.index > 0 && (
            <div className="small muted">
              The transaction reached <b>{detail.txs[0].entry_node ?? "a node"}</b> first, then was built into this block by <b>{detail.proposer}</b>
              {detail.txs[0].sent_tick !== null && <> (about {detail.tick - (detail.txs[0].sent_tick ?? 0)} ticks later)</>}.
              Every other node then re-checked the block and added it.
            </div>
          )}
        </>
      )}
    </div>
  );
}
