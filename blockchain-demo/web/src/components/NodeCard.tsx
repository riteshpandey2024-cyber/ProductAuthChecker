import { api } from "../api";
import type { Notify, NodeInfo } from "../types";
import { hashColor, short } from "../util";

const MODES = [
  ["honest", "Honest"],
  ["offline", "Offline"],
  ["equivocate", "Sends two different blocks"],
  ["tamper", "Proposes a forged block"],
] as const;

interface Props {
  node: NodeInfo;
  notify: Notify;
  onChange: () => void;
  selectedHash: string | null;
  onPick: (nodeId: string, hash: string) => void;
}

export default function NodeCard({ node, notify, onChange, selectedHash, onPick }: Props) {
  const setMode = async (mode: string) => {
    try {
      await api(`/nodes/${node.id}/mode`, "POST", { mode });
      onChange();
    } catch (e) {
      notify((e as Error).message, "error");
    }
  };
  const c = node.consensus;
  return (
    <div className={`card node ${node.online ? "" : "off"} ${node.diverges ? "diverges" : ""}`}>
      <div className="row between">
        <strong>{node.name}</strong>
        <span className="row">
          {node.joining && <span className="pill warn">joining</span>}
          {node.diverges && <span className="pill bad">differs</span>}
        </span>
      </div>
      <div className="muted small mono">{node.address.slice(0, 14)}…</div>
      <div className="row" style={{ marginTop: 8 }}>
        <span>height <b>{node.height}</b></span>
        <span>head <b className="mono" style={{ color: hashColor(node.head_hash) }}>{short(node.head_hash, 6)}</b></span>
        <span className="muted">weight {node.head_weight}</span>
        <span className="muted">pending {node.mempool}</span>
      </div>
      <div className="lane">
        {node.recent.map((b) => (
          <div
            key={b.hash}
            role="button"
            tabIndex={0}
            className={`chip pick ${selectedHash === b.hash ? "sel" : ""}`}
            style={{ background: hashColor(b.hash) }}
            title={`Block #${b.index}${b.index ? `, built by ${b.proposer}` : ""}. Click for details.`}
            onClick={() => onPick(node.id, b.hash)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onPick(node.id, b.hash)}
          >
            <b>#{b.index}</b>
            <span className="mono">{short(b.hash, 4)}</span>
            {b.index > 0 && <div>{b.proposer.replace("Node ", "")} · w{b.weight}</div>}
            {b.txs > 0 && <div className="txmark">● {b.txs} tx</div>}
          </div>
        ))}
      </div>
      {c.in_turn && <div className="small muted" style={{ marginTop: 8 }}>{c.in_turn === node.address ? "this node is in turn" : ""}</div>}
      <div className="row" style={{ marginTop: 10 }}>
        <select value={node.mode} onChange={(e) => setMode(e.target.value)} aria-label={`behaviour of ${node.name}`}>
          {MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
    </div>
  );
}
