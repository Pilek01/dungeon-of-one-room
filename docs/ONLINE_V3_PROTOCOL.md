# Dungeon Online v3 protocol contract

Status: design contract only. None of these endpoints is implemented in Phase 1.

Base prefix: `/api/v3`
Protocol: `ranked-v3-checkpoint-1`
Media type: `application/json`

## Common rules

Every authenticated mutation after start carries:

```json
{
  "runId": "run_...",
  "revision": 4,
  "idempotencyKey": "idem_...",
  "signedRunToken": "opaque.signed.token",
  "roomNonce": "room_nonce_..."
}
```

- `revision` is the revision the client expects the server to accept next.
- An idempotency key is bound to player, run, route, revision, and canonical request digest.
- Repeating the same request/key returns the original result.
- Reusing a key with different content returns `409 idempotency_conflict`.
- `roomNonce` binds a checkpoint/event to the currently issued room.
- The signed checkpoint token is opaque to the client. Proposed claims: token version, run ID, player ID, season, game version, ruleset hash, issued time, expiry, and token ID. It must not contain secrets or mutable full run state.
- The server response includes `traceId`. No response is required by movement, combat, animation, audio, or HUD code.

## `POST /api/v3/runs/start`

Creates one active Ranked run or returns an idempotent replay.

Request:

```json
{
  "idempotencyKey": "idem_...",
  "playerName": "Kamil",
  "installationId": "install_...",
  "season": "season-1",
  "gameVersion": "v0.8.0",
  "rulesetHash": "sha256:...",
  "clientStartedAt": "2026-07-23T12:00:00.000Z"
}
```

Success `201`:

```json
{
  "ok": true,
  "runId": "run_...",
  "revision": 0,
  "signedRunToken": "opaque.signed.token",
  "tokenExpiresAt": "2026-07-23T18:00:00.000Z",
  "season": "season-1",
  "gameVersion": "v0.8.0",
  "rulesetHash": "sha256:...",
  "roomDirective": {
    "id": "directive_...",
    "roomIndex": 1,
    "roomType": "combat",
    "roomNonce": "room_nonce_...",
    "seed": "opaque-seed",
    "rewardOffer": null,
    "merchantInventory": [],
    "specialRoomSchedule": []
  }
}
```

## `POST /api/v3/runs/checkpoint`

Accepts one complete `RankedStateV3` projection at a lifecycle boundary.

Request:

```json
{
  "runId": "run_...",
  "revision": 1,
  "idempotencyKey": "idem_...",
  "signedRunToken": "opaque.signed.token",
  "roomNonce": "room_nonce_...",
  "boundary": "room_cleared",
  "state": {
    "schemaVersion": 1,
    "runId": "run_...",
    "revision": 1,
    "season": "season-1",
    "gameVersion": "v0.8.0",
    "rulesetHash": "sha256:...",
    "status": "active",
    "depth": 7,
    "roomIndex": 8,
    "roomDirectiveId": "directive_...",
    "roomType": "combat",
    "roomNonce": "room_nonce_...",
    "gold": 143,
    "lives": 2,
    "build": {
      "relics": [{ "id": "vampfang", "stacks": 1 }],
      "mutators": ["greed"],
      "skillTiers": { "dash": 2, "aoe": 1, "shield": 1 },
      "elixirs": ["fury"]
    },
    "statistics": {
      "kills": 31,
      "eliteKills": 4,
      "bossesCleared": 1,
      "damageDone": 983,
      "damageTaken": 227,
      "potionsUsed": 2,
      "elixirsUsed": 1,
      "roomsCleared": 8,
      "commandsAccepted": 174
    },
    "rewardOffer": null,
    "merchantInventory": [],
    "specialRoomSchedule": [],
    "journalDigest": "8f21d0a4",
    "compactProof": {
      "version": 1,
      "roomDirectiveId": "directive_...",
      "roomNonce": "room_nonce_...",
      "roomIndex": 8,
      "roomType": "combat",
      "generationDigest": "44ad2a11",
      "clearDigest": "dc271a06",
      "commandCount": 174,
      "journalDigest": "8f21d0a4"
    }
  }
}
```

Success `200`:

```json
{
  "ok": true,
  "runId": "run_...",
  "acceptedRevision": 1,
  "nextRevision": 2,
  "acceptedJournalDigest": "8f21d0a4",
  "nextRoomDirective": {
    "id": "directive_...",
    "roomIndex": 9,
    "roomType": "merchant",
    "roomNonce": "room_nonce_...",
    "seed": "opaque-seed",
    "rewardOffer": null,
    "merchantInventory": [],
    "specialRoomSchedule": []
  }
}
```

## `POST /api/v3/runs/event`

Records a low-volume semantic event such as `life_lost`, `reward_selected`, `merchant_purchase`, `portal_entered`, or `extract_requested`. It never records individual movement/combat commands.

Request:

```json
{
  "runId": "run_...",
  "revision": 2,
  "idempotencyKey": "idem_...",
  "signedRunToken": "opaque.signed.token",
  "roomNonce": "room_nonce_...",
  "event": {
    "type": "life_lost",
    "eventId": "event_...",
    "depth": 10,
    "roomIndex": 11,
    "payload": {
      "lives": 1,
      "reasonCode": "player_hp_depleted"
    },
    "journalDigest": "51d0c1aa"
  }
}
```

Success `200` returns `acceptedRevision`, `nextRevision`, and the canonical accepted event ID.

## `POST /api/v3/runs/finalize`

Seals an active run and, if eligible, creates its single leaderboard row in the same logical operation.

Request:

```json
{
  "runId": "run_...",
  "revision": 12,
  "idempotencyKey": "idem_...",
  "signedRunToken": "opaque.signed.token",
  "roomNonce": "room_nonce_...",
  "terminalReason": "victory",
  "finalState": {},
  "journalDigest": "7ec92b18",
  "compactProof": {}
}
```

Success `200`:

```json
{
  "ok": true,
  "runId": "run_...",
  "status": "finalized",
  "acceptedRevision": 12,
  "score": 18420,
  "leaderboardEntryId": "entry_...",
  "eligible": true
}
```

An unreconciled or invalid run may return `eligible: false` with no leaderboard entry. A retry with the same idempotency key returns the original terminal result.

## `GET /api/v3/leaderboard`

Query:

```text
?season=season-1&limit=20&cursor=opaque
```

Success `200` returns up to 20 entries and an optional cursor. Each entry includes:

```json
{
  "entryId": "entry_...",
  "rank": 1,
  "playerName": "Kamil",
  "score": 18420,
  "depth": 100,
  "gold": 930,
  "lives": 1,
  "bossesCleared": 10,
  "finishedAt": "2026-07-23T12:40:00.000Z",
  "gameVersion": "v0.8.0",
  "build": {
    "relics": [{ "id": "vampfang", "stacks": 2 }],
    "mutators": ["greed"],
    "skillTiers": { "dash": 3, "aoe": 2, "shield": 3 },
    "elixirs": ["fury"],
    "bossDepthSummary": [
      { "depth": 10, "bossId": "warden", "outcome": "cleared" }
    ]
  }
}
```

## `GET /api/v3/leaderboard/:runId`

Returns the same public entry fields plus the complete public build and boss/depth summary. It never returns signed tokens, player IDs, installation IDs, private proof material, IP-derived data, or raw command journals.

## Errors

Canonical response:

```json
{
  "ok": false,
  "error": {
    "code": "stale_revision",
    "message": "Checkpoint revision is stale.",
    "retryable": false,
    "expectedRevision": 5
  },
  "traceId": "trace_..."
}
```

| HTTP | Code | Retry |
|---|---|---|
| 400 | `invalid_schema` | No |
| 401 | `invalid_token`, `expired_token` | Only after an explicit token recovery flow |
| 409 | `stale_revision`, `revision_gap`, `idempotency_conflict`, `room_nonce_mismatch`, `ruleset_mismatch`, `run_not_active` | No blind retry |
| 422 | `proof_rejected` | No; run becomes ineligible or needs review |
| 429 | `rate_limited` | Yes, honor `Retry-After` |
| 503 | `service_unavailable` | Yes |

Network failure, timeout, 408, 425, 429, and transient 5xx use bounded exponential backoff with full jitter: 500 ms base, 8 s cap, at most five attempts, always the same idempotency key and exact request body.

Retries occur outside input/combat/animation. The local game continues. Pending boundary work is bounded to one checkpoint plus a compact event queue; newer state may supersede an unsent non-terminal checkpoint only when the protocol can prove revision continuity. Finalize is never discarded or rewritten.

## Compact proof and journal digest

The browser recorder creates a canonical, sequence-numbered command journal with a chained digest. A compact room proof includes the directive ID, nonce, room index/type, generation digest, clear digest, command count and final journal digest. The journal snapshot additionally carries first/last sequence. Future production signing must use a cryptographic digest; the Phase 1 recorder’s small deterministic digest is a shape/test fixture only and is not a security primitive.

The server uses the proof for continuity and plausibility checks. It does not store one D1 row per command and does not claim to replay authoritative combat.
