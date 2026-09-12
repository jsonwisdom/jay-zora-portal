import fs from "node:fs";
import crypto from "node:crypto";

const PROFILE_URL = process.env.ZORA_PROFILE_URL || "https://zora.co/@jaywisdom";
const OUT = process.env.ZORA_OUT || "data/live_zora_items.json";
const MIN_EXPECTED = Number(process.env.MIN_EXPECTED || "2");
const FORCE_LOW_COUNT = process.env.FORCE_LOW_COUNT === "1";

const headers = {
  "user-agent": "jay-zora-portal/1.0 (+https://jsonwisdom.github.io/jay-zora-portal/)",
  "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

async function fetchText(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`fetch failed ${res.status} ${url}`);
  return await res.text();
}

function decodeHtml(s = "") {
  return String(s)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function meta(html, prop) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${prop}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return decodeHtml(m[1]).trim();
  }
  return "";
}

function extractCoinLinks(html) {
  const links = new Set();
  const absolute = /https:\/\/zora\.co\/coin\/base:0x[a-fA-F0-9]{40}/g;
  const relative = /\/coin\/base:0x[a-fA-F0-9]{40}/g;
  for (const m of html.matchAll(absolute)) links.add(m[0]);
  for (const m of html.matchAll(relative)) links.add(`https://zora.co${m[0]}`);
  return [...links].map((u) => u.replace(/[?#].*$/, ""));
}

function contractFromUrl(url) {
  return (url.match(/base:(0x[a-fA-F0-9]{40})/) || [])[1]?.toLowerCase() || "";
}

function readExisting() {
  if (!fs.existsSync(OUT)) return [];
  const raw = fs.readFileSync(OUT, "utf8");
  const data = JSON.parse(raw);
  if (Array.isArray(data)) return data;
  return data.items || data.results || data.data || [];
}

function stableTokenId(contract) {
  return Buffer.from(`BASE-MAINNET.${contract}`).toString("base64");
}

async function itemFromCoinUrl(url) {
  const contract = contractFromUrl(url);
  const html = await fetchText(url);
  const title = meta(html, "og:title").replace(/\s*\|\s*Zora\s*$/i, "").trim() || contract;
  const description = meta(html, "og:description");
  const image_uri = meta(html, "og:image") || meta(html, "twitter:image");
  return {
    title,
    description,
    image_uri,
    zora_url: url,
    contract,
    token_id: stableTokenId(contract),
    chain: "base",
    tx_hash: "",
    created_at: null,
  };
}

function mergeByContract(existing, fresh) {
  const map = new Map();
  for (const item of existing) {
    const key = String(item.contract || item.zora_url || item.token_id || crypto.randomUUID()).toLowerCase();
    map.set(key, item);
  }
  for (const item of fresh) {
    const key = String(item.contract || item.zora_url || item.token_id).toLowerCase();
    const old = map.get(key) || {};
    map.set(key, { ...old, ...item, description: item.description || old.description || "", image_uri: item.image_uri || old.image_uri || "" });
  }
  return [...map.values()].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")) || String(a.title || "").localeCompare(String(b.title || "")));
}

async function main() {
  const existing = readExisting();
  console.log(`EXISTING_COUNT=${existing.length}`);
  const profileHtml = await fetchText(PROFILE_URL);
  const links = extractCoinLinks(profileHtml);
  console.log(`PROFILE_COIN_LINKS_FOUND=${links.length}`);

  const fresh = [];
  for (const url of links) {
    try {
      fresh.push(await itemFromCoinUrl(url));
      console.log(`OK ${url}`);
    } catch (err) {
      console.log(`WARN ${url} ${err.message}`);
    }
  }

  const merged = mergeByContract(existing, fresh);
  if (merged.length < MIN_EXPECTED && !FORCE_LOW_COUNT) {
    throw new Error(`refusing to publish low-count index: ${merged.length} < ${MIN_EXPECTED}`);
  }

  fs.mkdirSync(OUT.split("/").slice(0, -1).join("/"), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(merged, null, 2) + "\n");
  const sha256 = crypto.createHash("sha256").update(fs.readFileSync(OUT)).digest("hex");
  console.log(`FINAL_COUNT=${merged.length}`);
  console.log(`SHA256=${sha256}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
