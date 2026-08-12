# Boot Loading Hotfix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Start the production loading indicator immediately after the first boot input without reintroducing the gameplay-board flash.

**Architecture:** Keep the existing HD readiness promise and menu-before-reveal sequence. Add the loading presentation state synchronously at the `enterSplash()` boundary, while leaving the production builder's idempotent loading state and fade logic intact.

**Tech Stack:** Browser JavaScript, Node.js `node:test`, Pages build transform, Cloudflare Pages.

## Global Constraints

- Keep `GAME_VERSION` at `v0.8.2`.
- Do not change Worker, D1, protocol, gameplay, ruleset semantics, or Classic asset policy.
- Preserve `initialGraphicsReady -> enterMenu() -> dismissBootScreen()` ordering.
- Use one focused regression contract and no unrelated refactoring.

---

### Task 1: Boot loading transition

**Files:**
- Modify: `tests/hd-only-release-gates.test.js`
- Modify: `game.js`

**Interfaces:**
- Consumes: `bootScreenEl`, `initialGraphicsReady`, `enterMenu()`, and `dismissBootScreen()`.
- Produces: synchronous `bootScreenEl` loading presentation before the readiness promise settles.

- [ ] **Step 1: Write the failing regression assertion**

Add an assertion to the existing `boot input prepares the menu before revealing the HD app` test that requires `bootScreenEl?.classList.add("loading")` to occur before `Promise.resolve(initialGraphicsReady)`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/hd-only-release-gates.test.js`

Expected: one failure stating that boot input must start loading immediately.

- [ ] **Step 3: Implement the minimal fix**

At the start of `enterSplash()`, add:

```js
bootScreenEl?.classList.add("loading");
```

- [ ] **Step 4: Run focused checks and verify GREEN**

Run: `node --test tests/hd-only-release-gates.test.js`

Run: `node --check game.js`

Run: `git diff --check`

Expected: all commands exit successfully.

### Task 2: Generated provenance and release verification

**Files:**
- Regenerate: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/data/*.generated.json`
- Regenerate: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/ruleset-manifest.json`

**Interfaces:**
- Consumes: the updated `game.js` source fingerprint.
- Produces: self-consistent test-only generated provenance; canonical ruleset data remains unchanged.

- [ ] **Step 1: Regenerate and check metadata**

Run: `node scripts/generate-online-v3-meta-rules.mjs`

Run: `node scripts/generate-online-v3-meta-rules.mjs --check`

Expected: the check reports PASS and only `game.js` provenance plus derived file hashes change.

- [ ] **Step 2: Run required verification**

Run: `npm run verify:guard`

Run: `npm run verify:full`

Run: `git diff --check`

Expected: all verification exits successfully.

- [ ] **Step 3: Build and verify the release bundle**

After current visual evidence is regenerated and explicitly approved, run `npm run pages:build`, then `node scripts/verify-pages-production-bundle.mjs`.

Expected: the bundle identifies the final merge commit, contains no QA marker or retired Classic presentation assets, and passes verification.

- [ ] **Step 4: Publish through the approved release workflow**

Commit only the hotfix, regression contract, design/plan, and generated provenance; push the hotfix branch; create and merge a PR into `main`; build from the exact merge SHA; verify Wrangler authentication; then deploy `output/pages-dist` to the `dungeon-of-one-room` Pages project. Do not deploy the Worker.
