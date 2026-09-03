# SLEEP_GOAL_ZORA_MAINTENANCE_V0_1

## STATUS: SLEEP_GOAL_SET
## TARGET: ZORA
## AGENT: jay-agent
## CONTROLLER_LABEL: jaywisdom.base.eth
## AUTHORITY: FALSE
## NO_FAKE_GREEN: TRUE

## Goal While Jay Sleeps

Keep the repo observable and better than it was introduced.

The agent does not mutate Zora, sign wallets, mint, trade, or claim final semantic truth. The agent only runs read-only maintenance pulses and leaves replay artifacts.

## 15-Minute Loop

Every pulse should answer:

1. What changed in the repo surface?
2. Which Zora / identity / receipt files are visible?
3. Are UNKNOWN or YELLOW surfaces preserved?
4. Did the repo drift from expected proof posture?
5. Is No Fake Green still active?
6. What should Jay inspect first when awake?

## Valuable Right Now

- Read-only repo visibility
- Zora surface inventory
- unknown preservation
- artifact upload for morning replay
- no wallet action
- no authority claim

## Boundary

```text
READ_ONLY_MAINTENANCE = GREEN
AUTONOMOUS_SIGNING = FALSE
AUTONOMOUS_MINTING = FALSE
SEMANTIC_TRUTH_FINAL = FALSE
AUTHORITY = FALSE
NO_FAKE_GREEN = TRUE
```

## Ruling

jay-agent is a maintenance observer, not a wallet agent.

Zora is the target surface.
GitHub is the mirror.
Base is the anchor surface.
Receipts decide reality.
