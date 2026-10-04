# SECURITY_BOARD_V1

ROLE = ENFORCEABLE_REPOSITORY_SECURITY_INVARIANT
VERSION = V1
AUTHORITY_CREATED = FALSE
PROMOTION = NONE

## Mirror Contract

Drive policy: https://docs.google.com/document/d/14jp33GZhfiphRwWD1otAddt7FbrSbShf2V49dLgeCJE/edit

```text
GITHUB_BOARD != DRIVE_POLICY
DRIVE_POLICY != TECHNICAL_ENFORCEMENT
POLICY_MATCH != AUTHORITY

GITHUB_SECURITY_BOARD_VERSION = V1
DRIVE_POLICY_VERSION = V1
CONTENT_SEMANTICS_MATCH_REQUIRED = TRUE
BYTE_IDENTITY_REQUIRED = FALSE
```

## Current Security Board

```text
DEPLOYMENT_SECURITY_REVIEW    = HOLD

WORKFLOW_LEAST_PRIVILEGE      = PASS
DEPLOY_BRANCH_GATE            = PASS
DATASET_SHA_BINDING           = PASS

REPO_RULESETS                 = EMPTY
CLASSIC_BRANCH_PROTECTION     = UNKNOWN
SECRET_STORAGE_SCOPE          = UNKNOWN
SECRET_EXPOSURE_BOUNDARY      = HOLD
ACTION_DEPENDENCY_PINNING     = HOLD
ARTIFACT_IDENTITY_CLASS       = COMMIT_SHA + DATASET_SHA
FULL_DEPLOYMENT_IDENTITY      = HOLD
DIRECTORY_SEMANTICS_ALIGNMENT = HOLD

DEPLOYMENT_AUTHORITY_BOUND    = HOLD
PROMOTION_POLICY_DEFINED      = HOLD
PROMOTION_POLICY_ENFORCED     = HOLD
HUMAN_APPROVER_BOUND          = HOLD

AUTHORITY_CREATED             = FALSE
PROMOTION                     = NONE
```

## S1_BRANCH_PROTECTION

Target for `live-zora-ingestion`:

```text
review_required = true
required_reviews >= 1
CODEOWNER review preferred
force_push = false
direct_push = restricted
```

Any branch that receives `ZORA_API_KEY` must satisfy the same or stricter protection.

Observed classic branch-protection state remains `UNKNOWN` until independently read.

## S2_SECRET_BOUNDARY

Storage and exposure are separate predicates.

```text
SECRET_STORAGE_SCOPE target = ENVIRONMENT

SECRET_EXPOSURE_SCOPE target =
  github-pages environment
  + push or workflow_dispatch
  + live-zora-ingestion only

feature_branch_secret_access = false
```

Feature-branch build/test workflows must not receive `ZORA_API_KEY`.

## S3_WORKFLOW_MUTABILITY

CODEOWNERS review is required for:

```text
.github/workflows/**
tools/export_zora_profile_coins.mjs
dependency lockfiles
```

Any source that can touch a deployment secret must be review-gated before entering a secret-receiving branch.

## S4_ACTION_PINNING

Every GitHub Actions `uses:` selector must execute from an immutable commit SHA.

```text
floating version tags = forbidden execution selector
version tags = human-readable metadata only
action SHA change = review-required change
```

## S5_ARTIFACT_IDENTITY

```text
DEPLOYED_ARTIFACT_IDENTITY = {
  commit_sha,
  dataset_sha256,
  manifest_sha256,
  run_id,
  timestamp,
  branch
}

deployment_artifact_digest = OPTIONAL_ADDITIVE

COMMIT_ONLY_REPRODUCIBILITY = EXPLICITLY_FALSE
ARTIFACT_REPRODUCIBILITY target = SHA_BOUND
```

The same repository commit may publish different live Zora bytes when the live dataset changes.

## S6_DIRECTORY_SEMANTICS

```text
DIRECTORY_MEMBERSHIP != IDENTITY_PROOF

public_wallet_identity -> public_wallet_directory_entry
identity anchor -> directory anchor

identity_proof_status in {NONE, PENDING, VERIFIED}
```

Never call a directory entry verified identity unless that exact proposition has its own receipt.

## S7_PROMOTION

Promotion requires all of:

```text
security gates PASS
semantic cleanup PASS
artifact identity receipt present
named human approval
```

Policy existence alone does not promote a deployment or product state.

## S8_AUTHORITY

```text
AUTHORITY_CREATED = FALSE

DEPLOYMENT_AUTHORITY_BOUND
  may become PASS only when existing human deployment authority
  is explicitly bound and technically constrained.

PROMOTION_POLICY_DEFINED
  may become PASS only when its governing policy is explicitly accepted
  under the project rule.

PROMOTION_POLICY_ENFORCED
  requires observed technical enforcement.

HUMAN_APPROVER_BOUND
  requires a named human approval role and receipt.

POLICY != AUTHORITY
ENFORCEMENT != AUTHORITY
CI != AUTHORITY
DEPLOYMENT != AUTHORITY
```

Authority is constrained by maturity, not created by maturity.

## Non-Promotion Guard

```text
POLICY_FILE_EXISTS != POLICY_ENFORCED
SECURITY_BOARD_EXISTS != SECURITY_PASS

AUTHORITY_CREATED = FALSE
PROMOTION = NONE
```
