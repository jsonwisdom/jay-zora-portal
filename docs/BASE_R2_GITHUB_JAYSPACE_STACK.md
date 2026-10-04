# Base + R2 + GitHub + JaySpace Stack

Doctrine: store fossils in R2, catalog fossils in GitHub, timestamp strata on Base, explore the dig site in JaySpace.

## Layer Responsibilities

```text
Receipt leaf JSON
↓
Canonicalize + hash leaves
↓
Merkle forest root
↓
Upload full artifacts to R2/S3/GCS
↓
Commit small manifest to GitHub
↓
Anchor root + pointer hash on Base/EAS
↓
JaySpace renders and verifies
```

## On Base

Keep this tiny:

- `bytes32 forestRoot`
- `bytes32 receiptHash`
- `bytes32 pointerHash`
- `string source`
- `uint64 checkpoint`
- `uint64 timestamp`

Anchor once per batch, not once per artifact.

## In R2 / S3 / GCS

Store large artifacts:

- full receipt bundles
- forest snapshots
- proof paths
- images
- screenshots
- PDFs
- original evidence files

Use content-addressed keys:

```text
artifacts/sha256-<hash>.json
images/sha256-<hash>.<ext>
snapshots/forest-<checkpoint>-sha256-<hash>.json
```

## In GitHub

Commit small manifests only:

```text
manifests/checkpoint-000001.json
frontend/public/forest.json
frontend/public/data/history.json
```

GitHub is the archaeological index, not bulk storage.

## In JaySpace

JaySpace reads:

- `forest.json`
- `history.json`
- `permissions.json`
- manifests
- R2 artifact pointers

Then it verifies against the anchored root/pointer hashes.

## Canon Rule

No artifact is canonical unless it can be traced through:

```text
artifact hash → manifest → GitHub commit → Merkle root → Base/EAS anchor
```
