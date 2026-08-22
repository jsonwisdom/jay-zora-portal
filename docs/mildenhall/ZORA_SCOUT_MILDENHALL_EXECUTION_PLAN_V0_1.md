# Zora Scout — Mildenhall Execution Plan v0.1

Status: DRAFT / REVIEWABLE / NO SIDE EFFECTS  
Object: `eip155:8453/erc20:0x04ea9a5650470f06a6b09cb31ede50fbb0667f95`  
Authority created: FALSE

## Purpose

Perform the first structured `ReverseReplayReadbackRESTRestore` cycle for the existing Mildenhall Zora candidate without allowing missing data, a cache miss, or a local search miss to become a false conclusion.

## Lawful execution order

```text
CONTRACT ROOT
→ SDK READBACK
→ REST READBACK
→ HTML WITNESS
→ CROSS-SURFACE COMPARE
→ DRIFT EVENT
→ GRAY BABY GATE
→ EXPLICIT GIT / DRIVE BINDING
→ CANON CANDIDATE
→ HUMAN PROMOTION ONLY
```

## 1. Contract root

Input:

- contract: `0x04ea9a5650470f06a6b09cb31ede50fbb0667f95`
- chain ID: `8453`
- object key: `eip155:8453/erc20:0x04ea9a5650470f06a6b09cb31ede50fbb0667f95`

The contract and chain are the only fixed Zora object coordinates before readback.

## 2. SDK readback

Use the official Zora Coins SDK query functions:

- `getCoin`
- `getCoinHolders`
- `getCoinSwaps`
- `getCoinComments`

`getCoin` is the primary metadata/creator/media/market observation. Holders, swaps, and comments remain separate observations and must not be inferred from the base coin response.

Freeze each raw structured response independently before normalization.

Required receipts:

```text
sdk_get_coin.raw.json
sdk_get_coin.raw.sha256
sdk_holders.raw.json
sdk_holders.raw.sha256
sdk_swaps.raw.json
sdk_swaps.raw.sha256
sdk_comments.raw.json
sdk_comments.raw.sha256
```

Every observation receives its own `observed_at` timestamp.

## 3. REST readback

Use Zora's documented public REST surface where the same object/field is available.

REST output is an independent observer. It does not silently replace SDK output.

Freeze:

- raw response bytes
- SHA-256
- request locator
- observed-at timestamp
- status/error state

## 4. HTML witness

The HTML scraper remains an independent drift witness only.

It may observe visible page fields such as:

- name
- symbol
- description
- media pointer
- creator presentation
- market presentation

Rules:

```text
HTML != PRIMARY SOURCE
CACHE_MISS != DELETION
PARSE_ERROR != OBJECT_ABSENCE
HTML_MISMATCH != FRAUD
```

## 5. Cross-surface comparison

Compare independently observed fields across:

- SDK
- REST
- HTML witness
- Git binding
- Drive binding
- prior readback snapshot

Comparison result:

`MATCH | MISSING | CHANGED | CONFLICT`

No comparison result creates intent, fault, fraud, or authority.

## 6. Drift event

If a material difference exists, emit a `CrossSurfaceDriftEvent`.

Candidate drift classes:

- `MISSING`
- `CHANGED`
- `CONFLICT`
- `DELETION`
- `MUTATION`
- `REWRITE`
- `REORDER`
- `INVERSION`

`DELETION` is never inferred from an HTML/cache failure. A deletion signal requires corroborating structured-object absence and remains a bounded observation until independently resolved.

## 7. Gray Baby gate

```text
MISSING REQUIRED METADATA → HOLD
CREATOR CONFLICT          → CONFLICT
CONTRACT / CHAIN MISMATCH → REJECT
UNCHANGED + RECEIPT MATCH → PASS CANDIDATE
```

Gray Baby may block promotion. Gray Baby does not create truth or authority.

## 8. Explicit binding

A PASS candidate may bind only through explicit records:

```text
ZORA OBJECT
+ GITHUB REPO / PATH / COMMIT
+ DRIVE FILE ID
+ SOURCE RECEIPTS
= ZoraObjectBinding CANDIDATE
```

Ticker, title, semantic similarity, image similarity, and natural-language matching may not select canon.

## 9. Canon candidate

Scout never promotes canon itself.

```text
SCOUT PASS
→ BINDING CANDIDATE
→ HUMAN REVIEW
→ HUMAN PROMOTION OR HOLD
```

## Security boundary

```text
SCOUT = READ ONLY
BOXDEE = REPLAY LENS
GRAY BABY = FAIL-CLOSED GAP GATE
LEAHPRIME187 = SYNTHETIC EXPLAINER
AGENT != SIGNER
AGENT != PUBLISHER
AGENT != TRADER
```

No private key, wallet signer, trade call, publication call, or canon-promotion capability belongs in this execution plan.
