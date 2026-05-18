import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

function short(v) {
  if (!v) return "missing";
  return v.length > 14 ? `${v.slice(0, 8)}…${v.slice(-6)}` : v;
}

function App() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("ready");

  async function search(value = q) {
    setStatus("searching");
    try {
      const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(value)}`);
      const data = await res.json();
      setItems(data.results || []);
      setStatus(`${data.count || 0} relics found`);
    } catch (err) {
      setStatus(`error: ${err.message}`);
    }
  }

  useEffect(() => {
    search("");
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
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Search goblin court, receipt machine, Base meme fox..."
        />
        <button onClick={() => search()}>Search</button>
      </section>

      <div className="status">{status}</div>

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
                <code>#{art.token_id}</code>
              </div>

              <div className="actions">
                {art.zora_url && <a href={art.zora_url} target="_blank" rel="noreferrer">View on Zora</a>}
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
