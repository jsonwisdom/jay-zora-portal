import fallbackListings from "./listings.json";
import metaTeslaHoldReceipt from "./meta-tesla-evidence-receipt-v1.hold.json";

export type SourceState = "OBSERVED" | "SNAPSHOT" | "HOLD";
export type ListingKind = "coin" | "post" | "collection" | "contract";

export type Activity = {
  type: string;
  timestamp: string | null;
  txHash: string | null;
  sender: string | null;
  amount: string | null;
};

/** META_TESLA_EVIDENCE_RECEIPT_V1 — typed shape from DEFINE_META_TESLA_EVIDENCE_GATE_V1 */
export type EvidenceReceiptV1 = {
  schema: "META_TESLA_EVIDENCE_RECEIPT_V1";
  object_key: string | null;
  candidate_label: string;
  state: "PASS" | "HOLD" | "CONFLICT";
  retrieved_at_utc: string | null;
  source_state: SourceState;
  contract: string | null;
  creation_tx: string | null;
  block_number: number | null;
  block_timestamp_utc: string | null;
  token_uri: string | null;
  media_uri: string | null;
  media_sha256: string | null;
  creator_address: string | null;
  payout_recipient: string | null;
  zora_url: string | null;
  independent_witness_url: string | null;
  holds: string[];
  conflicts: string[];
  notes?: string;
};

export type Listing = {
  id: string;
  name: string;
  symbol: string | null;
  kind: ListingKind;
  chainId: number;
  address: string | null;
  creatorAddress: string | null;
  description?: string;
  createdAt: string | null;
  tokenUri: string | null;
  imageUrl?: string | null;
  sourceState: SourceState;
  source: string;
  receipt: { txHash: string | null; mediaHash: string | null };
  evidenceReceipt?: EvidenceReceiptV1;
  raw?: Record<string, unknown>;
};

export type IndexResult = {
  listings: Listing[];
  sourceState: SourceState;
  sourceNote: string;
  profile?: { handle?: string; displayName?: string; avatarUrl?: string; wallet?: string; balances?: number };
};

export const ZORA_HANDLE = "jaywisdom";
export const BASE_WALLET = "0x829AdfEdBe565F9885a7eA6Bc78912acAef055E2";
export const JAYWISDOM_COIN = "0x694cE46C64D9D1a5e9376A9feBcF85Ec05D72e9F";
export const META_TESLA_HOLD_ID = "meta-tesla-scope-hold";

/** Static HOLD fixture — never invents missing edges */
export const META_TESLA_HOLD_RECEIPT = metaTeslaHoldReceipt as EvidenceReceiptV1;

type CoinsSdk = {
  getProfile: (params: Record<string, unknown>) => Promise<any>;
  getProfileCoins: (params: Record<string, unknown>) => Promise<any>;
  getProfileBalances: (params: Record<string, unknown>) => Promise<any>;
  getCoin: (params: Record<string, unknown>) => Promise<any>;
  getCoinSwaps: (params: Record<string, unknown>) => Promise<any>;
};

// The public page intentionally has no API key. A pinned browser import keeps this
// shell thin; if Zora rate-limits it, the signed-integration-free snapshot remains.
let sdkPromise: Promise<CoinsSdk> | null = null;
function getSdk(): Promise<CoinsSdk> {
  if (!sdkPromise) {
    sdkPromise = import(/* @vite-ignore */ "https://esm.sh/@zoralabs/coins-sdk@0.8.0?bundle") as Promise<CoinsSdk>;
  }
  return sdkPromise;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const value = (record: Record<string, unknown>, key: string): string | null => typeof record[key] === "string" ? record[key] : null;
const number = (record: Record<string, unknown>, key: string, fallback = 8453): number => typeof record[key] === "number" ? record[key] : fallback;

function safeUrl(uri: string | null) {
  if (!uri) return null;
  return uri.startsWith("ipfs://") ? `https://ipfs.io/ipfs/${uri.slice(7)}` : uri;
}

function attachHoldEvidence(listing: Listing): Listing {
  if (listing.id === META_TESLA_HOLD_ID || listing.name === "Meta Tesla Scope") {
    return { ...listing, evidenceReceipt: META_TESLA_HOLD_RECEIPT };
  }
  return listing;
}

function sdkListing(input: unknown): Listing | null {
  if (!isRecord(input)) return null;
  const address = value(input, "address") ?? value(input, "contract");
  const title = value(input, "name") ?? value(input, "title") ?? address ?? "Unnamed Zora object";
  const media = isRecord(input.mediaContent) ? input.mediaContent : null;
  const preview = media && isRecord(media.previewImage) ? media.previewImage : null;
  const createdAt = value(input, "createdAt") ?? value(input, "created_at");
  const kind: ListingKind = value(input, "kind") === "post" ? "post" : "coin";
  return {
    id: value(input, "id") ?? `${number(input, "chainId")}:${address ?? title}`,
    name: title,
    symbol: value(input, "symbol"),
    kind,
    chainId: number(input, "chainId"),
    address,
    creatorAddress: value(input, "creatorAddress"),
    description: value(input, "description") ?? undefined,
    createdAt,
    tokenUri: value(input, "tokenUri"),
    imageUrl: safeUrl((preview && (value(preview, "medium") ?? value(preview, "small"))) ?? (media && value(media, "originalUri")) ?? value(input, "image_uri")),
    sourceState: "OBSERVED",
    source: "Zora Coins SDK",
    receipt: { txHash: value(input, "txHash") ?? value(input, "tx_hash"), mediaHash: null },
    raw: input
  };
}

function snapshotListing(input: unknown): Listing | null {
  const listing = sdkListing(input);
  return listing ? { ...listing, sourceState: "SNAPSHOT", source: "repository snapshot" } : null;
}

async function getSnapshot(): Promise<Listing[]> {
  const url = `${import.meta.env.BASE_URL}zora-index.json`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`snapshot HTTP ${response.status}`);
  const payload: unknown = await response.json();
  const rows = Array.isArray(payload) ? payload : isRecord(payload) && Array.isArray(payload.results) ? payload.results : [];
  return rows.map(snapshotListing).filter((item): item is Listing => item !== null);
}

async function getLiveProfile(): Promise<IndexResult> {
  const { getProfile, getProfileCoins, getProfileBalances } = await getSdk();
  const [profileResult, coinsResult, balanceResult] = await Promise.allSettled([
    getProfile({ identifier: ZORA_HANDLE }),
    getProfileCoins({ identifier: ZORA_HANDLE, count: 100, chainIds: [8453] }),
    getProfileBalances({ identifier: BASE_WALLET, count: 20 })
  ]);
  if (profileResult.status !== "fulfilled" || coinsResult.status !== "fulfilled") throw new Error("Zora profile query failed");
  const profileResponse = profileResult.value;
  const coinsResponse = coinsResult.value;
  const profile = profileResponse.data?.profile as Record<string, unknown> | undefined;
  const created = profile && isRecord((coinsResponse.data?.profile as Record<string, unknown> | undefined)?.createdCoins)
    ? (coinsResponse.data?.profile as Record<string, Record<string, unknown>>).createdCoins
    : undefined;
  const edges = Array.isArray(created?.edges) ? created.edges : [];
  const listings = edges.map((edge) => isRecord(edge) ? sdkListing(edge.node) : null).filter((item): item is Listing => item !== null);
  if (!listings.length) throw new Error("Zora returned no created Base coins");
  const balances = balanceResult.status === "fulfilled" ? (balanceResult.value.data?.profile as Record<string, unknown> | undefined)?.coinBalances : undefined;
  return {
    listings,
    sourceState: "OBSERVED",
    sourceNote: "Live Zora Coins SDK profile read",
    profile: {
      handle: value(profile ?? {}, "handle") ?? ZORA_HANDLE,
      displayName: value(profile ?? {}, "displayName") ?? undefined,
      avatarUrl: isRecord(profile?.avatar) ? value(profile.avatar, "medium") : undefined,
      wallet: isRecord(profile?.publicWallet) ? value(profile.publicWallet, "walletAddress") ?? undefined : undefined,
      balances: isRecord(balances) && Array.isArray(balances.edges) ? balances.edges.length : undefined
    }
  };
}

export async function loadIndex(): Promise<IndexResult> {
  const local = (fallbackListings as Listing[]).map(attachHoldEvidence);
  let snapshot: Listing[] = [];
  try { snapshot = (await getSnapshot()).map(attachHoldEvidence); } catch { /* local snapshot is intentionally available offline */ }
  try {
    const live = await getLiveProfile();
    // Preserve the local Meta Tesla HOLD slot even when live profile succeeds
    const hasMeta = live.listings.some((l) => l.id === META_TESLA_HOLD_ID || l.name === "Meta Tesla Scope");
    const listings = hasMeta ? live.listings.map(attachHoldEvidence) : [...live.listings, ...local.filter((l) => l.id === META_TESLA_HOLD_ID)];
    return { ...live, listings };
  } catch (error) {
    const listings = snapshot.length ? snapshot : local;
    return {
      listings,
      sourceState: snapshot.length ? "SNAPSHOT" : "HOLD",
      sourceNote: snapshot.length ? "Live Zora read unavailable; repository snapshot shown." : "Live and repository snapshot unavailable; local receipt snapshot shown.",
      profile: { handle: ZORA_HANDLE, wallet: BASE_WALLET }
    };
  }
}

export async function loadReceipt(listing: Listing): Promise<{ listing: Listing; activity: Activity[] }> {
  // HOLD evidence fixture is already attached; do not invent live data for null-address objects
  if (!listing.address) {
    return { listing: attachHoldEvidence(listing), activity: [] };
  }
  const { getCoin, getCoinSwaps } = await getSdk();
  const [coinResult, swapsResult] = await Promise.allSettled([
    getCoin({ address: listing.address, chain: 8453 }),
    getCoinSwaps({ address: listing.address, chain: 8453, first: 8 })
  ]);
  const refreshed = coinResult.status === "fulfilled" ? sdkListing(coinResult.value.data?.zora20Token) : null;
  const swaps = swapsResult.status === "fulfilled"
    ? ((swapsResult.value.data?.zora20Token as Record<string, unknown> | undefined)?.swapActivities as Record<string, unknown> | undefined)?.edges
    : [];
  const activity = Array.isArray(swaps) ? swaps.map((edge): Activity | null => {
    const row = isRecord(edge) && isRecord(edge.node) ? edge.node : null;
    return row ? { type: value(row, "activityType") ?? "ACTIVITY", timestamp: value(row, "blockTimestamp"), txHash: value(row, "transactionHash"), sender: value(row, "senderAddress"), amount: value(row, "coinAmount") } : null;
  }).filter((item): item is Activity => item !== null) : [];
  return { listing: refreshed ? { ...refreshed, sourceState: "OBSERVED" } : listing, activity };
}

export function zoraUrl(listing: Listing) { return listing.address ? `https://zora.co/coin/base:${listing.address}` : `https://zora.co/@${ZORA_HANDLE}`; }
export function baseScanUrl(value: string | null) { return value ? `https://basescan.org/${value.startsWith("0x") && value.length === 42 ? "address" : "tx"}/${value}` : null; }
