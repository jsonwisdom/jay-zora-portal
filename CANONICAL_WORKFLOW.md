# Canonical Workflow: GitHub Direct JaySpace

Doctrine: Velocity comes from fewer moving parts.

This repo is a GitHub Direct public proof surface. The canonical operating path is GitHub Actions + static JSON + Vite static build + GitHub Pages.

No Fly runtime. No Docker runtime. No Postgres runtime. No search-api runtime. No hidden server dependency.

## Canonical Flow

```text
Zora public data / public JSON
↓
GitHub Actions workflow
↓
data/live_zora_items.json
↓
frontend/public/zora-index.json
↓
media normalization
↓
Vite static build
↓
GitHub Pages
↓
JaySpace public homepage
↓
GitHub Direct proof mirror
```

## What Is Canonical

- `.github/workflows/pages.yml`
- `tools/refresh-zora-from-public.mjs`
- `data/live_zora_items.json`
- `frontend/public/zora-index.json`
- `frontend/public/identity-index.json`
- `frontend/src/`
- `frontend/vite.config.js` only as a static GitHub Pages build config
- `README.md`
- `MERKLE_REBOOT_RECEIPT.md`
- `SOLUTION_ROOT_ENS_SCHEMA_ATTEST_VERIFIER.md`

## What Is Not Canonical

These are legacy residue unless explicitly reclassified:

- `docker-compose.yml`
- `Dockerfile.fly`
- `fly.toml`
- `api/`
- `crawler/` as a long-running service
- Postgres
- `search-api`
- Vite dev proxy to Docker/API services
- any runtime server required for public page rendering

## Required Maintenance Loop

1. Refresh public Zora data through GitHub Actions.
2. Normalize metadata and media fields.
3. Copy normalized output into `frontend/public/zora-index.json`.
4. Build static frontend.
5. Deploy to GitHub Pages.
6. Commit refreshed public inventory.
7. Keep README and solution root aligned with the live site.

## Media Normalization Rules

Every item should attempt these fields, in order:

1. `image_uri`
2. `image`
3. `image_url`
4. `imageUrl`
5. `media_url`
6. `media.url`
7. `media.uri`
8. `thumbnail_url`
9. `preview_image_url`
10. `metadata.image`
11. `metadata.image_url`
12. `metadata.animation_url`

URI conversion:

- `ipfs://CID/path` → `https://ipfs.io/ipfs/CID/path`
- `ar://ID` → `https://arweave.net/ID`
- `https://` remains unchanged

## Drift Rule

If a file introduces a runtime server, database, Docker dependency, Fly deployment path, or hidden API dependency, it must be marked `LEGACY_NON_CANONICAL` or removed.

## Velocity Rule

Fast path only:

```text
edit source
↓
push commit
↓
GitHub Action refreshes data
↓
GitHub Pages deploys
↓
public site updates
```

Anything requiring manual server maintenance is outside the canonical workflow.

## Plain-English Summary

GitHub updates the data.
GitHub builds the site.
GitHub hosts the proof surface.
The public observes the result.

That is the workflow.
