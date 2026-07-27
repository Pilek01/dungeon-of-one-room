# Online v3 - Current Handoff

## Milestone M4 complete locally

- `4cd353b` adds the isolated browser transport, real token-kind validation,
  stable operation identity, exact/conflicting retry handling, redacted logs,
  separate recovery storage, and the pre-integration source audit.
- M4.2 now has an explicit Ranked entry, canonical start/starting-relic flow,
  a fail-closed session state machine, the complete directive allowlist and
  four narrow `game.js` bridge regions. Practice does not instantiate the
  transport and keeps its own save path.
- The authorized `game.js` hooks changed source provenance only. Regeneration
  changed the test-only ruleset hash from
  `sha256:08f023da2700e76e862d7adec7045dc8aa6e931b5c97976d955182aa19f2cebb`
  to
  `sha256:13b0605ef0e7e23b742d558eac02d739d898a941ef172fa58f3acb1d86966f3e`;
  no canonical policy table was edited.
- Latest M4.2 targeted tests: 10/10 PASS. Latest `verify:fast`: 24/24 PASS.
- `7a43dcc` integrates explicit Ranked bootstrap, canonical starting relics,
  the full active directive allowlist, and the narrow game bridge.
- M4.3 adds one shared public-projection adapter for Warden/Otter/Arena relic
  offers, replacement, Merchant, Forge Temper/Transmute, Crossroads, Camp and
  Pact. Targeted client tests are 14/14 and `verify:fast` is 28/28 PASS.
- `a6c648c` integrates those canonical reward and meta-transaction surfaces.
- M4.4 adds server-owned fatal-event, prevention, extraction and finalization
  handling. Lost responses resume the exact persisted operation; canonical
  terminal state stops local simulation and the published score is displayed
  only after finalization. Targeted client tests are 17/17 and `verify:fast`
  is 31/31 PASS.
- `4c76ccb` integrates canonical lives, terminal outcomes, extraction,
  finalization and exact terminal recovery.
- M4.5 adds an explicit public leaderboard entry, opaque cursor pagination,
  server-order list rendering and immutable public build details. It renders
  no tokens, digests, receipts or private operation data. Targeted tests are
  4/4 and `verify:fast` is 35/35 PASS.
- `1fa8e4b` adds the canonical leaderboard list and public build details.
- M4.6 adds clean Practice guardrails plus a real Wrangler/D1 headed Ranked
  lifecycle. One headed run covers bootstrap, starting relic, first checkpoint,
  active-combat zero-network observation, reload recovery, canonical defeat,
  lost-finalize-response exact replay, one D1 row, leaderboard and build
  detail. The headed lifecycle is 1/1, network-loss 1/1 and reload 1/1;
  Practice headless preflight is PASS and `verify:fast` is 36/36 PASS.
- `d7eaf33` adds the real local Worker/D1 headed lifecycle and makes the clean
  baseline verifier run both Practice and Ranked browser suites.
- M4 implementation is complete through six internal commits. Final
  documentation and the phase/baseline/full gates are the only remaining
  local handoff steps. Production remains blocked and `v08-meta-1` test-only.
- Current test-only ruleset hash after the terminal hooks is
  `sha256:d1f28d957244002da574180c5c9a7040d4d18deba1551a24e6597712d971b231`.
- No push, deployment, production activation, D1 migration or Vault Guardian
  change has occurred.

## Repository

- Workspace: D:/Codex workstation/Dungeon/dungeon-online-v3
- Branch: main
- Base before the Arena commit: 7687b8a (Fix Online v3 verification module boundary)
- Protected baseline: f98820c99066d810169e100beb23a54a332734bd
- Pre-Arena ruleset hash: sha256:7c60b9af6bdf309c860c2daa2534a3d527d1469433921bc8db3766a654cb40f9
- Phase 3B2C3B ruleset hash: sha256:f462e632fda9a687e848a1445052360bcc78f13d2388e0d5208a7478e0a9a8e3
- v08-meta-1 has a registry-only local release-candidate descriptor; its pure
  canonical manifest remains test-only.
- Active endpoints still use the fixture ruleset.
- Online v3 is not loaded by index.html.
- Preserve unrelated Vault Guardian pack deletions outside staging and commits.

## Completed milestones

- Phase 0 through Phase 3B2C3A are committed through 0a9ca77.
- Compact workflow and task instructions are committed in 7790f20.
- CommonJS compatibility for legacy .js verification targets is restored in 7687b8a.
- Phase 3B2C3B implements the canonical Arena relic reward policy.

## Phase 3B2C3B

- Uses the existing Arena RoomDirectiveV3 and one RoomRewardEnvelopeV3 relic slot.
- Preserves the protected v0.8 rare+ relic_draft pool and non-boss rarity formula.
- Issues three choices normally and four with canonical Ascension.
- Reuses RegularRelicOfferV3 and the canonical replacement transaction.
- Allows the 60-base-gold fallback only for an existing canonical stored Arena reward with zero canonical choices.
- Includes 40 source-bound fixtures and seeded offer and binding properties.
- Verification: fast 63/63 PASS; phase 547/547 PASS; baseline guard 3/3 PASS; headed baseline smoke PASS.
- No unresolved Arena source evidence or blockers.
- No client, game, endpoint, D1, recent_ops, protocol, Wrangler, activation, push, or deployment change.

## Milestone M1

- Milestone M1 - Meta Transactions is complete locally.
- Commit `75c06c6` implements the shared immutable atomic transaction core.
- The core binds canonical source/offer/choice/transaction IDs to run,
  ruleset hash, revision, state digest, and build digest.
- It provides exact retry, conflicting-retry rejection, bounded receipts,
  rollback, restart determinism, one existing gold ledger for run/camp
  balances, and canonical offer rebinding after multi-slot purchases.
- Core verification: targeted 9/9; fast 21/21; phase 556/556; baseline 3/3
  plus headed smoke PASS; 12 golden cases and 256 property seeds.
- Current M1 ruleset hash after the core commit:
  `sha256:58cb8868556314bb871570f7f0063650afd9385e2894b39daebcffb2cceabc9b`.
- Canonical Merchant transactions are complete: inventory, prices, purchases,
  sold/locked state, relic replacement/reservation, buyback, services, and
  exact retry all derive from server-issued opaque choices.
- Merchant verification: targeted 9/9; combined targeted 27/27; fast 30/30;
  phase 565/565; baseline 3/3 plus headed smoke PASS; 24 golden cases and
  128 property seeds.
- Canonical Forge Temper and Transmute transactions are complete. Temper uses
  the baseline uniform first pick and canonical replacement; Transmute binds
  one owned stack and up to three server-derived legal results, then removes
  and acquires atomically. Both preserve baseline zero cost, cancel, empty-pool,
  and Forge-consumption timing.
- Forge verification: targeted 9/9; combined targeted 36/36; fast 39/39;
  phase 574/574; baseline 3/3 plus headed smoke PASS; 24 golden cases and
  128 property seeds.
- Canonical Crossroads transactions are complete. POWER preserves confirmation,
  the rounded 15% max-HP cost for 100 turns, Epic+ RNG order, replacement,
  skip, exact penalty restoration, and modified base-80 empty-pool fallback.
  MERCY heals, resets cooldowns, refills potions, or applies the canonical
  Pact of Avarice gold conversion. Either choice consumes the room once.
- Crossroads verification: targeted 11/11; combined targeted 47/47; fast 50/50;
  phase 585/585; baseline 3/3 plus headed smoke PASS; 24 golden cases and
  128 property seeds.
- Canonical Camp transactions are complete for the active baseline purchases:
  ten upgrades with frozen visit multiplier, elixir buy/refill/discard, and
  confirmed one-stack relic sales, all through the existing camp-gold ledger.
- Canonical Pact transactions are complete for two uniform depth-eligible
  offers, apply/replace, break-with-current, and leave-without-current. Apply,
  replace, and break consume the room; leave keeps it reusable.
- Camp/Pact verification: targeted 12/12; combined targeted 59/59; fast 62/62;
  phase 597/597; baseline 3/3 plus headed smoke PASS; 32 golden cases and
  128 Camp plus 128 Pact property seeds.
- Current M1 ruleset hash after Camp/Pact:
  `sha256:2fcc9df6032f7966ff0ede0e723dc1f0f3b0b28cc0d77533caaeb7ae886a8594`.
- Final verification: phase 597/597 PASS; baseline guard 3/3 PASS; headed
  baseline smoke PASS; full 609/609 PASS including local Wrangler/D1 E2E 9/9;
  `git diff --check` PASS.
- M1 changed 34 owned paths and zero forbidden game, client, endpoint, D1,
  `recent_ops`, protocol, Wrangler, migration, fixture-activation, or
  deployment paths.
- The protected Vault Guardian WIP remains exactly 172 deleted paths with
  normalized initial/final path delta 0, staged count 0, and M1 commit count 0.
- Recommended next milestone: Phase 3B2C4 exact compact idempotency-response
  reconstruction. It remains unstarted and requires a fresh task.

## Milestone M2 partial result

- Commit `e267999` implements compact `recent_ops` v2 reconstruction with one
  immutable base projection, deterministic patches, exact historical tokens,
  semantic response equality and result-digest verification.
- Commit `7f52493` persists v2 in the existing D1 JSON column, reads legacy v1
  full-response arrays exactly and migrates them deterministically on the next
  successful write. The retained history is 12 operations; no migration or new
  table is required.
- Commit `3898db7` adds a fail-closed local release-candidate descriptor for the
  exact `v08-meta-1` ID/hash. Fixture, test-only, local candidate, production
  and deprecated states are distinct; production remains unavailable.
- Ordinary local D1 history measured 27,554 B at 12 operations. A repeated
  14,484 B replacement fixture measured 175,291 B in legacy v1 versus
  29,573 B in compact v2.
- The ruleset hash remains
  `sha256:2fcc9df6032f7966ff0ede0e723dc1f0f3b0b28cc0d77533caaeb7ae886a8594`.
- M2.4 is blocked: the mandatory starting-relic offer exists before any room
  directive, while the unchanged token/event contract requires a directive ID
  and nonce for every authenticated mutation. There is no canonical pre-room
  boundary in the existing HTTP contract.
- M2.5 real-ruleset Wrangler/D1 lifecycle coverage depends on M2.4 and remains
  blocked. Existing fixture HTTP/D1 compact persistence, retry, restart,
  concurrency and atomic-finalize coverage passes 9/9.
- Final partial-M2 verification: phase 612/612 PASS; baseline guard 3/3 and
  headed smoke PASS; full 624/624 PASS including local fixture Wrangler/D1
  9/9; `git diff --check` PASS.
- No game, Online v3 client, production resource, deployment configuration or
  protected Vault Guardian path is part of the M2 commits.
- Recommended next work is a narrowly scoped M2 unblock design for the
  authenticated pre-room offer boundary. Do not start M3 before M2 endpoint
  dispatch and real-ruleset lifecycle coverage are complete.

## Milestone M2B progress

- Commit `80b8edf` implements the authenticated pre-room bootstrap boundary:
  exact v2 `run_bootstrap` tokens bind the run, ruleset ID/hash, revision,
  starting offer, state digest and bootstrap nonce while legacy checkpoint
  tokens remain fixture-only and are not reinterpreted.
- The canonical bootstrap remains `awaiting_starting_relic` with its real
  server-issued offer and no room directive, room nonce, synthetic room or
  placeholder result.
- M2B.1 verification: targeted token/bootstrap tests 13/13, 64 explicit
  determinism seeds, phase 616/616, baseline guard 3/3 and headed smoke PASS.
- Commit `90a597c` implements the immutable starting-relic bootstrap
  transition. The client supplies only opaque offer/choice IDs; the ruleset
  derives the relic, build and first room directive atomically.
- M2B.2 verification: targeted bootstrap/selection tests 10/10, 64 explicit
  selection seeds, phase 622/622, baseline guard 3/3 and headed smoke PASS.
- Commit `87c3da9` wires the exact local-release-candidate ID/hash through the
  existing start/event/checkpoint surface. The local Wrangler entry now uses
  the real registry; the fixture entry remains explicit for fixture tests and
  cannot silently replace the real ruleset.
- Real finalization is authenticated but intentionally fail-closed with
  `REAL_RULESET_FINALIZATION_REQUIRES_M3`; score, outcome, lives and extract
  policy were not invented in M2B.
- M2B.3 verification: real HTTP contracts 7/7, focused runtime/config/D1
  contracts 11/11, phase 629/629, baseline guard 3/3 and headed smoke PASS.
- Commit `4963754` adds real Wrangler/D1 persistence, restart, concurrency,
  checkpoint and finalize-blocker coverage while retaining the fixture E2E as
  a separate explicit harness.
- Real persistence exposed and fixed canonical JSON key-order validation and
  the incorrect use of gold-modifier IDs as the full legal Pact/Camp catalog.
  The genuine ruleset source change updates the hash to
  `sha256:58528474cf072fbeddfc68a29c1eda00414996cd8fb4ea2871e0b954a1f95276`.
- M2B.4 verification: real Wrangler/D1 5/5, M2B targeted contracts 18/18,
  phase 630/630, baseline guard 3/3 and headed smoke PASS.
- M2B code is complete in four internal commits. Final verification and the
  documentation-only completion commit follow this handoff update.
- M3 remains unstarted. Its first required decision is the canonical real-run
  finalization contract (score, outcome, lives/extract and public leaderboard
  summary); until then real finalize remains fail-closed and non-mutating.
- Final M2B verification: phase 630/630 PASS; baseline guard 3/3 and headed
  smoke PASS; full 647/647 PASS including local Wrangler/D1 14/14;
  `git diff --check` PASS.

## Milestone M3

- M3 canonical run completion is complete locally in `d7a0071`, `ee2de2c`,
  `6b01106`, `61a0f89`, and `d042f53`.
- Active v0.8 evidence is recorded in `docs/ONLINE_V3_M3_SOURCE_AUDIT.md`;
  no score, lives, outcome, extraction or duration rule came from Ranked v2 or
  a client claim.
- Lives start and cap at 5. Chrono Loop and Second Chance precede one canonical
  life loss; a zero-life loss creates defeat eligibility. Victory requires the
  accepted depth-100 final directive and settled reward. Confirmed normal and
  emergency extraction policies create extraction eligibility.
- `server-wall-clock-v1` freezes duration from persisted Worker timestamps.
  `v08-score-1` uses only accepted maximum depth, cumulative canonical earned
  gold, and the confirmed five-depth milestone term.
- A dedicated signed `run_terminal` boundary replaces any need for a synthetic
  room. Finalization accepts only run ID and the opaque token, derives every
  result server-side, and commits the finalized run plus exactly one
  leaderboard entry in one D1 batch.
- Exact retry survives restart and reconstructs the original result.
  Conflicting/stale retries fail, concurrent finalizers publish at most one
  row, D1 failure rolls back both effects, and finalized runs cannot mutate.
- Public leaderboard order remains score descending, creation time ascending,
  run ID ascending. Cursor, compact list and frozen public detail share those
  canonical projections and expose no client identity, token, recent ops or
  canonical state.
- M3 has 36 golden fixtures, 512 explicit property cases, and 11 targeted real
  Wrangler/D1 lifecycle scenarios.
- Ruleset hash changed from
  `sha256:58528474cf072fbeddfc68a29c1eda00414996cd8fb4ea2871e0b954a1f95276`
  to
  `sha256:08f023da2700e76e862d7adec7045dc8aa6e931b5c97976d955182aa19f2cebb`.
- Final verification: phase 656/656 PASS; baseline guard 3/3 plus headed smoke
  PASS; full 678/678 PASS including local Wrangler/D1 19/19;
  `git diff --check` PASS.
- Game/client, D1 schema/migration, compact `recent_ops`, production
  activation, deployment configuration, staging and production remain
  unchanged. M4 is not started.

## Verification

- npm run verify:fast
- npm run verify:phase
- npm run verify:baseline
- npm run verify:full
