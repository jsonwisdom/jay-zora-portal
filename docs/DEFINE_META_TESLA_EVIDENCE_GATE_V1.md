# DEFINE_META_TESLA_EVIDENCE_GATE_V1

```text
STATUS                 = DRAFT / REVIEWABLE
RAIL                   = EVIDENCE_GATE
OBJECT                 = META_TESLA_SCOPE
CHAIN                  = BASE / 8453
DEFAULT_DISPOSITION    = HOLD
AUTHORITY_CREATED      = FALSE
FINANCIAL_CLAIM        = FALSE
```

## Purpose

Define the minimum receipt set required before any specific Zora object may be labeled **Meta Tesla Scope** outside a draft/HOLD presentation.

This gate does not create ownership, authorship, value, platform affiliation, or promotion authority. It only evaluates whether a proposed object binding is sufficiently evidenced and replayable.

## Canonical object key

```text
eip155:8453/erc20:<lowercase_contract_address>
```

A title, ticker, image, profile handle, transaction co-occurrence, or repository path cannot substitute for this key.

## Required evidence edges

| Edge | Required witness | Gate result if missing |
| --- | --- | --- |
| Object identity | Base chain ID + 20-byte contract address | HOLD_IDENTITY |
| Zora object | Canonical Zora coin URL or Coins SDK response bound to that address | HOLD_ZORA_BINDING |
| Creation | Creation tx hash and successful receipt/event | HOLD_CREATION |
| Time | Block number and UTC block timestamp from the creation receipt/block | HOLD_TIMESTAMP |
| Metadata | Token URI exactly as returned by source/onchain evidence | HOLD_METADATA |
| Media | Resolved media URI plus SHA-256 of retrieved bytes, or an explicit unavailable receipt | HOLD_MEDIA |
| Role | Creator and payout fields from a coin record or creation event | HOLD_ROLE |
| Source replay | Source URL/query, retrieval timestamp, and source state | HOLD_REPLAY |
| Cross-check | Independent public explorer or SDK/readback agrees on chain + contract | HOLD_CROSSCHECK |

## Gate algorithm

```text
IF any required edge is missing
  => HOLD

IF any identity-bearing edge disagrees
  => CONFLICT

IF all required edges are present and agree
  => PASS_EVIDENCE_GATE

PASS_EVIDENCE_GATE
  != CANON_PROMOTION
  != OWNERSHIP_PROOF
  != FINANCIAL_VALUE
  != AUTHORITY
```

## Required output receipt

```json
{
  "schema": "META_TESLA_EVIDENCE_RECEIPT_V1",
  "object_key": "eip155:8453/erc20:0x...",
  "candidate_label": "Meta Tesla Scope",
  "state": "PASS | HOLD | CONFLICT",
  "retrieved_at_utc": "ISO-8601",
  "source_state": "OBSERVED | SNAPSHOT | HOLD",
  "contract": "0x...",
  "creation_tx": "0x...",
  "block_number": 0,
  "block_timestamp_utc": "ISO-8601",
  "token_uri": "ipfs://...",
  "media_uri": "ipfs://... | https://...",
  "media_sha256": "hex | null",
  "creator_address": "0x...",
  "payout_recipient": "0x...",
  "zora_url": "https://zora.co/coin/base:0x...",
  "independent_witness_url": "https://basescan.org/...",
  "holds": [],
  "conflicts": []
}
```

## Current disposition

```text
META_TESLA_SCOPE_CONTRACT      = HOLD
META_TESLA_SCOPE_CREATION_TX   = HOLD
META_TESLA_SCOPE_TIMESTAMP     = HOLD
META_TESLA_SCOPE_MEDIA_BINDING = HOLD
EVIDENCE_GATE                  = NOT_EVALUABLE
```

No candidate data is silently filled from the JAYWISDOM Creator Coin, display similarity, or a generic Zora profile listing.
