# GitHub Direct Merkle Reboot Receipt

Date: 2026-05-19

Doctrine: GitHub Direct — Proofs by Observation.

Rule: If it cannot be observed directly from GitHub, it is not part of the proof machine.

Public site goal: active.

## Trigger folders and files scanned

- `.github/workflows/` — GitHub Pages build, inventory refresh, deployment trigger
- `tools/` — public inventory refresh scripts and future Merkle builder location
- `frontend/public/` — public JSON indexes served by GitHub Pages
- `frontend/src/` — public portal UI source
- `data/live_zora_items.json` — refreshed Zora inventory mirror
- `README.md` — public project statement
- `package.json` — root Node execution surface
- `frontend/package.json` — frontend build surface
- `frontend/vite.config.js` — GitHub Pages base path and build config

## Drift classification

GitHub Direct surfaces are canonical.

Fly.io, Docker, Postgres, and server-runtime paths are not canonical proof surfaces. They may exist only as historical residue until removed or quarantined.

## Merkle tree target

Build a Merkle tree over the observable public-site trigger surface:

1. GitHub Actions workflow files
2. public JSON indexes
3. portal source files
4. public inventory data
5. README and package/build configs

Output targets:

- `frontend/public/proofs/merkle-tree.json`
- `frontend/public/proofs/merkle-root.txt`

## Canon phrase

GitHub Direct, not GitHub Drift.
Proofs by Observation, not promises by deployment.
