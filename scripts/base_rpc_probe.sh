#!/usr/bin/env bash
set -euo pipefail

RPC_URL="${BASE_RPC_URL:-https://mainnet.base.org}"

echo "RPC: $RPC_URL"

curl -s "$RPC_URL" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' | tee data/base_raw/latest_block.json

echo
echo "Saved: data/base_raw/latest_block.json"
