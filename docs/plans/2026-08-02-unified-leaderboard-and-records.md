# Unified Leaderboard and Practice Records Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give the Online build one canonical Gothic Ranked Leaderboard and give terminal Practice campaigns an equally polished offline Practice Records archive with truthful build details.

**Architecture:** Keep Ranked list/detail data in the existing Online v3 client and Worker contract, but replace its presentation model and CSS. Extend only the local Practice record payload with a terminal snapshot, render it with the same shared record classes in the native overlay, and route terminal buttons by `state.onlineV3Ranked` so the two modes never mix data.

**Tech Stack:** Vanilla JavaScript, existing DOM overlays, CSS, localStorage, Online v3 client modules, Node test runner, existing headed Playwright verification.

---

### Task 1: Specify and test the reusable Ranked record view model

**Files:**
- Modify: `online-v3/ranked-v3-leaderboard-ui.js:10-208`
- Create: `tests/ranked-v3-leaderboard-ui.test.js`

**Step 1: Write the failing test**

Create a Node test that loads the UMD module in a small DOM fixture and asserts:

- `createLeaderboardViewModel()` preserves rank/name/score/depth/gold;
- `renderList()` exposes five labelled facts only, three podium records, and a
  clickable player name plus `Inspect build` control;
- neither duration nor outcome appears in the primary ledger;
- the detail view renders known relics and a focusable mutator tooltip with
  exact active modifier IDs.

**Step 2: Run the test to verify it fails**

Run: `node --test tests/ranked-v3-leaderboard-ui.test.js`

Expected: FAIL because the old renderer prints outcome/duration and has no
podium or mutator disclosure.

**Step 3: Implement the minimal presentation model**

Add immutable helpers for record facts, terminal summary fields, safe mutator
metadata lookup, human time formatting, and a reusable `renderRecordLedger()`.
Render a top-three podium and an ordinary ledger. Use `textContent`, not
interpolated record text, for player data. Build rows expose both name and
inspect buttons to the same callback. The detail page uses only fields that are
actually present in the returned entry.

**Step 4: Run the focused regression**

Run: `node --test tests/ranked-v3-leaderboard-ui.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/ranked-v3-leaderboard-ui.test.js online-v3/ranked-v3-leaderboard-ui.js
git commit -m "Redesign Ranked leaderboard records"
```

### Task 2: Apply the shared Gothic record visual system

**Files:**
- Modify: `style.css:1496-1750`
- Modify: `style.css:4671-5000`
- Modify: `online-v3/ranked-v3-runtime.js:189-263`

**Step 1: Write the failing styling contract test**

Extend `tests/ranked-v3-leaderboard-ui.test.js` with source assertions for the
shared record custom properties, top-three skull asset treatment, reduced-motion
fallback, responsive ledger labels, and explicit focus styles.

**Step 2: Run the test to verify it fails**

Run: `node --test tests/ranked-v3-leaderboard-ui.test.js`

Expected: FAIL because current classes use a two-column utilitarian row and
there is no shared record theme.

**Step 3: Implement the visual layer**

Refactor leaderboard CSS around shared `record-archive-*` classes. Reuse the
existing HD skull image as the actual podium artwork and tint each existing
asset for gold, silver, and bronze ranks. Preserve the existing dark Gothic
chrome, add a responsive ledger layout and `prefers-reduced-motion` rule.
Update Ranked headings and controls to call the view `Ranked Leaderboard` and
`Build Chronicle` without changing API requests.

**Step 4: Run the focused regression**

Run: `node --test tests/ranked-v3-leaderboard-ui.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add style.css online-v3/ranked-v3-runtime.js tests/ranked-v3-leaderboard-ui.test.js
git commit -m "Style leaderboard records as Gothic archive"
```

### Task 3: Make Practice records terminal-only and chronicle-capable

**Files:**
- Modify: `game.js:1699-1800`
- Modify: `game.js:4450-4520`
- Modify: `game.js:14170-14390`
- Modify: `tests/practice-records.test.js`

**Step 1: Write the failing test**

Create a focused static/domain test for the local contract. It must assert that
Practice writes only from final defeat and final victory, not extraction or an
ordinary life loss; sanitization preserves a terminal build/summary snapshot;
and legacy entries remain readable with unavailable detail rather than invented
statistics.

**Step 2: Run the test to verify it fails**

Run: `node tests/practice-records.test.js`

Expected: FAIL because extraction and first death currently submit records.

**Step 3: Implement the minimal terminal snapshot**

Add dedicated snapshot helpers which copy, sanitize, and freeze the current
relic IDs/stacks, pacts, skills, upgrades, elixirs, active mutators, elapsed
time when available, and terminal Game Over statistics. Move record creation to
the terminal defeat/victory paths before reset. Keep old entries valid and do
not queue Practice Records to a network API.

**Step 4: Run the focused regression and syntax check**

Run:

```bash
node tests/practice-records.test.js
node --check game.js
```

Expected: PASS.

**Step 5: Commit**

```bash
git add game.js tests/practice-records.test.js
git commit -m "Store terminal Practice record chronicles"
```

### Task 4: Route menu and terminal record actions by mode

**Files:**
- Modify: `game.js:3931-3945`
- Modify: `game.js:7430-7445`
- Modify: `game.js:22538-22650`
- Modify: `game.js:23024-23190`
- Modify: `game.js:31891-31935`
- Modify: `scripts/build-pages-v3.mjs:168-185`
- Modify: `cloudflare/leaderboard-v3/test/production-release.test.js:330-360`
- Modify: `tests/practice-records.test.js`

**Step 1: Write the failing test**

Extend the Practice record test and Pages production boundary test to require:

- the Online menu only routes the bridge `leaderboard` option to
  `DungeonOnlineV3.openLeaderboard()`;
- a terminal Ranked action opens canonical Online results;
- a terminal Practice action opens only local Practice Records;
- native Practice labels never claim an online source or fallback.

**Step 2: Run the tests to verify they fail**

Run:

```bash
node tests/practice-records.test.js
node --test cloudflare/leaderboard-v3/test/production-release.test.js
```

Expected: FAIL because all terminal actions currently call the old generic
leaderboard modal.

**Step 3: Implement contextual navigation and local detail rendering**

Rename/restrict the native local modal as Practice Records. Render the Practice
podium, ledger, and chronicle with the shared archive classes and a no-network
detail path. Add a single terminal record action that selects the existing
Online overlay only when `state.onlineV3Ranked` is true. Keep the generated
Online menu replacement bound to the one main-menu `Leaderboard` entry.

**Step 4: Run focused verification**

Run:

```bash
node tests/practice-records.test.js
node --test tests/ranked-v3-leaderboard-ui.test.js
node --test cloudflare/leaderboard-v3/test/production-release.test.js
node --check game.js
node --check online-v3/ranked-v3-leaderboard-ui.js
node --check online-v3/ranked-v3-runtime.js
node --check scripts/build-pages-v3.mjs
```

Expected: all PASS.

**Step 5: Commit**

```bash
git add game.js scripts/build-pages-v3.mjs cloudflare/leaderboard-v3/test/production-release.test.js tests/practice-records.test.js
git commit -m "Separate Practice Records from Ranked leaderboard"
```

### Task 5: Verify visible behavior and record the handoff

**Files:**
- Modify: `progress.md`

**Step 1: Build the current Pages test bundle**

Run: `npm.cmd run build:pages:test`

Expected: successful bundle build with the QA marker only under
`output/pages-test-dist`.

**Step 2: Run current-tree UI verification**

Run:

```bash
npm.cmd run verify:ui-current -- --scenario hd
npm.cmd run verify:ranked-headed -- --scenario lifecycle
```

Expected: PASS with no new console or page errors.

**Step 3: Inspect artifacts**

Open the latest screenshot for each headed command. Confirm Gothic frame,
top-three podium treatment, collapsed narrow layout, distinct Practice/Ranked
labels, and keyboard-visible focus. Inspect text-state and console artifacts;
fix the first new error before proceeding.

**Step 4: Run required regression boundaries**

Run:

```bash
npm.cmd run verify:baseline
npm.cmd run verify:phase
npm.cmd run verify:guard
git diff --check
```

Expected: all PASS. Do not deploy, push, migrate, backfill, or activate a
ruleset.

**Step 5: Record and commit**

Append the exact user-visible behavior, test receipts, and remaining manual
visual review note to `progress.md`.

```bash
git add progress.md
git commit -m "Record leaderboard verification"
```
