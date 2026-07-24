# Online v3 Phase 3B2B2B2 - Vault and Arena relic-source resolution

Date: 2026-07-24

Ruleset: `v08-meta-1`

Status: `test-only`; not imported by either active Worker entrypoint

Protected baseline: `f98820c99066d810169e100beb23a54a332734bd`

## Outcome

This phase is classification-only. Vault is conclusively
`NOT_AN_ACTIVE_RELIC_SOURCE`. Arena is an active relic source, but is
`BLOCKED_BY_REPLACEMENT_POLICY`; no Arena offer policy, RNG stream, reward
slot, payload, or synthetic offer fixture was implemented.

The previous ruleset hash was:

```text
sha256:154cdecaf014a21fffa7a5e02953e1353d126b24f700f39efcbc2f9ea5c66003
```

The Phase 3B2B2B2 hash is:

```text
sha256:ea3412fcc8a7456105b7243774538677a423f65bf16c8c977227d5cde8b08a7b
```

## Vault mechanical proof

`vault-room.js` controls the Guardian lifecycle, chest lock state, threat
markers and hazards. It contains no relic reference. After the Guardian is
defeated, `game.js:openChest` sends every surviving ordinary Vault chest
through `lootTablesApi.rollChestOutcome`.

The complete active chest outcome set is:

```text
health
healing
attack
armor
potion
map_fragment
gold
trap
```

There is no Vault branch in the stored relic-cache dispatch and no Vault
caller in the complete `buildRelicDraftChoices` call graph. Vault chest gold
and the fixed Vault bonus remain gold behavior, not relic replacement.

The generator now fails with `VAULT_RELIC_SOURCE_REVIEW_REQUIRED` if the
active outcome set, relic-draft builder call graph, stored relic-cache
dispatch, or `openChest` routing changes. A future Vault relic source must
therefore add an explicit new policy instead of silently inheriting this
classification.

## Arena active baseline contract

| Field | Baseline result |
|---|---|
| `sourceId` | `arena-reward-cache` |
| `legacySourceFiles` | `expansion-content.js`, `game.js`, `relic-data.js`, `relic-runtime.js` |
| `legacyFunctionOrSymbol` | `ROOM_TYPES.arena`, `ARENA_WAVE_COUNT`, `checkRoomClearBonus`, `spawnArenaRewardChest`, `openStoredRelicChest`, `chooseRelic` |
| trigger | issued non-boss Blood Arena room reaches zero enemies after its second wave |
| `roomType` | `arena` |
| minimum depth | 40 |
| maximum depth | 99 |
| run limit | no explicit per-run cap; every scheduler-selected eligible Arena can reward once |
| completion condition | both Arena waves cleared and no enemies remain |
| reward moment | `checkRoomClearBonus` calls `spawnArenaRewardChest` after the final clear |
| reward slot type | would be `relic_offer`; not implemented in this phase |
| offer choice count | `3 + extraRelicChoices`: 3 normally, 4 with Ascension |
| candidate pool | all rare+ relics passing baseline draft eligibility; no duplicate IDs in one offer |
| allowed rarities | rare, epic, legendary, mythic |
| rarity weights | non-boss depth formula; rolled-rarity miss falls back to the whole remaining rare+ pool |
| depth scaling | legendary `0.02 + floor(depth/5)*0.008`; epic `0.06 + floor(depth/5)*0.012`; rare `0.17`; mythic is 10% of legendary capped at `0.02` |
| pity | none for the reward and none for Arena room scheduling |
| source restrictions | non-boss Arena, rare+, owned unique excluded, capped normal stack excluded, second mythic excluded |
| slot policy | one stored `arena_reward` chest guarded by `state.arena.rewardSpawned` |
| selection required | no; the draft can be skipped |
| empty pool | no chest spawns; an already-present stale empty cache grants 60 baseline gold |
| full slots | a selected candidate can enter global replacement UI |
| replacement | `relicSwapPending` / `legendarySwapPending`; outside this phase |
| `serverCanIssueExactly` | false in the current canonical Online v3 state |
| bounded attestation | Arena completion must be bounded client attestation tied to Worker directive, envelope, slot, revision, nonce and state digest |

The Worker may own directive/envelope issuance, the one-time reward slot,
canonical build, IDs, RNG and choice projection. It cannot prove local combat,
positions, AI, damage, HP or the physical Arena layout. The client may not
authoritatively provide a relic ID, rarity, candidate pool, choice count,
stack count, or a slot ID outside the issued envelope.

## Why Arena was not implemented

Two independent blockers prevent exact issuance:

1. The active count is `3 + extraRelicChoices`; Ascension adds one, while
   canonical `meta-state.js` contains neither `extraRelicChoices` nor mutator
   state.
2. Baseline `buildRelicDraftChoices` does not filter slot capacity. A legal
   offered relic can enter the global replacement state only after selection.

Reducing the count to three or pre-filtering full-slot candidates would change
baseline behavior. Implementing replacement or mutator state would cross the
explicit phase boundary. Arena therefore remains active but
`BLOCKED_BY_REPLACEMENT_POLICY`.

## Deferred inventory

| Source | Status |
|---|---|
| Vault | `NOT_AN_ACTIVE_RELIC_SOURCE` |
| Arena | `BLOCKED_BY_REPLACEMENT_POLICY` |
| Crossroads | `REQUIRES_TRANSACTION_PHASE` |
| Merchant live relic | `REQUIRES_TRANSACTION_PHASE` |
| Merchant reservation | `REQUIRES_TRANSACTION_PHASE` |
| Merchant Black Market | `REQUIRES_TRANSACTION_PHASE` |
| Forge Temper | `READY_FOR_IMPLEMENTATION` |
| Forge Transmute | `REQUIRES_TRANSACTION_PHASE` |
| replacement rewards | `BLOCKED_BY_REPLACEMENT_POLICY` |
| Pact | `NOT_AN_ACTIVE_RELIC_SOURCE` |
| debug picker | `NOT_PRODUCTION_SOURCE` |

Each entry retains source evidence in
`deferred-special-relic-spec.generated.json`.

## Verification contract

This phase adds 14 classification fixtures, not Arena offer golden fixtures.
The tests assert the live Vault outcome/call graphs, the future-source
generator guard, the complete Arena lifecycle, both exact-issuance blockers,
and the absence of a synthetic Arena policy or reward slot. Arena property
offers and public payload are not applicable because no Arena offer exists.

No game, client module, active endpoint, fixture ruleset, D1 migration,
`recent_ops`, Wrangler configuration, HTTP contract, Merchant, Forge,
Crossroads, replacement flow, or production activation is changed.
