# Online v3 Phase 3B2C1 — canonical run modifiers

## Boundary

This phase adds a test-only canonical representation for active v0.8 run
modifiers. It does not add a client offer, unlock/profile synchronization,
HTTP mutation, Arena offer, replacement transaction, score calculation,
leaderboard integration, Worker activation, game integration, or deployment.

The authoritative flow is:

`runModifiers -> deriveRunModifierEffects -> gold/reward/relic policies`

Profile unlock evidence remains untrusted and deferred. Only trusted ruleset
domain code can call the pure selection transition.

## Active baseline inventory

The generated catalog contains exactly the ten IDs read by active v0.8 code.
Every selectable entry is `RUN_SCOPED`, non-stackable, has a maximum of one
stack, and has no active baseline mutual-exclusion pair.

| modifierId | displayName | unlock source | runtime effects | gold | relic offer | enemy/room | profile dependency |
|---|---|---|---|---|---|---|---|
| `alchemist` | Alchemist | 25 merchant potions | +2 potion slots/potions, heal x1.30; chest healing disabled | +0.20 additive | none | none | `DEFERRED_PROFILE_UNLOCK_VALIDATION` |
| `ascension` | Ascension | depth highscore 30 | enemy ATK +0.03 per three maximum depths | +0.20 additive | `extraRelicChoices +1` | dynamic enemy ATK | `DEFERRED_PROFILE_UNLOCK_VALIDATION` |
| `berserker` | Berserker | 200 kills | ATK x1.25; max HP x0.75 | +0.20 additive | none | none | `DEFERRED_PROFILE_UNLOCK_VALIDATION` |
| `bulwark` | Bulwark | depth highscore 15 | armor x1.30; ATK x0.80 | +0.20 additive | none | none | `DEFERRED_PROFILE_UNLOCK_VALIDATION` |
| `elitist` | Elitist | 250 elite kills | elite chance +0.30; elite HP x1.25 | +0.20 additive; elite gold x1.60 | none | elite scaling | `DEFERRED_PROFILE_UNLOCK_VALIDATION` |
| `famine` | Famine | potion-free extraction | max HP x1.30; potion slots -3 (min 1); heal x0.50 | +0.20 additive | none | none | `DEFERRED_PROFILE_UNLOCK_VALIDATION` |
| `greed` | Greed | 12000 total gold | shop costs x1.25 | +0.40 additive | none | +2 enemies; enemy HP x1.20 | `DEFERRED_PROFILE_UNLOCK_VALIDATION` |
| `hunter` | Hunter | 90 elite kills | crit +0.20 | +0.20 additive | none | enemy damage x1.25 | `DEFERRED_PROFILE_UNLOCK_VALIDATION` |
| `momentum` | Momentum | depth highscore 20 | ATK +0.005 per maximum depth, rounded | +0.20 additive | none | enemy damage x1.15 | `DEFERRED_PROFILE_UNLOCK_VALIDATION` |
| `resilience` | Resilience | 60 shield uses in game | room-entry barrier = 0.20 max HP | +0.20 additive | none | enemy damage x1.20 | `DEFERRED_PROFILE_UNLOCK_VALIDATION` |

All ten selections use:

- `modifierKind: MUTATOR`
- `selectionMoment: BETWEEN_RUNS` or trusted `CAMP_MID_RUN_ACTIVATION`
- `stackable: false`
- `maximumStacks: 1`
- `mutuallyExclusiveWith: []`
- `serverCanRepresentExactly: true`
- `implementedInThisPhase: true`

The full requested inventory fields, source hashes, symbols, effect IDs, and
scope rows are generated in:

- `run-modifier-catalog.generated.json`
- `run-modifier-effects.generated.json`
- `run-modifier-selection-policy.generated.json`
- `run-modifier-metadata.generated.json`

The 22 legacy `state.runMods` fields are inventoried as derived effects or
non-mutator runtime state. They are not additional selectable modifier IDs.

## Scope separation

| state | unlockScope | selectionScope | runtimeScope | server representation | deferred dependency |
|---|---|---|---|---|---|
| active mutator | profile-gated | `RUN_SCOPED` | `RUN_SCOPED` | canonical active ledger | `DEFERRED_PROFILE_UNLOCK_VALIDATION` |
| normal unlock evidence | `PROFILE_SCOPED` | n/a | n/a | not implemented | `DEFERRED_PROFILE_STATE` |
| Resilience shield-use evidence | profile result with game-session evidence | n/a | n/a | not implemented | `DEFERRED_GAME_SESSION_STATE` |
| localStorage active/unlocked maps | client/profile persistence | n/a | n/a | untrusted | profile import not implemented |

No profile, account, localStorage migration, or client unlock list is accepted
by the ruleset.

## Canonical ledger and transition

`meta-state.js` owns:

```text
runModifiers.active[]
runModifiers.activeCount
runModifiers.modifierDigest
runModifiers.derivedEffectsVersion
```

Each active entry contains only `modifierId`, `stacks`, `activatedRevision`,
and `activationSource`. Entries are sorted by `modifierId`; the digest is
therefore independent of request order. Unknown IDs, sources, fields, stacks,
removals, replacements, and selections above the active limit fail closed.
Only `TRUSTED_RULESET_DOMAIN` may invoke the pure transition. No endpoint
exposes it.

## Derived effect contract

`deriveRunModifierEffects` returns one deterministic, versioned projection
covering gold, elite gold, relic choices, player start/dynamic modifiers,
potions, reward flags, economy, room entry/generation, enemy scaling, score,
lives, and canonical flags. Policies receive the projection; they do not
inspect arbitrary modifier IDs or client flags.

Gold keeps the exact v0.8 order: base/source modifiers are calculated first,
elite gold is applied to the enemy pre-grant, then the global additive
multiplier is applied with `Math.round`.

## Ascension and Arena

The exact baseline source is modifier ID `ascension`.

- inactive: `extraRelicChoices = 0`
- active: `extraRelicChoices = 1`
- future Arena adapter: `3 + extraRelicChoices`, therefore 3 or 4
- Warden draft: `3 + extraRelicChoices`, matching active baseline behavior
- Starting offer remains fixed at 3
- Otter offer remains fixed at 9

Arena remains `BLOCKED_BY_REPLACEMENT_POLICY`. Its run-modifier and
`extraRelicChoices` dependencies are `RESOLVED`; the replacement contract is
`OPEN`. No Arena offer or replacement flow is implemented here.

Ruleset hash:

- previous: `sha256:ea3412fcc8a7456105b7243774538677a423f65bf16c8c977227d5cde8b08a7b`
- Phase 3B2C1: `sha256:b4d227a665bd9f059e79b69b4db21a202b826313787af0d6c6cd39ae737cad5a`
