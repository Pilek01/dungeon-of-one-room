# Online v3 Phase 3B2B2A: standard relic offers and rarity policy

Status: implemented as an isolated, `test-only` pure ruleset. It is not
connected to active Worker routes, D1, Wrangler, or the browser game.

Protected baseline commit:
`f98820c99066d810169e100beb23a54a332734bd`.

Previous Phase 3B2B1 hash:
`sha256:ca964ec0ce54dd9ea550e4814fb4cc151a699da01d1970637e30cd25c64bf800`.

Phase 3B2B2A hash:
`sha256:fdfe7524ecee5c597f4e1fa87bddef1165c23291edc82092cfa12e2cc7b244a9`.

Both hashes are unreleased history. The descriptor remains `test-only` and
registry resolution remains fail-closed.

## Audited reward-source inventory

The generator reads the active v0.8 baseline and emits an exact-schema
12-source inventory:

| Source ID | Classification | 3B2B2A | Reason |
|---|---|---:|---|
| `starting-fixed` | starting | no | already implemented in 3B2B1 |
| `standard-chest` | standard chest | no | baseline chest table has no relic outcome |
| `warden-standard-drop` | standard boss reward | yes | unambiguously standard regular relic source |
| `arena-reward-cache` | special room reward | no | special-source policy deferred |
| `crossroads-power` | special room reward | no | Crossroads-specific policy deferred |
| `otter-crimson-chest` | special room reward | no | Otter-specific offer and pity deferred |
| `forge-temper` | special room reward | no | Forge-specific offer and pity deferred |
| `forge-transmute` | replacement reward | no | replacement policy deferred |
| `merchant-relic-slot` | Merchant | no | Merchant policy deferred |
| `merchant-reserved-relic` | Merchant | no | Merchant policy deferred |
| `merchant-black-market` | replacement reward | no | Merchant replacement policy deferred |
| `vault-standard-chest` | special room reward | no | baseline Vault chest has no relic outcome; Vault policy deferred |

Each record includes source file/symbol, category, room and depth domain,
choice count, allowed rarities, rarity weights, pity state, restrictions,
reward-slot requirement, implementation flag, and a stable deferred reason.
Generation fails on an unknown, duplicate, or unclassified active source.

Generated additions:

```text
data/relic-reward-sources.generated.json
data/relic-rarity-policy.generated.json
data/relic-pity-policy.generated.json
data/regular-relic-offer-policy.generated.json
```

## Common public choice contract

Starting and regular offers use one allowlisted public choice projection:

```js
{
  choiceId,
  relicId,
  rarity,
  currentStacks,
  resultingStacks,
  slotCost,
  resultingSlotsUsed,
  resultingSlotLimit
}
```

The server retains the private canonical choice map. Public offers exclude
that map, `privateRelicId`, and `issuedStateDigest`. Selection accepts exactly
`offerId` and `choiceId`; client relic ID, rarity, stack count, cost, capacity,
or resulting build fields are rejected.

The maximum implemented three-choice public regular offer serializes to
1141 UTF-8 bytes, below the generated 2048-byte target.

## One-time reward slot and regular offer

A standard boss `RoomRewardEnvelopeV3` receives exactly one private
`relic_offer` slot bound to the Warden source. Ordinary chest envelopes
receive no relic slot because v0.8 chest outcomes are health, healing, attack,
armor, potion, map fragment, gold, or trap only.

The private regular offer is bound to:

```text
runId, rulesetHash, revision, source directive, reward envelope,
reward slot, source type, source ID, canonical build digest
```

Offer and choice IDs are deterministic, opaque, domain-separated HMAC values.
The same state and secret reproduce the same result after retry or restart;
another run or RNG purpose receives different IDs.

Issuance consumes the slot exactly once. A no-drop result stores `no_drop` and
increments the Warden miss streak once. A drop stores `offer_issued`, resets
the streak, and binds the offer ID. Exact retries are no-ops.

Selection revalidates every binding and the canonical build digest, maps the
opaque choice on the server, applies exactly one acquisition, consumes the
offer and reward slot, and writes a bounded receipt. Exact selection retries
return the stored state; a changed choice fails closed. Gold, lives, depth,
room revision, and unrelated meta state do not change.

## Exact v0.8 Warden rarity and pity

| Depth | Drop | Normal | Rare | Epic | Legendary |
|---:|---:|---:|---:|---:|---:|
| 5-9 | 45% | 75% | 25% | 0% | 0% |
| 10-14 | 50% | 55% | 30% | 15% | 0% |
| 15-19 | 55% | 45% | 25% | 20% | 10% |
| 20-24 | 60% | 45% | 30% | 20% | 5% |
| 25-95 | 60% | 35% | 30% | 22% | 13% |

Each missed Warden drop adds `0.15` to the next drop chance, capped at
`0.95`; three prior misses guarantee the next drop. The streak is run-scoped,
serialized in `relicOfferState`, and updated only when a new bound reward slot
is resolved.

At eligible depths, mythic is a pre-roll equal to 5% of the tier's legendary
weight, capped at 2%. The remaining rarity weights are then normalized and
rolled cumulatively using canonical integer units. Depths below 15 cannot
produce legendary or mythic relics.

Only the run-scoped Warden miss streak is implemented. The persistent
first-drop depth flag and Forge/Otter room pity are explicitly deferred
because this phase cannot verify them as run-scoped regular-offer state.

## Candidate filtering and unresolved states

Each of up to three choices rolls a rarity, filters the generated relic
catalog by source, depth, boss eligibility, unlocked rarity, ownership,
stack cap, uniqueness, mutual exclusion, legendary/mythic caps, and resulting
slot capacity, then selects without duplicate relic IDs.

If the rolled rarity has no legal candidate, v0.8 falls back to all otherwise
legal unlocked rarities for the Warden source. If fewer than three legal
candidates remain, the offer contains fewer choices. An empty pool fails
closed as `UNRESOLVED_EMPTY_RELIC_POOL`; this phase does not invent gold,
replacement relics, or another reward.

## Verification

The golden corpus contains exactly 58 fixtures with:

```text
fixtureId, legacySourceEvidence, sourceType, initialMetaState,
rewardEnvelope, rewardSlot, serverRandomInputs, expectedRarity,
expectedCandidatePool, expectedOffer, selection, expectedBuild,
expectedPityState, expectedError, expectedRulesetHash
```

It covers source classification, all rarity boundaries, mythic eligibility,
pity transitions and exact retries, slot/envelope/directive/run/hash binding,
candidate filters, empty and short pools, all selections, forged fields,
consumption, canonical build updates, public projection, serialization,
restart determinism, and bounded receipts.

Property tests execute 5,000 seeded Warden offers and 250 illegal client
selection attempts. They check determinism, no duplicate choices, legal
rarities, canonical capacity and stacks, exactly-once pity/slot changes,
ID separation, fail-closed selection, and unchanged unrelated state.

## Explicitly deferred

Phase 3B2B2A does not implement Vault, Arena, Crossroads, Otter, Merchant,
Forge, replacement rewards, mutator/skill/elixir offers, Camp, lives, score,
leaderboard, relic effect activation, Worker endpoints, client/game
integration, push, or deployment. The next planned phase is 3B2B2B for
special relic sources.
