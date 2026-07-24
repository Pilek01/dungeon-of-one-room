# Online v3 Phase 3B2B1: starting relic offer and canonical build ledger

Status: implemented as an isolated, `test-only` pure ruleset. It is not
connected to active Worker routes, D1, `recent_ops_json`, Wrangler, or the
browser game.

Protected baseline commit:
`f98820c99066d810169e100beb23a54a332734bd`.

Previous Phase 3B2A test-only hash:
`sha256:29df5d1f7b5cb4042e1abbe77a625b7e2250fffce13e6d9ca37f41fffe07665f`.

Phase 3B2B1 hash:
`sha256:ca964ec0ce54dd9ea550e4814fb4cc151a699da01d1970637e30cd25c64bf800`.

The hash is source-bound and is refreshed if any ruleset, generated data, or
golden fixture byte changes. Both hashes are unreleased history.

## Source inventory and generated policy

The generator reads the active `game.js`, `relic-data.js`,
`relic-runtime.js`, `loot-tables.js`, `merchant-curation.js`, and
`boss-campaign.js`. It inventories all 58 relics: 13 normal, 13 rare, 19
epic, 10 legendary, and 3 mythic.

Every catalog record contains:

```text
relicId, displayName, rarity, startingEligible, stackable, maximumStacks,
slotCost, unique, legendary, mythic, mythicRules, bonusRelicSlots,
mutuallyExclusiveWith, acquisitionSources, depthRestrictions,
bossRestrictions, goldModifierRef, buildMetadataFields, legacySourceFiles,
legacySourceSymbols, notes
```

Generated canonical files:

```text
data/relic-catalog.generated.json
data/relic-stack-policy.generated.json
data/relic-slot-policy.generated.json
data/starting-relic-policy.generated.json
data/relic-build-metadata.generated.json
```

Generation is deterministic, includes source byte lengths and SHA-256 hashes,
and has no timestamp. `--check` detects drift. Generation fails for duplicate
or unknown active relic IDs, a missing starting relic, a missing active source
symbol, or an unknown gold-affecting relic reference. It reads source text and
does not import the game, DOM, assets, or audio.

## Exact v0.8 inventory rules

- The fixed starting set and order are `fang`, `plating`, `lucky`.
- A starting choice is mandatory; skip is not legal.
- Base relic capacity is 8 occupied slots.
- Every copy consumes one slot.
- Only normal relics marked stackable can stack, to a maximum of 5.
- `ironboots`, `fieldrations`, `trapweave`, `cachekey`, `scoutlens`, and
  `shrineward` are non-stackable normal relics.
- Every rare, epic, legendary, and mythic relic is unique.
- The normal legendary limit is 1. `crownconcord` raises it to 2.
- At most 1 mythic relic may be owned.
- `abyssalreliquary` grants 2 bonus relic slots, including when acquired into
  an otherwise full 8-slot inventory.

`Golden Idol` is a rare, unique relic. Its canonical gold modifier is limited
to one ledger entry and one +15% contribution. The old Phase 3B2A generated
modifier record incorrectly reused the normal stack cap; Phase 3B2B1 corrects
that record to a cap of 1.

## Canonical build ledger

The ruleset owns:

```js
build: {
  relics: [{
    relicId,
    stacks,
    acquiredRevision,
    acquisitionSource,
    sourceOfferId
  }],
  relicSlotBase,
  relicSlotBonus,
  relicSlotLimit,
  relicSlotsUsed,
  uniqueRelicCount,
  totalRelicStacks,
  buildDigest,
  mutators,
  pacts,
  campUpgrades,
  skillTiers,
  elixirs
}
```

The last five fields are compatibility placeholders for already inventoried
future phases. This phase mutates only the relic ledger.

`buildDigest` is SHA-256 over canonical JSON of the relic ledger and derived
slot/count summaries, excluding the digest itself. Acquisition helpers clone
input, validate catalog membership, stacks, unique limits, legendary/mythic
policy and capacity, then return a new build.

`projectPublicBuild()` exposes only relic ID/stacks, capacity/count summaries,
and the digest. It omits acquisition revision, acquisition source, and private
offer ID.

The gold policy reads `relicId` and `stacks` only from this canonical ledger.
A client-supplied relic list, rarity, stack count, or claimed modifier does
not affect settlement.

## Starting OfferV3

After `createRun`, canonical state has:

```text
status = awaiting_starting_relic
currentRoomDirective = null
pendingOffer.offerType = starting_relic
```

The private offer has:

```js
{
  offerId,
  offerType: "starting_relic",
  runId,
  rulesetHash,
  issuedRevision,
  sourceType,
  sourceId,
  choices: [{ choiceId, privateRelicId }],
  publicChoices: [{
    choiceId, relicId, rarity, currentStacks, resultingStacks, slotCost,
    resultingSlotsUsed, resultingSlotLimit
  }],
  issuedStateDigest,
  expiresOnRevision,
  consumed,
  consumedChoiceId,
  consumedAtRevision
}
```

Offer and choice IDs are deterministic HMAC-derived opaque values with
separate RNG purposes. The same run/revision/secret survives retry and Worker
restart exactly; another run receives different IDs. Phase 3B2B2A replaces
the original ID-only projection with the common safe eight-field relic choice
projection. It still never includes `privateRelicId`, the private `choices`
collection, or `issuedStateDigest`.

`selectStartingRelic(metaState, { offerId, choiceId }, context)` is a pure
transition. It validates offer/run/ruleset/revision/choice binding, applies
exactly one canonical acquisition, advances the revision, changes status to
`active`, removes the pending offer, and stores a bounded consumed receipt.
The receipt archives the consumed offer fields and public result.

An exact retry returns the same state without another relic. A different
choice after consumption returns
`STARTING_RELIC_OFFER_ALREADY_CONSUMED_DIFFERENT_CHOICE`. Unknown, stale,
other-run, and other-ruleset selections fail closed.

Only after legal selection does the ruleset issue the first
`RoomDirectiveV3`. Direct room issuance while awaiting the starting choice
returns `RUN_NOT_ACTIVE`.

## Verification

The Phase 3B2B1 corpus contains exactly 33 executable golden fixtures with:

```text
fixtureId, legacySourceEvidence, initialMetaState, serverRandomInputs, offer,
request, expectedBuild, expectedPublicBuild, expectedNextStatus,
expectedError, expectedRulesetHash
```

Coverage includes offer shape and opacity, exact starting set/order,
deterministic retries/restarts, all three choices, binding failures,
consumption idempotency, ledger shape/projection/digest/serialization, stack
and slot limits, bonus slots, unique and mythic rejection, unknown/fake
fields, Golden Idol integration, ignored client build, and room
blocking/unlocking.

Property suites execute 1,000 seeded starting-offer/select/retry lifecycles
and 1,000 seeded catalog acquisition sequences. They verify determinism, ID
separation, exactly-once selection, stack/slot summaries, unique/mythic
limits, canonical serialization, bounded state, and absence of private
acquisition fields from the public build.

## Explicitly deferred

Phase 3B2B1 does not implement regular chest, boss, Vault or Otter relic
offers; rarity rolls or pity; Merchant; mutator, skill or elixir offers; Camp,
Forge or Pact actions; lives, score or leaderboard changes; activation of
relic effects; Worker endpoints; game-client integration; push; or deployment.
