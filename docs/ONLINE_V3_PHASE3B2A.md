# Online v3 Phase 3B2A: reward envelopes and authoritative gold ledger

Status: implemented as an isolated, `test-only` pure ruleset. It is not active
in Worker endpoints and is not loaded by the game.

Protected baseline commit: `f98820c99066d810169e100beb23a54a332734bd`.

Previous Phase 3B1 test-only hash:
`sha256:8096931c55e096a51c6e2a5a84fcc7faf3d814bdaa24db6abb1dd613f00b16b5`.

Phase 3B2A hash:
`sha256:29df5d1f7b5cb4042e1abbe77a625b7e2250fffce13e6d9ca37f41fffe07665f`.

The old hash was never released. The descriptor still has status `test-only`,
and registry resolution still returns `RULESET_NOT_RELEASED:test-only`.

## Trust boundary

Phase 3B2A does not call local combat server-authoritative. It uses four
different trust classes:

- `SERVER_DERIVED`: room-clear awards, canonical modifier application, ledger
  totals, and future transactional debits/credits.
- `SERVER_ISSUED`: envelope identity, binding, claim allowlist, count limits,
  opaque chest slot IDs, and the maximum gold budget.
- `BOUNDED_CLIENT_ATTESTED`: enemy/elite/hazard counts and opened chest slots.
  The Worker validates the category and limit and computes the amount.
- `HEURISTIC_ONLY`: local crit/kill/turn procs, offer-empty fallbacks, elapsed
  time, turn count, command-journal digest, and compact combat proof.

The source inventory contains 26 classified records. It includes ordinary,
elite, boss and hazard kills; room clear; all active chest gold branches;
Vault, Otter, Arena and Crossroads fallbacks; Merchant credit/debit; extract;
Shrine, Forge, Pact and terminal zero-direct-award cases; elite-affix effects;
Golden Idol and other modifiers; Void Reaper and Chaos Orb; and local
debug/Observer gold. Zero-direct-award records exist deliberately so an audit
cannot mistake absence of a separate award for a missing source.
Merchant and Crossroads are pre-cleared in the active baseline and therefore
receive a zero fixed room-clear award.

Generated canonical data:

```text
data/gold-sources.generated.json
data/gold-modifiers.generated.json
data/room-reward-bounds.generated.json
data/chest-reward-bounds.generated.json
```

The generator reads active baseline files as text, records their hashes, never
imports `game.js` or a DOM, writes no timestamp, supports `--check`, and fails
with `UNCLASSIFIED_ACTIVE_GOLD_SOURCE` when the active `grantGold` call
signature set changes without classification.

## RoomRewardEnvelopeV3

The public `RoomDirectiveV3` exposes only:

```js
rewardEnvelopeRef
```

The private canonical state stores:

```js
{
  envelopeId,
  runId,
  rulesetHash,
  directiveId,
  revision,
  roomIndex,
  depth,
  roomType,
  claimPolicyVersion,
  fixedAwards,
  boundedClaims,
  claimSlots,
  maximumGoldDelta,
  consumed,
  issuedStateDigest
}
```

There are no chest coordinates, tiles, enemies positions, or full local
layout. Chest slots are opaque sequential IDs and are issued only up to the
generated room-type bound. The envelope is bound to the run, hash, revision,
directive, room index, depth, and room type.

Each bounded claim definition contains its claim type and ID, maximum count,
unit-policy reference, required room type/build effect, stacking policy, and
duplicate policy. Each one-shot slot contains a slot ID/type, allowed claim,
and consumed flag.

The maximum budget is a hard upper bound over the fixed award plus bounded
enemy/chest categories for the issued room and canonical build. It is capped
at 10,000 as a fail-closed secondary guard. An accepted settlement must remain
at or below this value.

## Claim contract

The pure domain settlement accepts:

```js
{
  envelopeId,
  roomDirectiveId,
  roomNonce,
  claims: [
    {
      claimType,
      claimId,
      count,
      localEvidence
    }
  ],
  reportedGoldDelta,
  reportedGoldTotal,
  turnCount,
  elapsedMs,
  commandJournalDigest,
  compactRoomProof
}
```

`reportedGoldDelta` and `reportedGoldTotal` are telemetry only. They never
write `gold`. Unknown claim types/IDs, negative or excessive counts, duplicate
entries/evidence, wrong room binding, stale envelopes, and reuse with a
changed payload fail closed without mutating the input state.

An exact retry has the same canonical request digest and returns the identical
settled state. The bounded settlement history stores only envelope ID, request
digest, authoritative delta, and anomaly reason codes. A changed request for
the same consumed envelope returns `REWARD_IDEMPOTENCY_PAYLOAD_MISMATCH`.

Room completion remains a required bounded client attestation. Missing
`local-room-completed` is rejected before reward settlement.

## Ledger

Canonical state stores:

```js
goldLedger: {
  earnedServerDerived,
  earnedBoundedAttested,
  spentServerDerived,
  lastDelta,
  lastEnvelopeId,
  roomClaimsAccepted,
  roomClaimsRejected,
  anomalyScore,
  anomalyFlags,
  maximumClaimStreak
}
```

The anomaly list and settlement history are both capped at 64 entries.
`anomalyScore` is capped at 100. No frame, move, combat log, coin row, or full
command journal is stored. The enforced identity is:

```text
gold = earnedServerDerived + earnedBoundedAttested - spentServerDerived
```

Gold cannot be negative. Fixed awards, bounded claims, and claim slots settle
at most once. Retries do not increment counters or anomaly score.

## Canonical build modifiers

Fixture builds are canonical server state. Client-supplied build/modifier
fields are ignored and never enter the calculation.

Implemented v0.8 ordering:

1. enemy-specific Bounty Contract and elite/Elitist multiplication;
2. `Math.round`;
3. chest-specific Treasure Sense multiplication where applicable;
4. additive run multiplier from Golden Idol, Greed, and each non-Greed
   mutator;
5. Pact of Avarice multiplication;
6. `Math.round` and minimum positive award of one.

Supported gold-affecting state:

- Golden Idol: +15% per stack, normal relic stack cap 5;
- Greed: +40%;
- each unique non-Greed mutator: +20%;
- Elitist: x1.6 on elite reward before the general multiplier;
- Pact of Avarice: x1.4;
- Treasure Sense: +10% chest base per level, cap 5;
- Bounty Contract: +10% enemy base per level, cap 5.

Known presentation-only relics do not affect the ledger. Unknown relic,
mutator, pact, or camp-upgrade IDs fail closed. The policy does not implement
how any item is acquired; that belongs to Phase 3B2B.

Void Reaper crit-kill gold and Chaos Orb turn-roll gold remain
`HEURISTIC_ONLY` and are not awarded by 3B2A. Crossroads, Arena, and Otter
empty-offer fallbacks also remain heuristic/deferred because canonical offer
state does not exist yet.

## Remaining manipulation and anomaly signals

Zmodyfikowany klient może próbować zgłaszać maksymalny dozwolony claim w każdym
pokoju. Envelope ogranicza skalę manipulacji, ale nie udowadnia faktycznego
wyniku walki.

In particular, a modified client may claim that every allowed enemy died, that
every issued chest slot was opened, or that each random chest used the highest
allowed gold base. The Worker caps the damage but cannot prove the local
event. Actual death omission and combat legality remain outside the guarantee.

Deterministic anomaly reason codes:

```text
REPORTED_GOLD_DELTA_MISMATCH
REPORTED_GOLD_TOTAL_MISMATCH
COMMAND_JOURNAL_DIGEST_MISSING
TURN_COUNT_OUT_OF_BOUNDS
ELAPSED_MS_BELOW_MINIMUM
COMPACT_ROOM_PROOF_MISSING
MAXIMUM_GOLD_DELTA_CLAIMED
REPEATED_MAXIMUM_CLAIM
```

These signals do not change gameplay, reject an otherwise valid bounded
claim, ban a player, or alter score in this phase.

## Verification corpus

The Phase 3B2A corpus contains 36 executable golden fixtures and explicit
contract fields for initial state, directive, envelope, claims, authoritative
delta, ledger, anomalies, and result.

Property coverage proves:

- client totals never become server totals;
- accepted delta never exceeds the envelope maximum;
- fixed award, slot, and envelope settle once;
- gold is nonnegative and reconciles with the ledger;
- retry preserves identical state;
- telemetry changes do not change the authoritative result;
- canonical modifiers change results while a fake client build does not;
- 1,000 seeded envelopes stay deterministic and within hard limits.

The projected compact pure settlement response is 532 bytes in the measured
fixture. This is a projection only; Phase 3B2A does not change endpoint
responses or `recent_ops_json`.

`pendingOffer` remains `null`. No offer, Merchant, Camp, Forge, Pact, lives,
score, leaderboard, D1, endpoint, game client, or deployment behavior is
implemented here.

Next phase: Phase 3B2B, server-issued starting relic/relic/mutator/skill/elixir
offers and a canonical build ledger, still without integration with
`game.js`.
