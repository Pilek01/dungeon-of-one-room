# Dungeon Online v3 architecture

Status: Milestone R2 complete locally. The browser client is integrated with the
real local `v08-meta-1` registry and persistent D1. Production activation,
remote migration, deployment, and M5 remain unstarted.

## Boundary

Online v3 is checkpoint-authoritative meta progression around the unchanged v0.8.0 browser game. The server owns run identity, season and ruleset binding, revision, room directives and nonces, gold, lives, offers, inventory, build transitions, score, finalization, and leaderboard publication.

The browser remains authoritative for moment-to-moment movement and combat. No Worker request is made from input, turn resolution, enemy AI, animation, audio, HUD, Classic/HD presentation, cheats, Observer Bot, or special-room rendering. The game loop remains synchronous; Online v3 is reached only through narrow room, reward, fatal, extraction, and finalization boundaries outside moment-to-moment combat.

## Worker layout

`cloudflare/leaderboard-v3` is separated into four layers:

- `src/domain`: pure state transitions, room directives, idempotency records, scoring, and the injected `RulesetV3` interface;
- `src/security`: canonical JSON, SHA-256 digests, and compact HMAC checkpoint tokens;
- `src/storage`: D1 repositories for runs, profiles, and leaderboard reads/publication;
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

The active local Ranked runtime resolves an exact `rulesetId` and `rulesetHash`
through the registry. `v08-meta-1` implements the complete documented
meta-progression surface: profile hydration, starting relic, directives and
rewards, replacement/fallback, Merchant, Forge, Crossroads, Pact, canonical
lives/outcomes, extraction-to-Camp, finalization, and public projections.

The descriptor remains local/test-only. Production resolution and run start
fail closed unless an explicitly authorized release descriptor, D1, HMAC
secret, and distributed abuse-control binding are configured.

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

Migrations `0001`–`0003` create `ranked_runs`, `leaderboard_entries`, and
`ranked_profiles`. The run row contains canonical state, revision/digest,
current boundary, a bounded 12-operation replay ring, profile binding, and only
a derived recovery verifier. The profile row contains the canonical persistent
Camp/profile state and only a derived profile-credential verifier.

Finalization batches the conditional run update and guarded leaderboard insert.
Extraction batches the run mutation with the profile update. Optimistic
revision/state/status predicates make concurrent writers one-winner. Scheduled
cleanup removes expired non-finalized runs; finalized leaderboard entries are
preserved.

The leaderboard order and seek tuple are score descending, creation time
ascending, then run ID ascending. The versioned cursor is explicitly
client-controlled public seek data, not a cryptographic capability.

## Local R2 runtime

Wrangler `4.114.0` is pinned. Local conformance applies migrations `0001`–`0003`
and runs the real `v08-meta-1` registry through HTTP and persistent D1. Tests
cover exact replay, restart recovery, profile Camp, concurrency, atomic
finalization/extraction, retention, cursor semantics, and public projections.
The headed browser suite additionally covers reload, lost response, one-writer
tabs with takeover, extraction-to-Camp, and next-run profile hydration.

All runtime state stays under ignored `output/`. No production resource,
secret, remote database, activation, or deployment is created.

## Authoritative transitions

The R2 surface is:

```text
GET  /api/v3/availability
POST /api/v3/runs/start
POST /api/v3/runs/resume
POST /api/v3/runs/abandon
POST /api/v3/runs/checkpoint
POST /api/v3/runs/event
POST /api/v3/runs/finalize
POST /api/v3/profiles/camp
GET  /api/v3/leaderboard
GET  /api/v3/leaderboard/:runId
```

The Worker owns only documented meta-state. Registered mutations reject unknown
top-level fields and protocol mismatches. Resume requires an independent
recovery credential and returns only the public projection plus the correct
fresh token kind. Final score and public build are server-derived. Public reads
never expose tokens, credentials, canonical private state, or recent operations.

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

Retries stay outside gameplay/input/animation. The R2 browser client persists the exact pending operation, retries only bounded retryable failures, and uses authenticated canonical resume for conflicts or projection errors.

## Baseline guard

Tests continue to compare protected v0.8 behavior to commit
`f98820c99066d810169e100beb23a54a332734bd`. Practice remains local and emits
zero `/api/v3` requests. Online v3 hooks stay outside movement, combat, AI,
animation, audio, rendering, cheats, Observer Bot, and special-room gameplay.
The unrelated 172-path Vault Guardian deletion set remains unstaged and outside
all R2 commits.

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
