import { getProfileCoins } from "@zoralabs/coins-sdk";
import fs from "fs";

const identifier = process.env.ZORA_IDENTIFIER || "jaywisdom";
const pageSize = Number(process.env.ZORA_PAGE_SIZE || 100);
const expectedMin = Number(process.env.ZORA_EXPECTED_MIN || 946);

let after = undefined;
let edges = [];
let page = 0;
let seen = new Set();

while (true) {
  page += 1;

  const args = {
    identifier,
    count: pageSize,
  };

  if (after) args.after = after;

  const response = await getProfileCoins(args);

  fs.writeFileSync(
    "discovery/zora/latest_profile_coins_response.json",
    JSON.stringify(response, null, 2)
  );

  const createdCoins = response?.data?.profile?.createdCoins;
  const batch = createdCoins?.edges || [];
  const pageInfo = createdCoins?.pageInfo || {};

  let newCount = 0;

  for (const edge of batch) {
    const id =
      edge?.node?.id ||
      edge?.node?.address ||
      edge?.node?.coinAddress ||
      JSON.stringify(edge);

    if (!seen.has(id)) {
      seen.add(id);
      edges.push(edge);
      newCount += 1;
    }
  }

  console.log(JSON.stringify({
    page,
    batch: batch.length,
    newCount,
    totalEdges: edges.length,
    hasNextPage: pageInfo.hasNextPage ?? null,
    endCursor: pageInfo.endCursor ?? null
  }));

  if (!pageInfo.hasNextPage || !pageInfo.endCursor || newCount === 0) break;

  after = pageInfo.endCursor;
}

fs.writeFileSync(
  "discovery/zora/latest_profile_coins_edges.json",
  JSON.stringify(edges, null, 2)
);

if (edges.length < expectedMin) {
  console.error(JSON.stringify({
    ok: false,
    error: "EXPORT_BELOW_EXPECTED_MIN",
    identifier,
    edges: edges.length,
    expectedMin
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  identifier,
  edges: edges.length,
  expectedMin
}, null, 2));
