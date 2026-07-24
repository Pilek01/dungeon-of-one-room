# Online v3 Phase 3B2B2B1: special relic source audit and Otter reward

Status: implemented as an isolated, `test-only` pure ruleset. It is not
connected to the browser game or active Worker endpoints.

Previous Phase 3B2B2A hash:

```text
sha256:fdfe7524ecee5c597f4e1fa87bddef1165c23291edc82092cfa12e2cc7b244a9
```

Phase 3B2B2B1 hash:

```text
sha256:154cdecaf014a21fffa7a5e02953e1353d126b24f700f39efcbc2f9ea5c66003
```

Both hashes are unreleased. Registry resolution still rejects the
`test-only` descriptor with `RULESET_NOT_RELEASED`.

## Audit result

The generated 12-source audit is
`special-relic-source-audit.generated.json`. Every row carries the required
20-field schema and exact legacy evidence.

| Source | Result |
|---|---|
| Vault standard chest | `UNRESOLVED_ACTIVE_RELIC_SOURCE`; not implemented |
| Otter Crimson chest | implemented in this phase |
| Arena reward cache | `READY_FOR_IMPLEMENTATION` |
| Crossroads POWER | `REQUIRES_TRANSACTION_PHASE` |
| Merchant relic slot | `REQUIRES_TRANSACTION_PHASE` |
| Merchant reservation | `REQUIRES_TRANSACTION_PHASE` |
| Merchant Black Market | `REQUIRES_TRANSACTION_PHASE` |
| Forge Temper | `READY_FOR_IMPLEMENTATION` |
| Forge Transmute | `REQUIRES_TRANSACTION_PHASE` |
| Global replacement rewards | `BLOCKED_BY_REPLACEMENT_POLICY` |
| Pact room | `NOT_AN_ACTIVE_RELIC_SOURCE` |
| Debug cheat relic picker | `NOT_AN_ACTIVE_RELIC_SOURCE` |

The companion `deferred-special-relic-spec.generated.json` is the executable
handoff for all sources not implemented here.

## Vault stop condition

The active v0.8 Vault has no relic reward. `vault-room.js` controls Guardian
and chest availability. `game.js:openChest` routes a surviving Vault chest to
`lootTablesApi.rollChestOutcome`, and `loot-tables.js:rollChestOutcome` has no
relic result. Chest survival changes the ordinary chest claim and fixed Vault
gold bonus, not a relic pool or relic offer.

No Vault source ID, rarity table, choice count, RNG stream, selection path, or
synthetic property run was invented. Vault reward payload is therefore not
applicable.

## Otter policy

The existing Phase 3B1 scheduler remains the sole owner of Otter room chance
and occurrence state. This phase starts only from a legal issued Otter
directive and creates one `RoomRewardEnvelopeV3` relic slot.

The exact baseline reward policy is:

- legal depths 20-99, with boss depths excluded; the first effective depth is
  21;
- at most three issued Otter rooms per run;
- up to nine unique choices;
- canonical `rare`, `epic`, `legendary`, and `mythic` candidates with
  acquisition source `otter`;
- non-boss depth rarity formula from `rollRelicRarity(false)`;
- normal or unavailable rarity rolls fall back to any otherwise legal rare+
  Otter candidate;
- empty canonical pool fails closed as `UNRESOLVED_EMPTY_RELIC_POOL`;
- full-build replacement remains `BLOCKED_BY_REPLACEMENT_POLICY`.

Otter room scheduling uses 0.007 chance, 0.01 ultra chance and depth-41 pity.
The `otterSeenThisGame`/`otterPityUsedThisGame` state is classified
`GAME_SESSION_SCOPED` and remains
`DEFERRED_GAME_SESSION_SCOPED_PITY`; it is not copied into the run reward
state. The reward offer itself has no pity.

Otter has independent deterministic RNG purposes for rarity, candidate,
choice order, offer ID and choice ID. Exact retries reproduce the same offer.

## Shared selection and public contract

Otter uses the existing `RegularRelicOfferV3` and `selectRegularRelic`.
Selection accepts only opaque `offerId` and `choiceId`, revalidates
`canAcquireRelic`, writes the canonical build ledger, consumes the offer and
reward slot, and leaves gold, lives and depth unchanged. Exact selection retry
is idempotent.

The public projection remains the common eight fields:

```text
choiceId
relicId
rarity
currentStacks
resultingStacks
slotCost
resultingSlotsUsed
resultingSlotLimit
```

The measured maximum nine-choice Otter payload is 2271 bytes. It contains no
private choice map, RNG inputs, digest, HTML, tooltips or asset paths.

## Verification

Phase 3B2B2B1 adds exactly 50 schema-complete fixtures. Vault fixtures prove
the unresolved stop condition; they do not pretend to exercise a missing
offer. Otter coverage exercises directive/slot bindings, depth and run
boundaries, exact retry/restart, source isolation, candidate filtering,
selection/build ledger, serialization, payload and failure immutability.

Property coverage includes 3000 seeded Otter offer/selection runs and 250
illegal selection attempts. No synthetic 3000-offer Vault property run exists.

Final automated validation:

```text
generator drift check:       PASS
unit/fixture tests:          331 pass, 0 fail
real runtime/D1 tests:         9 pass, 0 fail
combined:                    340 pass, 0 fail
headed game baseline smoke: PASS
```

The browser game, `game.js`, HTML, CSS, audio, HUD, cheat menu, Observer Bot,
special-room implementation, client modules, active HTTP entrypoint, fixture
ruleset, D1 schema, `recent_ops_json`, Wrangler configuration and endpoint
contracts are unchanged.

Explicitly deferred: Arena, Crossroads, all Merchant relic transactions,
Forge Temper/Transmute, replacement rewards, Pact, mutator/skill/elixir
offers, Camp, lives, final score, leaderboard summary, client/endpoint
integration, push and deployment.
