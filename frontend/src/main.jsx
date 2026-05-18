import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_BASE = "";
const PAGE_SIZE = 20;

function short(v) {
  if (!v) return "missing";
  const s = String(v);
  return s.length > 14 ? `${s.slice(0, 8)}…${s.slice(-6)}` : s;
}

function App() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("ready");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState({
    total: 0,
    count: 0,
    limit: PAGE_SIZE,
    offset: 0,
    next_offset: null,
    prev_offset: null,
  });

  async function search(value = q, offset = 0) {
    setLoading(true);
    setStatus("searching…");

    try {
      const params = new URLSearchParams({
        q: value || "",
        limit: String(PAGE_SIZE),
        offset: String(offset || 0),
      });

      const res = await fetch(`${API_BASE}/search?${params.toString()}`);
      const text = await res.text();

      if (!res.ok) {
        throw new Error(`API ${res.status}: ${text.slice(0, 120)}`);
      }

      const data = JSON.parse(text);

      setItems(data.results || []);
      setPage({
        total: data.total || 0,
        count: data.count || 0,
        limit: data.limit || PAGE_SIZE,
        offset: data.offset || 0,
        next_offset: data.next_offset ?? null,
        prev_offset: data.prev_offset ?? null,
      });

      setStatus(`${data.count || 0} shown of ${data.total || 0} relics`);
    } catch (err) {
      setStatus(`error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    search("", 0);
  }, []);

  return (
    <main>
      <header className="hero">
        <div className="brand">🦊⚙️🧾 Wisdom R&amp;D</div>
        <h1>Jay Wisdom Portal — L2 Creator Index</h1>
        <p>Search Jay’s Zora drops by title, description, themes, aliases, contract, token ID, and receipt metadata.</p>
      </header>

      <section className="search">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search(q, 0)}
          placeholder="Search goblin court, receipt machine, Base meme fox..."
        />
        <button disabled={loading} onClick={() => search(q, 0)}>
          {loading ? "Loading…" : "Search"}
        </button>
      </section>

      <div className="status">{status} · offset {page.offset}</div>

      <section className="pager">
        <button disabled={loading || page.prev_offset === null} onClick={() => search(q, page.prev_offset)}>
          Previous
        </button>
        <span>
          Page {Math.floor(page.offset / page.limit) + 1} / {Math.max(1, Math.ceil(page.total / page.limit))}
        </span>
        <button disabled={loading || page.next_offset === null} onClick={() => search(q, page.next_offset)}>
          Next
        </button>
      </section>

      <section className="grid">
        {items.map((art, i) => (
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
                <a
                  href={`https://zora.co/search?q=${encodeURIComponent(art.contract || art.title || "jaywisdom")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Search on Zora
                </a>
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
