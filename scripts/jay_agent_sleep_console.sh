#!/usr/bin/env bash
set -euo pipefail

mkdir -p artifacts/jay-agent
OUT="artifacts/jay-agent/sleep_console_snapshot.txt"
NOW="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

{
  echo "JAY_AGENT_SLEEP_CONSOLE_SNAPSHOT"
  echo "timestamp_utc=$NOW"
  echo "repo=$(basename "$(git rev-parse --show-toplevel)")"
  echo "branch=$(git branch --show-current 2>/dev/null || echo github_actions_detached_head)"
  echo "head=$(git rev-parse HEAD)"
  echo "target=Zora"
  echo "controller_label=jaywisdom.base.eth"
  echo
  echo "== ROOT STATUS =="
  git status --short --branch || true
  echo
  echo "== PUBLIC ZORA / IDENTITY SURFACES =="
  find frontend/public data docs/receipts agents/jay-agent scripts .github/workflows -maxdepth 3 -type f 2>/dev/null | sort || true
  echo
  echo "== RECENT COMMITS =="
  git log --oneline -8 || true
  echo
  echo "== TODO / FIXME HUNTER =="
  grep -RInE "TODO|FIXME|UNKNOWN|YELLOW|NO_FAKE_GREEN|jay-agent|Zora|zora" \
    README.md frontend/public data docs agents scripts .github/workflows 2>/dev/null | head -120 || true
  echo
  echo "== NIGHT GOAL =="
  echo "1. Keep Zora surfaces observable."
  echo "2. Preserve unknowns instead of promoting them."
  echo "3. Detect repo drift every 15 minutes."
  echo "4. Leave artifacts for morning replay."
  echo
  echo "== RULING =="
  echo "JAY_AGENT_SLEEP_CONSOLE = BOOTED"
  echo "TARGET = ZORA"
  echo "MODE = READ_ONLY_MAINTENANCE"
  echo "WALLET_SIGNING = FALSE"
  echo "MINTING = FALSE"
  echo "SEMANTIC_TRUTH_FINAL = FALSE"
  echo "AUTHORITY = FALSE"
  echo "NO_FAKE_GREEN = TRUE"
} | tee "$OUT"

sha256sum "$OUT" | tee artifacts/jay-agent/sleep_console_snapshot.sha256
