import { getProfileCoins, setApiKey } from "@zoralabs/coins-sdk";
import fs from "fs";

const identifier = process.env.ZORA_IDENTIFIER || "jaywisdom.base.eth";
const count = Number(process.env.ZORA_COUNT || 50);

// Optional API key reduces rate-limit pressure
if (process.env.ZORA_API_KEY) {
  setApiKey(process.env.ZORA_API_KEY);
}

/**
 * Exponential backoff with jitter for rate-limited (and transient) calls.
 * Detects 429 / rate-limit style errors and respects Retry-After when present.
 */
async function withBackoff(fn, opts = {}) {
  const {
    maxRetries = 8,
    baseDelayMs = 1000,
    maxDelayMs = 60_000,
    jitter = true,
  } = opts;

  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;

      const status =
        err?.status ??
        err?.response?.status ??
        err?.statusCode ??
        err?.cause?.status;

      const message = String(err?.message || err || "");
      const isRateLimit =
        status === 429 ||
        /rate.?limit|too many requests|429/i.test(message);

      if (!isRateLimit || attempt > maxRetries) {
        throw err;
      }

      // Exponential delay: base * 2^(attempt-1), capped
      let delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);

      // Full jitter (0.5x – 1.5x)
      if (jitter) {
        delay = delay * (0.5 + Math.random());
      }

      // Honor Retry-After header when the SDK/transport surfaces it
      const retryAfterRaw =
        err?.headers?.["retry-after"] ??
        err?.response?.headers?.["retry-after"] ??
        err?.cause?.headers?.["retry-after"];

      if (retryAfterRaw != null) {
        const secs = Number(retryAfterRaw);
        if (!Number.isNaN(secs) && secs > 0) {
          delay = Math.max(delay, secs * 1000);
        }
      }

      console.log(
        JSON.stringify({
          event: "rate_limit_backoff",
          attempt,
          delay_ms: Math.round(delay),
          max_retries: maxRetries,
          status: status ?? null,
        })
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

function chainName(chainId) {
  if (chainId === 8453) return "base";
  if (chainId === 1) return "ethereum";
  return `chain-${chainId}`;
}

function words(...parts) {
  const out = new Set();
  for (const part of parts) {
    if (!part) continue;
    String(part)
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .split(" ")
      .map((x) => x.trim().toLowerCase())
      .filter((x) => x.length > 2)
      .forEach((x) => out.add(x));
  }
  return [...out].sort();
}

function normalizeNode(node) {
  const image =
    node?.mediaContent?.previewImage?.medium ||
    node?.mediaContent?.previewImage?.small ||
    node?.mediaContent?.originalUri ||
    "";

  const contract = node?.address || "";
  const chain = chainName(node?.chainId);
  const tokenId = node?.id || contract;

  return {
    title: node?.name || node?.symbol || "Untitled Zora Coin",
    description: node?.description || "",
    image_uri: image,
    zora_url: contract
      ? `https://zora.co/coin/base:${contract}`
      : "https://zora.co/@jaywisdom",
    contract,
    token_id: tokenId,
    chain,
    tx_hash: "",
    created_at: node?.createdAt || null,
    themes: words("zora base", node?.coinType, node?.symbol),
    query_aliases: words(
      node?.name,
      node?.description,
      node?.symbol,
      contract
    ),
  };
}

let after = undefined;
let page = 0;
let allEdges = [];
let lastResponse = null;

while (true) {
  page += 1;

  const response = await withBackoff(() =>
    getProfileCoins({
      identifier,
      count,
      after,
    })
  );

  lastResponse = response;

  const createdCoins = response?.data?.profile?.createdCoins;
  const edges = createdCoins?.edges || [];
  const pageInfo = createdCoins?.pageInfo || {};

  allEdges.push(...edges);

  console.log(
    JSON.stringify({
      page,
      edges: edges.length,
      total_edges: allEdges.length,
      hasNextPage: !!pageInfo.hasNextPage,
      endCursor: pageInfo.endCursor ? "present" : null,
    })
  );

  if (!pageInfo.hasNextPage || !pageInfo.endCursor || edges.length === 0) {
    break;
  }

  after = pageInfo.endCursor;
}

fs.writeFileSync(
  "discovery/zora/latest_profile_coins_response.json",
  JSON.stringify(lastResponse, null, 2)
);

fs.writeFileSync(
  "discovery/zora/latest_profile_coins_edges.json",
  JSON.stringify(allEdges, null, 2)
);

const items = allEdges
  .map((edge) => normalizeNode(edge.node))
  .filter((x) => x.contract);

fs.writeFileSync("data/live_zora_items.json", JSON.stringify(items, null, 2));

console.log(
  JSON.stringify(
    {
      ok: true,
      identifier,
      page_size: count,
      pages: page,
      exported: items.length,
      raw_receipt: "discovery/zora/latest_profile_coins_response.json",
      raw_edges: "discovery/zora/latest_profile_coins_edges.json",
      normalized: "data/live_zora_items.json",
    },
    null,
    2
  )
);
