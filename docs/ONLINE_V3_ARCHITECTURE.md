# Dungeon Online v3 architecture

Status: Phase 2.5 Worker validated in a real local Wrangler/Miniflare runtime
with persistent D1. Phase 3B1 adds a pure, isolated `test-only`
`v08-meta-1` room-progression implementation and deterministic RNG. The active
Worker still does not import it, the browser game is not integrated, and
`index.html` does not load Online v3.

## Boundary

Online v3 is checkpoint-authoritative meta progression around the unchanged v0.8.0 browser game. The server owns run identity, season and ruleset binding, revision, room directives and nonces, gold, lives, offers, inventory, build transitions, score, finalization, and leaderboard publication.

The browser remains authoritative for moment-to-moment movement and combat. No Worker request is made from input, turn resolution, enemy AI, animation, audio, HUD, Classic/HD presentation, cheats, Observer Bot, or special-room rendering. The Phase 1 adapter remains synchronous, inert, and unloaded.

## Worker layout

`cloudflare/leaderboard-v3` is separated into four layers:

- `src/domain`: pure state transitions, room directives, idempotency records, scoring, and the injected `RulesetV3` interface;
- `src/security`: canonical JSON, SHA-256 digests, and compact HMAC checkpoint tokens;
- `src/storage`: D1 repositories for runs and leaderboard reads/publication;
- `src/http` plus `src/index.js`: request validation, routing, response mapping, orchestration, and dependency injection.

The pure boundaries `createInitialRun`, `applyCheckpoint`, `applyMetaEvent`, and `finalizeRun` return:

```js
{
  nextState,
  response,
  storageEffects
}
```

They do not call `fetch`, D1, or Web Crypto and do not mutate their input state.

## RulesetV3

Production behavior is fail-closed. A ruleset must have a non-empty matching `rulesetHash` and all six methods:

1. `createInitialMetaState`
2. `issueRoomDirective`
3. `resolveCheckpointRewards`
4. `validateMetaEvent`
5. `computeFinalScore`
6. `buildLeaderboardSummary`

Phase 2 contains only `test/fixtures/fixture-ruleset.js`. Its values are deterministic test data and are not v0.8 balance data. There is intentionally no production ruleset.

Phase 3B1 implements initial meta state, deterministic room scheduling,
server-issued room directives and strict sequential directive consumption in
`src/rulesets/v08-meta-1`. Its descriptor remains `test-only`, so registry
resolution fails closed with `RULESET_NOT_RELEASED:test-only`. Isolated tests
may call the factory directly. The active Worker and local fixture entrypoint
do not import the registry or descriptor, so this is not a production ruleset
or a second active HTTP behavior.

## Signed checkpoint token

The Worker reads `RANKED_V3_HMAC_SECRET` from the environment and rejects secrets shorter than 32 UTF-8 bytes. No secret is stored in source or `wrangler.toml`.

Token format:

```text
base64url(canonical JSON payload).base64url(HMAC-SHA-256 signature)
```

Claims are exactly the checkpoint binding:

```text
protocolVersion, runId, revision, season, rulesetHash, stateDigest,
roomDirectiveId, roomNonce, issuedAt, expiresAt
```

The payload must use canonical key ordering. Signing and verification use Web Crypto. Verification uses `crypto.subtle.verify`, avoiding application-level byte-by-byte signature comparison. D1 remains the source of truth; possession of a valid token never overrides the stored revision or state digest.

## D1 model

Migration `cloudflare/leaderboard-v3/migrations/0001_initial.sql` creates exactly:

- `ranked_runs`: one canonical state row per run, current revision and digest, current directive/nonce, bounded `recent_ops_json`, lifecycle timestamps, and start idempotency binding;
- `leaderboard_entries`: one public finalized entry per run, including the compact public build and summary.

It also creates `leaderboard_entries_season_score_created` for deterministic seasonal ordering.

There is no command, event, replay, or idempotency table. A bounded ring of 24 recent operations is stored in the run row. Exact key plus exact canonical request digest returns the stored response; the same key with different content returns `409 IDEMPOTENCY_KEY_REUSED`.

Normal mutations use:

```sql
UPDATE ranked_runs
...
WHERE run_id = ? AND revision = ? AND status = 'active'
```

Zero changed rows become `409 REVISION_CONFLICT`. Finalization batches the conditional update with a guarded insert. The insert requires both `changes() = 1` and the resulting finalized revision, so only the winner of the optimistic-concurrency race can publish.

Logical D1 budget:

| Endpoint | Reads | Writes |
|---|---:|---:|
| start | 0 | 1 |
| checkpoint | 1 | 1 conditional update |
| event | 1 | 1 conditional update |
| finalize | 1 | 2 in one batch |
| leaderboard list/detail | 1 | 0 |

An idempotent start retry may additionally read the row after its unique insert conflicts. `start_idempotency_key` is globally unique. The conflict lookup uses that key alone, then compares the stored canonical request digest. This makes a changed player, season, or any other request field return `409 IDEMPOTENCY_KEY_REUSED` while an exact retry returns the stored run ID and response.

## Local Phase 2.5 runtime

Wrangler `4.114.0` is pinned as a local dev dependency. `wrangler.local.jsonc`
selects `src/local-fixture-entry.js`, the fixture ruleset, fixture season, and
one local-only D1 binding with a non-production placeholder UUID. Production
`src/index.js` remains fail-closed without a real injected ruleset.

The E2E process generates an HMAC secret in memory, exposes it only to the child
`wrangler dev` process, and persists D1 exclusively under ignored `output/`.
The schema read from `sqlite_schema` contains the two application tables and
leaderboard index. `_cf_METADATA` and `d1_migrations` are internal local-runtime
bookkeeping, not additional application tables.

Real HTTP/D1 tests cover all six routes, parallel start and mutation races,
restart persistence, same/different-secret token verification, exact retries
after discarded responses, cursor stability, and public-field boundaries.

Finalization has an additional real D1 adapter fault test:

- an exception before `db.batch` changes neither table;
- a failure in the second batch statement rolls back the run update;
- loss after a successful batch leaves both the finalized run and its single
  leaderboard row committed.

This local entrypoint and its fixture ruleset are test infrastructure only. No
production D1 ID, secret, external service, deployment, or game connection is
created.

## Authoritative transitions

The Worker accepts only six routes:

```text
POST /api/v3/runs/start
POST /api/v3/runs/checkpoint
POST /api/v3/runs/event
POST /api/v3/runs/finalize
GET  /api/v3/leaderboard
GET  /api/v3/leaderboard/:runId
```

Client-supplied gold, depth, build, offer, inventory, schedule, and score are not copied into canonical state. The ruleset derives meta changes from the stored state and issued offers. Checkpoints advance exactly one depth and require the current directive, nonce, compact proof, bounded command set, plausible counters, and matching journal digest. Final score and public build summary are ruleset outputs. Published entries use:

```text
verification_level = "checkpoint_verified_v3"
```

The list endpoint is compact and excludes build details. The detail endpoint returns only public build and summary fields; it never returns tokens, canonical run state, operation history, or raw journal commands.

## Threat model and limitation

The journal digest, command allowlist, size limits, turn/time limits, directive, nonce, revision, and state digest provide continuity and plausibility checks. They do not prove an honest combat simulation.

A modified client can fabricate a plausible compact command journal and combat outcome between checkpoints. Online v3 therefore claims authoritative meta progression only, not authoritative combat. `checkpoint_verified_v3` is deliberately narrower than a server-simulated verification claim.

## Network loss

The client-side contract is to retain the exact serialized request body and the same `Idempotency-Key` until a terminal response is known:

- response lost after commit: resend exact request and receive the stored response;
- timeout before execution: resend exact request and execute once;
- finalize response lost: resend exact request; no second leaderboard row is created;
- exact replay remains available after the original token expires because the signature and stored operation binding are checked before current-token expiry;
- never change the body under an existing key.

Retries stay outside gameplay/input/animation. Phase 2 implements and tests server replay behavior only; it does not add a browser retry queue.

## Baseline guard

Tests compare protected baseline files to commit `f98820c99066d810169e100beb23a54a332734bd`, reject any Worker import of game/DOM/audio/HUD/renderer/Ranked v2 code, and assert that `index.html` has no Online v3 reference. Phase 2 changes no game, CSS, asset, audio, cheat, Observer Bot, or special-room implementation.

## Phase 3A design references

- `ONLINE_V3_RULESET_AUTHORITY_MATRIX.md`: v0.8 meta-rule inventory and honest authority class.
- `ONLINE_V3_RULESET_DESIGN.md`: gold/directive/offer/RNG/hash/generator/fixture design.
- `ONLINE_V3_RECENT_OPS_AUDIT.md`: measured operation-ring cost and deferred recommendation.
- `ONLINE_V3_PHASE3B_HOOK_PLAN.md`: maximum-eight-hook integration plan with no awaits in gameplay loops.
- `ONLINE_V3_PHASE3B1.md`: implemented room-directive/RNG scope, generated
  canonical data, fixtures, unresolved rules and the Phase 3B2 boundary.
- `ONLINE_V3_PHASE3B2A.md`: private reward envelopes, bounded client claims,
  generated gold inventory/modifiers, authoritative ledger, anomaly signals,
  fixtures, limits, and the Phase 3B2B boundary.
