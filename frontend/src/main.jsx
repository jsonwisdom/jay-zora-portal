import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const PAGE_SIZE = 12;
const INDEX_URL = `${import.meta.env.BASE_URL}zora-index.json`;
const IDENTITY_URL = `${import.meta.env.BASE_URL}identity-index.json`;
const FLYWHEEL_COIN_URL = "https://zora.co/coin/base:0x5e35e630356a1b24d1b45078918ea60ef98e915a?referrer=0x829adfedbe565f9885a7ea6bc78912acaef055e2";
const GITHUB_DIRECT_URL = "https://github.com/jsonwisdom/jay-zora-portal";
const SOLUTION_ROOT_URL = "https://github.com/jsonwisdom/jay-zora-portal/blob/live-zora-ingestion/SOLUTION_ROOT_ENS_SCHEMA_ATTEST_VERIFIER.md";
const MERKLE_REBOOT_URL = "https://github.com/jsonwisdom/jay-zora-portal/blob/live-zora-ingestion/MERKLE_REBOOT_RECEIPT.md";

const MODES = {
  observe: { title: "Observe Everything", text: "Live Zora relics, identity anchors, and public proof surfaces become visible in one control wall." },
  record: { title: "Record Everything", text: "GitHub Direct turns culture into public artifacts: commits, JSON indexes, receipts, and trigger files." },
  replay: { title: "Replay Anything", text: "The archive becomes a searchable memory surface: mint → mirror → index → verify → reputation." },
  verify: { title: "Verify Everything", text: "ENS, schema, attestation, verifier, GitHub Pages, and Base links form the proof path." },
  build: { title: "Build Legacy", text: "JaySpace is not a feed. It is a living proof-native internet shrine with daily updates." },
};

const PROOF_REPOS = [
  ["jay-zora-portal", "JaySpace public proof wall", GITHUB_DIRECT_URL],
  ["COMPUTERWISDOM", "Machine-speed execution + replay", "https://github.com/jsonwisdom/COMPUTERWISDOM"],
  ["AL", "Constitutional runtime + attestations", "https://github.com/jsonwisdom/AL"],
  ["receipts-engine-v1", "Receipt kernel candidate", "https://github.com/jsonwisdom/receipts-engine-v1"],
  ["verifygate", "Public verification doorway", "https://github.com/jsonwisdom/verifygate"],
];

const MECHANICS = ["ENS", "Schema", "Attestation", "Verifier", "GitHub Direct", "Public Site", "Reputation"];

function short(v) {
  if (!v) return "missing";
  const s = String(v);
  return s.length > 14 ? `${s.slice(0, 8)}…${s.slice(-6)}` : s;
}

function normalizeMediaUri(uri) {
  if (!uri || typeof uri !== "string") return "";
  if (uri.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${uri.replace("ipfs://", "")}`;
  if (uri.startsWith("ar://")) return `https://arweave.net/${uri.replace("ar://", "")}`;
  return uri;
}

function imageFor(art) {
  return normalizeMediaUri([
    art.image_uri, art.image, art.image_url, art.imageUrl, art.media_url,
    art.media?.url, art.media?.uri, art.thumbnail_url, art.preview_image_url,
    art.metadata?.image, art.metadata?.image_url, art.metadata?.animation_url,
  ].find(Boolean));
}

function textFor(art) {
  return [art.title, art.description, art.contract, art.token_id, art.tx_hash, art.chain, ...(art.themes || []), ...(art.query_aliases || [])].filter(Boolean).join(" ").toLowerCase();
}

function ArtImage({ art }) {
  const [failed, setFailed] = useState(false);
  const src = imageFor(art);
  if (!src || failed) return <div className="image-fallback"><span>🧾</span><strong>Receipt Indexed</strong><small>media resolver pending</small></div>;
  return <img src={src} alt={art.title || "Artwork"} loading="lazy" onError={() => setFailed(true)} />;
}

function App() {
  const [q, setQ] = useState("");
  const [allItems, setAllItems] = useState([]);
  const [identities, setIdentities] = useState([]);
  const [status, setStatus] = useState("loading static index…");
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [mode, setMode] = useState("observe");

  useEffect(() => {
    async function loadIndex() {
      try {
        const [indexRes, identityRes] = await Promise.all([fetch(INDEX_URL, { cache: "no-store" }), fetch(IDENTITY_URL, { cache: "no-store" })]);
        const data = JSON.parse(await indexRes.text());
        const rows = Array.isArray(data) ? data : data.results || [];
        setAllItems(rows);
        if (identityRes.ok) setIdentities(JSON.parse(await identityRes.text()) || []);
        setStatus(`${rows.length} relics loaded · ${rows.filter(imageFor).length} media hints · GitHub Direct static index`);
      } catch (err) {
        setStatus(`error loading static index: ${err.message}`);
      } finally { setLoading(false); }
    }
    loadIndex();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return allItems;
    return allItems.filter((art) => textFor(art).includes(needle));
  }, [allItems, q]);

  const featured = useMemo(() => allItems.filter(imageFor).slice(0, 4).concat(allItems.slice(0, 4)).slice(0, 4), [allItems]);
  const pageItems = filtered.slice(offset, offset + PAGE_SIZE);
  const nextOffset = offset + PAGE_SIZE < filtered.length ? offset + PAGE_SIZE : null;
  const prevOffset = offset > 0 ? Math.max(offset - PAGE_SIZE, 0) : null;

  function runSearch() { setOffset(0); setStatus(`${filtered.length} matching relics in static GitHub index`); }

  return (
    <main>
      <header className="control-room">
        <section className="hero hero-machine">
          <div className="brand">🦊⚙️🧾 JaySpace2026 Intelligence Index</div>
          <h1>Receipt Machine</h1>
          <p className="lead">Art wall. Proof wall. Link hub. Witness archive. A boyish-cool cyberpunk control room for culture that can be observed, replayed, and verified.</p>
          <div className="hero-actions">
            <a className="primary-link" href={FLYWHEEL_COIN_URL} target="_blank" rel="noreferrer">Live Zora Ignition</a>
            <a className="secondary-link" href={GITHUB_DIRECT_URL} target="_blank" rel="noreferrer">GitHub Direct Mirror</a>
          </div>
          <div className="ticker">MINT → MIRROR → INDEX → VERIFY → REPUTATION</div>
        </section>

        <section className="machine-console" aria-label="Playable receipt machine">
          <div className="receipt-roll">
            <span>$FLYWHEEL</span>
            <strong>TRUTH IN<br />RECEIPT OUT</strong>
            <small>{status}</small>
          </div>
          <div className="mode-screen">
            <span className="eyebrow">Playable Console</span>
            <h2>{MODES[mode].title}</h2>
            <p>{MODES[mode].text}</p>
            <div className="mode-buttons">
              {Object.keys(MODES).map((key) => <button key={key} className={mode === key ? "active" : ""} onClick={() => setMode(key)}>{key}</button>)}
            </div>
          </div>
        </section>
      </header>

      <section className="stats-strip">
        <div><strong>{allItems.length}</strong><span>Relics Indexed</span></div>
        <div><strong>{identities.length}</strong><span>Identity Anchors</span></div>
        <div><strong>{allItems.filter(imageFor).length}</strong><span>Media Hints</span></div>
        <div><strong>Daily</strong><span>GitHub Refresh</span></div>
      </section>

      <section className="machine-panel invariant-wall">
        <div className="machine-copy">
          <span className="eyebrow">Final Invariant</span>
          <h2>If culture can be replayed, culture can be audited.</h2>
          <p>If culture can be audited, reputation becomes observable. If reputation becomes observable, truth gains economic gravity.</p>
        </div>
        <div className="repo-grid">{MECHANICS.map((m) => <div className="repo-card" key={m}><strong>{m}</strong><span>active layer</span></div>)}</div>
      </section>

      <section className="machine-panel featured-wall">
        <div className="machine-copy"><span className="eyebrow">Featured Relics</span><h2>Newest visual proof surfaces.</h2><p>The archive stays searchable below. The homepage shows the signal first.</p></div>
        <div className="mini-grid">{featured.map((art, i) => <article className="mini-card" key={`${art.contract}-${i}`}><ArtImage art={art} /><strong>{art.title || "Untitled"}</strong>{art.zora_url && <a href={art.zora_url} target="_blank" rel="noreferrer">Open</a>}</article>)}</div>
      </section>

      <section className="machine-panel">
        <div className="machine-copy"><span className="eyebrow">Everything In Between</span><h2>Functional links, live data, daily updates.</h2><p>GitHub Pages is the public membrane. COMPUTERWISDOM is the machine-speed layer. AL is the constitutional runtime.</p><div className="hero-actions compact-actions"><a className="secondary-link" href={SOLUTION_ROOT_URL} target="_blank" rel="noreferrer">Solution Root</a><a className="secondary-link" href={MERKLE_REBOOT_URL} target="_blank" rel="noreferrer">Merkle Receipt</a></div></div>
        <div className="repo-grid">{PROOF_REPOS.map(([name, role, url]) => <a key={name} href={url} target="_blank" rel="noreferrer" className="repo-card"><strong>{name}</strong><span>{role}</span></a>)}</div>
      </section>

      <section className="identity-grid">{identities.map((id) => <a className="identity-card" key={id.name} href={id.url} target="_blank" rel="noreferrer"><div className="identity-type">{id.type}</div><h3>{id.name}</h3><p>{id.description}</p><div className="identity-meta"><span>{id.network}</span>{id.address && <code>{short(id.address)}</code>}</div></a>)}</section>

      <section className="archive-head"><span className="eyebrow">Receipt Archive</span><h2>Search the full intelligence index.</h2></section>
      <section className="search"><input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runSearch()} placeholder="Search goblin court, receipt machine, Base, Zora, ENS, verifier, replay..." /><button disabled={loading} onClick={runSearch}>{loading ? "Loading…" : "Search"}</button></section>
      <div className="status">{status} · showing {pageItems.length} of {filtered.length} · offset {offset}</div>
      <section className="pager"><button disabled={loading || prevOffset === null} onClick={() => setOffset(prevOffset)}>Previous</button><span>Page {Math.floor(offset / PAGE_SIZE) + 1} / {Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))}</span><button disabled={loading || nextOffset === null} onClick={() => setOffset(nextOffset)}>Next</button></section>

      <section className="grid">{pageItems.map((art, i) => <article className="card" key={`${art.contract}-${art.token_id}-${i}`}><div className="image"><ArtImage art={art} /></div><div className="body"><h2>{art.title || "Untitled Relic"}</h2><p>{art.description || "No description."}</p><div className="tags">{(art.themes || []).slice(0, 6).map((t) => <span key={t}>{t}</span>)}</div><div className="meta"><code>{short(art.contract)}</code><code>#{short(art.token_id)}</code></div><div className="actions">{art.zora_url && <a href={art.zora_url} target="_blank" rel="noreferrer">View on Zora</a>}{art.tx_hash && art.tx_hash !== "0xseed" && <a href={`https://basescan.org/tx/${art.tx_hash}`} target="_blank" rel="noreferrer">Receipt</a>}</div></div></article>)}</section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
