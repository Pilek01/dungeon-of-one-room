# Online v3 Phase 3B1 — room directives and deterministic ruleset RNG

Date: 2026-07-23

Status: implemented and tested in isolation as `test-only`. The active Worker,
local fixture entrypoint, browser game, D1 schema and deployed endpoints do not
load this ruleset.

## Scope and authority boundary

Phase 3B1 implements only:

- generated canonical run-progression and room-policy data from the protected
  v0.8 source commit `f98820c99066d810169e100beb23a54a332734bd`;
- deterministic ruleset RNG;
- initial meta state;
- server-issued `RoomDirectiveV3`;
- sequential room/depth progression and directive consumption;
- boss/final priority, region weighting and the existing special-room schedule;
- golden fixtures, seeded property tests and drift checks.

Combat, physical room layout, rewards, offers, economy, build mutations, life
loss, score, browser hooks and production Worker wiring remain out of scope.
Combat continues to run locally. The honest player-facing label remains
`Checkpoint Verified`; this is not full combat verification.

## Generated canonical data

`scripts/generate-online-v3-meta-rules.mjs` reads these active baseline files
as data and never executes or imports the browser IIFE:

| Source | Extracted policy |
|---|---|
| `game.js` | depth limits, start-depth checkpoints, room categories, region weights, Merchant/Vault rules and procedural priority evidence |
| `room-pity.js` | Forge and Otter pity depths |
| `expansion-content.js` | expansion-room minimum depths and region weights |
| `pact-room.js` | Pact minimum depth and depth-weight profiles |

It deterministically writes:

```text
data/source-manifest.generated.json
data/run-progression.generated.json
data/room-types.generated.json
data/room-eligibility.generated.json
data/special-room-policy.generated.json
data/ruleset-manifest.json
```

Each generated data document has a schema version, ruleset ID, protected source
commit, exact source hashes and canonical data. Output has stable ordering and
no wall-clock field. `--check` regenerates in memory and requires byte-for-byte
equality.

The manifest hashes every executable policy module, fixture/schema file and
canonical generated data file in `v08-meta-1`, including `index.js` and
excluding only the manifest itself to avoid a circular hash. The current
immutable content hash is recorded in `ruleset-manifest.json`. A later release
must create a new ruleset hash/version instead of changing files behind a hash
used by an existing run.

## Deterministic RNG

The production primitive uses HMAC-SHA-256 through Web Crypto with:

```text
domain: dungeon-online-v3/ruleset-rng/v1
binding: RANKED_V3_RULESET_RNG_SECRET
message fields: rulesetId, runId, revision, purpose, counter, length, blockIndex
```

Every field is length-delimited. Purpose strings separate room type, directive
ID, nonce, seed, bounded integer, choice and shuffle draws. Output expansion is
block-based and capped at 65,536 bytes.

Public helpers are:

```js
deriveRandomBytes(options)
deriveUint32(options)
deriveIntInclusive(min, max, options)
chooseIndex(length, options)
deriveShuffleOrder(length, options)
```

Inclusive integers use 64-bit rejection sampling before reduction, avoiding
modulo bias. The code never uses `Math.random()` or `Date.now()`. The ruleset
RNG secret is distinct from the checkpoint-token HMAC secret and never belongs
in source, D1, directives, manifests, responses or logs.

The fixed regression vector for the 48-byte draw is:

```text
d66e43a706cb24ddb90989d22804e50df179a9cfaa9493af1c1c063d2cab5d79
b64d0902b19e5538f839ce476471bdfd
```

The same vector also pins `uint32 = 2455657910`, bounded integer
`3196366757`, choice index `3`, and shuffle order `[1,2,6,4,0,5,7,3]`.

## Initial state and start depth

`createInitialMetaStateV08` binds:

- ruleset ID/hash, run ID and season;
- revision `0`, status `active`, start depth and the next sequential room;
- initial gold `0`, lives `5`, and an empty build;
- empty pending offer/inventory fields;
- bounded consumed directive-ID and nonce histories;
- room-schedule counters, statistics and timestamps;
- verification level `checkpoint_verified_v3`.

Entrance start `0` issues the first playable directive at depth `1`. Checkpoint
starts `11, 21, ..., 91` require the same depth in `unlockedStartDepths` and
issue that exact depth first. Other or locked start depths fail closed.

## Exact RoomDirectiveV3 contract

```js
{
  directiveId,
  runId,
  revision,
  roomIndex,
  depth,
  roomType,
  roomCategory,
  directiveSeed,
  roomNonce,
  specialRoomPayload,
  rewardEnvelope: null,
  offerPolicyRef: null,
  issuedAt,
  consumed: false
}
```

IDs, nonces and seeds are opaque deterministic values with separate RNG
purposes. The directive deliberately contains no map, coordinates, actors,
combat result, reward amount or offer. A retry against an unconsumed state
returns the existing directive instead of spending another draw.

Consumption requires the exact ruleset hash, run, revision, directive ID,
nonce, room index, depth, room type and a local `cleared` completion
attestation. Reuse, another run, a stale revision, skipped/regressed depth,
changed type or reused nonce is rejected. Accepted consumption advances exactly
one depth/revision, retains only the newest 64 consumed IDs/nonces and issues
the next directive. Consuming the final depth transitions to `victory`.

Room consumption explicitly asserts that gold, lives and build did not change.

## Progression and special rooms

Depth advances from 1 through 100. Every fifth depth is a boss, except depth
100 which is final and has highest priority.

Non-boss priority is:

1. queued Otter roll;
2. Forge pity at depth 21;
3. Otter pity at depth 41;
4. guaranteed Merchant at room index 8 when none was seen, and always at 18;
5. region Vault roll from its minimum depth;
6. weighted baseline and expansion room schedule.

Expansion minimum depths are generated for Ambush, Horde, Duel, Crossroads and
Blood Arena. Pact is disabled before depth 25 and uses the generated
depth-profile weights afterward. Existing minimum-depth fallbacks are preserved:
early Cursed/Forge becomes Treasure; early Merchant/Pact becomes Combat.

Otter is disabled on boss depths, begins at depth 20, is limited to three per
run, and uses the baseline chances `0.007` before depth 40 and `0.01` from depth
40. Boss and final priority prevents any special room from replacing those
depths.

## Unresolved source rules

Exactly two `UNRESOLVED_SOURCE_RULE` entries remain:

1. `forge-pity-game-scope`: the browser persists Forge pity across local runs
   in one game session, while Online v3 has no canonical cross-run game-session
   identity.
2. `otter-pity-game-scope`: the same ambiguity applies to Otter pity.

The test-only state exposes explicit history inputs so the policy is
deterministic without silently choosing a production persistence model.

Two known dependencies are deferred, not unresolved:

- Treasure Map forcing the next Vault depends on reward/economy state planned
  for Phase 3B2.
- Crossroads power-penalty exclusion depends on a local build effect planned
  for a later build-policy phase.

## Fixture and property coverage

The golden corpus contains 25 executable fixtures. Every fixture includes:

```text
fixtureId, sourceEvidence, initialMetaState, runId, revision, randomInputs,
operation, expectedDirective, expectedNextState, expectedRejection,
expectedRulesetHash
```

Coverage includes entrance/checkpoint starts, invalid starts, regular and
sequential rooms, skipped/regressed depth, directive/nonce reuse, other-run and
stale-revision directives, boss/final/victory, special eligibility and limits,
retry/restart determinism, a changed RNG secret, parallel same-revision issue,
ruleset mismatch, unknown hash and old-hash immutability.

Seeded property tests run complete depth-100 progressions and assert monotonic
depth/index, unique IDs/nonces, boss/final precedence, Otter limits, bounded
histories, state round-tripping, deterministic retry and unchanged
gold/lives/build.

## Isolation and release gate

`createV08Meta1Ruleset()` can be instantiated directly by isolated tests, but
its descriptor status is `test-only`. Registry resolution rejects it with
`RULESET_NOT_RELEASED:test-only`. Both active entrypoints remain free of
`v08-meta-1` and registry imports, so no current HTTP route can select it.

Phase 3B2 may add reward/offer/economy policy against the generated room
directive, still without browser integration. Before any production connection:

- resolve the two cross-run pity ownership rules;
- complete transaction and combat-settlement fixtures;
- inject the dedicated RNG binding through an inactive Worker integration;
- retain the old immutable hash alongside any new hash;
- rerun the full Worker and headed game baselines.
