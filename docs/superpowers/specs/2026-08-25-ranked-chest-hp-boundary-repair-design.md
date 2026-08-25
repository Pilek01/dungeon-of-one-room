# Ranked chest HP boundary repair — design

Date: 2026-08-25
Status: APPROVED
Baseline: `5b61a57c3feae5da29db389d49f7f99199c90099`

## Confirmed regression

The production Observer Bot trace reaches a canonical health chest in the
second run. The browser applies the issued `+5 Max HP` immediately and submits
`combatResources.maxHp = 105`, while the Worker has already recorded the chest
bucket but still compares the request with `build.resources.maxHp = 100`.
`validateBoundaryCombatResourcesV08` rejects the valid request, the checkpoint
endpoint returns `500`, and recovery resumes the same room and depth.

This is a shared Ranked checkpoint defect, not an Observer Bot decision defect.
The same failure can affect any player who receives a canonical health chest
while `boundedCombatResources` is enabled.

## Required invariant

`build.resources.maxHp` is the effective canonical maximum for the active run.
It includes the base/Vitality maximum, active canonical max-HP effects, and the
additive health total derived from `campaign.chestBonuses`. A client value is
accepted only when it equals that server-derived effective maximum.

The client remains authoritative only for bounded current combat HP. It never
selects a chest result or supplies a stat amount. Gold, inventory, chest slots,
campaign bonuses, maximum HP, and eligibility remain Worker-controlled.

## Settlement order

For a cleared room with a valid server-issued health chest:

1. Validate the issued chest slot, award ID, outcome, envelope bindings, and
   replay identity exactly as today.
2. Increment the canonical health depth bucket.
3. Derive the health-flat delta from the canonical ledger; do not trust a
   client amount.
4. Add that delta once to canonical `maxHp` and `hp`, matching the local v0.8
   immediate health-upgrade behavior.
5. Validate submitted `combatResources` against the resulting maximum and
   store the bounded submitted HP.
6. Recompute the existing build digest and commit the room atomically.

Attack and armor chest awards continue to use the canonical campaign ledger
and local combat presentation. Fatal and emergency boundaries do not grant
the stat award. Exact replay cannot apply the delta twice.

## Campaign carry and Camp interaction

When a later run is hydrated from the same Ranked profile, the Worker rebuilds
the base/Vitality maximum and then adds the canonical carried health-flat total
once. The run starts at that effective full HP. Start New Ranked still resets
the chest ledger and therefore removes the carry.

Camp Vitality scales only the base maximum. The additive chest health total is
temporarily removed from the calculation and added back afterward, preventing
rounding drift or multiplication of chest bonuses. Merchant Full Heal and
other active-run policies continue to operate on the effective maximum.

## Failure behavior

An unissued or forged maximum remains rejected with
`BOUNDARY_COMBAT_RESOURCES_MAX_MISMATCH`. No tolerance, fallback acceptance, or
Observer Bot exception is added. HTTP error classification is outside this
repair because changing the status alone would leave the canonical state
inconsistent and preserve the replay loop.

## Release compatibility

The production hash present before this repair remains registered as a
historical production descriptor with the same capability contract. The
browser protocol accepts both the repaired current hash and that prior hash,
so an already-started run can still resume after a later deployment. This is a
local source binding only in this phase; no production activation occurs.

## Verification

- Observe a RED domain regression for health chest settlement with bounded
  combat resources before modifying implementation code.
- Cover immediate `100 -> 105`, exact replay, forged `106`, fatal/emergency,
  profile carry, Start New Ranked reset, and Vitality plus additive chest HP.
- Run the focused Worker tests, ruleset generator, syntax/manifest checks,
  `verify:phase`, the affected headed Ranked Camp scenario, and
  `git diff --check`.
- Push, production activation, Worker deployment, Pages deployment, migrations,
  and ruleset activation require a separate user approval after local evidence.
