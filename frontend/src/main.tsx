import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BASE_WALLET, JAYWISDOM_COIN, baseScanUrl, loadIndex, loadReceipt, type Activity, type Listing, type SourceState, zoraUrl } from "./zora";
import "./styles.css";

const short = (text: string | null) => !text ? "—" : `${text.slice(0, 8)}…${text.slice(-6)}`;
const date = (value: string | null) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not bound";

function Status({ state }: { state: SourceState }) { return <span className={`status ${state.toLowerCase()}`}>{state}</span>; }

function App() {
  const [index, setIndex] = useState<{ listings: Listing[]; state: SourceState; note: string }>({ listings: [], state: "HOLD", note: "Loading source adapter…" });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [receipt, setReceipt] = useState<Listing | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  useEffect(() => { loadIndex().then((result) => setIndex({ listings: result.listings, state: result.sourceState, note: result.sourceNote })); }, []);
  const filtered = useMemo(() => index.listings.filter((listing) => {
    const haystack = `${listing.name} ${listing.symbol ?? ""} ${listing.description ?? ""} ${listing.address ?? ""}`.toLowerCase();
    return (filter === "all" || listing.kind === filter || (filter === "contract" && Boolean(listing.address))) && haystack.includes(query.toLowerCase());
  }), [index.listings, query, filter]);
  const featured = index.listings.find((item) => item.address?.toLowerCase() === JAYWISDOM_COIN.toLowerCase()) ?? index.listings[0];

  async function openReceipt(listing: Listing) {
    setReceipt(listing); setActivity([]); setLoadingReceipt(true);
    const detail = await loadReceipt(listing); setReceipt(detail.listing); setActivity(detail.activity); setLoadingReceipt(false);
  }
  async function copy(text: string | null) { if (text) await navigator.clipboard?.writeText(text); }
  async function share(listing: Listing) {
    const url = zoraUrl(listing); if (navigator.share) await navigator.share({ title: listing.name, url }); else await copy(url);
  }

  return <main>
    <header className="topbar"><a className="brand" href="https://zora.co/@jaywisdom" target="_blank" rel="noreferrer">JAYWISDOM <i>Zora Index</i></a><div className="observer"><Status state={index.state} /><span>{index.note}</span></div></header>
    <section className="hero"><p className="eyebrow">PUBLIC EVIDENCE / GALLERY CONSOLE · BASE 8453</p><h1>What is listed is visible.<br /><em>What is uncertain stays marked.</em></h1><p className="lede">A thin source adapter around Zora Coins SDK, with a repository snapshot behind it. No storefront theater; every object can open its own receipt.</p><div className="identity"><button onClick={() => copy(BASE_WALLET)} title="Copy Base wallet">{short(BASE_WALLET)} ⧉</button><a href={baseScanUrl(BASE_WALLET) ?? "#"} target="_blank" rel="noreferrer">BaseScan ↗</a><a href="https://github.com/jsonwisdom/jay-zora-portal" target="_blank" rel="noreferrer">Source ↗</a></div></section>
    <section className="featured" aria-label="Featured coin"><div><p className="eyebrow">FEATURED / RECEIPT-FIRST</p><h2>{featured?.name ?? "JAYWISDOM"}</h2><p>{featured?.description ?? "Creator Coin observed from the locally bound receipt snapshot."}</p><div className="tags"><Status state={featured?.sourceState ?? "HOLD"} /><span>Base coin</span><span>{short(featured?.address ?? JAYWISDOM_COIN)}</span></div></div><div className="feature-actions"><button onClick={() => featured && openReceipt(featured)}>Open receipt</button><a href={featured ? zoraUrl(featured) : "https://zora.co/@jaywisdom"} target="_blank" rel="noreferrer">View Zora ↗</a></div></section>
    <section className="feature-hold"><strong>Meta Tesla Scope</strong><span>Featured slot retained as <Status state="HOLD" /> until an exact contract / tx / media receipt is source-bound.</span></section>
    <section className="toolbar"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search listings, contract, symbol…" aria-label="Search listings" /><div className="filters">{["all", "coin", "post", "collection", "contract"].map((kind) => <button key={kind} className={filter === kind ? "active" : ""} onClick={() => setFilter(kind)}>{kind}</button>)}</div></section>
    <section className="grid" aria-live="polite">{filtered.map((listing) => <article className="listing" key={listing.id}><div className="card-top"><span>{listing.kind}</span><Status state={listing.sourceState} /></div>{listing.imageUrl ? <img src={listing.imageUrl} alt="" /> : <div className="placeholder">{listing.name.slice(0, 1)}</div>}<h3>{listing.name}</h3><p className="symbol">{listing.symbol ? `$${listing.symbol}` : "No ticker bound"}</p><p className="description">{listing.description || "No description returned by this source."}</p><div className="card-meta"><code>{short(listing.address)}</code><span>{date(listing.createdAt)}</span></div><div className="card-actions"><button onClick={() => openReceipt(listing)}>Receipt</button><button onClick={() => copy(listing.address)}>Copy</button><a href={zoraUrl(listing)} target="_blank" rel="noreferrer">Zora ↗</a></div></article>)}</section>
    {!filtered.length && <p className="empty">No listing matches this filter. The source has not been extended by inference.</p>}
    {receipt && <aside className="drawer" role="dialog" aria-modal="true" aria-label="Listing receipt"><button className="close" onClick={() => setReceipt(null)}>×</button><p className="eyebrow">RECEIPT DRAWER</p><h2>{receipt.name}</h2><Status state={receipt.sourceState} /><dl><dt>Contract</dt><dd><code>{receipt.address ?? "HOLD — not source-bound"}</code><button onClick={() => copy(receipt.address)}>copy</button></dd><dt>Transaction</dt><dd>{receipt.receipt.txHash ? <a href={baseScanUrl(receipt.receipt.txHash) ?? "#"} target="_blank" rel="noreferrer">{short(receipt.receipt.txHash)} ↗</a> : "HOLD — no tx in this source"}</dd><dt>Timestamp</dt><dd>{date(receipt.createdAt)}</dd><dt>Media URI / hash</dt><dd>{receipt.tokenUri ?? receipt.receipt.mediaHash ?? "HOLD — not supplied"}</dd><dt>Source state</dt><dd>{receipt.source} / <Status state={receipt.sourceState} /></dd></dl><div className="qr"><img alt={`QR code for ${receipt.name}`} src={`https://api.qrserver.com/v1/create-qr-code/?size=132x132&data=${encodeURIComponent(zoraUrl(receipt))}`} /><div><button onClick={() => share(receipt)}>Share / copy link</button><a href={zoraUrl(receipt)} target="_blank" rel="noreferrer">Zora ↗</a></div></div><h3>Activity</h3>{loadingReceipt ? <p>Reading coin activity…</p> : activity.length ? <ul className="activity">{activity.map((event, i) => <li key={`${event.txHash}-${i}`}><strong>{event.type}</strong><span>{event.amount ?? "—"}</span><small>{date(event.timestamp)}</small></li>)}</ul> : <p>No activity returned. This is not a claim of no activity.</p>}</aside>}
  </main>;
}

createRoot(document.getElementById("root")!).render(<App />);
