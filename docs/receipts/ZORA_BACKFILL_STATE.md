# Zora Micropool Backfill State

State: STRUCTURAL_CLUSTER_SUMMARY_READY

Artifacts:
- scripts/base_rpc_probe.sh
- scripts/base_getlogs_window.sh
- scripts/parse_base_logs_summary.py
- scripts/decode_coincreated_v4_logs.py

Live window:
- Blocks: 46141641-46151641
- Topic0: 0x2de436107c2096e039c98bbcc3c5a2560583738ce15c234557eecb4d3221aa81
- Factory: 0x777777751622c0d3258f214f9df38e35bf45baf3
- Decoded logs: 429

Structural findings:
- factory_address unique: 1
- version_topic unique: 1
- topic1_addr unique: 321
- topic2_addr unique: 321
- topic1/topic2 counts match
- topic3_addr unique: 39
- data_word0 unique: 311
- data_word1 constant: 0x180
- data_word2 dominant: 0x200

Rules:
- No synthetic telemetry.
- No price logic.
- No social data.
- No intent labels.
- No rug claims.

Next valid transition:
STRUCTURAL_CLUSTER_SUMMARY_READY -> ABI_FIELD_MAPPING
