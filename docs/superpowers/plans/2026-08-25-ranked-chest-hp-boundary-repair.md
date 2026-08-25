# Ranked Chest HP Boundary Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore reliable Ranked depth progression after canonical health chests while preserving strict Worker-derived maximum HP validation.

**Architecture:** Make active-run `build.resources.maxHp` include the health total derived from the canonical chest ledger. Apply a newly issued health award before bounded combat-resource validation, rebuild the same effective maximum during profile hydration, and keep Camp Vitality multiplicative only over base HP.

**Tech Stack:** JavaScript ES modules, Node test runner, Cloudflare Workers ruleset generator, Playwright headed Ranked verification.

**Spec:** `docs/superpowers/specs/2026-08-25-ranked-chest-hp-boundary-repair-design.md`

## Global Constraints

- Work in one agent and preserve all unrelated tracked and untracked files.
- Do not weaken chest bindings, replay protection, resource bounds, schemas, or rank eligibility.
- Do not trust a client-provided chest amount or maximum HP.
- Do not change protected v0.8 gameplay, Observer Bot policy, UI, assets, D1, or Wrangler configuration.
- Do not commit, push, deploy, migrate, or activate a ruleset in this phase.

---

### Task 1: Health chest settlement and bounded HP

**Files:**
- Modify: `cloudflare/leaderboard-v3/test/canonical-chest-outcomes.test.js`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/reward-policy.js`

**Interfaces:**
- Consumes: `applyIssuedChestStatBonusV08(campaign, { stat, scalingDepth })` and `projectChestBonusesV08(chestBonuses)`.
- Produces: canonical active-run `build.resources.hp/maxHp` after a valid issued health award.

- [x] **Step 1: Add the failing bounded-health-chest regression**

  Extend the canonical chest test helpers so a health claim can run with both
  `canonicalChestOutcomes: "v1"` and `boundedCombatResources: "v1"`. Submit
  `combatResources: { hp: 105, maxHp: 105 }` from a state whose canonical
  resources start at `100/100`, and assert that settlement yields one health
  bucket plus canonical `105/105`.

- [x] **Step 2: Observe RED**

  Run:

  ```powershell
  node --test --test-concurrency=1 cloudflare/leaderboard-v3/test/canonical-chest-outcomes.test.js
  ```

  Expected: the new test fails with
  `BOUNDARY_COMBAT_RESOURCES_MAX_MISMATCH`.

- [x] **Step 3: Apply the issued health delta before resource validation**

  Import `projectChestBonusesV08` into `reward-policy.js`. Around the existing
  `applyIssuedChestStatBonusV08` call, derive the old and new canonical
  `healthFlat` totals. For a positive health delta, increase
  `next.build.resources.maxHp` and `next.build.resources.hp` by exactly that
  delta before `validateBoundaryCombatResourcesV08(next, request, ...)` runs.
  Do not alter attack/armor resource fields and do not add any client amount.

- [x] **Step 4: Prove fail-closed and replay behavior**

  Add assertions that the same settlement replays without a second increment,
  `maxHp: 106` is rejected, and existing fatal/emergency coverage leaves both
  the ledger and effective maximum unchanged.

- [x] **Step 5: Run the focused test green**

  Run the command from Step 2. Expected: PASS.

### Task 2: Profile hydration and Camp Vitality

**Files:**
- Modify: `cloudflare/leaderboard-v3/test/chest-bonus-carry.test.js`
- Modify: `cloudflare/leaderboard-v3/test/m1-camp-pact.test.js`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/profile-policy.js`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/camp-policy.js`

**Interfaces:**
- Consumes: `projectChestBonusesV08(campaign.chestBonuses).healthFlat`.
- Produces: a later run whose canonical `hp/maxHp` includes carried additive
  chest health exactly once.

- [x] **Step 1: Add failing carry and Vitality regressions**

  Strengthen the profile carry test so a depth-31 health bucket produces
  `build.resources.maxHp = 107` and `hp = 107` after hydration. Add a Camp
  Vitality case with `+5` carried chest health and effective `105/105`; after
  buying Vitality level 1, assert effective `115/115`, not `116/116`.

- [x] **Step 2: Observe RED**

  Run:

  ```powershell
  node --test --test-concurrency=1 cloudflare/leaderboard-v3/test/chest-bonus-carry.test.js cloudflare/leaderboard-v3/test/m1-camp-pact.test.js
  ```

  Expected: hydration remains `100/100`, and the unadjusted Vitality formula
  rounds `105 * 1.1` to `116`.

- [x] **Step 3: Rebuild effective HP during hydration**

  Normalize `next.campaign` before resetting the build in
  `hydrateRunFromProfileV08`. Pass the projected `healthFlat` into the private
  reset helper and add it once after deriving the base/Vitality maximum. Start
  the next run with `hp` equal to that effective maximum in both legacy and v1
  potion-policy branches.

- [x] **Step 4: Keep Vitality additive with chest health**

  Import `projectChestBonusesV08` in `camp-policy.js`, pass canonical campaign
  state into `applyInstantUpgradePreview`, subtract the projected health flat
  before applying the old/new Vitality ratio, then add the unchanged flat back.
  Apply the same transformation to current HP while maintaining `0 <= hp <=
  maxHp`.

- [x] **Step 5: Run both focused files green**

  Run the command from Step 2. Expected: PASS.

### Task 3: Ruleset artifacts and proportional verification

**Files:**
- Modify: generated files selected by `scripts/generate-online-v3-meta-rules.mjs`
- Verify: the complete intended diff only

**Interfaces:**
- Produces: a regenerated ruleset manifest/hash that matches the changed pure
  ruleset source without activating it in production.
- Preserves: the prior production hash as a registered, protocol-supported
  descriptor with its complete bounded-resource capability contract.

- [x] **Step 1: Regenerate canonical ruleset artifacts**

  Run:

  ```powershell
  node scripts/generate-online-v3-meta-rules.mjs
  ```

  Inspect every generated path. Do not edit production bindings, D1, or
  Wrangler configuration manually.

- [x] **Step 1a: Bind the repaired hash without orphaning active runs**

  Add the pre-repair production hash to the Worker production/local registries,
  the compatible-hash policy, and every matching client capability set. Update
  the client current hash to the regenerated manifest hash only after the final
  ruleset source regeneration. Prove the prior descriptor resolves with
  `boundedCombatResources: "v1"`.

- [x] **Step 2: Run focused syntax and domain verification**

  Run:

  ```powershell
  node --check cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/reward-policy.js
  node --check cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/profile-policy.js
  node --check cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/camp-policy.js
  node --test --test-concurrency=1 cloudflare/leaderboard-v3/test/canonical-chest-outcomes.test.js cloudflare/leaderboard-v3/test/chest-bonus-carry.test.js cloudflare/leaderboard-v3/test/m1-camp-pact.test.js cloudflare/leaderboard-v3/test/ranked-boundary-resources.test.js
  ```

  Expected: all checks PASS.

- [x] **Step 3: Run the required shared-ruleset verification once**

  Run:

  ```powershell
  npm run verify:phase
  ```

  Expected: PASS with matching generated ruleset artifacts.

- [x] **Step 4: Run the affected headed Ranked scenario**

  Run:

  ```powershell
  npm run verify:ranked-headed -- --scenario camp
  ```

  Expected: PASS through extraction, Camp, and the next descent without a
  repeated current-room recovery loop.

- [x] **Step 5: Audit the final workspace**

  Run `git diff --check`, `git status --short`, and inspect the exact diff.
  Confirm the user's three pre-existing untracked files are untouched, no D1
  migration exists, and no production action occurred.
