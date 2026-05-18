import { getProfileCoins } from "@zoralabs/coins-sdk";
import fs from "fs";

const identifier = process.env.ZORA_IDENTIFIER || "jaywisdom.base.eth";

const response = await getProfileCoins({
  identifier,
  count: 5
});

fs.writeFileSync(
  "discovery/zora/profile_coins_response.json",
  JSON.stringify(response, null, 2)
);

console.log(JSON.stringify({
  ok: true,
  identifier,
  hasData: !!response?.data,
  hasProfile: !!response?.data?.profile,
  createdCoinsCount: response?.data?.profile?.createdCoins?.count ?? null,
  edges: response?.data?.profile?.createdCoins?.edges?.length ?? 0
}, null, 2));
