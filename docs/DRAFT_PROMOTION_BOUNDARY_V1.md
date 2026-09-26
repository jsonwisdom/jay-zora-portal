# DRAFT_PROMOTION_BOUNDARY_V1

```text
STATUS                    = DRAFT / ACTIVE_BOUNDARY
RAIL                      = PROMOTION_CONTROL
SCOPE                     = JAYWISDOM_ZORA_INDEX
DEFAULT                    = NO_PROMOTION
AUTHORITY_CREATED          = FALSE
MERGE_AUTHORITY            = FALSE
PAGES_DEPLOYMENT_AUTHORITY = FALSE
```

## Purpose

Keep discovery, source reads, local snapshots, generated receipts, draft branches, CI results, and public/canonical promotion distinct.

A green build proves only that the checked code built under its recorded workflow. It does not promote a listing, evidence gate result, Git branch, GitHub Pages artifact, or external claim.

## Allowed inside the draft rail

- Add source adapters, schemas, local fallback snapshots, and receipt renderers.
- Read Zora, BaseScan, GitHub, and other public sources.
- Open or update a **draft** pull request.
- Run read-only CI and produce a preview/build artifact.
- Mark missing evidence as `HOLD` and disagreement as `CONFLICT`.

## Explicitly prohibited without a separate owner instruction

- Merge a pull request.
- Mark a draft pull request ready for review.
- Change the GitHub Pages production branch or publish configuration.
- Deploy to Cloudflare, Vercel, or another live host.
- Rewrite a historical receipt or change a bound hash/commit without a superseding receipt.
- Convert `HOLD` into `OBSERVED` or `PASS` merely because a UI card exists.
- Treat a Zora display page, same-transaction co-occurrence, profile label, or image similarity as identity proof.
- Add API secrets to the static site, repository, workflow output, or chat.

## Promotion preconditions

All conditions must be independently true:

| Gate | Required proof |
| --- | --- |
| Evidence | `DEFINE_META_TESLA_EVIDENCE_GATE_V1 = PASS_EVIDENCE_GATE` with a stored receipt |
| Exact head | Proposed commit SHA and workflow run bind to the same tree |
| Build | Required CI checks are successful on that exact head |
| Review | Draft status is intentionally changed by the owner; no inferred approval |
| Deployment | A separate explicit instruction names target, environment, and promotion scope |
| Receipt | Promotion receipt records actor, timestamp, source commit, target, and result |

```text
EVIDENCE_PASS + CI_PASS + OWNER_PROMOTION_INSTRUCTION
  => ELIGIBLE_FOR_PROMOTION_REVIEW

ELIGIBLE_FOR_PROMOTION_REVIEW
  != PROMOTED
```

## Required instruction shape

```text
PROMOTE_META_TESLA_V1
TARGET = <named branch or named hosting environment>
SOURCE_HEAD = <full commit SHA>
SCOPE = <draft-only | review-ready | pages-preview | production>
CONFIRM = PROMOTE_META_TESLA_V1
```

A different phrase, missing exact head, ambiguous target, or missing scope yields:

```text
PROMOTION = HOLD_AUTH_REQUIRED
```

## Terminal state

```text
DRAFT_BRANCH             = feat/jaywisdom-zora-index-v1
DRAFT_PR                 = #11
MERGE                     = FALSE
PAGES_DEPLOYMENT          = FALSE
LIVE_HOSTING              = FALSE
CANON_PROMOTION           = FALSE
AUTHORITY_CREATED         = FALSE
```
