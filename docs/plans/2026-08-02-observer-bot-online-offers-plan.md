# Observer Bot Online Offer Synchronization Implementation Plan

> **For Codex:** Follow this plan task-by-task with systematic debugging and TDD.

**Goal:** Prevent the Ranked Observer Bot from racing canonical Online v3 offers and portal transitions while keeping test runs autonomous.

**Architecture:** The Ranked runtime owns deterministic automated choice submission and exposes one read-only busy signal through the production bridge. The local Observer Bot consults that signal before taking any gameplay action, while all canonical mutations continue through the existing Ranked client.

**Tech Stack:** Browser JavaScript, Node test runner, generated Pages bridge, Playwright headed Ranked QA.

---

### Task 1: Add RED runtime and bridge regressions

**Files:**
- Modify: `cloudflare/leaderboard-v3/test/online-ranked-boundary-repair.test.js`
- Modify or create the narrowest existing runtime harness under `cloudflare/leaderboard-v3/test/`

1. Add a regression proving an active test bot causes relic, replacement, and
   meta offers to submit one stable legal server-issued choice.
2. Add a Forge regression proving `open_meta_offer` and its canonical choice
   complete before checkpoint and portal entry.
3. Add a bridge regression proving the bot loop observes the Ranked automation
   busy signal.
4. Run the exact new tests and preserve the expected RED result.

### Task 2: Implement runtime-owned automated offer resolution

**Files:**
- Modify: `online-v3/ranked-v3-runtime.js`

1. Track whether the Ranked test bot is enabled after password validation.
2. Track one automated canonical action at a time.
3. Resolve relic, replacement, and meta offers from legal public choices using
   deterministic selection and the existing client calls.
4. Keep failures routed through the existing recovery UI and clear the busy
   state only after acknowledgement or error handling.
5. Run the focused runtime tests and confirm GREEN.

### Task 3: Block local bot actions across canonical boundaries

**Files:**
- Modify: `scripts/build-pages-v3.mjs`
- Test: `cloudflare/leaderboard-v3/test/online-ranked-boundary-repair.test.js`

1. Expose `isRankedAutomationBlocked()` on the generated game bridge.
2. Add a generated-build guard to the Observer Bot step before local movement,
   special-room interaction, or portal descent.
3. Ensure ordinary player input and Practice Observer Bot behavior are
   unchanged.
4. Run focused tests and JavaScript syntax checks.

### Task 4: Verify the visible lifecycle

**Files:**
- Modify only if required: `scripts/online-v3-ranked-headed.mjs`

1. Extend the existing lifecycle scenario only as needed to exercise the
   password-gated bot through representative canonical offers and portal entry.
2. Run `npm.cmd run verify:ranked-headed -- --scenario lifecycle`.
3. Inspect the resulting screenshot and player-visible text state.
4. Confirm no `Online v3 is still resolving the next room.`, reconnect overlay,
   console error, or page error appears.

### Task 5: Final proportional verification

1. Run syntax checks for every changed JavaScript file.
2. Run the focused regression suite.
3. Run `npm.cmd run verify:guard` once.
4. Run `npm.cmd run verify:phase` once because shared Ranked runtime changed.
5. Run `git diff --check`.
6. Run `npm.cmd run status:compact` and confirm the protected fingerprints are
   unchanged.
7. Inspect the exact final diff and report without staging, committing, pushing,
   deploying, or activating a ruleset.
