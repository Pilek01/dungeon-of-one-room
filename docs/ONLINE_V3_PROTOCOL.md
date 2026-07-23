# Dungeon Online v3 protocol

Status: isolated Phase 2 Worker contract plus Phase 3A ruleset design. No browser client or production ruleset is connected.

```text
base path: /api/v3
protocolVersion: ranked-v3-checkpoint-1
content type: application/json
verificationLevel: checkpoint_verified_v3
```

Every POST requires an `Idempotency-Key` header. The key is bound to the canonical digest of method, route, and body. An exact retry returns the original status/body and `x-idempotent-replay: 1`; reuse with another body returns `409 IDEMPOTENCY_KEY_REUSED`.

For start, `start_idempotency_key` has a global D1 `UNIQUE` constraint. After a
losing or repeated insert, the Worker retrieves the row by that unique key and
compares the stored request digest. This applies equally when the changed
payload changes `season`: exact content replays the original `201`; any changed
content returns `409`. Parallel identical starts create at most one run row.

Authenticated mutations contain `runId`, `checkpointToken`, `roomDirectiveId`, and `roomNonce`. The token binds the stored revision, state digest, season, ruleset, directive, and nonce. The client does not submit an authoritative revision separately.

## Start

`POST /api/v3/runs/start`

```json
{
  "playerName": "FixturePlayer",
  "season": "fixture-season",
  "gameVersion": "v0.8.0",
  "rulesetHash": "sha256:...",
  "clientInstallIdHash": "non-secret-one-way-identifier"
}
```

Success is `201` and returns `runId`, revision 0, `checkpointToken`, and canonical public `metaState` with the first server-issued room directive.

The Worker fails closed with `503` when a matching complete ruleset, HMAC secret, or D1 binding is unavailable. Phase 2 has no production ruleset.

## Checkpoint

`POST /api/v3/runs/checkpoint`

```json
{
  "runId": "run_...",
  "checkpointToken": "payload.signature",
  "roomDirectiveId": "directive_...",
  "roomNonce": "nonce_...",
  "roomResult": "cleared",
  "turnCount": 6,
  "elapsedMs": 12000,
  "commandJournalDigest": "hex-digest",
  "compactRoomProof": {
    "roomDirectiveId": "directive_...",
    "roomNonce": "nonce_...",
    "commands": [
      { "code": "move", "count": 4 },
      { "code": "attack", "count": 2 }
    ]
  },
  "clientSummary": {}
}
```

The Worker validates the current signed boundary, recalculates the journal digest when commands are present, applies exactly one ruleset-derived depth advance, and issues a new directive, nonce, digest, and token. Fields in `clientSummary`, including claimed depth, gold, build, offers, schedule, or score, are ignored.

## Meta event

`POST /api/v3/runs/event`

```json
{
  "runId": "run_...",
  "checkpointToken": "payload.signature",
  "roomDirectiveId": "directive_...",
  "roomNonce": "nonce_...",
  "type": "relic_selected",
  "payload": { "relicId": "server-offered-id" }
}
```

Allowed event names are `reward_selected`, `relic_selected`, `mutator_selected`, `skill_upgraded`, `elixir_selected`, `merchant_purchase`, `camp_upgrade`, `forge_action`, `pact_selected`, `life_lost`, and `extract`. Acceptance and all costs/effects come from the stored state and injected ruleset, never from client prices or resulting totals.

## Finalize

`POST /api/v3/runs/finalize`

```json
{
  "runId": "run_...",
  "checkpointToken": "payload.signature",
  "roomDirectiveId": "directive_...",
  "roomNonce": "nonce_...",
  "outcome": "defeat"
}
```

`outcome` is `victory`, `defeat`, or `extract`; extract requires an accepted prior extract event. The ruleset computes score and public summary. The run update and single leaderboard insert execute in one D1 batch. Client score/final-state fields are ignored.

## Leaderboard reads

`GET /api/v3/leaderboard?season=fixture-season&limit=20&cursor=...`

Returns a deterministic page ordered by score descending, then creation time and run ID ascending. Compact rows contain run ID, player name, score, depth, gold, duration, outcome, verification level, and creation time. Build data is excluded.

`GET /api/v3/leaderboard/:runId`

Returns the compact row plus season, public build, public summary, and final state digest. It excludes the canonical run state, checkpoint token, installation hash, idempotency history, and command journal.

## Errors and retry

Errors use:

```json
{
  "ok": false,
  "error": {
    "code": "REVISION_CONFLICT",
    "message": "Run changed before this operation committed."
  },
  "traceId": "uuid"
}
```

Important statuses:

| HTTP | Meaning |
|---:|---|
| 400 | invalid request/header/schema |
| 401 | invalid, mismatched, or expired checkpoint token |
| 404 | run, entry, or route not found |
| 409 | revision, state, room, ruleset, lifecycle, or idempotency conflict |
| 413 | request body exceeds 64 KiB |
| 422 | invalid proof, journal, command, offer, price/effect, or outcome |
| 503 | ruleset, HMAC secret, or D1 is unavailable |

Network retry rules:

1. Keep the exact serialized body and the same idempotency key.
2. Retry only after transport failure, timeout, or an explicitly retryable service response.
3. Do not alter or supersede a committed boundary until its response is reconciled.
4. Never discard or rewrite finalize.
5. Run retries outside input, combat, animation, audio, and HUD work.

The server stores only a bounded operation ring and the latest journal digest. The compact journal is heuristic evidence, not an authoritative combat replay.

## Local runtime conformance

Phase 2.5 executes this protocol through real HTTP on a local Wrangler
`4.114.0` process and reads the resulting rows from its persistent D1. Tests
cover:

- the six routes and their JSON/content-type/status contracts;
- exact network-loss replay for start, checkpoint, event, and finalize;
- one-winner optimistic concurrency for checkpoint, `reward_selected`,
  merchant purchase, and finalize;
- same-secret and different-secret restarts;
- expired, other-season, other-ruleset, noncanonical, and invalid-signature
  tokens;
- leaderboard order, limit, cursor, tie stability, details, missing IDs, and
  season isolation;
- absence of canonical state, operation history, secrets, and tokens from
  public reads and runtime logs.

This test runtime uses only the fixture ruleset. It does not establish or imply
a production v0.8 ruleset.

The Phase 3A `v08-meta-1` directory is `spec-only` and does not alter any route
or payload above. Future production offers must be opaque, bound to
run/revision/directive, and selected by ID; client prices and resulting totals
remain non-authoritative.
