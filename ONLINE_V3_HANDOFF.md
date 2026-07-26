# Online v3 - Current Handoff

## Repository

- Workspace: D:/Codex workstation/Dungeon/dungeon-online-v3
- Branch: main
- Base before the Arena commit: 7687b8a (Fix Online v3 verification module boundary)
- Protected baseline: f98820c99066d810169e100beb23a54a332734bd
- Pre-Arena ruleset hash: sha256:7c60b9af6bdf309c860c2daa2534a3d527d1469433921bc8db3766a654cb40f9
- Phase 3B2C3B ruleset hash: sha256:f462e632fda9a687e848a1445052360bcc78f13d2388e0d5208a7478e0a9a8e3
- v08-meta-1 remains disconnected and test-only.
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

## Next work

- Milestone M1 - Meta Transactions is active.
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
- Current M1 ruleset hash after Forge:
  `sha256:6fe5f6a89103e08dfbea650eaf423e56748ae2f0aab85dfbb9c336e0042f30e8`.
- Next M1 block: canonical Crossroads transactions.

## Verification

- npm run verify:fast
- npm run verify:phase
- npm run verify:baseline
- npm run verify:full only when a future CURRENT.md explicitly requires it
