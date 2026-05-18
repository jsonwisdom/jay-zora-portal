import { getProfileCoins } from "@zoralabs/coins-sdk";
import fs from "fs";

const identifier = process.env.ZORA_IDENTIFIER || "jaywisdom.base.eth";
const count = Number(process.env.ZORA_COUNT || 50);

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
    zora_url: contract ? `https://zora.co/coin/base:${contract}` : "https://zora.co/@jaywisdom",
    contract,
    token_id: tokenId,
    chain,
    tx_hash: "",
    created_at: node?.createdAt || null,
    themes: words("zora base", node?.coinType, node?.symbol),
    query_aliases: words(node?.name, node?.description, node?.symbol, contract)
  };
}

let after = undefined;
let page = 0;
let allEdges = [];
let lastResponse = null;

while (true) {
  page += 1;

  const response = await getProfileCoins({
    identifier,
    count,
    after
  });

  lastResponse = response;

  const createdCoins = response?.data?.profile?.createdCoins;
  const edges = createdCoins?.edges || [];
  const pageInfo = createdCoins?.pageInfo || {};

  allEdges.push(...edges);

  console.log(JSON.stringify({
    page,
    edges: edges.length,
    total_edges: allEdges.length,
    hasNextPage: !!pageInfo.hasNextPage,
    endCursor: pageInfo.endCursor ? "present" : null
  }));

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

const items = allEdges.map((edge) => normalizeNode(edge.node)).filter((x) => x.contract);

fs.writeFileSync(
  "data/live_zora_items.json",
  JSON.stringify(items, null, 2)
);

console.log(JSON.stringify({
  ok: true,
  identifier,
  page_size: count,
  pages: page,
  exported: items.length,
  raw_receipt: "discovery/zora/latest_profile_coins_response.json",
  raw_edges: "discovery/zora/latest_profile_coins_edges.json",
  normalized: "data/live_zora_items.json"
}, null, 2));
