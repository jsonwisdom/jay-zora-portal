# Zora Micropool Backfill State

State: BLOCKED_ON_BASE_DATA_SOURCE

Artifact:
- queries/zora_micropool_backfill_v1.sql
- scripts/run_zora_backfill_10k.sh

Latest execution finding:
- Google BigQuery is working under project `jason-wisdom`.
- `bigquery-public-data.crypto_base` is not available / not found.
- Visible public chain dataset search returned `blockchain_analytics_ethereum_mainnet_us`, not Base.

Rules:
- Run small block window first once a Base logs source is available.
- Live rows only.
- No synthetic telemetry.
- No price logic.
- No social data.
- No intent labels.
- No rug claims.

Expected output:
result_type | pool_key_hash | factory_address | version_topic | distinct_creators | coins_deployed | first_block | last_block

Current repo placement:
- queries/ = SQL backfill artifacts
- docs/receipts/ = state receipts and operator notes
- scripts/ = executable wrappers

Next valid transition:
BLOCKED_ON_BASE_DATA_SOURCE -> BASE_LOG_SOURCE_SELECTED -> READY_FOR_EXECUTION_AWAITING_ROWS
