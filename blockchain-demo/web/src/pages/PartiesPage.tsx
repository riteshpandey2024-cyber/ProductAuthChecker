import { useState } from "react";
import type { Ctx } from "../App";
import { api } from "../api";

const ROLE_HELP: Record<string, string> = {
  producer: "Makes products and signs their tags. Approved on the chain by the administrator.",
  participant: "Receives products after the producer, such as a supplier or shop. Approved on the chain.",
  customer: "Buys a product. Needs no approval.",
};

export default function PartiesPage({ ctx }: { ctx: Ctx }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<"producer" | "participant" | "customer">("producer");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      await api("/parties", "POST", { name: name.trim(), role });
      ctx.notify(role === "customer" ? `${name} added` : `${name} approved by the administrator (agreed in a block)`);
      setName("");
      ctx.refresh();
    } catch (e) {
      ctx.notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid two">
      <div className="card stack">
        <h2>Add a party</h2>
        <div className="row">
          <select value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
            <option value="producer">Producer</option>
            <option value="participant">Participant (supplier / shop)</option>
            <option value="customer">Customer</option>
          </select>
          <input type="text" placeholder="Name, e.g. AcmeWatches" value={name} style={{ flex: 1, minWidth: 160 }} onChange={(e) => setName(e.target.value)} />
          <button className="btn primary" disabled={!name.trim() || busy} onClick={create}>{busy ? "Waiting for agreement…" : "Add"}</button>
        </div>
        <div className="small muted">{ROLE_HELP[role]}</div>
        <div className="small muted">The server holds each party's signing key (as the design proposes), so the app can act as any of them.</div>
      </div>
      <div className="card">
        <h2>Parties</h2>
        <table>
          <thead><tr><th>Name</th><th>Role</th><th>Approved on chain</th><th>Address</th></tr></thead>
          <tbody>
            {ctx.parties.filter((p) => p.role !== "validator").map((p) => (
              <tr key={p.address}>
                <td>{p.name}</td>
                <td>{p.role}</td>
                <td>{p.approved ? <span className="pill good">yes</span> : <span className="pill warn">pending</span>}</td>
                <td className="mono">{p.address.slice(0, 12)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
        {ctx.parties.length === 0 && <div className="muted">No parties yet.</div>}
      </div>
    </div>
  );
}
