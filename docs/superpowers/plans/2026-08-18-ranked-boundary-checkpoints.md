# Ranked Boundary Checkpoints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Ranked room settlement from the last enemy kill to portal, extraction, emergency extraction, and fatal boundaries while preserving legacy ruleset contracts.

**Architecture:** The injected game bridge keeps the active reward recorder open after clear and captures an immutable boundary journal only when the player leaves or dies. The shared runtime uses the existing checkpoint for a cleared portal/normal extraction and capability-gated event payloads for emergency/fatal settlement; the Worker derives canonical state and old hashes retain their current event contracts. The local `v08-meta-1` candidate alone advertises the new capability and receives a regenerated manifest hash without production activation.

**Tech Stack:** Browser JavaScript adapter/runtime, Node.js test runner, Cloudflare Worker pure ruleset/domain modules, generated ruleset manifest, Playwright-based Ranked QA.

**Spec:** `docs/plans/2026-08-18-ranked-boundary-checkpoints-design.md`

## Global Constraints

- Work with one agent and no delegation.
- Do not modify `game.js`; use `scripts/build-pages-v3.mjs` injection.
- Add no requests during movement, combat, AI, animation, audio, or rendering.
- Online v3 remains checkpoint-authoritative meta-progression, not server-authoritative combat and not cheat-proof.
- Preserve every historical and production ruleset contract; enable settlement only for the new local candidate hash.
- Do not change D1, push, deploy, activate a ruleset, commit, or touch `docs/plans/2026-08-13-ranked-playtest-fixes.md`.
- Use exact copy: `Loading next depth…`, `Extracting…`, and the approved one-time integrity notice.

---

### Task 1: Browser boundary journal and transition contract

**Files:**
- Modify: `cloudflare/leaderboard-v3/test/online-ranked-boundary-repair.test.js`
- Modify: `online-v3/ranked-v3-recorder.js`
- Modify: `online-v3/ranked-v3-protocol.js`
- Modify: `online-v3/ranked-v3-client.js`
- Modify: `online-v3/ranked-v3-runtime.js`
- Modify: `scripts/build-pages-v3.mjs`

**Interfaces:**
- Consumes: active directive, recorder claims, completion capability, room-start gold.
- Produces: `captureRankedBoundary()` returning `{ turnCount, rewardClaims, reportedGoldDelta, completionCapability }`; `supportsBoundarySettlement(hash)`; `onPortalEntry()`; capable event payload `boundarySettlement`.

- [ ] **Step 1: Write failing source/runtime tests** proving clear does not snapshot or resolve, portal invokes `onPortalEntry`, fatal/extract capture one immutable journal, and delayed copy is exact.
- [ ] **Step 2: Run RED:** `node --test cloudflare/leaderboard-v3/test/online-ranked-boundary-repair.test.js`; expect missing boundary APIs/copy.
- [ ] **Step 3: Implement minimally.** Capable hashes keep the journal open after clear; portal/extract/fatal seal it. Legacy hashes retain eager settlement. A prevented fatal starts a new same-room recorder segment.
- [ ] **Step 4: Run the same command and require GREEN.**

### Task 2: Capability-gated Worker settlement

**Files:**
- Create: `cloudflare/leaderboard-v3/test/ranked-boundary-checkpoints.test.js`
- Modify: `cloudflare/leaderboard-v3/src/domain/ruleset-runtime.js`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/releases.js`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/reward-policy.js`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/index.js`
- Modify only if validation requires it: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/meta-state.js`

**Interfaces:**
- Consumes: `boundarySettlement` with room binding, claims, integrity values, and outcome `emergency` or `fatal`.
- Produces: `settleBoundaryRewardEnvelope(state, request, { outcome }, context)` and capability `boundarySettlementMode: "event-journal-v1"`.

- [ ] **Step 1: Write failing pure/runtime tests** for late chest portal settlement; emergency without clear reward/depth; fatal map-fragment durability without clear/depth; exact replay; prevented-fatal continuation without duplicate claim; later-room map fragment; edited totals provisional; transport failure neutral; legacy compatibility.
- [ ] **Step 2: Run RED:** `node --test cloudflare/leaderboard-v3/test/ranked-boundary-checkpoints.test.js`; expect missing settlement interface.
- [ ] **Step 3: Implement minimally.** Cleared keeps fixed awards/progression; emergency applies bounded claims without fixed award before server loss; fatal applies supported durable discoveries/resource consequences before life resolution. Reuse claim-slot consumption and HTTP recent-operation replay; never trust client totals.
- [ ] **Step 4: Run GREEN:** `node --test cloudflare/leaderboard-v3/test/ranked-boundary-checkpoints.test.js cloudflare/leaderboard-v3/test/ranked-integrity.test.js cloudflare/leaderboard-v3/test/ranked-fatal-worker-recovery.test.js cloudflare/leaderboard-v3/test/revision-idempotency.test.js cloudflare/leaderboard-v3/test/ruleset-registry.test.js`.

### Task 3: Candidate manifest/hash compatibility

**Files:**
- Modify generated: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/data/ruleset-manifest.json`
- Modify other generated source-bound data only if the generator reports drift.
- Modify: `online-v3/ranked-v3-protocol.js`

**Interfaces:**
- Consumes: normalized ruleset bytes.
- Produces: one new test-only candidate hash in `BOUNDARY_SETTLEMENT_RULESET_HASHES`; all previous hashes remain supported.

- [ ] **Step 1: Regenerate:** `node scripts/generate-online-v3-meta-rules.mjs`.
- [ ] **Step 2: Bind the exact generated candidate hash only; do not change production `RULESET_HASH` or production descriptors.**
- [ ] **Step 3: Verify:** `node --test cloudflare/leaderboard-v3/test/ruleset-manifest.test.js cloudflare/leaderboard-v3/test/ruleset-registry.test.js cloudflare/leaderboard-v3/test/production-release.test.js`.

### Task 4: Required local verification

**Files:**
- Verify only; no release/production-state files.

**Interfaces:**
- Consumes: final current tree.
- Produces: fresh syntax, focused, phase, browser, baseline, and whitespace evidence.

- [ ] **Step 1: Run `node --check` once for every changed JavaScript file.**
- [ ] **Step 2: Run final focused tests once after relevant edits.**
- [ ] **Step 3: Run `npm run verify:guard`, `npm run verify:phase`, exactly one affected `verify:ranked-headed` scenario selected from coverage, and `npm run verify:baseline`.**
- [ ] **Step 4: Open the latest affected Ranked screenshots and inspect the log for new console/page errors.**
- [ ] **Step 5: Run `git -c safe.directory=C:/Users/Kamil/.codex/worktrees/c097/dungeon-online-v3 diff --check` and full status; confirm the older user plan is untouched and no production action occurred.**
