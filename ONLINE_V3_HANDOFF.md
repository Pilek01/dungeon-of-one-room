# Online v3 handoff - Phase 3B2A

Date: 2026-07-24

Workspace: `D:\Codex workstation\Dungeon\dungeon-online-v3`

Protected baseline: `f98820c99066d810169e100beb23a54a332734bd`

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
