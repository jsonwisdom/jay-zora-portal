import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const PAGE_SIZE = 20;
const INDEX_URL = `${import.meta.env.BASE_URL}zora-index.json`;
const IDENTITY_URL = `${import.meta.env.BASE_URL}identity-index.json`;

const FLYWHEEL_COIN_URL =
  "https://zora.co/coin/base:0x236a0c4ebfc18a1a7dd24fd7c11c288db2ecdd55?referrer=0x829adfedbe565f9885a7ea6bc78912acaef055e2";

const PROOF_REPOS = [
  {
    name: "AL",
    role: "Constitutional receipt machine",
    url: "https://github.com/jsonwisdom/AL",
  },
  {
    name: "COMPUTERWISDOM",
    role: "Machine-speed execution and replay layer",
    url: "https://github.com/jsonwisdom/COMPUTERWISDOM",
  },
  {
    name: "jay-zora-portal",
    role: "Culture index and public mirror",
    url: "https://github.com/jsonwisdom/jay-zora-portal",
  },
  {
    name: "receipts-engine-v1",
    role: "Receipt kernel candidate",
    url: "https://github.com/jsonwisdom/receipts-engine-v1",
  },
  {
    name: "verifygate",
    role: "Public verification doorway",
    url: "https://github.com/jsonwisdom/verifygate",
  },
];

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
  const [identities, setIdentities] = useState([]);
  const [status, setStatus] = useState("loading static index…");
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    async function loadIndex() {
      try {
        const [indexRes, identityRes] = await Promise.all([
          fetch(INDEX_URL, { cache: "no-store" }),
          fetch(IDENTITY_URL, { cache: "no-store" }),
        ]);

        const indexText = await indexRes.text();
        if (!indexRes.ok) throw new Error(`index ${indexRes.status}: ${indexText.slice(0, 120)}`);

        const data = JSON.parse(indexText);
        const rows = Array.isArray(data) ? data : data.results || [];
        setAllItems(rows);

        if (identityRes.ok) {
          const identityText = await identityRes.text();
          const ids = JSON.parse(identityText);
          setIdentities(Array.isArray(ids) ? ids : []);
        }

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
        <h1>Zora Dual Anchored Flywheel</h1>
        <p className="lead">
          This is not a token. This is a receipt machine. The legacy system is a black box. Mint → Mirror → Index → Verify → Reputation is the key.
        </p>

        <div className="hero-actions">
          <a className="primary-link" href={FLYWHEEL_COIN_URL} target="_blank" rel="noreferrer">
            Mint $FLYWHEEL on Zora
          </a>
          <a className="secondary-link" href="https://github.com/jsonwisdom" target="_blank" rel="noreferrer">
            Open GitHub Mirror
          </a>
        </div>

        <section className="proof-banner" aria-label="Receipt machine canon">
          <div>
            <span className="eyebrow">Receipt Machine Canon</span>
            <h2>Mint truth. Mirror receipts. Verify everything.</h2>
            <p>
              Every $FLYWHEEL mint is treated as a public proof event: culture enters through Zora, anchors on Base, mirrors to GitHub, and becomes searchable reputation.
            </p>
          </div>
          <ol className="flow-list" aria-label="Proof flow">
            <li>Mint</li>
            <li>Mirror</li>
            <li>Index</li>
            <li>Verify</li>
            <li>Reputation</li>
          </ol>
        </section>

        <section className="identity-grid" aria-label="Public identity anchors">
          {identities.map((id) => (
            <a className="identity-card" key={id.name} href={id.url} target="_blank" rel="noreferrer">
              <div className="identity-type">{id.type}</div>
              <h3>{id.name}</h3>
              <p>{id.description}</p>
              <div className="identity-meta">
                <span>{id.network}</span>
                {id.address && <code>{short(id.address)}</code>}
              </div>
            </a>
          ))}
        </section>
      </header>

      <section className="machine-panel" aria-label="Verification layer for culture">
        <div className="machine-copy">
          <span className="eyebrow">Verification Layer for Culture</span>
          <h2>Public claims meet public receipts.</h2>
          <p>
            This portal connects Jay Wisdom’s Zora creator surface to ENS identity, Base verification, GitHub mirrors, replay receipts, and machine-speed audit paths.
          </p>
        </div>
        <div className="repo-grid">
          {PROOF_REPOS.map((repo) => (
            <a key={repo.name} href={repo.url} target="_blank" rel="noreferrer" className="repo-card">
              <strong>{repo.name}</strong>
              <span>{repo.role}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="search">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          placeholder="Search receipt machine, Base, Zora, goblin court, replay..."
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
