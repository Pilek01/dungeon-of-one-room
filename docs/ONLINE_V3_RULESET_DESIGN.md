# Online v3 ruleset design — Phase 3B1

Status: the room-progression slice is implemented as a pure `test-only`
ruleset. No production policy or browser module is connected, and the active
Worker routes still receive only the fixture ruleset in local tests. See
`ONLINE_V3_PHASE3B1.md` for the exact implementation, fixtures and unresolved
source rules.

## Honest authority boundary

Online v3 can own identities, revisions, room schedules, offers, inventories, prices, persistent progression, accepted gold ledger, score and leaderboard publication. Combat stays local. The Worker cannot directly observe damage, HP history, enemy movement, actual skill timing, an omitted death or the full legality of a clear.

The classes used by the audit are:

- `SERVER_DERIVED`: exact transition from canonical state and accepted operations.
- `SERVER_ISSUED`: server creates a directive/offer/inventory; client selects from it.
- `BOUNDED_CLIENT_ATTESTED`: client reports a local result and the Worker enforces a strict issued maximum.
- `HEURISTIC_ONLY`: useful plausibility evidence, but not proof.
- `CLIENT_ONLY`: unavailable to this architecture without moving combat simulation server-side.

The detailed inventory is in `ONLINE_V3_RULESET_AUTHORITY_MATRIX.md`.

## Gold model comparison

### Model A — exact client delta plus bounds

The client submits its gold delta and a reason breakdown. The server caps the delta using the room directive.

| Dimension | Assessment |
|---|---|
| Protection | Rejects absurd totals and negative-price tricks; weak against a plausible fabricated maximum every room. |
| v0.8 compatibility | Highest. Existing `grantGold` results can be summarized with minimal client change. |
| Client changes | Gold ledger instrumentation at every source and transaction. |
| Server data | Reward upper bounds, price tables and canonical multipliers. |
| D1 cost | Low; one compact checkpoint delta. |
| Remaining cheating | Client chooses any value inside the cap and can mislabel proc sources. |
| Implementation complexity | Low to medium. |

This is acceptable as a temporary bridge, but not as the target because raw gold remains client-selected.

### Model B — fixed room reward

The server ignores kill/chest composition and awards a fixed amount for the issued room profile.

| Dimension | Assessment |
|---|---|
| Protection | Strong for gold inflation; no client gold delta is trusted. |
| v0.8 compatibility | Low. It changes the economy because current rewards depend on enemy types, elites, chests, special rewards and procs. |
| Client changes | Small at checkpoints, but visible reward copy would diverge from local combat rewards. |
| Server data | One reward per room profile and deterministic transaction tables. |
| D1 cost | Lowest. |
| Remaining cheating | Fabricated room clears remain possible, but cannot inflate per-room gold. |
| Implementation complexity | Low, with high balance/design cost. |

This is not recommended for a compatibility-focused `v08-meta-1`.

### Model C — server-issued room manifest

The directive contains a compact encounter/reward manifest: allowed enemy types/counts, elite flags or maxima, boss reward, chest reward IDs/outcomes, room-clear profile and any special reward offer. The client reports which issued units/rewards were completed or consumed. The Worker derives the delta.

| Dimension | Assessment |
|---|---|
| Protection | Strongest compatible option. Gold is derived from issued inventory and capped defeated counts. |
| v0.8 compatibility | High if the first iteration issues counts/profile IDs rather than tile coordinates. |
| Client changes | Adapt room construction to the issued profile and report compact IDs/counts at boundaries. |
| Server data | Canonical reward tables, room schedules, special-room profiles, multipliers and offer state. |
| D1 cost | Moderate but still one state-row update per boundary; the manifest remains compact. |
| Remaining cheating | Client can falsely claim it defeated issued enemies or cleared the room. Hit/crit-triggered gold remains heuristic. |
| Implementation complexity | Highest of the three, but localized to ruleset data and boundary adapters. |

Recommendation: Model C with bounded combat attestation. Use server-derived fixed rewards for room-clear and transactions; issue enemy/chest maxima for combat-dependent rewards. For `Void Reaper` and turn/proc rewards, either cap and mark heuristic or exclude them from verified gold until their cadence can be issued. This gives casual tamper resistance without pretending to resist a determined reverse engineer.

## Phase 3B2A `RoomDirectiveV3` and private reward envelope

```js
{
  directiveId,           // unique opaque directive ID
  runId,                 // explicit run binding
  revision,              // state revision that issued it
  roomIndex,
  depth,
  roomType,
  roomCategory,
  directiveSeed,         // opaque seed; not the RNG secret
  roomNonce,
  specialRoomPayload,    // bounded policy descriptor or null
  rewardEnvelopeRef,     // opaque reference to private canonical envelope
  offerPolicyRef: null,  // deferred to Phase 3B2B
  issuedAt,
  consumed: false
}
```

The directive selects normal room type, boss/final phase, guaranteed Merchant,
Vault, Otter, Forge, Pact, Crossroads, Blood Arena, Shrine and other rare
rooms. Physical placement, actors and combat remain local. Phase 3B2A settles
only server-derived fixed awards and bounded client-attested enemy/chest
results. Offers remain deferred, and there is still no `buildRoom()` hook.

The full private `RoomRewardEnvelopeV3` is documented in
`ONLINE_V3_PHASE3B2A.md`. It never appears in the public directive.

Validity rules:

1. Bind to `runId + revision + roomIndex + depth + roomNonce`.
2. Consume exactly once at checkpoint, extract or terminal transition.
3. Reject a directive from another run/revision even if its type is plausible.
4. A newer accepted revision invalidates the previous directive.
5. Keep public data bounded; never expose the RNG secret or unused future schedule.

## Server-issued offers and inventory

| System | Required canonical data | RNG purpose | Validity/binding | Invalidation | RankedStateV3 storage | Existing UI |
|---|---|---|---|---|---|---|
| Relic draft | catalog, rarity weights, eligibility, caps, source profile | `relic-draft` | run/revision/directive/offer | choice, skip, transition | current offers + inventory | Reuse |
| Mutators | catalog, unlock evidence, active set | none for current all-unlocked selection surface | run/revision/menu offer | accepted selection/start | unlocks + active IDs | Reuse |
| Skill upgrades | tier table, current tiers, legendary requirement, prices | none | Merchant directive/revision/offer | purchase or room transition | skill tiers + offer | Reuse |
| Elixirs | catalog, unlock depths, loadout/charges, costs | none | Camp revision/catalog quote | buy/refill/discard/new revision | elixir loadout | Reuse |
| Merchant | relic pool, services, prices, reservation, purchase caps | `merchant-inventory` and `black-market-result` | run/revision/directive/offer | purchase, newer room, finalize; reservation has its own lifetime | inventory, reservation, counters | Reuse |
| Pact | pact catalog, minDepth, active pact | `pact-offer` | run/revision/directive/offer | select/replace/break/leave | offer + active pact | Reuse |
| Forge | depth profiles, catalog, build, sacrifice, legality | `forge-temper` or `forge-transmute` | run/revision/directive/offer/sacrifice | select/leave/new revision | offer, pending sacrifice, used flag | Reuse |
| Camp | upgrade catalog/levels/costs, relics, elixir, start unlocks | none for current choices | run/revision/Camp session | accepted transaction/new run | persistent meta state | Reuse |

Offer IDs must be opaque. The client sends only the offer ID and a legal selected ID, never a price, rarity, resulting inventory, level or resulting wallet.

## Deterministic server RNG

Interface:

```js
deriveRandomBytes({ secret, rulesetId, runId, revision, purpose, counter, length })
```

Phase 3B1 implements this primitive plus `deriveUint32`,
`deriveIntInclusive`, `chooseIndex` and `deriveShuffleOrder`.

- Algorithm: HMAC-SHA-256 through Web Crypto.
- Domain: `dungeon-online-v3/ruleset-rng/v1`.
- Message: length-delimited `rulesetId`, `runId`, `revision`, `purpose`,
  `counter`, requested length and block index.
- `purpose` is mandatory domain separation (`room-directive`, `merchant-inventory`, `relic-draft`, and so on).
- `counter` is monotonic within a purpose/revision and persisted when more than one draw is needed.
- Security randomness never uses `Math.random()`.
- RNG uses a planned separate binding `RANKED_V3_RULESET_RNG_SECRET`; it must not reuse `RANKED_V3_HMAC_SECRET`, which signs checkpoint tokens.
- Neither secret belongs in source, manifests, D1, responses or logs.

Inclusive integer sampling uses a 64-bit rejection threshold, so modulo
reduction is unbiased. The dedicated production binding is still not wired
into an active Worker.

## Versioned implementation and fail-closed registry

```text
cloudflare/leaderboard-v3/src/rulesets/
  registry.js
  v08-meta-1/
    index.js
    constants.js
    rng.js
    room-policy.js
    meta-state.js
    room-directive.js
    gold-policy.js
    reward-policy.js
    merchant-policy.js
    camp-policy.js
    forge-policy.js
    pact-policy.js
    life-policy.js
    score-policy.js
    leaderboard-summary.js
    data/
      source-manifest.generated.json
      run-progression.generated.json
      room-types.generated.json
      room-eligibility.generated.json
      special-room-policy.generated.json
      golden-fixtures.manifest.json
      ruleset-manifest.json
    test/
      phase3b1-golden-fixtures.json
```

`v08-meta-1` is `test-only`. Isolated tests can call its factory directly.
Registry resolution throws `RULESET_NOT_RELEASED:test-only`. The active Worker
does not import the registry or descriptor.

The registry is keyed only by the full ruleset hash:

- empty hash: fail closed;
- unknown hash: fail closed;
- duplicate descriptor hash: fail closed;
- known descriptor not marked `supported`: fail closed;
- only a known `supported` descriptor may instantiate;
- old hashes stay in the descriptor list so already-started runs can keep resolving the exact old implementation after a new version is introduced.

## Hash strategy

The generated `ruleset-manifest.json` lists SHA-256 and byte length for every executable policy module and canonical ruleset data file. The full ruleset hash is:

```text
sha256(canonicalJson({
  manifestVersion,
  rulesetId,
  files: [{ file, byteLength, sha256 }, ...]
}))
```

Only the manifest file itself is excluded to avoid a circular hash. `index.js`
and every other module are included. The registry descriptor reads the
generated hash. A production release must never mutate files behind an old
hash; it adds a new ruleset directory/hash instead.

## Generator and active source plan

`scripts/generate-online-v3-meta-rules.mjs` performs Phase 3B1 extraction and
drift control:

1. Reads only `game.js`, `room-pity.js`, `expansion-content.js` and
   `pact-room.js` from the protected baseline.
2. Parses the canonical progression, room, eligibility and special-room values
   and records exact byte lengths/SHA-256 values.
3. Writes five stable generated documents and hashes the complete versioned
   policy/data/fixture content into `ruleset-manifest.json`.
4. `--check` performs byte-for-byte verification and fails on source or generated-manifest drift.
5. It reads files as data; neither the Worker nor its presentation path imports `game.js`, DOM code or rendering functions.

The generator does not execute the browser IIFE under a fake DOM. It validates
schema versions, IDs, numeric ranges, stable ordering and generated-file parity.

The audit expected a `pact-data.js`; active v0.8 has no such file. Its source of truth is `pact-room.js` plus `pact-effects.js`.

## Golden fixture coverage

The executable Phase 3B1 corpus contains 25 room-progression scenarios. The
older 22-item full-ruleset inventory below remains a future coverage plan for
reward, economy, build, scoring and finalization phases.

1. start run;
2. regular room checkpoint;
3. boss depth;
4. issued special room;
5. relic offer and selection;
6. illegal relic choice;
7. mutator;
8. skill upgrade;
9. elixir;
10. Merchant purchase;
11. insufficient gold;
12. Camp;
13. Forge;
14. Pact;
15. life lost;
16. extract;
17. final victory;
18. final defeat;
19. duplicate operation;
20. stale offer;
21. score calculation;
22. `build_json`.

Every Phase 3B1 fixture contains:

```text
fixtureId, sourceEvidence, initialMetaState, runId, revision, randomInputs,
operation, expectedDirective, expectedNextState, expectedRejection,
expectedRulesetHash
```

The corpus is executed against the direct test-only factory. It is not imported
by the active Worker and is not production activation evidence.

## Verification wording

Machine value: `checkpoint_verified_v3`.

Player label: `Checkpoint Verified`.

Player explanation:

> Progression, build and score were checked by the server. Combat runs locally. The system catches typical manipulation, but it is not a complete anti-cheat.

No UI is changed in Phase 3B1.

## Phase 3B2B exit gate

Add server-issued starting relic/relic/mutator/skill/elixir offers and a
canonical build ledger against the generated room directive, still disconnected
from `game.js`. Merchant, Camp, Forge and Pact transactions remain later work.
Require a fresh review of the Merchant-buyback/runGoldEarned discrepancy before
any browser hook is added. Resolve the cross-run Forge/Otter pity ownership
before production activation.
