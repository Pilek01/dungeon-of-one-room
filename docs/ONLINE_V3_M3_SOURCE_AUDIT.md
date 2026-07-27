# Online v3 M3 - active v0.8 end-of-run source audit

## Source boundary

- Protected source commit: `f98820c99066d810169e100beb23a54a332734bd`.
- Active `game.js` SHA-256:
  `a7d436f8cdde618e7bab802322a658d2055f201950d9ae7b4598269feff3df00`.
- Active `loot-tables.js` SHA-256:
  `9343a62db72aacd89d16ab0efa3c1fba0c40d08cc1e82e10795990299467e0a9`.
- `git diff f98820c... -- game.js loot-tables.js relic-data.js camp-runtime.js`
  is empty.
- Ranked v2 was not used as evidence.

## Canonical lives and death

| Rule | Active source evidence | Exact v0.8 behavior | Authority |
| --- | --- | --- | --- |
| Initial and maximum lives | `game.js:MAX_LIVES`, `resetMetaProgressForFreshStart` | Fresh progress starts with 5 lives and all gains are capped at 5. | Server-derived |
| Fatal event | `game.js:gameOver` | A locally observed fatal event first evaluates Chrono Loop, then Second Chance, then loses one life. The client can attest only that a fatal event occurred. | Bounded heuristic input; result server-derived |
| Chrono Loop | `relic-data.js:chronoloop`, `game.js:tryTriggerChronoLoop` | If owned and unused in the current life/run, prevent the fatal event once. No life is lost. | Canonical entitlement plus bounded fatal-event attestation |
| Second Chance | `game.js:gameOver`, Merchant `secondchance` service | If active after Chrono Loop is unavailable, consume it and prevent the fatal event. No life is lost. | Canonical entitlement plus bounded fatal-event attestation |
| Life loss | `game.js:gameOver` | If no prevention applies, decrement exactly one life, never below zero. | Server-derived after bounded fatal-event attestation |
| Death relic penalty | `game.js:loseRandomRelicOnDeath` | On an actual life loss, uniformly choose one owned non-Mythic relic copy and remove it. Empty/all-Mythic builds lose nothing. | Server-issued HMAC RNG |
| Nonterminal continuation | `game.js:gameOver`, `startRun({ carriedRelics, startDepth: 0 })` | With lives remaining, retain canonical meta/build state, clear transient room offers, restart at entrance depth, and reset per-life Chrono usage. | Server-derived |
| Terminal defeat | `game.js:gameOver`, `resetMetaProgressForFreshStart` | The accepted life loss that reaches zero is terminal defeat. Client-provided lives or defeat is never authoritative. | Server-derived |
| Life gain | `game.js:grantLife`, Merchant `onelife` service | The active non-debug life gain is the canonical Merchant extra-life purchase, capped at 5. | Server-derived transaction |
| Chest life blessing | `loot-tables.js:CHEST_BLESSING_LIFE_CHANCE` | The active chance is exactly 0; chest completion cannot add a life. | Not an active transition |

The baseline cannot prove that a modified local client reports every fatal event.
Online v3 therefore remains checkpoint-verified, not server-authoritative combat.

## Victory and terminal outcome

| Rule | Active source evidence | Exact v0.8 behavior |
| --- | --- | --- |
| Depth cap | `game.js:MAX_DEPTH`, `attemptDescend` | Maximum depth is 100; no descent beyond it is legal. |
| Victory trigger | `game.js:checkRoomClearBonus`, `triggerDepth100Victory` | Victory occurs only after the accepted final boss clear at depth 100. |
| Reward timing | `game.js:checkRoomClearBonus` | The final room-clear fixed gold is awarded before victory is triggered. |
| Online canonical state | `room-policy.js:consumeRoomDirectiveV08` | Consuming the canonical final directive settles its reward, clears the directive/envelope, increments completion statistics, then enters terminal victory eligibility. |
| Defeat | `game.js:gameOver` | Only the accepted life loss that makes canonical lives zero is terminal defeat. |

Pending room offers, replacement transactions, and room-local meta offers are
cleared by an actual life loss or extraction. A terminal state has no playable
room directive and cannot mutate before finalization.

## Extraction and abandonment

Extraction is supported by active v0.8 and is not synthesized from the endpoint
outcome field.

- Normal extraction: `game.js:extractRun` requires playing state, the portal,
  and a cleared room. `enterCampFromExtract` records the run, converts the
  remaining run wallet 1:1 (rounded) to camp gold, and retains carried relics.
- Cleared-room shortcut: the active `Q` handler invokes forced extraction only
  after `state.roomCleared`.
- Emergency extraction: `openEmergencyExtractConfirm` plus
  `confirmEmergencyExtract` allows extraction before room clear after explicit
  confirmation. It keeps
  `floor(currentGold * (1 - lossRatio))`.
- Loss ratio: `getEmergencyExtractLossRatio` is
  `clamp(0.7 - emergencyStashLevel*0.1, 0.05, 0.95)`.
- Cancel leaves state unchanged.
- Leaving from the nonterminal death screen returns to the menu after the death
  was already recorded; it is not a separate scored extraction outcome.

## Canonical score

`game.js:calculateScore`, `getRunMaxDepth`, `getRunGoldEarned`, and
`recordRunOnLeaderboard` define the complete formula:

```text
score = round(
  acceptedMaxDepth * 1000
  + acceptedRunGoldEarned * 2
  + floor(acceptedMaxDepth / 5) * 2500
)
```

Both canonical inputs are non-negative integers, so the final `round` does not
change the result. Score has no outcome, lives, time, relic, mutator, elite, or
separate boss multiplier. Boss contribution is only the
`floor(depth / 5) * 2500` term. Gold uses cumulative accepted earned gold, not
the final spendable wallet and not client-reported gold.

Score policy version: `v08-score-1`.

## Duration

Active v0.8 leaderboard entries contain a completion timestamp and turn count
but no run-duration formula or pause policy. Duration is not a score component.

M3 uses the already persisted Online v3 server timestamps:

- start: immutable `startedAt` from authenticated run creation;
- finish: Worker `now` captured once by the successful atomic finalize;
- precision: integer milliseconds;
- duration: `finalizedAt - startedAt`;
- pauses and disconnects: included as wall-clock time;
- client `elapsedMs`: telemetry/plausibility only, never final authority;
- clock regression and finalization after `expiresAt`: rejected;
- exact retry: returns the originally persisted duration and never reads a new
  clock value.

Duration policy version: `server-wall-clock-v1`.

## Final projections and leaderboard

- Canonical build source: the existing relic/build ledger and its build digest.
- Canonical score gold source: existing gold-ledger earned aggregates.
- Canonical statistics: accepted room, boss, final-room, fatal-event,
  prevented-death, and actual-life-loss counts only.
- Public build excludes offer IDs, acquisition internals, tokens, recent
  operations, anomaly internals, and client JSON.
- Existing D1 schema already stores one row per `run_id`, build JSON, summary
  JSON, duration, outcome, verification level, state digest, and creation time.
- Existing ordering is `score DESC, created_at ASC, run_id ASC`; the cursor
  contains the same tie-break fields.

No destructive migration is required. Score version, ruleset ID/hash, outcome,
life summary, duration policy, and canonical counters fit in immutable summary
JSON.
