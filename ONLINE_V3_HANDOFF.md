# Online v3 handoff - Phase 2.5

Date: 2026-07-23

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

- no production v0.8 `RulesetV3`;
- no browser fetch client, retry queue, or game hooks;
- no leaderboard UI integration;
- no production D1 resource or secret;
- no push, deployment, rebase, merge, or worktree.

Next step: map the real v0.8 meta rules into a versioned `RulesetV3`, still
without integrating `game.js`.
