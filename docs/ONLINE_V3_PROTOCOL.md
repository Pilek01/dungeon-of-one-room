# Dungeon Online v3 protocol

Status: Milestone R2 local contract. The real `v08-meta-1` browser/Worker/D1
lifecycle is integrated locally; the ruleset remains test-only and production
is gated.

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

Registered start requires the ruleset ID/hash, anonymous profile ID and
credential, an independent run recovery credential, and the client protocol
version. The raw credentials are never returned by the Worker or stored in D1.
An exact retry must resend the identical body and operation key.

```json
{
  "playerName": "Player",
  "season": "local-season",
  "gameVersion": "v0.8.0",
  "rulesetId": "v08-meta-1",
  "rulesetHash": "sha256:...",
  "clientProtocolVersion": "ranked-v3-checkpoint-1",
  "clientInstallIdHash": "non-secret-signal",
  "profileId": "profile_...",
  "profileCredential": "client-held-secret",
  "recoveryCredential": "different-client-held-secret"
}
```

The response is either a bootstrap offer or, for a hydrated extracted profile,
an active first room. Production start additionally requires configured edge
abuse control.

## Checkpoint

`POST /api/v3/runs/checkpoint`

The strict registered body contains the current run/token/directive/nonce,
`roomResult: "cleared"`, bounded reward claims, turn/time counters, journal
digest, compact proof, and `clientProtocolVersion`. Unknown top-level fields
return 400. The Worker verifies the boundary and advances exactly one canonical
room. The compact proof is bounded client attestation, not proof of combat.

## Meta event

`POST /api/v3/runs/event`

The strict body contains run/token/directive/nonce, one supported event type,
its exact event-specific payload, and `clientProtocolVersion`. Bootstrap relic
selection uses its separate bootstrap token and exact offer/choice IDs. Costs,
choices, rewards, replacement, lives, extraction, and resulting state are
resolved from stored canonical state.

## Finalize

`POST /api/v3/runs/finalize`

```json
{
  "runId": "run_...",
  "checkpointToken": "terminal-payload.signature",
  "clientProtocolVersion": "ranked-v3-checkpoint-1"
}
```

Only a canonical terminal boundary is accepted. Outcome, score, duration,
build, lives, and public summary are derived server-side. The run update and
single leaderboard insert execute atomically.

## Resume, abandonment, and Camp

`POST /api/v3/runs/resume` requires operation ID, run ID, independent recovery
credential, protocol version, and last known revision. Run ID, install hash, or
player name alone never authorize it. The response contains only the public
canonical projection and a state-correct fresh boundary token.

`POST /api/v3/runs/abandon` uses the same authentication and is idempotent.
Finalized runs are immutable. `POST /api/v3/profiles/camp` requires the profile
credential and permits `open`, `commit`, or `close` only after canonical
extraction and finalization.

`GET /api/v3/availability` needs no D1 binding. It reports supported protocol
versions, strict schema-policy version, compatibility, test-only or
production-gated availability, and never activates production.

## Leaderboard reads

`GET /api/v3/leaderboard?season=fixture-season&limit=20&cursor=...`

Returns a deterministic page ordered by score descending, then creation time and run ID ascending. The version-1 cursor is a strictly validated, client-controlled public seek tuple. Malformed/unsupported cursor data returns `400 LEADERBOARD_CURSOR_INVALID`; it never silently resets to page one. Compact rows exclude build data.

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

## Local R2 conformance

The complete unit/property/Worker suite, real Wrangler/D1 lifecycle, D1
atomicity fault test, and headed browser lifecycle exercise this contract.
Recovery and Camp survive Worker restart; the headed suite covers reload,
response loss, multi-tab takeover, extraction-to-Camp, and next-run profile
hydration. Recorder/checkpoint proof helpers remain explicitly test/spec-only.

This conformance does not authorize a production ruleset, remote migration,
shared abuse-control binding, deployment, or M5 rollout.