# Ranked Canonical Chest Carry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make HP/ARM/ATK chest bonuses canonical for one complete Ranked campaign, reset only on Start New Ranked, and preserve strict anti-cheat and Practice isolation.

**Architecture:** Add a capability-gated server-issued chest outcome contract and versioned campaign bucket ledger. Reuse the existing reward-claim/checkpoint transport and settlement replay protection. Project canonical counters/totals into the game bridge before each Ranked descent; never persist Ranked state into Practice storage.

**Tech Stack:** JavaScript ES modules, Node test runner, Cloudflare Workers/D1 JSON state, generated Pages bridge, Playwright headed verification.

**Spec:** `docs/plans/2026-08-23-ranked-canonical-chest-carry-design.md`

## Global Constraints

- One Ranked campaign includes every dungeon, extraction, Camp, and subsequent descent until the campaign ends.
- Chest bonuses reset only on Start New Ranked.
- Practice behavior and storage remain unchanged and isolated.
- Potion caps, exact gold validation, slot consumption, replay binding, and provisional fail-closed behavior remain strict.
- Historical ruleset hashes keep their prior capability contract.

---

### Task 1: Canonical campaign chest ledger

**Files:**
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/meta-state.js`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/profile-policy.js`
- Create: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/chest-bonus-policy.js`
- Test: `cloudflare/leaderboard-v3/test/chest-bonus-carry.test.js`

**Interfaces:**
- Produces: `normalizeChestBonusesV08(value)`, `projectChestBonusesV08(value)`, and `applyIssuedChestStatBonusV08(campaign, award)`.
- Persists: `campaign.chestBonuses` with exact bounded attack/armor/health depth bucket maps.

- [ ] Write tests proving empty defaults, bounded normalization, exact derived totals, extraction/profile/hydration carry, and fresh campaign reset.
- [ ] Run the focused tests and confirm they fail because the canonical chest ledger does not exist.
- [ ] Implement the minimal ledger and campaign/profile integration.
- [ ] Run the focused tests and confirm they pass.

### Task 2: Server-issued Ranked chest outcomes

**Files:**
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/reward-policy.js`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/room-policy.js`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/releases.js`
- Test: `cloudflare/leaderboard-v3/test/chest-bonus-carry.test.js`
- Test: `cloudflare/leaderboard-v3/test/ranked-boundary-checkpoints.test.js`

**Interfaces:**
- Produces: a capability-gated `canonicalOutcome` on ordinary chest claim slots.
- Consumes: exact chest slot claim and canonical room scaling depth.
- Applies: canonical stat bucket increments only for completed-room settlement.

- [ ] Add failing tests for deterministic issued outcomes, exact slot binding, tampered outcome rejection, five-per-bucket cap, replay idempotency, and no stat award on fatal/emergency boundaries.
- [ ] Run the focused tests and confirm the missing issued-outcome contract is the failure.
- [ ] Implement deterministic outcome issuance and exact settlement without accepting client stat amounts.
- [ ] Run focused and reward-policy property tests until green.

### Task 3: Ranked client recorder and canonical projection

**Files:**
- Modify: `online-v3/ranked-v3-recorder.js`
- Modify: `online-v3/ranked-v3-protocol.js`
- Modify: `online-v3/ranked-v3-runtime.js`
- Modify: `scripts/build-pages-v3.mjs`
- Test: `cloudflare/leaderboard-v3/test/m4-ranked-gold-parity.test.js`
- Test: `cloudflare/leaderboard-v3/test/online-ranked-boundary-repair.test.js`

**Interfaces:**
- Consumes: canonical ordered chest slot outcomes and `campaign.chestBonuses` projection.
- Produces: amount-free exact slot claims and local `sessionChest*` state matching the server.

- [ ] Add failing recorder/bridge tests proving the client uses issued outcomes, hydrates carry before `startRun`, reconciles after checkpoint, resets only on new campaign, and does not write Practice storage.
- [ ] Run the focused tests and confirm the old local RNG/projection behavior fails them.
- [ ] Implement the minimal recorder, runtime, and generated bridge changes.
- [ ] Run the focused client tests and generated-artifact checks until green.

### Task 4: Remove cascading emergency gold diagnostics

**Files:**
- Modify: `cloudflare/leaderboard-v3/src/domain/ruleset-runtime.js`
- Test: `cloudflare/leaderboard-v3/test/ranked-boundary-checkpoints.test.js`

**Interfaces:**
- Preserves: `BOUNDARY_SETTLEMENT_INVALID` and provisional eligibility for invalid claims.
- Suppresses: gold comparison only when the emergency settlement used the invalid-claim zero fallback.

- [ ] Add a failing extraction test using potion-use count four against three canonical potions and edited gold totals; expect only `BOUNDARY_SETTLEMENT_INVALID`.
- [ ] Strengthen the valid edited-total test to require `REPORTED_GOLD_DELTA_MISMATCH` and `REPORTED_GOLD_TOTAL_MISMATCH`.
- [ ] Run the tests and confirm the invalid fallback currently adds false gold reasons.
- [ ] Gate gold comparison on `!boundaryInvalid` and rerun until green.

### Task 5: New ruleset release and full verification

**Files:**
- Modify: generated ruleset manifest/data required by the repository release workflow.
- Modify: `online-v3/ranked-v3-protocol.js`
- Modify: release notes/progress tracking required by existing workflow.
- Test: existing guard, phase, headed Ranked, and full release suites.

**Interfaces:**
- Produces: a new production ruleset hash with the canonical chest capability.
- Preserves: every previous production descriptor and rollback target.

- [ ] Generate a new ruleset manifest/hash and register it as the current production release while retaining all historical hashes.
- [ ] Run syntax, focused Worker, property, protocol, generator, guard, phase, and full release tests.
- [ ] Build Pages, run the required Playwright client, inspect gameplay screenshots/text state/console, and verify Camp carry plus fresh reset and Practice isolation.
- [ ] Commit to main, deploy Worker with staged verification, deploy Pages, and verify the immutable and stable production URLs.
