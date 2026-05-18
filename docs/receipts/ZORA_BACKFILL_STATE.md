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

TX receipt trace check:
- Sample receipts: 3
- All sampled tx `to` values target EntryPoint 0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789.
- Receipt statuses: all 0x1.
- Log counts: 55, 52, 30.
- Correction: AA linkage is visible at transaction target layer.
- Prior UserOperationEvent topic scan returned 0 and remains recorded as a negative topic-query result.
- Behavioral claims remain blocked.

Next valid transition:
TX_RECEIPT_TRACE_CHECK_CONFIRMED -> ENTRYPOINT_EVENT_TOPIC_MAPPING

EntryPoint event topic mapping:
- Observed EntryPoint topic counts from 3 sampled receipts:
  - 0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f: 4
  - 0xbb47ee3e183a558b1a2ff0874b079f3fc5478b7454eacf2bfc5af2ff5878f972: 3
  - 0x2da466a7b24304f47e87fa2e1e5a81b9831ce54fec19055ce277ca2f39ba42c4: 2
- Correction: previous UserOperationEvent topic query used an unobserved topic hash for this receipt set.
- AA linkage is confirmed at transaction target layer and EntryPoint event-layer topics are now mapped.
- Behavioral claims remain blocked.

Next valid transition:
ENTRYPOINT_EVENT_TOPIC_MAPPING -> REQUERY_ENTRYPOINT_OBSERVED_TOPIC

Observed EntryPoint topic requery:
- Topic: 0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f
- Large 10k JSON file was corrupted/truncated during terminal flood.
- RPC puller patched to suppress raw JSON terminal output.
- Valid 1k windows:
  - 46141641-46142641: 7206 logs
  - 46142641-46143641: 6793 logs
  - 46143641-46144641: 8857 logs
- Rule: use 1k or smaller windows for high-volume EntryPoint topics.
- Behavioral claims remain blocked.

Next valid transition:
ENTRYPOINT_OBSERVED_TOPIC_SMALL_WINDOWS_VALID -> ENTRYPOINT_EVENT_DECODER

EntryPoint event decoder:
- Script: scripts/summarize_entrypoint_logs.py
- Files summarized: 3
- Total observed logs: 22856
- Block range: 46141641-46144641
- Topic0: 0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f
- Topic count distribution: 4 topics on all 22856 logs
- Top emitting addresses:
  - 0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789: 16236
  - 0x0000000071727de22e5e9d8baf0edac6f37da032: 5840
  - 0x4337084d9e255ff0702461cf8895ce9e3b5ff108: 779
  - 0x433709009b8330fda32311df1c2afa402ed8d009: 1
- Behavioral claims remain blocked.

Next valid transition:
ENTRYPOINT_EVENT_DECODER_CONFIRMED -> COINCREATE_TO_ENTRYPOINT_TX_JOIN
