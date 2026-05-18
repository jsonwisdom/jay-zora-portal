# Zora Micropool Backfill State

State: STRUCTURAL_LOG_SUMMARY_CONFIRMED

Artifacts:
- queries/zora_micropool_backfill_v1.sql
- scripts/run_zora_backfill_10k.sh
- scripts/base_rpc_probe.sh
- scripts/base_getlogs_window.sh
- scripts/parse_base_logs_summary.py

Latest execution finding:
- BigQuery Base dataset unavailable.
- Base RPC source selected.
- eth_getLogs returned live CoinCreatedV4 logs.
- Window: 46141641-46151641
- Topic0: 0x2de436107c2096e039c98bbcc3c5a2560583738ce15c234557eecb4d3221aa81
- Factory: 0x777777751622c0d3258f214f9df38e35bf45baf3
- Raw log count: 429
- Summary line count: 430 including header

Rules:
- Live rows only.
- No synthetic telemetry.
- No price logic.
- No social data.
- No intent labels.
- No rug claims.

Next valid transition:
STRUCTURAL_LOG_SUMMARY_CONFIRMED -> STRUCTURAL_LOG_DECODER
