# Online v3 M3 — canonical run completion

Milestone M3 is complete locally. The real local `v08-meta-1` runtime can reach
canonical victory, defeat or extraction, finalize once, and atomically publish
one immutable leaderboard entry. No game-client integration or production
activation is included.

## Commits

- `d7a0071` — Implement Online v3 canonical lives and outcome state
- `ee2de2c` — Implement Online v3 canonical duration and scoring
- `6b01106` — Implement atomic Online v3 real-ruleset finalization
- `61a0f89` — Publish canonical Online v3 leaderboard results
- `d042f53` — Add Online v3 finalization Wrangler and D1 lifecycle coverage

## Source-derived contract

The complete evidence inventory is in
`docs/ONLINE_V3_M3_SOURCE_AUDIT.md`. It is bound to protected source commit
`f98820c99066d810169e100beb23a54a332734bd`, active `game.js` SHA-256
`a7d436f8cdde618e7bab802322a658d2055f201950d9ae7b4598269feff3df00`,
and active `loot-tables.js` SHA-256
`9343a62db72aacd89d16ab0efa3c1fba0c40d08cc1e82e10795990299467e0a9`.

- A run starts with 5 lives and is capped at 5.
- Fatal resolution order is Chrono Loop, Second Chance, then exactly one life
  loss. An actual loss removes one uniformly selected owned non-Mythic relic
  copy when eligible.
- A nonterminal loss restarts from the entrance with the canonical carried
  build. The accepted loss reaching zero creates defeat eligibility.
- Victory requires settlement of the canonical final-room reward and accepted
  completion of the final boss directive at depth 100.
- Normal extraction requires at least one accepted room clear. Emergency
  extraction uses the confirmed v0.8 loss formula and canonical camp-gold
  transfer. The client never supplies the resulting outcome or wallets.

## Duration and score

Duration policy `server-wall-clock-v1` freezes one integer-millisecond value:

```text
durationMs = persisted finalizedAt - persisted startedAt
```

Disconnect and pause time remain wall-clock time. Clock regression, expiration
and client-reported final duration fail closed. Exact retry reconstructs the
stored value.

Score policy `v08-score-1` is:

```text
acceptedMaxDepth * 1000
+ acceptedRunGoldEarned * 2
+ floor(acceptedMaxDepth / 5) * 2500
```

Gold is the existing canonical cumulative earned-gold ledger, not the current
wallet. Time, outcome, lives, build, elites and client claims do not add score.

## Atomic finalization and publication

Terminal states receive a dedicated signed `run_terminal` boundary token. They
do not receive or synthesize a room directive. The token binds run, ruleset
ID/hash, revision and state digest.

The finalize request accepts only `runId` and that opaque token. The ruleset
derives outcome, score, duration, final build and summary. One D1 batch
conditionally updates the terminal run to `finalized` and inserts the
leaderboard row. A failure before or during the batch rolls back both effects.

The idempotency v2 record freezes the original response. Exact retry, including
after Worker restart, reproduces outcome, score, duration, revision, build,
summary and leaderboard identity. A conflicting retry fails, concurrent
finalizers produce at most one result, and post-finalization events,
checkpoints and further finalization cannot mutate the run.

Leaderboard rows retain the score version, duration policy, ruleset ID/hash,
canonical build and summary in the existing schema. List ordering remains:

```text
score DESC, created_at ASC, run_id ASC
```

The cursor uses the same tie-break fields. List responses are compact; detail
responses expose frozen public projections but no canonical state, recent
operations, tokens or client installation identity.

## Test inventory

- Golden fixtures: 36 total (12 lives/outcome, 12 duration/score, 12
  finalization).
- Property cases: 512 total (128 fatal/outcome, 256 score/restart, 128
  finalization/projection).
- M3.5 real lifecycle scenarios: 11 targeted (10 Wrangler HTTP/D1 plus one
  direct real-ruleset D1 atomicity/rollback scenario).
- Final phase suite: 656/656 PASS.
- Final baseline: guard 3/3 PASS and headed game smoke PASS.
- Final full suite: 678/678 PASS, including local Wrangler/D1 19/19.
- `git diff --check`: PASS.

Logs are retained under ignored `output/verification/`.

## Boundaries

Ruleset hash:

- before M3:
  `sha256:58528474cf072fbeddfc68a29c1eda00414996cd8fb4ea2871e0b954a1f95276`
- after M3:
  `sha256:08f023da2700e76e862d7adec7045dc8aa6e931b5c97976d955182aa19f2cebb`

M3 does not change `game.js`, the Online v3 client, endpoint paths, HTTP
contracts outside the already reserved finalize body, D1 schema or migration,
`recent_ops` storage format, Wrangler/deployment configuration, fixture
activation, staging or production. `v08-meta-1` remains local/test-only.

The next recommended milestone is M4 client integration, but it is not started
by this work.
