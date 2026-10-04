import { getProfileCoins, setApiKey } from "@zoralabs/coins-sdk";
import fs from "fs";

const identifier = process.env.ZORA_IDENTIFIER || "jaywisdom";
const count = Number(process.env.ZORA_COUNT || 50);

// Optional API key reduces rate-limit pressure
if (process.env.ZORA_API_KEY) {
  setApiKey(process.env.ZORA_API_KEY);
}

/**
 * Sequential circuit breaker.
 * States: CLOSED → OPEN → HALF_OPEN → CLOSED
 *
 * - CLOSED: normal operation; consecutive failures increment counter
 * - OPEN: fail fast until resetTimeoutMs elapses
 * - HALF_OPEN: allow one probe; success closes, failure re-opens
 */
class CircuitBreaker {
  constructor(name, opts = {}) {
    this.name = name || "default";
    this.failureThreshold = opts.failureThreshold ?? 5;
    this.resetTimeoutMs = opts.resetTimeoutMs ?? 30_000;
    this.successThreshold = opts.successThreshold ?? 1;

    this.state = "CLOSED"; // CLOSED | OPEN | HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.openedAt = null;
  }

  _log(event, extra = {}) {
    console.log(
      JSON.stringify({
        event,
        breaker: this.name,
        state: this.state,
        failure_count: this.failureCount,
        success_count: this.successCount,
        ...extra,
      })
    );
  }

  canRequest() {
    if (this.state === "CLOSED") return true;

    if (this.state === "OPEN") {
      const elapsed = Date.now() - (this.openedAt || 0);
      if (elapsed >= this.resetTimeoutMs) {
        this.state = "HALF_OPEN";
        this.successCount = 0;
        this._log("circuit_half_open", { elapsed_ms: elapsed });
        return true;
      }
      return false;
    }

    // HALF_OPEN: allow the probe
    return true;
  }

  recordSuccess() {
    if (this.state === "HALF_OPEN") {
      this.successCount += 1;
      if (this.successCount >= this.successThreshold) {
        this.state = "CLOSED";
        this.failureCount = 0;
        this.successCount = 0;
        this.openedAt = null;
        this._log("circuit_closed");
      }
      return;
    }

    // CLOSED: reset consecutive failures on success
    this.failureCount = 0;
  }

  recordFailure(err) {
    this.failureCount += 1;

    if (this.state === "HALF_OPEN") {
      this.state = "OPEN";
      this.openedAt = Date.now();
      this.successCount = 0;
      this._log("circuit_reopened", {
        reason: String(err?.message || err || "probe_failed").slice(0, 120),
      });
      return;
    }

    if (this.state === "CLOSED" && this.failureCount >= this.failureThreshold) {
      this.state = "OPEN";
      this.openedAt = Date.now();
      this._log("circuit_opened", {
        threshold: this.failureThreshold,
        reason: String(err?.message || err || "threshold_reached").slice(0, 120),
      });
    }
  }

  reset() {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.successCount = 0;
    this.openedAt = null;
    this._log("circuit_reset");
  }

  snapshot() {
    return {
      name: this.name,
      state: this.state,
      failure_count: this.failureCount,
      success_count: this.successCount,
      opened_at: this.openedAt,
      failure_threshold: this.failureThreshold,
      reset_timeout_ms: this.resetTimeoutMs,
    };
  }
}

/**
 * Bulk circuit breaker registry.
 * Independent named breakers; shared default options; bulk snapshot/reset.
 */
class BulkCircuitBreakers {
  constructor(defaultOpts = {}) {
    this.defaultOpts = {
      failureThreshold:
        defaultOpts.failureThreshold ??
        Number(process.env.CB_FAILURE_THRESHOLD || 5),
      resetTimeoutMs:
        defaultOpts.resetTimeoutMs ??
        Number(process.env.CB_RESET_TIMEOUT_MS || 30_000),
      successThreshold:
        defaultOpts.successThreshold ??
        Number(process.env.CB_SUCCESS_THRESHOLD || 1),
    };
    this.breakers = new Map();
  }

  /** Get or lazily create a named breaker. */
  get(name, opts = {}) {
    if (!this.breakers.has(name)) {
      this.breakers.set(
        name,
        new CircuitBreaker(name, { ...this.defaultOpts, ...opts })
      );
    }
    return this.breakers.get(name);
  }

  /** Snapshot of every registered breaker. */
  snapshot() {
    const out = {};
    for (const [name, breaker] of this.breakers) {
      out[name] = breaker.snapshot();
    }
    return out;
  }

  /** Force-reset one breaker. */
  reset(name) {
    const breaker = this.breakers.get(name);
    if (breaker) breaker.reset();
  }

  /** Force-reset all breakers. */
  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /** True if any breaker is currently OPEN. */
  anyOpen() {
    for (const breaker of this.breakers.values()) {
      if (breaker.state === "OPEN") return true;
    }
    return false;
  }

  /** Names of breakers currently OPEN. */
  openNames() {
    return [...this.breakers.values()]
      .filter((b) => b.state === "OPEN")
      .map((b) => b.name);
  }
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

/**
 * Compose circuit breaker + backoff for a single SDK call.
 */
async function protectedCall(breaker, fn) {
  if (!breaker.canRequest()) {
    const waitMs = Math.max(
      0,
      breaker.resetTimeoutMs - (Date.now() - (breaker.openedAt || 0))
    );
    const err = new Error(
      `CircuitBreaker[${breaker.name}] OPEN — failing fast (retry in ~${Math.ceil(waitMs / 1000)}s)`
    );
    err.code = "CIRCUIT_OPEN";
    err.breaker = breaker.name;
    throw err;
  }

  try {
    const result = await withBackoff(fn);
    breaker.recordSuccess();
    return result;
  } catch (err) {
    breaker.recordFailure(err);
    throw err;
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

// ---------------------------------------------------------------------------
// Bulk registry — independent breakers per logical resource
// ---------------------------------------------------------------------------
const breakers = new BulkCircuitBreakers();

// Named breakers used by this exporter (extend as more endpoints are added)
const profileCoinsBreaker = breakers.get("profileCoins");
// Future examples (lazy-created on first use):
// const profileBalancesBreaker = breakers.get("profileBalances");
// const coinHoldersBreaker = breakers.get("coinHolders");

let after = undefined;
let page = 0;
let allEdges = [];
let lastResponse = null;

while (true) {
  page += 1;

  const response = await protectedCall(profileCoinsBreaker, () =>
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
      circuit_state: profileCoinsBreaker.state,
      circuits_open: breakers.openNames(),
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
      circuit_final_state: profileCoinsBreaker.state,
      circuit_snapshot: breakers.snapshot(),
      raw_receipt: "discovery/zora/latest_profile_coins_response.json",
      raw_edges: "discovery/zora/latest_profile_coins_edges.json",
      normalized: "data/live_zora_items.json",
    },
    null,
    2
  )
);
