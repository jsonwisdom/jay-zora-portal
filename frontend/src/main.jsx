import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const PAGE_SIZE = 20;
const INDEX_URL = `${import.meta.env.BASE_URL}zora-index.json`;
const IDENTITY_URL = `${import.meta.env.BASE_URL}identity-index.json`;

const FLYWHEEL_COIN_URL =
  "https://zora.co/coin/base:0x5e35e630356a1b24d1b45078918ea60ef98e915a?referrer=0x829adfedbe565f9885a7ea6bc78912acaef055e2";

const GITHUB_DIRECT_URL = "https://github.com/jsonwisdom/jay-zora-portal";
const SOLUTION_ROOT_URL =
  "https://github.com/jsonwisdom/jay-zora-portal/blob/live-zora-ingestion/SOLUTION_ROOT_ENS_SCHEMA_ATTEST_VERIFIER.md";
const MERKLE_REBOOT_URL =
  "https://github.com/jsonwisdom/jay-zora-portal/blob/live-zora-ingestion/MERKLE_REBOOT_RECEIPT.md";

const PROOF_REPOS = [
  {
    name: "jay-zora-portal",
    role: "JaySpace public proof wall and GitHub Direct mirror",
    url: "https://github.com/jsonwisdom/jay-zora-portal",
  },
  {
    name: "COMPUTERWISDOM",
    role: "Machine-speed execution, replay, and verifier memory",
    url: "https://github.com/jsonwisdom/COMPUTERWISDOM",
  },
  {
    name: "AL",
    role: "Constitutional runtime, receipts, schemas, and attestations",
    url: "https://github.com/jsonwisdom/AL",
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

const MECHANICS = [
  ["ENS", "Public identity and pointer layer"],
  ["Schema", "Machine-readable claim shape"],
  ["Attestation", "Signed claim event"],
  ["Verifier", "Replay and check engine"],
  ["GitHub Direct", "Public observation surface"],
  ["Public Site", "Readable proof membrane"],
  ["Reputation", "Replayable social memory"],
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
        <div className="brand">🦊⚙️🧾 JaySpace by JayWisdom</div>
        <h1>JaySpace: Themed Public Proof Wall</h1>
        <p className="lead">
          Not social media. Social evidence. A personal web shrine wired like a verification machine: ENS identity, Zora culture, Base anchors, GitHub receipts, verifier services, and machine-speed memory.
        </p>

        <div className="hero-actions">
          <a className="primary-link" href={FLYWHEEL_COIN_URL} target="_blank" rel="noreferrer">
            Mint / View Live Zora Surface
          </a>
          <a className="secondary-link" href={GITHUB_DIRECT_URL} target="_blank" rel="noreferrer">
            Open Live GitHub Direct Mirror
          </a>
        </div>

        <section className="proof-banner" aria-label="JaySpace canon">
          <div>
            <span className="eyebrow">ZipZapSnap Canon</span>
            <h2>Mint truth. Mirror receipts. Verify everything.</h2>
            <p>
              JaySpace is the public proof profile: art wall, link hub, witness layer, receipt archive, and verification membrane in one observable GitHub Direct surface.
            </p>
          </div>
          <ol className="flow-list" aria-label="Proof flow">
            <li>Zora</li>
            <li>Witness</li>
            <li>GitHub</li>
            <li>Merkle</li>
            <li>Base</li>
            <li>Replay</li>
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

      <section className="machine-panel" aria-label="Simple mechanics and maintenance">
        <div className="machine-copy">
          <span className="eyebrow">Simple Mechanics &amp; Maintenance</span>
          <h2>ENS → Schema → Attestation → Verifier → GitHub Direct → Public Site → Replayable Reputation</h2>
          <p>
            ENS tells people where to look. Schema tells machines what a claim means. Attestation signs the claim. Verifier checks the claim. GitHub Direct lets the public observe it. The public site makes it readable.
          </p>
          <div className="hero-actions compact-actions">
            <a className="secondary-link" href={SOLUTION_ROOT_URL} target="_blank" rel="noreferrer">
              Solution Root
            </a>
            <a className="secondary-link" href={MERKLE_REBOOT_URL} target="_blank" rel="noreferrer">
              Merkle Reboot Receipt
            </a>
          </div>
        </div>
        <div className="repo-grid">
          {MECHANICS.map(([name, role]) => (
            <div key={name} className="repo-card">
              <strong>{name}</strong>
              <span>{role}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="machine-panel" aria-label="Repo placement map">
        <div className="machine-copy">
          <span className="eyebrow">Everything In Between</span>
          <h2>GitHub Direct placement map.</h2>
          <p>
            The public site is the front door. COMPUTERWISDOM is the machine-speed layer. AL is the constitutional runtime. The remaining repos are receipt and verification support surfaces.
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
          placeholder="Search JaySpace, receipt machine, Base, Zora, ENS, verifier, replay..."
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
