# Solution Root: ENS + Schema + Attestation + Verifier

Date: 2026-05-19

Doctrine: Simple mechanics and maintenance.

This file is the routing table for the public proof machine. It does not invent a new system. It points the observer to the existing parts and defines how they fit together.

## Core Mechanic

```text
ENS
↓
Schema
↓
Attestation
↓
Verifier
↓
GitHub Direct
↓
Public Site
↓
Replayable Reputation
```

## Layer Roles

### ENS = pointer / public identity

ENS and Basename records are the human-readable routing layer. They point observers toward the public proof surface.

Primary anchors:

- jaywisdom.eth
- jaywisdom.base.eth

Known source surfaces:

- AL: `docs/ALMS-100-ENS-ANCHOR.md`
- AL: `_truth/ens/alms-100-ens-text-records.txt`
- AL: `docs/attestations/ens_keymap.json`
- COMPUTERWISDOM: `receipts/anchor/ENS_TEXT_RECORD_POINTER_001.json`

### Schema = machine-readable claim shape

Schemas define what a claim is allowed to mean before it becomes a receipt, attestation, or verifier input.

Known source surfaces:

- AL: `scripts/deploy-eas-schema.ts`
- AL: `scripts/deploy-link-schema.ts`
- COMPUTERWISDOM: `docs/EXECUTION_RECEIPT_SCHEMA_V1.md`
- COMPUTERWISDOM: `docs/ACTION_PROPOSAL_SCHEMA_V1.md`
- COMPUTERWISDOM: `services/zora-flywheel/factory_receipt_schema_candidate.json`
- COMPUTERWISDOM: `workflows/deepseek-zora-ingestion-v1/merkle_forest_schema_v1.json`
- COMPUTERWISDOM: `workflows/deepseek-zora-ingestion-v1/merkle_bridge_receipt_schema_v1.json`

### Attestation = signed claim event

Attestations turn claim-shaped data into signed, timestamped, externally checkable events.

Known source surfaces:

- AL: `scripts/attest-receipt.ts`
- AL: `docs/alms-attest.html`
- AL: `docs/attest/index.html`
- AL: `script/GenesisAttestation.s.sol`
- AL: `_truth/eas/leaf008_eas_attestation.json`
- COMPUTERWISDOM: `receipts/anchor/EAS_ATTESTATION_PAYLOAD_001.json`
- COMPUTERWISDOM: `receipts/anchor/EAS_SCHEMA_AND_ATTESTATION_ENTRIES_001.json`

### Verifier = replay / check engine

Verifier services test whether claims, receipts, roots, and attestations still match the public record.

Known source surfaces:

- AL: `docs/specs/VERIFIER_SPEC_V1.md`
- AL: `src/verifier.ts`
- AL: `alms/receipt_verifier.py`
- AL: `conformance/verifier_receipt_v1.md`
- AL: `runtime_lattice/zk_verifier.py`
- AL: `watchers/media/anchor_verifier_v1_net.sh`
- COMPUTERWISDOM: `receipts/verifier/computer_wisdom_public_verifier_receipt_2026_05_20.json`

### GitHub Direct = observation surface

GitHub Direct is the public mirror. If the public cannot observe it directly from GitHub, it is not part of the proof machine.

Portal surfaces:

- `frontend/public/identity-index.json`
- `frontend/public/zora-index.json`
- `MERKLE_REBOOT_RECEIPT.md`
- `.github/workflows/pages.yml`

### Public Site = readable membrane

GitHub Pages is the public proof surface. It turns the repo into an inspectable portal without Fly, Docker, hidden runtime servers, or database theater.

## Maintenance Rhythm

1. Add or update source artifact.
2. Mirror it into GitHub Direct.
3. Keep the public pointer index current.
4. Recompute or refresh proof roots when needed.
5. Expose only observable links on the public site.
6. Do not promote claims without receipts.

## Drift Rules

- No hidden runtime is canonical.
- No unverifiable middleware is canonical.
- No claim becomes canonical without a public receipt path.
- No ENS, schema, attestation, or verifier surface should exist without a pointer in this routing table.

## Plain-English Summary

ENS tells people where to look.
Schema tells machines what a claim means.
Attestation signs the claim.
Verifier checks the claim.
GitHub Direct lets the public observe the evidence.
The public site makes the system readable.

That is the machine.
Maintenance is keeping those pointers clean.
