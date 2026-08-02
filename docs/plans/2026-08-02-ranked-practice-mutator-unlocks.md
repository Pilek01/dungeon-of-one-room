# Ranked Practice-Parity Mutator Unlocks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Online Ranked use the exact Practice mutator unlock conditions, with one accepted local Practice import followed by canonical server progression and reversible Camp selection.

**Architecture:** A new pure ruleset progression module owns sanitized counters, unlock evaluation, import consumption, and fresh-campaign reset. Existing canonical events feed that module, profiles persist and project it, Camp offers server-issued add/remove transactions, and the generated game bridge renders unlocks from the profile rather than transient offers.

**Tech Stack:** Browser JavaScript, Cloudflare Worker/Durable Objects, Online v3 ruleset domain, generated Pages bridge, Node test runner, Playwright headed Ranked QA.

---

### Task 1: Lock the Practice contract with RED tests

**Files:**
- Create: `cloudflare/leaderboard-v3/test/ranked-mutator-progression.test.js`
- Modify: `cloudflare/leaderboard-v3/test/online-ranked-boundary-repair.test.js`
- Reference: `mutator-data.js`

1. Add a table-driven test for all ten Practice metric/threshold pairs.
2. Add RED tests proving counters below each threshold remain locked and the exact threshold unlocks once.
3. Add RED tests for stable sorted IDs, invalid counter rejection, unknown import IDs, and import replay rejection.
4. Add a RED legacy-profile hydration test with no progression fields.
5. Run the two focused test files and preserve the expected failures.

### Task 2: Add canonical mutator progression and one-time import

**Files:**
- Create: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/mutator-progression.js`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/meta-state.js`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/profile-policy.js`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/index.js`
- Modify: `cloudflare/leaderboard-v3/src/http/schema-policy.js`
- Modify: `cloudflare/leaderboard-v3/src/index.js`
- Modify: `cloudflare/leaderboard-v3/src/domain/run-bootstrap.js`

1. Define a versioned progression object containing `totalKills`, `eliteKills`, `depthHighscore`, `totalGoldEarned`, `totalMerchantPots`, `shieldUsesThisGame`, `potionFreeExtract`, sorted unlock IDs, and a persistent import-consumed marker.
2. Evaluate unlocks from the existing generated catalog instead of duplicating thresholds.
3. Accept an optional bounded Practice import only while the profile import marker is false.
4. Recompute nine unlocks from imported metrics; allow the historical Resilience flag as the explicitly accepted exception.
5. Include already-active legacy modifier IDs in the migrated unlock set.
6. Persist the import receipt across fresh campaign resets while resetting campaign counters/unlocks/active modifiers.
7. Project progression/unlock IDs in public profile and run state.
8. Run the focused progression/profile tests and confirm GREEN.

### Task 3: Feed progression from canonical events

**Files:**
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/reward-policy.js`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/gold-ledger.js`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/merchant-policy.js`
- Modify: the existing extraction/fatal-event ruleset modules selected by source tracing
- Modify: `online-v3/ranked-v3-checkpoints.js`
- Modify: `online-v3/ranked-v3-runtime.js`
- Modify: `scripts/build-pages-v3.mjs`

1. Add RED tests proving accepted enemy claims advance total/elite kills exactly once under replay.
2. Prove canonical gold awards, Merchant potion purchases, and accepted depth advance the matching counters exactly once.
3. Add a bounded `shield-use` checkpoint claim and bridge callback from the existing Shield action; preserve the no-network-during-combat rule.
4. Track canonical potion use for the current run and award Famine only on normal extraction at depth 10+ with zero uses.
5. Re-evaluate unlock IDs after each relevant canonical mutation.
6. Run focused reward, Merchant, extraction, retry, and runtime tests.

### Task 4: Add reversible canonical Camp selection

**Files:**
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/camp-policy.js`
- Modify: `online-v3/ranked-v3-runtime.js`
- Modify: `scripts/build-pages-v3.mjs`
- Test: `cloudflare/leaderboard-v3/test/ranked-mutator-progression.test.js`

1. Add RED tests: locked mutators get no add offer; unlocked inactive mutators get `mutator_add`; active mutators always get `mutator_remove`; three active suppress further additions but not removals.
2. Bind both transaction types to the exact expected active set and reject stale commits.
3. Commit removal by rebuilding the canonical run-modifier ledger with the selected ID removed.
4. Extend runtime Camp choice matching and `toggleMutator` to request add or remove based on canonical active state.
5. Keep Practice `toggleMutator` behavior byte-for-byte unchanged in the source game.
6. Run focused domain/runtime tests and generated-bundle syntax checks.

### Task 5: Stabilize import and UI projection

**Files:**
- Modify: `online-v3/ranked-v3-client.js`
- Modify: `online-v3/ranked-v3-runtime.js`
- Modify: `scripts/build-pages-v3.mjs`
- Modify only if required: `online-v3/ranked-v3-protocol.js`
- Test: existing Online client/runtime contract tests

1. Read the Practice import snapshot before any fresh-Ranked reset mutates in-memory state.
2. Send the import only when available; let the server decide whether it has already been consumed.
3. Project `unlockedMutatorIds` separately from active run modifiers.
4. Remove every inference from transient `mutator_add` offers.
5. Add tests for reopen Camp, refresh after add/remove, Continue Ranked, Start Next Run, and Start New Ranked reset.
6. Confirm no Online state is written back into Practice mutator persistence.

### Task 6: Regenerate the candidate ruleset and verify visible Camp behavior

**Files:**
- Generated: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/data/ruleset-manifest.json`
- Modify: `scripts/online-v3-ranked-headed.mjs` only if the existing `camp` scenario lacks the required interactions
- Modify: `progress.md`

1. Run the canonical Online v3 rules generator and inspect every generated change.
2. Run focused tests and syntax checks for all changed JavaScript.
3. Run `npm.cmd run verify:ranked-headed -- --scenario camp` and exercise locked, newly unlocked, add, remove, three-active limit, Camp reopen, and Start Next Run.
4. Inspect screenshot, `render_game_to_text`, API calls, console errors, and page errors.
5. Append a concise progress entry with exact results and remaining release state.

### Task 7: Final proportional verification

1. Run `npm.cmd run verify:guard` once.
2. Run `npm.cmd run verify:phase` once because Worker/ruleset/shared Ranked runtime changed.
3. Run `npm.cmd run verify:full` once because protocol/ruleset/Worker release surfaces changed; do not separately rerun checks already replaced by full unless relevant files changed afterward.
4. Run `git diff --check` and check trailing whitespace in new files.
5. Run `npm.cmd run status:compact` and confirm protected fingerprints remain empty in the worktree and unchanged in main.
6. Inspect the exact final diff and changed-file count.
7. Do not stage, commit, push, deploy, migrate D1, backfill, or activate the candidate ruleset without separate explicit authorization.
