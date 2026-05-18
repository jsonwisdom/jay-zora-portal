# Zora Micropool Backfill State

State: ABI_FIELD_MAPPING_SCRIPT_COMMITTED

Artifacts:
- scripts/base_rpc_probe.sh
- scripts/base_getlogs_window.sh
- scripts/parse_base_logs_summary.py
- scripts/decode_coincreated_v4_logs.py
- scripts/decode_coincreated_v4_mapped.py

Live window:
- Blocks: 46141641-46151641
- Factory: 0x777777751622c0d3258f214f9df38e35bf45baf3
- Topic0: 0x2de436107c2096e039c98bbcc3c5a2560583738ce15c234557eecb4d3221aa81
- Mapped rows: 429

Field mapping:
- topic1_addr and topic2_addr match by observed counts.
- topic3_addr varies.
- asset_addr = data word 0 address.
- pool_key_hash = trailing 12 bytes of data word 9 + full data word 10.
- prior 0x0469a4bd... value is encoded pool-key prefix, not pool_key_hash.

Rules:
- No synthetic telemetry.
- No price logic.
- No social data.
- No intent labels.
- No rug claims.

Next valid transition:
ABI_FIELD_MAPPING_SCRIPT_COMMITTED -> MAPPED_CLUSTER_SUMMARY
