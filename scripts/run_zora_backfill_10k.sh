#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" = "" ]; then
  echo "Usage: ./scripts/run_zora_backfill_10k.sh <START_BLOCK>"
  exit 1
fi

START_BLOCK="$1"
END_BLOCK="$((START_BLOCK + 10000))"

sed \
  -e "s/DECLARE START_BLOCK INT64 DEFAULT 0;/DECLARE START_BLOCK INT64 DEFAULT ${START_BLOCK};/" \
  -e "s/DECLARE END_BLOCK INT64 DEFAULT 999999999;/DECLARE END_BLOCK INT64 DEFAULT ${END_BLOCK};/" \
  queries/zora_micropool_backfill_v1.sql \
  > /tmp/zora_micropool_backfill_${START_BLOCK}_${END_BLOCK}.sql

echo "Running Zora backfill window: ${START_BLOCK} -> ${END_BLOCK}"
bq query --use_legacy_sql=false < /tmp/zora_micropool_backfill_${START_BLOCK}_${END_BLOCK}.sql
