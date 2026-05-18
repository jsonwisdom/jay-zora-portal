# Zora Micropool Backfill State

State: SLOT_OPTIMIZED_STRUCTURAL_BACKFILL

Artifact:
- queries/zora_micropool_backfill_v1.sql

Rules:
- Run small block window first
- Live BigQuery rows only
- No synthetic telemetry
- No price logic
- No social data
- No intent labels
- No rug claims

Expected output:
result_type | pool_key_hash | factory_address | version_topic | distinct_creators | coins_deployed | first_block | last_block

Current repo placement:
- queries/ = SQL backfill artifacts
- docs/receipts/ = state receipts and operator notes
- scripts/ = future executable wrappers
