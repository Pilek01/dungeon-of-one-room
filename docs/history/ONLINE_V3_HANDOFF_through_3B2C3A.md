# Online v3 handoff — through Phase 3B2C3A

Date: 2026-07-26

Workspace: `D:\Codex workstation\Dungeon\dungeon-online-v3`

Protected baseline: `f98820c99066d810169e100beb23a54a332734bd`
## Phase 3B2C3A outcome

Commit:

```text
0a9ca773979b4873883a4f7636045054093f1cf3
Implement Online v3 canonical relic reward fallback policy
```

Phase 3B2C3A completes the v0.8 relic fallback audit and implements a pure,
source-bound evaluator plus atomic canonical transitions. Empty Warden, Otter,
and future Arena candidate pools close with no substitute reward. A canonical
existing Otter stored reward that resolves empty awards 50 base gold; the
future Arena equivalent awards the confirmed 60 base gold. Both flow through
the authoritative gold ledger and canonical modifiers.

Stale rewards, expired offers, unavailable sources, and impossible
replacements fail closed without a gold award. Explicit replacement
cancellation consumes the selected incoming reward while preserving the build.
Client-supplied reasons, amounts, choices, source IDs, and gold deltas never
become authority.

The implementation adds 60 schema-complete fixtures, a 5,000-case seeded
property run, payload/retry regressions, canonical generated data, and manifest
coverage. Arena issuance remains absent. Active endpoints, fixture ruleset,
D1, `recent_ops`, Wrangler, client modules, and the browser game are unchanged.

```text
previous hash: sha256:f4a24a19d229eed1b2d43b4e7b4d7385c2dae7ebf611153f286d6e3bd6cac0f1
current hash:  sha256:7c60b9af6bdf309c860c2daa2534a3d527d1469433921bc8db3766a654cb40f9
```

The maximum complete replacement projection remains 14,484 bytes. A
hypothetical `recent_ops` ring is approximately 176 KB at 12 entries and
352 KB at 24 entries. No optimization was implemented; compact deterministic
response reconstruction is deferred to Phase 3B2C4.

Detailed records:

```text
docs/ONLINE_V3_PHASE3B2C3A.md
docs/ONLINE_V3_PHASE3B2C3A_PAYLOAD_AUDIT.md
```

Next recommended phase: Phase 3B2C3B, canonical Arena relic offer issuance,
without game integration or ruleset activation.

Completed commits:

```text
0fe1423 Add Online v3 architecture and no-op boundary
52e363e Implement isolated Online v3 Worker and fixture tests
22633d4 Add Online v3 baseline regression smoke
```

The Phase 2.5 commit subject is:

```text
Validate Online v3 Worker against local Cloudflare runtime
```

The Phase 3A local commit subject is:

```text
Map v0.8 meta-progression for Online v3 ruleset
```

The Phase 3B1 local commit subject is:

```text
Implement Online v3 room directives and deterministic ruleset RNG
```

The Phase 3B2A local commit subject is:

```text
Implement Online v3 reward envelopes and authoritative gold ledger
```

The Phase 3B2B1 local commit subject is:

```text
Implement Online v3 starting relic offer and canonical build ledger
```

The Phase 3B2B2A local commit subject is:

```text
Implement Online v3 standard relic offers and rarity policy
```

The Phase 3B2B2B1 local commit subject is:

```text
Implement Online v3 Otter relic reward policy
```

The Phase 3B2B2B2 local commit subject is:

```text
Resolve Online v3 Vault and Arena relic source classifications
```

The Phase 3B2C1 local commit subject is:

```text
Implement Online v3 canonical run modifiers and derived effects
```

The Phase 3B2C2 local commit subject is:

```text
Implement Online v3 canonical relic replacement transactions
```

## Phase 3B2C2 outcome

Phase 3B2C2 completes the production-v0.8 replacement audit and adds one
server-derived acquisition evaluator with `ACQUIRE_DIRECT`,
`REQUIRE_REPLACEMENT`, and `REJECT` results. The canonical pending transaction
binds run, ruleset hash, revision, build digest, source offer, source choice,
reward slot, immutable incoming relic and opaque candidate IDs.

Every candidate is a complete final-build simulation. Normal stack targets
lose one stack while unique targets are removed completely. Incoming Abyssal
Reliquary applies its +2 slot bonus before its cost. Removing Abyssal or Crown
Concord is filtered when the lower resulting slot/legendary limit would make
the build invalid. The legacy multi-step Abyssal mythic shift is represented
as one atomic removal bundle, preserving all complete baseline outcomes
without exposing partial-loss intermediate saves.

Starting, Warden and Otter selection use the shared evaluator. A replacement
selection locks the incoming offer choice and reward slot until an opaque
commit or confirmed baseline cancel. Commit/cancel consume the offer and slot
once, store a bounded receipt and support exact retry and JSON restart
determinism. Starting remains direct-only because a valid starting build is
empty.

Arena dependencies are now:

- canonical run modifiers: `RESOLVED`;
- `extraRelicChoices`: `RESOLVED`;
- global relic replacement transaction: `RESOLVED`;
- replacement reward fallback for an empty/stale stored cache: `OPEN`.

Arena is therefore ready for normal legal pools and full-slot settlement, but
not for its empty-pool behavior. No Arena offer is implemented in this phase.
Merchant, Forge, Crossroads, Vault, endpoint, D1, client and game integration
also remain untouched.

Phase 3B2C2 adds 60 schema-complete golden fixtures and a 5000-case seeded
property run. The largest complete public projection is 14484 bytes for the
10-slot composite Abyssal case; all legal bundles are retained rather than
truncated to the preferred 8 KiB target.

```text
previous hash: sha256:b4d227a665bd9f059e79b69b4db21a202b826313787af0d6c6cd39ae737cad5a
current hash:  sha256:f4a24a19d229eed1b2d43b4e7b4d7385c2dae7ebf611153f286d6e3bd6cac0f1
```

Detailed record:

```text
docs/ONLINE_V3_PHASE3B2C2.md
```

Next recommended phase: implement the Arena relic offer and its explicit
replacement-reward fallback policy, without activating the ruleset until that
separate phase passes.

## Phase 3B2B2B2 outcome

Phase 3B2B2B2 is classification-only. A complete mechanical call-graph and
outcome audit resolves Vault as `NOT_AN_ACTIVE_RELIC_SOURCE` and adds a
generator guard that requires an explicit new policy if the baseline ever
gains a Vault relic path.

Arena is confirmed as an active relic source after two waves, at eligible
non-boss depths 40-99. It remains `BLOCKED_BY_REPLACEMENT_POLICY`: its offer
count is `3 + extraRelicChoices`, and baseline selection can enter the global
replacement state after offering a candidate that does not fit. Phase 3B2C1
now resolves the canonical Ascension/run-modifier dependency, but the
replacement contract remains open. No Arena policy, slot, RNG, public payload,
or replacement flow was added.

The ruleset remains disconnected and `test-only`. Active Worker endpoints,
fixture ruleset, D1, `recent_ops`, Wrangler, HTTP contracts, browser game and
client modules are unchanged. This phase adds 14 honest classification
fixtures. The exact record is:

```text
previous hash: sha256:154cdecaf014a21fffa7a5e02953e1353d126b24f700f39efcbc2f9ea5c66003
current hash:  sha256:ea3412fcc8a7456105b7243774538677a423f65bf16c8c977227d5cde8b08a7b
```

## Phase 3B2C1 outcome

Phase 3B2C1 inventories all ten active baseline mutators and adds four
source-bound generated documents: catalog, effects, selection policy, and
metadata/scope classification. The canonical v08 meta-state now owns a compact
`runModifiers` ledger with sorted active entries, active count, SHA-256 digest,
and derived-effects version.

`applyCanonicalRunModifierSelection` is a pure, fail-closed transition for
`TRUSTED_RULESET_DOMAIN` only. It is not exposed through the active Worker.
Unknown IDs and activation sources, duplicate non-stackable IDs, removals,
replacement, and more than three active modifiers are rejected. Profile
unlocks remain `DEFERRED_PROFILE_UNLOCK_VALIDATION`; profile and game-session
state are not imported.

`deriveRunModifierEffects` is now the only mutator effect projector used by
gold and regular relic offer policies. Gold no longer reads
`canonicalBuild.mutators`. Ascension projects `extraRelicChoices = 1`: Warden
and the future Arena adapter therefore use four choices instead of three.
Starting remains fixed at three and Otter remains fixed at nine.

Arena remains `BLOCKED_BY_REPLACEMENT_POLICY`. Canonical run-mod state and
`extraRelicChoices` are `RESOLVED`; the replacement contract is `OPEN`.

Phase 3B2C1 includes 40 executable golden fixtures and a 5000-case seeded
property run. The ruleset remains disconnected and `test-only`; game files,
active endpoints, fixture ruleset, D1, `recent_ops`, Wrangler, and HTTP
contracts remain unchanged.

```text
previous hash: sha256:ea3412fcc8a7456105b7243774538677a423f65bf16c8c977227d5cde8b08a7b
current hash:  sha256:b4d227a665bd9f059e79b69b4db21a202b826313787af0d6c6cd39ae737cad5a
```

Next step: Phase 3B2C2 — global canonical relic replacement transaction
contract, still without `game.js` integration or ruleset activation.

```text
docs/ONLINE_V3_PHASE3B2B2B2.md
```

Next recommended phase: canonical mutator/run-mod state and the global
replacement transaction contract. Do not begin Arena issuance until both are
available.

## Phase 3B2B2B1 outcome

Phase 3B2B2B1 audits 12 active or suspected special relic sources and
implements only the exact Otter Crimson-chest reward in the disconnected
`test-only` ruleset.

Vault stopped at `UNRESOLVED_ACTIVE_RELIC_SOURCE`: `vault-room.js` controls
Guardian/chest availability, while `game.js:openChest` uses
`lootTablesApi.rollChestOutcome`, whose active table has no relic result. No
Vault relic slot, pool, rarity policy, RNG or synthetic test success was
invented.

Otter now receives one source-bound `RoomRewardEnvelopeV3` slot after an
already-issued legal Otter directive. It offers up to nine unique canonical
rare+ choices using the exact non-boss depth rarity formula and independent
Otter RNG namespaces. It reuses `selectRegularRelic`, canonical build
validation and the shared eight-field public choice projection. Empty pools
fail closed; replacement-dependent full-build behavior remains deferred. The
room scheduler and its game-session-scoped pity remain unchanged.

The previous Phase 3B2B2A hash was:

```text
sha256:fdfe7524ecee5c597f4e1fa87bddef1165c23291edc82092cfa12e2cc7b244a9
```

The Phase 3B2B2B1 hash is:

```text
sha256:154cdecaf014a21fffa7a5e02953e1353d126b24f700f39efcbc2f9ea5c66003
```

The descriptor remains `test-only`; active endpoints still use the fixture
ruleset. The browser game, client modules, D1, `recent_ops_json`, Wrangler and
HTTP contracts are unchanged.

Verification adds exactly 50 fixtures, 3000 seeded Otter offer/selection
property cases and 250 illegal-selection immutability cases. The maximum
public Otter payload is 2271 bytes; Vault payload is not applicable.

Phase 3B2B2B1 validation:

```text
generator drift check:       PASS
unit/fixture tests:          331 pass, 0 fail
real runtime/D1 tests:         9 pass, 0 fail
combined:                    340 pass, 0 fail
headed game baseline smoke: PASS
```

Detailed record:

```text
docs/ONLINE_V3_PHASE3B2B2B1.md
```

Next recommended phase: Arena reward policy, before the transaction-heavy
Crossroads/Merchant/Forge/replacement work.

## Phase 3B2B2A outcome

Phase 3B2B2A adds an exact 12-source v0.8 relic-reward inventory, a common
safe public choice projection for starting and regular offers, and the
server-issued standard Warden relic flow.

Standard boss reward envelopes now contain one private, one-time relic-offer
slot. Ordinary and Vault chest tables contain no relic outcome in the active
baseline, so no chest relic slot was invented. Vault, Arena, Crossroads,
Otter, Forge, Merchant, and replacement sources retain explicit deferred
reasons for Phase 3B2B2B.

The Warden policy reproduces the exact depth-tier drop and rarity weights,
mythic pre-roll, three-choice behavior, no-duplicate candidate selection, and
the verifiable run-scoped miss streak. The persistent first-drop flag and
Forge/Otter room pity remain deferred. Empty legal pools fail closed instead
of synthesizing a replacement reward.

Regular issuance and selection are bound to run, ruleset, revision, room
directive, `RoomRewardEnvelopeV3`, reward slot, source, and canonical build
digest. Exact retries are idempotent; forged, stale, foreign, mismatched, or
already-consumed operations fail closed. The public three-choice payload is
1141 bytes and excludes the private choice map and state digest.

The previous Phase 3B2B1 hash was:

```text
sha256:ca964ec0ce54dd9ea550e4814fb4cc151a699da01d1970637e30cd25c64bf800
```

The Phase 3B2B2A hash is:

```text
sha256:fdfe7524ecee5c597f4e1fa87bddef1165c23291edc82092cfa12e2cc7b244a9
```

The descriptor remains `test-only`; neither hash was activated. Active Worker
routes, fixture ruleset, D1 schema, `recent_ops_json`, Wrangler configuration,
browser game, CSS, assets, and audio are unchanged.

Verification adds exactly 58 golden fixtures, 5,000 seeded Warden-offer
property cases, and 250 illegal-selection immutability cases.

Phase 3B2B2A validation:

```text
generator drift check:       PASS
unit/fixture tests:          265 pass, 0 fail
real runtime/D1 tests:         9 pass, 0 fail
combined:                    274 pass, 0 fail
headed game baseline smoke: PASS
```

Detailed record:

```text
docs/ONLINE_V3_PHASE3B2B2A.md
```

Next planned phase: 3B2B2B special relic sources.

## Phase 3B2B1 outcome

Phase 3B2B1 adds the complete 58-relic v0.8 inventory, five generated
canonical relic policy documents, an authoritative grouped relic ledger,
stable build digest and safe public projection, plus the fixed mandatory
starting offer for `fang`, `plating`, and `lucky`.

New runs remain `awaiting_starting_relic` with no room directive until a valid
opaque `offerId`/`choiceId` selection is accepted. Selection advances the
revision, writes exactly one canonical relic acquisition, archives a bounded
consumed receipt, and only then issues the first room directive. Exact retries
are no-ops; changed, stale, foreign, unknown, and forged selections fail
closed.

The generator now also reads active `relic-runtime.js`,
`merchant-curation.js`, and `boss-campaign.js`, and writes:

```text
relic-catalog.generated.json
relic-stack-policy.generated.json
relic-slot-policy.generated.json
starting-relic-policy.generated.json
relic-build-metadata.generated.json
```

The previous Phase 3B2A hash was:

```text
sha256:29df5d1f7b5cb4042e1abbe77a625b7e2250fffce13e6d9ca37f41fffe07665f
```

The Phase 3B2B1 hash is:

```text
sha256:ca964ec0ce54dd9ea550e4814fb4cc151a699da01d1970637e30cd25c64bf800
```

The descriptor remains `test-only`; neither hash was activated. Active Worker
routes, D1, `recent_ops_json`, Wrangler, game files, CSS, assets and audio are
unchanged.

Verification adds exactly 33 executable golden fixtures, 1,000 seeded
offer/selection runs, and 1,000 seeded catalog acquisition sequences.

Phase 3B2B1 validation:

```text
generator drift check:       PASS
unit/fixture tests:          191 pass, 0 fail
real runtime/D1 tests:         9 pass, 0 fail
combined:                    200 pass, 0 fail
headed game baseline smoke: PASS
```

Explicitly deferred: all non-starting relic offers, rarity/pity, Merchant,
mutator/skill/elixir offers, Camp, Forge, Pact, lives, score, leaderboard,
relic effect activation, endpoint/client integration, push and deployment.

Detailed record:

```text
docs/ONLINE_V3_PHASE3B2B1.md
```

## Phase 3B2A outcome

Phase 3B2A adds an isolated private `RoomRewardEnvelopeV3`, bounded room-result
claims, canonical v0.8 gold modifiers, a compact authoritative gold ledger,
deterministic anomaly reason codes, and a 26-entry inventory of active gold
sources. The public directive exposes only `rewardEnvelopeRef`; the full
envelope remains private canonical state.

The generator now also writes:

```text
gold-sources.generated.json
gold-modifiers.generated.json
room-reward-bounds.generated.json
chest-reward-bounds.generated.json
```

It records active source hashes and rejects an unclassified change to the
active `grantGold` call set. The Phase 3B2A corpus contains 36 executable
golden fixtures plus property tests over 1,000 deterministic envelopes.

The previous Phase 3B1 hash was:

```text
sha256:8096931c55e096a51c6e2a5a84fcc7faf3d814bdaa24db6abb1dd613f00b16b5
```

The Phase 3B2A hash is:

```text
sha256:29df5d1f7b5cb4042e1abbe77a625b7e2250fffce13e6d9ca37f41fffe07665f
```

Both are test-only history; neither is an activated production ruleset.
Registry resolution remains fail-closed. Active Worker routes, the fixture
ruleset, D1 schema, `recent_ops_json` limit 24, Wrangler configuration, and the
browser game are unchanged.

Honesty boundary: room-clear amounts and canonical modifiers are derived by
the Worker. Enemy, elite, hazard, and chest results are only bounded client
attestations. A modified client can still claim the maximum allowed local
result; the envelope limits the scale but does not prove combat. Void Reaper,
Chaos Orb, and offer-empty fallbacks remain heuristic/deferred.

`pendingOffer` remains `null`. No starting relic, relic, mutator, skill,
elixir, Merchant, Camp, Forge, Pact, lives, score, leaderboard, endpoint,
client integration, push, or deployment is part of 3B2A.

Detailed record:

```text
docs/ONLINE_V3_PHASE3B2A.md
```

## Phase 3B1 outcome

Phase 3B1 implements and tests, in isolation:

- deterministic generated canonical data for depth/start rules, room types,
  eligibility, region weights and special-room priority;
- HMAC-SHA-256 ruleset RNG with rejection-sampled bounded integers, choice and
  shuffle helpers;
- canonical initial meta state for entrance and unlocked checkpoint starts;
- exact server-issued `RoomDirectiveV3` IDs, nonces and seeds;
- sequential depth/revision consumption, boss/final priority and special-room
  limits;
- 25 executable golden fixtures and seeded full-run property tests;
- manifest/source drift checks and old-hash immutability behavior.

The descriptor status is `test-only`. Direct construction exists solely for
isolated tests; registry resolution fails closed. `src/index.js` and
`src/local-fixture-entry.js` do not import the registry or `v08-meta-1`.
No browser client, active Worker route, D1 migration, endpoint, reward,
economy, build, score or deployment behavior changed.

The detailed implementation record is:

```text
docs/ONLINE_V3_PHASE3B1.md
```

Phase 3B1 validation:

```text
generator drift check:       PASS
unit/fixture tests:          108 pass, 0 fail
real runtime/D1 tests:         9 pass, 0 fail
combined:                    117 pass, 0 fail
headed game baseline smoke: PASS
```

The headed report confirms Classic and HD Shrine, Vault guardian, audio
inventory/toggle, all 32 cheat-menu options, Observer Bot, saved-run Continue,
Final Defeat, zero `/api/v3` requests in Practice, zero console errors, zero
page errors and zero unexpected request failures. Screenshots and JSON reports
remain ignored under `output/online-v3-baseline`.

## Historical Phase 3A outcome

Phase 3A audited the active v0.8 meta sources and added:

- a machine-tested authority matrix separating exact, issued, bounded,
  heuristic and client-only rules;
- a recommendation for a server-issued room/reward manifest with bounded
  combat attestation;
- a minimal RoomDirectiveV3 and server-issued offer/inventory design;
- an HMAC-SHA-256 RNG interface with a separate planned RNG secret;
- a fail-closed registry and `spec-only` `v08-meta-1` skeleton;
- source-drift and canonical ruleset manifest generation with `--check`;
- a 22-scenario golden fixture manifest and five specification examples;
- a measured `recent_ops_json` audit;
- an eight-hook Phase 3B plan that never awaits from input, turn, AI,
  animation or render loops.

No production policy was implemented. `createV08Meta1Ruleset()` intentionally
throws, and `src/index.js` does not import the new registry.

Detailed documents:

```text
docs/ONLINE_V3_RULESET_AUTHORITY_MATRIX.md
docs/ONLINE_V3_RULESET_DESIGN.md
docs/ONLINE_V3_RECENT_OPS_AUDIT.md
docs/ONLINE_V3_PHASE3B_HOOK_PLAN.md
```

## Local Cloudflare runtime

Wrangler is a project-only dev dependency pinned exactly to `4.114.0`.
`package-lock.json` records the same version. Nothing is installed globally.

Local-only files:

```text
cloudflare/leaderboard-v3/wrangler.local.jsonc
cloudflare/leaderboard-v3/src/local-fixture-entry.js
cloudflare/leaderboard-v3/test-e2e/local-runtime.test.mjs
cloudflare/leaderboard-v3/test-e2e/d1-storage-atomicity.test.mjs
```

`wrangler.local.jsonc` uses:

- Worker name `dungeon-online-v3-local-fixture`;
- D1 binding `DB`;
- database name `dungeon-online-v3-local-fixture`;
- non-production placeholder UUID `00000000-0000-0000-0000-000000000003`;
- fixture season `fixture-season`;
- the fixture-only entrypoint and ruleset;
- no production account, database ID, remote binding, or external service.

The E2E runner generates a random HMAC secret in memory and passes it only in
the child Wrangler process environment. No secret is committed or written to
the report. Manual `npm run dev` requires a local untracked `.dev.vars` or an
equivalent process environment value for `RANKED_V3_HMAC_SECRET`.

Useful commands:

```text
npm run d1:migrate:local
npm run dev
npm run test:e2e:local
npm run validate:unit
npm run validate
```

All local D1 files, Wrangler state, logs, and reports are written under ignored
`output/` or ignored `.wrangler/`. No remote command or deployment is used.

Final local validation:

```text
npm run validate
unit/fixture tests:       65 pass, 0 fail
real runtime/D1 tests:     9 pass, 0 fail
combined:                 74 pass, 0 fail
```

The machine-readable runtime report is ignored at:

```text
output/online-v3-worker-e2e/local-e2e-summary.json
```

## Real D1 schema

`0001_initial.sql` was applied by Wrangler to persistent local D1.

Application tables:

```text
ranked_runs
leaderboard_entries
```

Required index:

```text
leaderboard_entries_season_score_created
```

Wrangler/Miniflare additionally creates internal bookkeeping tables
`_cf_METADATA` and `d1_migrations`; these are not application data tables.
There is no command, event, frame, replay, or idempotency table.

Real schema checks cover primary keys, SQLite types, required `NOT NULL`
columns, both table column sets, and the leaderboard index.

## Runtime findings

All six routes were exercised through real HTTP:

```text
POST /api/v3/runs/start              201
POST /api/v3/runs/checkpoint         200
POST /api/v3/runs/event              200
POST /api/v3/runs/finalize           200
GET  /api/v3/leaderboard             200
GET  /api/v3/leaderboard/:runId      200
```

Rows were read back from the same persistent D1 after each lifecycle stage.
Public GET responses contain no `canonical_state_json`, operation ring, secret,
or checkpoint token.

### Start idempotency correction

`ranked_runs.start_idempotency_key` is globally `UNIQUE`. The conflict lookup
now uses that same globally unique key instead of filtering by the new request
season. The stored canonical request digest then decides:

- same key and same payload: exact original `201` response and run ID;
- same key and changed player or season: `409 IDEMPOTENCY_KEY_REUSED`;
- parallel identical starts: two `201` HTTP responses representing one row and
  one run ID, with one response marked `x-idempotent-replay: 1`.

No JSON search and no third table are used.

### Concurrency and finalization

Real parallel requests with different idempotency keys produced:

```text
checkpoint:        200 + 409
reward_selected:   200 + 409
merchant_purchase: 200 + 409
finalize:          200 + 409
```

Depth, gold, relic, purchase, revision, and leaderboard publication were each
applied once. `recent_ops_json` stayed capped at 24 entries.

The real D1 adapter fault test verifies:

- controlled failure before `db.batch`: active run, zero leaderboard rows;
- failure in the second batch statement: the run update rolls back;
- simulated response loss after a successful batch: finalized run and exactly
  one leaderboard row remain together.

No split `finalized/no-entry` or `active/entry` state was observed.

### Restart and HMAC

Persistent D1 retained revision and state digest across a stopped/restarted
Wrangler process. The run then accepted another event, checkpoint, finalize,
and leaderboard read.

The same HMAC secret after restart verifies the old token. A different secret
returns `401 TOKEN_INVALID`. The real runtime also rejects correctly signed but
expired, other-season, other-ruleset, and noncanonical tokens. Tokens remain
compact base64url payload/signature pairs. Captured Wrangler logs contained no
secret and no full issued token.

### HTTP network loss

For start, checkpoint, event, and finalize, the test sent a real HTTP request,
discarded its response, then retried the exact serialized body and
`Idempotency-Key`. Every retry returned the stored response with
`x-idempotent-replay: 1`; no reward, charge, revision, run, or leaderboard row
was duplicated.

### Leaderboard

Real HTTP coverage includes multiple finalized fixture runs, score descending
ordering, `created_at` and run-ID tie stability, limit, cursor continuation,
no duplicates between pages, build details, missing run ID, and empty results
for another season.

## Measured local sizes

```text
start request                         182 bytes
checkpoint request                   1167 bytes
event request                         832 bytes
finalize request                      819 bytes
checkpoint token                      614 bytes
canonical_state_json                 1489 bytes
recent_ops_json at 24 operations    57767 bytes
leaderboard response, 20 rows        4356 bytes
build-detail response                 547 bytes
build_json                             105 bytes
```

There is no per-frame data, no per-command row, no full game save in a
checkpoint, and no combat replay in canonical state or build details.

## Baseline regression status

The committed headed runner verifies HTTP boot, Classic, HD, Shrine, Vault,
audio, HUD, cheat menu, Observer Bot, save/Continue, Final Defeat, zero
`/api/v3` requests, zero console errors, and zero page errors. Artifacts remain
under ignored `output/online-v3-baseline`.

Phase 2.5 changes none of:

```text
game.js
config.js
index.html
style.css
style-hd-*.css
assets/**
audio/**
cheat behavior
Observer Bot behavior
special-room behavior
loading screen baseline
```

`index.html` still loads no Online v3 module, and the active game client still
contains no `/api/v3` fetch.

## Still deliberately not done

- no supported/production v0.8 `RulesetV3` (Phase 3B1 is `test-only`);
- no browser fetch client, retry queue, or game hooks;
- no leaderboard UI integration;
- no production D1 resource or secret;
- no push, deployment, rebase, merge, or worktree.

Next step: Phase 3B2 reward/offer/economy policy against the generated room
directive, still without integrating `game.js` or activating Worker routes.
