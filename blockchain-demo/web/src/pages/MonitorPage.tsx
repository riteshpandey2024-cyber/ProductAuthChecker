import type { Ctx } from "../App";
import { hashColor, short } from "../util";

export default function MonitorPage({ ctx }: { ctx: Ctx }) {
  const { monitor } = ctx;
  if (!monitor) return <div className="card">Loading…</div>;
  const nameOf = (id: string) => monitor.nodes.find((n) => n.id === id)?.name ?? id;

  return (
    <div className="stack">
      <div className={`banner ${monitor.forked ? "bad" : "good"}`}>
        {monitor.forked
          ? `Fork: nodes hold ${monitor.groups.length} different chains${monitor.first_divergent_index !== null ? `, first different at block #${monitor.first_divergent_index}` : ""}. ${monitor.tie ? "The network is split evenly, so there is no majority; the reference view follows the heavier chain." : `${monitor.divergent_nodes.map(nameOf).join(", ")} disagree with the majority.`}`
          : "All nodes hold the same chain."}
      </div>

      <div className="card">
        <h2>Who agrees with whom</h2>
        <div className="small muted" style={{ marginBottom: 8 }}>Nodes with the same head block are coloured alike. The central view compares every node's head; no node decides for the others.</div>
        <table>
          <thead><tr><th>Head</th><th>Nodes</th><th></th></tr></thead>
          <tbody>
            {monitor.groups.map((g) => (
              <tr key={g.head}>
                <td><span className="variant mono" style={{ background: hashColor(g.head) }}>{short(g.head, 10)}</span></td>
                <td>{g.nodes.map(nameOf).join(", ")}</td>
                <td>{g.head === monitor.majority_head ? <span className="pill good">{monitor.tie ? "heavier chain" : "majority"}</span> : <span className="pill bad">differs</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Blocks by position</h2>
        <div className="small muted" style={{ marginBottom: 8 }}>Two blocks at the same number mean a fork. Each block shows who proposed it, its weight, and which nodes hold it.</div>
        <table>
          <thead><tr><th>#</th><th>Block(s)</th></tr></thead>
          <tbody>
            {[...monitor.rows].reverse().map((row) => (
              <tr key={row.index}>
                <td><b>{row.index}</b>{row.forked && <span className="pill bad" style={{ marginLeft: 6 }}>fork</span>}</td>
                <td>
                  {row.variants.map((v) => (
                    <div key={v.hash} className="row" style={{ marginBottom: 4 }}>
                      <span className="variant mono" style={{ background: hashColor(v.hash) }}>{short(v.hash, 8)}</span>
                      <span className="small">{v.proposer} · weight {v.weight} · {v.txs} tx</span>
                      <span className="small muted">held by {v.nodes.map(nameOf).join(", ")}</span>
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Nodes</h2>
        <table>
          <thead><tr><th>Node</th><th>Behaviour</th><th>Height</th><th>Head</th><th>Weight</th><th>Waiting txs</th><th>Blocks known</th></tr></thead>
          <tbody>
            {monitor.nodes.map((n) => (
              <tr key={n.id}>
                <td>{n.name}{n.joining && <span className="pill warn" style={{ marginLeft: 6 }}>joining</span>}</td><td>{n.mode}</td><td>{n.height}</td>
                <td><span className="variant mono" style={{ background: hashColor(n.head_hash) }}>{short(n.head_hash, 6)}</span></td>
                <td>{n.head_weight}</td><td>{n.mempool}</td>
                <td>{n.known_blocks}{n.known_blocks > n.height + 1 && <span className="muted small"> (includes abandoned branches)</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
