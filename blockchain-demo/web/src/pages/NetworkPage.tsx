import { useState } from "react";
import type { Ctx } from "../App";
import { api } from "../api";
import BlockPanel from "../components/BlockPanel";
import NodeCard from "../components/NodeCard";

export default function NetworkPage({ ctx }: { ctx: Ctx }) {
  const { state, monitor, notify } = ctx;
  const [count, setCount] = useState(4);
  const [newName, setNewName] = useState("");
  const [assign, setAssign] = useState<Record<string, number>>({});
  const [picked, setPicked] = useState<{ nodeId: string; hash: string } | null>(null);

  const call = async (path: string, body?: unknown, ok?: string) => {
    try {
      await api(path, "POST", body ?? {});
      if (ok) notify(ok);
    } catch (e) {
      notify((e as Error).message, "error");
    }
  };

  const nodes = monitor?.nodes ?? [];
  const defaultName = `Node ${nodes.length < 26 ? String.fromCharCode(65 + nodes.length) : nodes.length + 1}`;
  const applyPartition = () => {
    const groups: Record<number, string[]> = {};
    nodes.forEach((n) => (groups[assign[n.id] ?? 1] ??= []).push(n.id));
    const list = Object.values(groups);
    if (list.length < 2) return notify("Put nodes in at least two different groups", "error");
    call("/network/partition", { groups: list }, "Network split: groups cannot hear each other");
  };

  return (
    <div className="stack">
      <div className="grid two">
        <div className="card stack">
          <h2>Network</h2>
          <div className="row">
            <label className="row small">start with
              <input type="number" min={1} max={9} value={count} style={{ width: 64 }} onChange={(e) => setCount(Number(e.target.value))} />
              nodes
            </label>
            <button className="btn danger" onClick={() => call("/network/reset", { nodes: count }, "New network started")}>Start fresh network</button>
          </div>
          <div className="small muted">
            Running now: <b>{state?.nodes ?? "—"} nodes</b>. The number above only applies when you press Start fresh network, which also erases everything.
          </div>
          <h3>Add a node to the running network</h3>
          <div className="row">
            <input type="text" placeholder={`Name (default: ${defaultName})`} value={newName} style={{ width: 200 }} onChange={(e) => setNewName(e.target.value)} />
            <button className="btn" onClick={async () => { await call("/nodes", { name: newName.trim() || defaultName }, "Node added: it copies the chain and joins as soon as the network agrees"); setNewName(""); }}>Add one node</button>
          </div>
          <div className="row">
            {state?.paused
              ? <button className="btn primary" onClick={() => call("/network/resume")}>Resume</button>
              : <button className="btn" onClick={() => call("/network/pause")}>Pause</button>}
            <button className="btn" onClick={() => call("/network/step")} disabled={!state?.paused}>Step one tick</button>
            <label className="row small">message delay
              <select value={state?.latency ?? 1} onChange={(e) => call("/network/latency", { ticks: Number(e.target.value) })}>
                {[0, 1, 2, 3, 5].map((t) => <option key={t} value={t}>{t} tick{t === 1 ? "" : "s"}</option>)}
              </select>
            </label>
          </div>
          <div className="small muted">
            Proof-of-Authority: every node takes a turn building blocks. An in-turn block weighs 2, an out-of-turn block 1, and every node follows the heaviest chain.
            {" "}Messages delivered {state?.messages.delivered ?? 0}, lost {state?.messages.dropped ?? 0}.
          </div>
        </div>

        <div className="card stack">
          <h2>Split the network</h2>
          <div className="small muted">Choose a group for each node that is already running, then split. Nodes in different groups cannot hear each other, which is how different blocks appear.</div>
          <div className="row">
            {nodes.map((n) => (
              <label key={n.id} className="row small">{n.name}
                <select value={assign[n.id] ?? 1} onChange={(e) => setAssign({ ...assign, [n.id]: Number(e.target.value) })}>
                  <option value={1}>Group 1</option><option value={2}>Group 2</option><option value={3}>Group 3</option>
                </select>
              </label>
            ))}
          </div>
          <div className="row">
            <button className="btn danger" onClick={applyPartition}>Split</button>
            <button className="btn" onClick={() => call("/network/heal", {}, "Network healed")} disabled={!state?.partition}>Heal</button>
            {state?.partition && <span className="small muted">current: {state.partition.map((g) => g.join("+")).join("  |  ")}</span>}
          </div>
        </div>
      </div>

      {monitor?.forked && (
        <div className="banner bad">
          Nodes hold different blocks{monitor.first_divergent_index !== null ? ` from block #${monitor.first_divergent_index}` : ""}. Red cards differ from the reference chain (the majority, or the heavier chain if the split is even). See the Monitor tab for detail.
        </div>
      )}
      {picked && monitor && <BlockPanel nodeId={picked.nodeId} hash={picked.hash} monitor={monitor} onClose={() => setPicked(null)} />}
      <div className="small muted">Click any block to see who built it, which nodes hold it, and where each transaction in it was first sent.</div>
      <div className="grid nodes">
        {nodes.map((n) => (
          <NodeCard key={n.id} node={n} notify={notify} onChange={ctx.refresh}
            selectedHash={picked?.hash ?? null} onPick={(nodeId, hash) => setPicked({ nodeId, hash })} />
        ))}
      </div>
    </div>
  );
}
