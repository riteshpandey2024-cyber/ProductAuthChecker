import { useState } from "react";
import type { Ctx } from "../App";
import { api } from "../api";
import type { Product } from "../types";
import { short } from "../util";

export default function ProductsPage({ ctx }: { ctx: Ctx }) {
  const { parties, products, notify } = ctx;
  const producers = parties.filter((p) => p.role === "producer" && p.approved);
  const receivers = parties.filter((p) => (p.role === "producer" || p.role === "participant") && p.approved);
  const customers = parties.filter((p) => p.role === "customer");

  const [producer, setProducer] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [actAs, setActAs] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
      ctx.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  const register = () => run("register", async () => {
    const made = await api("/products", "POST", {
      producer: producer || producers[0]?.address,
      name: name.trim(),
      details: note ? { note } : {},
    });
    ctx.setShelf((prev) => [...prev, { id: `${made.product_id}-${Date.now()}`, label: `${name.trim()} (${made.product_id})`, data: made.tag }]);
    notify(`${made.product_id} registered in block ${made.block}; its tag is on the Scan shelf`);
    setName(""); setNote("");
  });

  const handover = (p: Product, to: string) => run(p.product_id, async () => {
    const r = await api(`/products/${p.product_id}/handover`, "POST", { actor: actAs || p.owner, to });
    notify(`Handed over in block ${r.block}. The tag was not rewritten.`);
  });

  const sell = (p: Product, buyer: string) => run(p.product_id, async () => {
    const r = await api(`/products/${p.product_id}/sell`, "POST", { actor: actAs || p.owner, buyer });
    notify(`Sold in block ${r.block}`);
  });

  const tamper = (p: Product) => run(p.product_id, async () => {
    await api("/debug/tamper-record", "POST", { product_id: p.product_id, field: "name", value: `${p.name} (edited)` });
    notify("Edited the record in the server database. Scan this product to see it caught.");
  });

  const addCustomer = () => run("customer", async () => {
    await api("/parties", "POST", { name: `Customer ${customers.length + 1}`, role: "customer" });
  });

  const toShelf = (p: Product) => {
    if (!p.tag) return;
    ctx.setShelf((prev) => [...prev, { id: `${p.product_id}-${Date.now()}`, label: `${p.name} (${p.product_id})`, data: p.tag! }]);
    notify("Tag copied to the Scan shelf");
  };

  return (
    <div className="stack">
      <div className="card stack">
        <h2>Register a product</h2>
        {producers.length === 0 && <div className="banner warn">Add and approve a producer on the Parties tab first.</div>}
        <div className="row">
          <select value={producer} onChange={(e) => setProducer(e.target.value)}>
            {producers.map((p) => <option key={p.address} value={p.address}>{p.name}</option>)}
          </select>
          <input type="text" placeholder="Product name, e.g. Chronograph watch" value={name} style={{ flex: 1, minWidth: 200 }} onChange={(e) => setName(e.target.value)} />
          <input type="text" placeholder="Details (optional)" value={note} style={{ flex: 1, minWidth: 160 }} onChange={(e) => setNote(e.target.value)} />
          <button className="btn primary" disabled={!name.trim() || producers.length === 0 || busy === "register"} onClick={register}>
            {busy === "register" ? "Waiting for agreement…" : "Register"}
          </button>
        </div>
        <div className="small muted">The full record is stored off-chain; only its hash, the owner and the tag identifier go on the chain. The producer then signs the tag once.</div>
      </div>

      <div className="card">
        <div className="row between">
          <h2>Products</h2>
          <label className="row small">Acting as
            <select value={actAs} onChange={(e) => setActAs(e.target.value)}>
              <option value="">the product's owner</option>
              {parties.filter((p) => p.role !== "validator").map((p) => <option key={p.address} value={p.address}>{p.name} ({p.role})</option>)}
            </select>
          </label>
        </div>
        <div className="small muted" style={{ marginBottom: 6 }}>Choose someone who is not the owner to see the contract refuse a handover.</div>
        <table>
          <thead><tr><th>Product</th><th>Producer (signer)</th><th>Owner</th><th>Status</th><th>Counters</th><th>Actions</th></tr></thead>
          <tbody>
            {products.map((p) => (
              <ProductRow key={p.product_id} p={p} receivers={receivers} customers={customers} busy={busy === p.product_id}
                open={open === p.product_id} onToggle={() => setOpen(open === p.product_id ? null : p.product_id)}
                onHandover={handover} onSell={sell} onTamper={tamper} onShelf={toShelf} onAddCustomer={addCustomer} />
            ))}
          </tbody>
        </table>
        {products.length === 0 && <div className="muted">No products registered yet.</div>}
      </div>
    </div>
  );
}

function ProductRow(props: {
  p: Product; receivers: { address: string; name: string }[]; customers: { address: string; name: string }[];
  busy: boolean; open: boolean; onToggle: () => void;
  onHandover: (p: Product, to: string) => void; onSell: (p: Product, buyer: string) => void;
  onTamper: (p: Product) => void; onShelf: (p: Product) => void; onAddCustomer: () => void;
}) {
  const { p } = props;
  const [to, setTo] = useState("");
  const [buyer, setBuyer] = useState("");
  const options = props.receivers.filter((r) => r.address !== p.owner);
  return (
    <>
      <tr>
        <td><b>{p.product_id}</b><div className="muted small">{p.name}</div></td>
        <td>{p.producer_name}</td>
        <td>{p.owner_name}</td>
        <td>{p.status === "sold" ? <span className="pill warn">sold</span> : <span className="pill good">registered</span>}</td>
        <td className="small">write {p.write_counter} · read {p.read_counter}</td>
        <td>
          <div className="row">
            {p.status === "registered" && (
              <>
                <select value={to} onChange={(e) => setTo(e.target.value)}>
                  <option value="">hand over to…</option>
                  {options.map((r) => <option key={r.address} value={r.address}>{r.name}</option>)}
                </select>
                <button className="btn" disabled={!to || props.busy} onClick={() => props.onHandover(p, to)}>Hand over</button>
                {props.customers.length === 0
                  ? <button className="btn" onClick={props.onAddCustomer}>Add a customer</button>
                  : <>
                      <select value={buyer} onChange={(e) => setBuyer(e.target.value)}>
                        <option value="">sell to…</option>
                        {props.customers.map((c) => <option key={c.address} value={c.address}>{c.name}</option>)}
                      </select>
                      <button className="btn" disabled={!buyer || props.busy} onClick={() => props.onSell(p, buyer)}>Sell</button>
                    </>}
              </>
            )}
            <button className="btn" onClick={() => props.onShelf(p)}>Tag to Scan</button>
            <button className="btn" onClick={props.onToggle}>{props.open ? "Hide" : "Details"}</button>
          </div>
        </td>
      </tr>
      {props.open && (
        <tr>
          <td colSpan={6}>
            <div className="grid two">
              <div>
                <h3>On-chain</h3>
                <div className="small mono">record hash {short(p.record_hash, 16)}…</div>
                <div className="small mono">tag identifier {p.tag_id}</div>
                <h3 style={{ marginTop: 10 }}>History (agreed by the network)</h3>
                {p.history.map((h, i) => (
                  <div key={i} className="small">block {h.block}: {h.type}{h.from ? ` ${h.from} → ${h.to}` : ""}{h.read_counter !== undefined ? ` (read counter ${h.read_counter})` : ""}</div>
                ))}
              </div>
              <div>
                <h3>Failed checks logged on the product</h3>
                {p.failures.length === 0 && <div className="small muted">none</div>}
                {p.failures.map((f, i) => <div key={i} className="small">block {f.block}: <b>{f.kind}</b> — {f.reason}</div>)}
                <h3 style={{ marginTop: 10 }}>Server database</h3>
                {p.db_edits.map((e, i) => <div key={i} className="small" style={{ color: "var(--bad)" }}>{e}</div>)}
                <button className="btn danger" onClick={() => props.onTamper(p)}>Edit the record in the database</button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
