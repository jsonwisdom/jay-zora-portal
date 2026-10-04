# Real Zora Export → Python Ingest Receipt 🦊⚙️🧾

Status: REAL_ZORA_EXPORT_INGEST_CONFIRMED

Verified:
- Node exporter calls @zoralabs/coins-sdk getProfileCoins
- Raw SDK response saved to discovery/zora/latest_profile_coins_response.json
- Normalized runtime artifact written to data/live_zora_items.json
- Python crawler loads /app/data/live_zora_items.json
- Search API returns real Zora records

Runtime output:
data/live_zora_items.json is intentionally gitignored.

Canonical path:
Zora SDK → normalized JSON → Python crawler → Postgres → FastAPI → React portal

Next:
Paginate exporter beyond first page and harden normalization.
