#!/usr/bin/env bash
set -euo pipefail

RPC_URL="${BASE_RPC_URL:-https://mainnet.base.org}"

if [ "${1:-}" = "" ] || [ "${2:-}" = "" ] || [ "${3:-}" = "" ]; then
  echo "Usage: ./scripts/base_getlogs_window.sh <START_BLOCK_DECIMAL> <END_BLOCK_DECIMAL> <TOPIC0>"
  exit 1
fi

START_DEC="$1"
END_DEC="$2"
TOPIC0="$3"

START_HEX=$(printf '0x%x' "$START_DEC")
END_HEX=$(printf '0x%x' "$END_DEC")

mkdir -p data/base_raw

OUT="data/base_raw/logs_${START_DEC}_${END_DEC}_${TOPIC0:0:10}.json"

curl -s "$RPC_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\":\"2.0\",
    \"id\":1,
    \"method\":\"eth_getLogs\",
    \"params\":[{
      \"fromBlock\":\"$START_HEX\",
      \"toBlock\":\"$END_HEX\",
      \"topics\":[\"$TOPIC0\"]
    }]
  }" | tee "$OUT"

echo
echo "Saved: $OUT"
