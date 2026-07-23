# Runtime HD / Classic Graphics Toggle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a persistent `Options → Graphics → HD / Classic` selector that changes renderers without restarting or losing the current run, then merge the verified overhaul into `main`.

**Architecture:** Add a small UMD preference module for strict local-storage parsing and keep the preference outside run state. Route the existing Options UI through the existing race-safe graphics controller so Classic applies synchronously and HD activates atomically after its critical assets load. Use the real menu flow in browser QA to prove state preservation and persistence.

**Tech Stack:** Vanilla JavaScript, Canvas 2D, DOM/CSS Options overlay, localStorage, Node test runner, Playwright browser QA, Git worktrees.

---

### Task 1: Freeze the renderer-preference contract

**Files:**
- Create: `render/graphics-preference.js`
- Create: `tests/graphics-toggle.test.js`
- Modify: `index.html:95-112`

**Step 1: Write the failing preference tests**

Cover these exact contracts:

```js
assert.equal(api.normalizeMode("hd", "classic"), "hd");
assert.equal(api.normalizeMode("classic", "hd"), "classic");
assert.equal(api.normalizeMode("broken", "hd"), "hd");
assert.equal(api.defaultMode(true), "hd");
assert.equal(api.defaultMode(false), "classic");
assert.equal(api.readPreference(storage, true), "classic");
assert.equal(api.writePreference(storage, "hd"), "hd");
assert.equal(api.isHd("hd"), true);
assert.equal(api.isHd("classic"), false);
```

Also assert that the module loads before `game.js` and does not contain audio or run-save identifiers.

**Step 2: Run the test to verify RED**

Run: `node --test tests/graphics-toggle.test.js`

Expected: FAIL because `render/graphics-preference.js` does not exist.

**Step 3: Implement the minimal UMD module**

Expose an immutable API with:

```js
const STORAGE_KEY = "dungeonOneRoomGraphicsMode";
const MODES = Object.freeze(["hd", "classic"]);
function normalizeMode(value, fallback) { /* strict hd/classic only */ }
function defaultMode(hdEnabled) { return hdEnabled ? "hd" : "classic"; }
function readPreference(storage, hdEnabled) { /* safe getItem + fallback */ }
function writePreference(storage, mode) { /* strict setItem + return */ }
function isHd(mode) { return normalizeMode(mode, "classic") === "hd"; }
```

Load it in `index.html` immediately before `game.js` and after the renderer dependencies.

**Step 4: Run the tests to verify GREEN**

Run: `node --test tests/graphics-toggle.test.js`

Expected: PASS.

**Step 5: Commit**

```powershell
git add -- render/graphics-preference.js tests/graphics-toggle.test.js index.html
git commit -m "feat: add persistent graphics preference"
```

### Task 2: Add Graphics to the existing Options flow

**Files:**
- Modify: `game.js:1850-1865,5925-6110,18345-18435,25895-25985`
- Modify: `tests/graphics-toggle.test.js`

**Step 1: Write failing Options contracts**

Assert that `game.js`:

- accepts `menuOptionsView === "graphics"`;
- adds root item `{ id: "graphics", key: "3", title: "Graphics" }`;
- exposes HD and Classic submenu items;
- marks the saved preference active and reports an HD-requested/Classic-runtime fallback;
- supports Enter, number shortcuts, left/right selection, and Escape back to Options root.

**Step 2: Run the test to verify RED**

Run: `node --test tests/graphics-toggle.test.js`

Expected: FAIL on the absent Graphics menu route.

**Step 3: Implement menu-only presentation and navigation**

Add:

```js
function getGraphicsOptionsItems() {
  return [
    { id: "hd", key: "1", label: "HD" },
    { id: "classic", key: "2", label: "Classic" }
  ];
}
```

Extend the root menu, active-items resolver, index synchronization, back navigation, renderer label, overlay subtitle/hint, activation, quick keys, and A/D or arrow switching using the same patterns as Audio.

**Step 4: Run menu tests**

Run: `node --test tests/graphics-toggle.test.js tests/ui-polish.test.js`

Expected: PASS.

**Step 5: Commit**

```powershell
git add -- game.js tests/graphics-toggle.test.js
git commit -m "feat: add graphics options menu"
```

### Task 3: Wire live renderer switching and persistence

**Files:**
- Modify: `game.js:21600-21680,26790-26810`
- Modify: `tests/graphics-toggle.test.js`
- Modify: `tests/hd-release-gates.test.js`

**Step 1: Write failing runtime contracts**

Require:

- startup preference comes from `DungeonGraphicsPreference.readPreference(localStorage, shippingDefault)`;
- the preference variable stays outside serializable run state;
- Classic writes the preference and calls `graphicsController.initialize(false)`;
- HD writes the preference and calls `graphicsController.initialize(true)`;
- both synchronous and asynchronous settlements dirty the HUD;
- failed HD keeps the saved `hd` preference while the controller remains Classic;
- no graphics preference, controller, asset, or mode enters the run-save builder.

**Step 2: Run tests to verify RED**

Run: `node --test tests/graphics-toggle.test.js tests/hd-renderer.test.js tests/hd-release-gates.test.js`

Expected: the new runtime integration assertions fail while existing renderer tests remain green.

**Step 3: Implement minimal runtime adapter**

Create renderer-only variables and helpers:

```js
const graphicsPreferenceApi = window.DungeonGraphicsPreference;
let graphicsPreference = graphicsPreferenceApi.readPreference(localStorage, shippingHdDefault);
let graphicsTransitionPending = false;
function getRuntimeGraphicsMode() { /* controller mode or canvas marker */ }
function setGraphicsPreference(mode) { /* persist, initialize, settle UI */ }
```

Refactor `initializeGraphicsMode()` to create the controller once and initialize from the saved preference. Keep `config.js` as the default only when no valid saved value exists.

**Step 4: Run integration tests**

Run: `node --test tests/graphics-toggle.test.js tests/hd-renderer.test.js tests/hd-release-gates.test.js tests/hd-status-emblems.test.js`

Expected: PASS.

**Step 5: Commit**

```powershell
git add -- game.js tests/graphics-toggle.test.js tests/hd-release-gates.test.js
git commit -m "feat: switch graphics at runtime"
```

### Task 4: Prove the real menu flow in a browser

**Files:**
- Create: `scripts/capture-graphics-toggle-qa.mjs`
- Modify: `tests/graphics-toggle.test.js`
- Modify: `progress.md`

**Step 1: Write the failing browser-runner contract**

Require the runner to capture and validate:

- deterministic playing state before the switch;
- Escape save and `Options → Graphics → Classic` through keyboard events;
- Classic marker and 144×144 dimensions;
- Continue restores the same depth, room, player coordinates, HP, and enemy roster;
- `Options → Graphics → HD` restores 576×576;
- page reload preserves HD;
- a second persisted-Classic reload preserves Classic;
- zero console/page diagnostics and screenshots at every checkpoint.

**Step 2: Run the test to verify RED**

Run: `node --test tests/graphics-toggle.test.js`

Expected: FAIL because the QA runner is absent.

**Step 3: Implement the Playwright runner**

Use the already approved standalone Playwright runtime. Save evidence under `output/graphics-toggle-qa/` and write a machine-readable `summary.json`.

**Step 4: Run and visually inspect QA**

Run:

```powershell
python -m http.server 8765 --bind 127.0.0.1
node scripts/capture-graphics-toggle-qa.mjs http://127.0.0.1:8765/index.html output/graphics-toggle-qa
```

Expected: PASS, with HD → Classic → HD → reload and persisted Classic all verified. Inspect each screenshot, especially HUD reconstruction and unchanged Classic art.

**Step 5: Record and commit evidence contract**

```powershell
git add -- scripts/capture-graphics-toggle-qa.mjs tests/graphics-toggle.test.js progress.md
git commit -m "test: verify runtime graphics switching"
```

### Task 5: Release verification and local merge

**Files:**
- Modify: `progress.md`
- Merge target: `main`

**Step 1: Run focused and full verification**

```powershell
node --test tests/graphics-toggle.test.js tests/hd-renderer.test.js tests/hd-release-gates.test.js tests/hd-status-emblems.test.js tests/ui-polish.test.js
$tests = Get-ChildItem tests -Filter '*.test.js' | Sort-Object Name | ForEach-Object FullName
node --test --test-concurrency=1 $tests
node --test tests/audio-freeze.test.js
node scripts/benchmark-hd-render.mjs http://127.0.0.1:8765/index.html output/graphics-toggle-qa/performance.json
node --check game.js
node --check render/graphics-preference.js
node --check scripts/capture-graphics-toggle-qa.mjs
git diff --check
```

Expected: all tests pass, audio 5/5, HD performance stays inside mean 24 ms / p95 40 ms, and browser diagnostics are empty.

**Step 2: Commit final verification notes**

```powershell
git add -- progress.md
git commit -m "docs: record graphics toggle verification"
```

**Step 3: Confirm the feature worktree is clean except for the user's untouched ZIP**

Run: `git status --short`

Expected: only `?? assets/hd/hd.zip`.

**Step 4: Merge locally into main**

From the main worktree:

```powershell
git merge --ff-only feature/graphics-overhaul
```

Do not pull, push, delete the branch, remove the worktree, or touch `assets/hd/hd.zip` unless separately requested.

**Step 5: Verify the merged result**

Run the focused graphics-toggle suite and audio freeze from the main worktree, then report the resulting `main` commit and preserved worktree/branch state.
