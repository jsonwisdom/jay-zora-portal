# Trust Is Repayable — Jay ↔ Zora ↔ Git

Status: DRAFT / REVIEWABLE / UNMERGED  
Authority created: FALSE

## Doctrine

**Trust is repayable.**

A system that asks a person to trust an identity, artifact, agent, publication, result, or canonical state incurs a trust debt.

That debt is repaid only by making the path inspectable and replayable.

```text
TRUST_REQUEST
    ↓
TRUST_DEBT_CREATED
    ↓
SOURCE / IDENTITY / OBJECT / ACTION
    ↓
RECEIPT
    ↓
REPLAY
    ↓
INDEPENDENT VERIFICATION
    ↓
TRUST_DEBT_REPAID
```

This is not the same as saying trust is permanent.

```text
PAST_PASS != CURRENT_PASS
PAST_RECEIPT != CURRENT_STATE
REPUTATION != AUTHORITY
TRUST != BLIND ACCEPTANCE
```

Every new material claim creates a new verification obligation.

## Replayable vs Repayable

```text
REPLAYABLE
= another observer can reconstruct the path.

REPAYABLE
= the system pays back the burden it placed on the observer by supplying the receipts needed to reconstruct that path.
```

The two properties reinforce each other but are not interchangeable.

## Jay ↔ Zora ↔ Git

```text
JAY
= creator / operator / human intent
!= automatic authority

ZORA
= public expression / distribution / discovery / timestamped object surface
!= canonical truth

GIT
= source / version / commit / review / canonical-artifact surface
!= proof of every external claim

RECEIPT + REPLAY
= the bridge that lets each surface verify what the others actually support
```

## Three-Way Trust Loop

```text
JAY CREATES
     ↓
GIT RECORDS BUILD / VERSION / RECEIPT
     ↓
ZORA EXPRESSES / DISTRIBUTES OBJECT
     ↓
SDK READBACK OBSERVES ZORA
     ↓
CANON BINDER CHECKS GIT
     ↓
DRIFT GOBLIN COMPARES SURFACES
     ↓
HUMAN CAN REPLAY
     ↓
TRUST DEBT REPAID
```

No participant gets a privileged exemption:

```text
DO NOT TRUST JAY BY NAME.
DO NOT TRUST ZORA BY PLATFORM.
DO NOT TRUST GIT BY COMMIT EXISTENCE.
DO NOT TRUST AN AGENT BY ROLE LABEL.

VERIFY THE EDGE.
```

## Agent Law

LeahPrime Commander and all Zero Trust Zora agents may help repay trust debt by collecting observations, emitting drift receipts, proposing bindings, and assembling replay paths.

They may not convert their own output into authority.

```text
AGENT_OUTPUT = CLAIM / OBSERVATION / PROPOSAL
AGENT_OUTPUT != CANON BY ITSELF
AGENT_CONFIDENCE != RECEIPT
AGENT_ROLE != PERMISSION
```

For v0.2:

```text
LEAHPRIME_COMMANDER
authority=false
signing=false
trading=false
publishing=false
```

## Service Before Self

Repaying trust means moving verification burden away from the person who is being asked to believe and back onto the system making the claim.

```text
SYSTEM MAKES CLAIM
→ SYSTEM SUPPLIES RECEIPT
→ OBSERVER MAY VERIFY
→ OBSERVER DOES NOT OWE BLIND TRUST
```

This is service before self in machine form: make the evidence easier for the next human to inspect than it was for the creator to produce.

## Final Invariant

```text
TRUST CAN BE EARNED.
TRUST CAN BE SPENT.
TRUST CAN DECAY.
TRUST MUST BE REPAID WITH RECEIPTS.
TRUST MUST REMAIN REPLAYABLE.
```

**Jay creates. Zora expresses. Git remembers. Replay repays trust.**
