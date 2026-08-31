# Ranked Merchant Exit And Otter Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serialize Merchant purchases and room exit, enforce the invariant in the Worker, and correct Otter eligibility/scaling depth drift.

**Architecture:** The browser runtime receives a per-directive single-flight Merchant exit coordinator. A capability-gated domain guard prevents checkpoint or extraction with unresolved Merchant inventory, while a shared pure Otter predicate keeps reward-slot and offer eligibility identical.

**Tech Stack:** Browser JavaScript, Node test runner, Cloudflare Worker domain modules, generated v08-meta-1 ruleset manifest.

**Spec:** `docs/superpowers/specs/2026-09-01-ranked-merchant-exit-and-otter-depth.md`

## Global Constraints

- Closing the Merchant UI must remain local and repeatable.
- Portal, normal extraction, and emergency extraction must settle Merchant leave before checkpoint/extraction.
- Existing ruleset hashes retain their old capabilities and behavior.
- No D1 migration, production activation, push, or deployment is part of this task.
- Tests must fail for the observed regression before production code changes.

---

### Task 1: Merchant Exit Race Regression

**Files:**
- Modify: `cloudflare/leaderboard-v3/test/observer-bot-merchant.test.js`
- Modify: `scripts/online-v3-ranked-merchant-headed.mjs`

**Interfaces:**
- Consumes: `onMerchantAction(request)`, `onMerchantLeave(options)`, `onExtraction(mode)`.
- Produces: executable regression proving purchase completion precedes leave and checkpoint.

- [ ] Add a runtime test whose deferred purchase is followed immediately by two portal leave calls.
- [ ] Assert the canonical sequence is purchase, leave, checkpoint and each boundary effect occurs once.
- [ ] Add normal and emergency extraction cases using the same deferred purchase.
- [ ] Run `node --test cloudflare/leaderboard-v3/test/observer-bot-merchant.test.js` and confirm the new cases fail because leave intent is dropped.

### Task 2: Browser Merchant Exit Coordinator

**Files:**
- Modify: `online-v3/ranked-v3-runtime.js`
- Modify: `scripts/build-pages-v3.mjs` only if the portal bridge signature needs adjustment.
- Test: `cloudflare/leaderboard-v3/test/observer-bot-merchant.test.js`
- Test: `cloudflare/leaderboard-v3/test/m4-client-bootstrap.test.js`

**Interfaces:**
- Produces: `merchantMutationFlight`, `merchantExitOperation`, and one coordinator called by portal and extraction paths.
- Returns: one shared `Promise<boolean>` per directive and destination.

- [ ] Store the complete purchase/resync promise instead of only a boolean pending flag.
- [ ] Implement the per-directive single-flight coordinator and exact leave settlement.
- [ ] Route Merchant portal and both extraction modes through the coordinator.
- [ ] Preserve local UI close/reopen semantics and deterministic failure behavior.
- [ ] Run the focused Merchant tests and confirm all pass.

### Task 3: Worker Merchant Barrier

**Files:**
- Modify: `cloudflare/leaderboard-v3/src/domain/ruleset-runtime.js`
- Modify: `cloudflare/leaderboard-v3/test/ranked-boundary-checkpoints.test.js`
- Modify: the closest extraction-domain test selected from `cloudflare/leaderboard-v3/test/`.
- Modify: `cloudflare/leaderboard-v3/src/rulesets/releases.js`

**Interfaces:**
- Consumes: `ruleset.capabilities.merchantExitBarrier`.
- Produces: fail-closed `MERCHANT_ROOM_TRANSACTION_PENDING` before state mutation.

- [ ] Add checkpoint and extraction tests with a real room-bound Merchant offer.
- [ ] Confirm both fail under `merchantExitBarrier: "v1"` and legacy capability omits the guard.
- [ ] Add the minimal guard before checkpoint consumption and extraction settlement.
- [ ] Add the capability only to the new candidate release descriptor.
- [ ] Run the focused domain tests and confirm pass.

### Task 4: Otter Depth Regression

**Files:**
- Create: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/otter-relic-eligibility.js`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/reward-policy.js`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/regular-relic-offer.js`
- Modify: `cloudflare/leaderboard-v3/test/phase3b2b2b1-golden.test.js`

**Interfaces:**
- Produces: `isOtterRelicRewardEligibleV08(directive, policy)` and `otterRelicRewardScalingDepthV08(directive)`.
- Consumers: reward slot issuance and regular relic offer issuance.

- [ ] Add a test for actual depth 23 with `scalingDepth: 25`; confirm it fails with `OTTER_RELIC_REWARD_DEPTH_INVALID`.
- [ ] Add actual depth 25 exclusion and scaling-only rarity coverage.
- [ ] Extract the shared eligibility predicate and use it in both consumers.
- [ ] Pass only the scaling helper result to `chooseOtterRelics`.
- [ ] Run the focused Otter golden test and confirm pass.

### Task 5: Manifest, Bindings, And Verification

**Files:**
- Regenerate: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/data/ruleset-manifest.json`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/releases.js`
- Modify: local candidate hash bindings found by the verification guard.

**Interfaces:**
- Produces: a new deterministic ruleset hash and candidate binding while retaining every old descriptor.

- [ ] Run `node scripts/generate-online-v3-meta-rules.mjs`.
- [ ] Update only candidate/local bindings required by generator and guard output.
- [ ] Run focused Merchant, boundary, extraction, Otter, and release-registry tests.
- [ ] Run syntax checks for every changed JavaScript file.
- [ ] Run `npm run verify:phase` once because Worker/ruleset/shared Ranked runtime changed.
- [ ] Run `npm run verify:ranked-headed -- --scenario camp` for the affected current-tree Ranked flow.
- [ ] Run `git diff --check`, inspect `git status --short`, and report without committing or deploying.
