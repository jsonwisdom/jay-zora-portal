import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const PAGE_SIZE = 20;
const INDEX_URL = `${import.meta.env.BASE_URL}zora-index.json`;

function short(v) {
  if (!v) return "missing";
  const s = String(v);
  return s.length > 14 ? `${s.slice(0, 8)}…${s.slice(-6)}` : s;
}

function textFor(art) {
  return [
    art.title,
    art.description,
    art.contract,
    art.token_id,
    art.tx_hash,
    art.chain,
    ...(art.themes || []),
    ...(art.query_aliases || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function App() {
  const [q, setQ] = useState("");
  const [allItems, setAllItems] = useState([]);
  const [status, setStatus] = useState("loading static index…");
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    async function loadIndex() {
      try {
        const res = await fetch(INDEX_URL, { cache: "no-store" });
        const text = await res.text();
        if (!res.ok) throw new Error(`index ${res.status}: ${text.slice(0, 120)}`);
        const data = JSON.parse(text);
        const rows = Array.isArray(data) ? data : data.results || [];
        setAllItems(rows);
        setStatus(`${rows.length} relics loaded from GitHub Pages static index`);
      } catch (err) {
        setStatus(`error loading static index: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
    loadIndex();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return allItems;
    return allItems.filter((art) => textFor(art).includes(needle));
  }, [allItems, q]);

  const pageItems = filtered.slice(offset, offset + PAGE_SIZE);
  const nextOffset = offset + PAGE_SIZE < filtered.length ? offset + PAGE_SIZE : null;
  const prevOffset = offset > 0 ? Math.max(offset - PAGE_SIZE, 0) : null;

  function runSearch() {
    setOffset(0);
    setStatus(`${filtered.length} matching relics in static GitHub index`);
  }

  return (
    <main>
      <header className="hero">
        <div className="brand">🦊⚙️🧾 Wisdom R&amp;D</div>
        <h1>Jay Wisdom Portal — L2 Creator Index</h1>
        <p>GitHub-only portal. Search Jay’s Zora drops by title, description, themes, aliases, contract, token ID, and receipt metadata.</p>
      </header>

      <section className="search">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          placeholder="Search goblin court, receipt machine, Base meme fox..."
        />
        <button disabled={loading} onClick={runSearch}>
          {loading ? "Loading…" : "Search"}
        </button>
      </section>

      <div className="status">{status} · showing {pageItems.length} of {filtered.length} · offset {offset}</div>

      <section className="pager">
        <button disabled={loading || prevOffset === null} onClick={() => setOffset(prevOffset)}>
          Previous
        </button>
        <span>
          Page {Math.floor(offset / PAGE_SIZE) + 1} / {Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))}
        </span>
        <button disabled={loading || nextOffset === null} onClick={() => setOffset(nextOffset)}>
          Next
        </button>
      </section>

      <section className="grid">
        {pageItems.map((art, i) => (
          <article className="card" key={`${art.contract}-${art.token_id}-${i}`}>
            <div className="image">
              {art.image_uri ? <img src={art.image_uri} alt={art.title || "Artwork"} /> : <span>No image yet</span>}
            </div>
            <div className="body">
              <h2>{art.title || "Untitled Relic"}</h2>
              <p>{art.description || "No description."}</p>

              <div className="tags">
                {(art.themes || []).slice(0, 6).map((t) => <span key={t}>{t}</span>)}
              </div>

              <div className="meta">
                <code>{short(art.contract)}</code>
                <code>#{short(art.token_id)}</code>
              </div>

              <div className="actions">
                {art.zora_url && (
                  <a href={art.zora_url} target="_blank" rel="noreferrer">
                    View on Zora
                  </a>
                )}
                {art.tx_hash && art.tx_hash !== "0xseed" && (
                  <a href={`https://basescan.org/tx/${art.tx_hash}`} target="_blank" rel="noreferrer">Receipt</a>
                )}
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
