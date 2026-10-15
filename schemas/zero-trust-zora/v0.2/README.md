# Zero Trust Zora v0.2 — Schema-First Contract

Status: DRAFT / REVIEWABLE / UNMERGED  
Authority created: FALSE  
Runtime changes: NONE  
Signer changes: NONE  
Trading changes: NONE  
Publishing changes: NONE

## Why schemas first

The repository already contains a real Zora Coins SDK exporter at `tools/export_zora_profile_coins.mjs` using `getProfileCoins`, with normalized output written to `data/live_zora_items.json`.

The redesign therefore does **not** begin by adding another crawler. It begins by defining the contracts that decide what an observation means, how a Zora object binds to canon, how disagreement is preserved, and how a flywheel cycle is replayed.

```text
ZORA SDK / REST PRIMARY OBSERVATION
            ↕
HTML SCRAPER INDEPENDENT WITNESS
            ↓
DRIFT EVENT
            ↓
EXPLICIT OBJECT BINDING
            ↓
GITHUB CANON / RECEIPT / REPLAY
```

The HTML scraper remains useful precisely because it is independent. It is not promoted to truth and it is not deleted.

## Four contracts

1. `identity_record.schema.json`
   - keeps wallet, ENS/Basename, Zora handle, GitHub login, and their evidence states separate;
   - identity linkage is a claim that requires observations;
   - `authority_created=false`.

2. `zora_object_binding.schema.json`
   - binds a Zora object to an exact GitHub repo/path/commit;
   - **never derives canonical path from ticker, symbol, title, or natural-language similarity**;
   - uses explicit registry binding only.

3. `drift_event.schema.json`
   - makes SDK/scraper/portal/GitHub disagreement a first-class replay object;
   - disagreement is logged as `PASS | HOLD | CONFLICT`;
   - drift does not imply fault, fraud, deception, or intent.

4. `flywheel_cycle.schema.json`
   - records the lifecycle from idea/build/receipt/replay/canon to human publication, SDK readback, drift check, service evaluation, and next proposal;
   - agent authority remains false;
   - agents cannot sign, trade, or publish.

## Canon Binder — deterministic mapping law

The earlier idea `ticker → path` is rejected.

```text
SYMBOL != IDENTITY
TITLE != IDENTITY
TICKER != CANONICAL_PATH
NATURAL_LANGUAGE_MATCH != BINDING
```

Canonical object identity is:

```text
object_key = eip155:<chain_id>/erc20:<lowercase_contract_address>
```

Canonical repository placement is **explicit**, not inferred:

```text
object_key
  + binding_namespace
  + repository_full_name
  + canonical_path
  + commit_sha
  + source_receipts
  = ZoraObjectBinding
```

Rules:

- `canonical_path` must be a normalized repository-relative path.
- An active binding may not be selected by ticker/symbol/title.
- More than one active binding for the same `(object_key, binding_namespace)` is `CONFLICT` and must fail closed.
- Moving canon requires a new binding that explicitly supersedes the prior binding.
- Missing binding remains `HOLD`; no heuristic fallback is permitted.

## LeahPrime Commander boundary

LeahPrime Commander is an orchestration / continuity role, not an authority source.

```text
LEAHPRIME_COMMANDER
authority=false
signing=false
trading=false
publishing=false
```

Recommended initial specialists:

```text
ZORA_SCOUT       = READ_ONLY
IDENTITY_RESOLVER= READ_ONLY
CANON_BINDER     = PROPOSE_ONLY
DRIFT_GOBLIN     = READ_ONLY + RECEIPT_EMIT
FLYWHEEL_ANALYST = READ_ONLY + PROPOSE_ONLY
```

No agent receives a private key, wallet signer, trading capability, or publication capability in v0.2.

## OpenAI Agents SDK enforcement boundary

The OpenAI Agents SDK supports manager-style orchestration, tool approvals, custom function-tool guardrails, run interruptions, resumable approval state, and tracing. These are useful controls but they are **not treated here as the sole authority boundary**.

Important implementation rule:

```text
PROMPT RULE != HARD AUTHORIZATION
AGENT NAME != CAPABILITY
GUARDRAIL != UNIVERSAL SANDBOX
APPROVAL != AUTHORITY BY ITSELF
```

Custom function-tool guardrails can validate/block tool calls around execution, and `needs_approval` can pause sensitive calls. However, the SDK guardrail pipeline does not cover every tool category or handoff path identically. Therefore Zero Trust Zora requires deterministic application-level authorization and capability minimization in addition to SDK guardrails.

For v0.2 the strongest control is simple: **do not expose side-effecting signer/trader/publisher tools to LeahPrime Commander or its specialists at all.**

If a future publish tool is introduced, it must be a separate capability with deterministic policy checks, explicit human approval, idempotency, and an execution receipt.

## Flywheel v2

```text
IDEA
→ BUILD
→ RECEIPT
→ REPLAY
→ CANON
→ HUMAN-APPROVED ZORA PUBLICATION
→ SDK READBACK
→ DRIFT CHECK
→ SERVICE / LEARNING SIGNALS
→ NEXT ACTION PROPOSAL
→ HUMAN DECISION
```

Market/activity metrics are observations only:

```text
HOLDERS != QUALITY
VOLUME != TRUTH
MARKET_CAP != CANON
COMMENTS != VERIFICATION
```

## Build order

```text
SCHEMAS
→ CANONICAL FIXTURES
→ VALIDATOR / CONFORMANCE TESTS
→ ZORA SCOUT READ-ONLY MODULE
→ DRIFT GOBLIN RECEIPT EMITTER
→ LEAHPRIME COMMANDER ORCHESTRATION
→ HUMAN-APPROVED SIDE EFFECTS (FUTURE, SEPARATE GATE)
```

No runtime, signer, trading, or publication behavior is authorized by this schema branch.
