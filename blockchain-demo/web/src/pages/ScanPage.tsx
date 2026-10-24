import { useEffect, useRef, useState } from "react";
import type { Ctx } from "../App";
import { api } from "../api";
import type { ScanResult, ShelfTag, Tag } from "../types";
import { randomChipSerial } from "../util";

export default function ScanPage({ ctx }: { ctx: Ctx }) {
  const { shelf, setShelf, monitor, notify } = ctx;
  const [selectedId, setSelectedId] = useState<string>("");
  const [nodeId, setNodeId] = useState("");
  const [trustDb, setTrustDb] = useState(true);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [fakeItem, setFakeItem] = useState(false);
  const [busy, setBusy] = useState(false);

  const selected = shelf.find((t) => t.id === selectedId) ?? shelf[0];

  // Whenever the shelf is empty (first visit, or the app dropped tags from another network), offer every
  // registered product's tag so a scan is one click away. Skipped if the user emptied the shelf themselves.
  const userEmptied = useRef(false);
  useEffect(() => {
    if (userEmptied.current || shelf.length > 0) return;
    const withTags = ctx.products.filter((p) => p.tag);
    if (withTags.length === 0) return;
    setShelf(() => withTags.map((p) => ({ id: `${p.product_id}-seed`, label: `${p.name} (${p.product_id})`, data: p.tag! })));
  }, [ctx.products, shelf.length, setShelf]);

  const update = (id: string, patch: (t: ShelfTag) => ShelfTag) => setShelf((prev) => prev.map((t) => (t.id === id ? patch(t) : t)));

  const send = async (tag: Tag, shelfId?: string) => {
    setBusy(true);
    setResult(null);
    try {
      const res = await api<ScanResult>("/scan", "POST", { tag, node_id: nodeId || null, trust_database: trustDb });
      setResult(res);
      // The record moves up by one once the network accepts the scan; the chip shows the same new value.
      if (shelfId && (res.verdict === "genuine" || res.verdict === "unconfirmed")) {
        update(shelfId, (t) => ({ ...t, data: { ...t.data, read_counter: tag.read_counter + 1 } }));
      }
      ctx.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const reloadFromProducts = () => {
    const withTags = ctx.products.filter((p) => p.tag);
    userEmptied.current = false;
    setShelf(() => withTags.map((p) => ({ id: `${p.product_id}-reload`, label: `${p.name} (${p.product_id})`, data: p.tag! })));
    setSelectedId("");
    setResult(null);
    notify(withTags.length ? `Loaded ${withTags.length} tag(s) from the registered products` : "No registered products have a tag yet", withTags.length ? "ok" : "error");
  };

  if (!selected) {
    return (
      <div className="card stack">
        <div>No tags yet. Register a product on the Products tab and its tag appears here.</div>
        <div className="row"><button className="btn" onClick={reloadFromProducts}>Load tags from registered products</button></div>
      </div>
    );
  }

  const setField = (key: keyof Tag, raw: string) =>
    update(selected.id, (t) => ({ ...t, data: { ...t.data, [key]: key === "write_counter" || key === "read_counter" ? Number(raw) || 0 : raw } }));

  /** A tap: the phone sends exactly what the chip shows. */
  const tap = (onFake = false) => {
    const sent = selected.data;
    update(selected.id, (t) => ({ ...t, lastSent: sent }));
    setFakeItem(onFake);
    send(sent, selected.id);
  };
  const sendAsIs = () => {
    const sent = selected.data;
    update(selected.id, (t) => ({ ...t, lastSent: sent }));
    setFakeItem(false);
    send(sent, selected.id);
  };
  const replay = () => {
    if (!selected.lastSent) return;
    setFakeItem(false);
    send(selected.lastSent);
  };
  const clone = () => {
    const copy: ShelfTag = {
      id: `clone-${Date.now()}`,
      label: `Clone of ${selected.label}`,
      data: { ...selected.data, tag_id: randomChipSerial() },
    };
    setShelf((prev) => [...prev, copy]);
    setSelectedId(copy.id);
    notify("Copied the tag's data onto a blank chip. The new chip has its own serial number.");
  };

  return (
    <div className="grid two">
      <div className="stack">
        <div className="card stack">
          <div className="row between">
            <h2 style={{ margin: 0 }}>Tags on the shelf</h2>
            <button className="btn" onClick={reloadFromProducts} title="Replace the shelf with a fresh tag for every registered product">Reload from products</button>
          </div>
          <div className="small muted">A tag is a signed label on a chip. The signature covers the product ID and the chip's serial number; the counters are not signed.</div>
          {shelf.map((t) => (
            <div key={t.id} className="row between">
              <button className={`btn ${t.id === selected.id ? "primary" : ""}`} onClick={() => setSelectedId(t.id)}>{t.label}</button>
              <button className="btn" aria-label="remove tag" onClick={() => { userEmptied.current = shelf.length <= 1; setShelf((prev) => prev.filter((x) => x.id !== t.id)); }}>×</button>
            </div>
          ))}
        </div>

        <div className="card stack">
          <h2>What the phone reads</h2>
          {(["product_id", "tag_id", "write_counter", "read_counter", "signature"] as (keyof Tag)[]).map((k) => (
            <label key={k} className="field">{k.replace("_", " ")}
              <input type="text" className="mono" value={String(selected.data[k])} onChange={(e) => setField(k, e.target.value)} />
            </label>
          ))}
          <div className="row">
            <button className="btn primary" disabled={busy} onClick={() => tap()}>Tap the tag</button>
            <button className="btn" disabled={busy} onClick={sendAsIs}>Send exactly as shown</button>
          </div>
          <h3>Attacks</h3>
          <div className="row">
            <button className="btn" onClick={clone}>Copy onto a blank chip</button>
            <button className="btn" disabled={busy || !selected.lastSent} onClick={replay}>Replay the last scan</button>
            <button className="btn" disabled={busy} onClick={() => tap(true)}>Move the real tag to a fake item</button>
          </div>
          <div className="small muted">Edit any field above to simulate someone changing the tag's contents, then press "Send exactly as shown".</div>
          <h3>Who answers</h3>
          <div className="row">
            <label className="row small">Read from
              <select value={nodeId} onChange={(e) => setNodeId(e.target.value)}>
                <option value="">the majority</option>
                {(monitor?.nodes ?? []).filter((n) => n.online).map((n) => <option key={n.id} value={n.id}>{n.name} (height {n.height})</option>)}
              </select>
            </label>
            <label className="row small"><input type="checkbox" checked={trustDb} onChange={(e) => setTrustDb(e.target.checked)} />Trust the server database</label>
          </div>
          <div className="small muted">Untick the database to see the chain catch an attack on its own. Pick a lagging or faulty node to see why a single node's answer is only as good as that node.</div>
        </div>
      </div>

      <div className="stack">
        <div className="card">
          <h2>Result</h2>
          {busy && <div className="muted">Checking… the counter update waits for the network to agree.</div>}
          {!busy && !result && <div className="muted">Tap a tag to run the authenticity check.</div>}
          {result && (
            <div className="stack">
              <div className={`banner ${result.verdict === "genuine" ? "good" : result.verdict === "unconfirmed" ? "warn" : "bad"}`}>{result.summary}</div>
              {result.attack !== "none" && <div><span className="pill bad">{result.attack.replace("_", " ")}</span></div>}
              {result.verdict === "genuine" && fakeItem && (
                <div className="banner warn">
                  This tag is genuine, but it may now be on a fake item. Nothing here can see the physical object: that is the oracle problem.
                </div>
              )}
              {result.verdict === "genuine" && result.sold && <div className="banner warn">This product is already sold.</div>}
              <div>
                {result.layers.map((l, i) => (
                  <div className="layer" key={i}>
                    <div className={`mark ${l.ok === true ? "ok" : l.ok === false ? "no" : ""}`}>{l.ok === true ? "✓" : l.ok === false ? "✗" : "–"}</div>
                    <div>
                      <b>{l.name}</b>
                      <div className="small">{l.detail}</div>
                      {l.recovered_signer !== undefined && (
                        <div className="small muted">signer recovered from the tag: <b>{l.recovered_signer ?? "—"}</b> · registered: <b>{l.registered_signer ?? "—"}</b></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="small muted">
                The contract read was answered by <b>{result.answered_by.name}</b> alone (height {result.answered_by.height}).
                {result.verdict === "genuine" && " The counter update was agreed by the whole network."}
                {result.owner && <> Current owner: <b>{result.owner}</b>.</>}
                {result.failure_logged_tx && <> The failure was logged on the product.</>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
