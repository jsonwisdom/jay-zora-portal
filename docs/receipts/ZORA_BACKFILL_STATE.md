# Zora Micropool Backfill State

State: MAPPED_CLUSTER_SUMMARY_CONFIRMED

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

Mapped summary:
- factory unique: 1
- version_topic unique: 1
- topic1_addr unique: 321
- topic2_addr unique: 321
- topic3_addr unique: 39
- asset_addr unique: 311
- pool_key_hash unique: 429
- word_count dominant: 22 words, 375 rows

Rules:
- No synthetic telemetry.
- No price logic.
- No social data.
- No intent labels.
- No rug claims.

Next valid transition:
MAPPED_CLUSTER_SUMMARY_CONFIRMED -> AA_LINKAGE_CHECK

AA linkage check:
- Window: 46141641-46151641
- UserOperationEvent topic: 0x49628dd123b3da59ec474c0921bb1feab9cd036d649d2112e4df6373b9e83ea8
- Result count: 0
- Interpretation: AA linkage not observed in same window.
- Behavioral claims remain blocked.

Next valid transition:
AA_LINKAGE_CHECK_WINDOW_COMPLETE -> TX_RECEIPT_TRACE_CHECK
