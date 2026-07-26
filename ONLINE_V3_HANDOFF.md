# Online v3 - Current Handoff

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

## Verification

- npm run verify:fast
- npm run verify:phase
- npm run verify:baseline
- npm run verify:full
