# HD Actor Proportions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Render the HD brute and totem at 80x80 and the HD merchant at 96x96 while preserving bottom-center anchoring, overlay alignment, Classic graphics, gameplay, saves, and audio.

**Architecture:** Add presentation-only render-size profiles to the HD renderer. Compute all non-boss actor destinations from their selected size, then derive HP/status/crest geometry from the resulting bounds. Keep source sprites, manifests, simulation state, and Classic renderer untouched.

**Tech Stack:** Browser JavaScript UMD modules, Node.js test runner, deterministic scenario overrides, standalone Playwright QA, HTML canvas.

---

### Task 1: Size-aware HD enemy rendering

**Files:**
- Modify: `tests/hd-enemy-assets.test.js`
- Modify: `render/hd-renderer-layers.js:36-45,698-750`

**Step 1: Write the failing destination-geometry test**

Add a test that supplies loaded idle assets for a brute, totem, and skeleton at fixed coordinates, calls `drawEnemiesLayer`, and asserts:

```js
assert.deepEqual(actorCalls.map(({ key, x, y, width, height }) => ({ key, x, y, width, height })), [
  { key: "enemy.brute.south.idle.01", x: 120, y: 112, width: 80, height: 80 },
  { key: "enemy.totem.base.idle.01", x: 248, y: 240, width: 80, height: 80 },
  { key: "enemy.skeleton.south.idle.01", x: 384, y: 384, width: 64, height: 64 }
]);
```

Also assert that the brute HP bar begins at the logical tile's centered 48-pixel rail, not at a hard-coded sprite offset.

**Step 2: Run the test to verify RED**

Run: `node --test tests/hd-enemy-assets.test.js`

Expected: FAIL because brute and totem still draw at 64x64 and the HP bar uses `x + 8`.

**Step 3: Implement presentation-only enemy profiles**

Add immutable profiles and a selector:

```js
const ENEMY_RENDER_PROFILES = Object.freeze({
  brute: Object.freeze({ renderSize: 80 }),
  totem: Object.freeze({ renderSize: 80 })
});

function getEnemyRenderSize(type) {
  return ENEMY_RENDER_PROFILES[type]?.renderSize || TILE_SIZE;
}
```

Use bottom-center geometry for every enemy:

```js
const renderSize = isBoss ? selection.renderSize : getEnemyRenderSize(selection.type);
const drawX = logicalX * TILE_SIZE + TILE_SIZE * 0.5 - renderSize * 0.5;
const drawY = logicalY * TILE_SIZE + TILE_SIZE - renderSize;
```

Change `drawEnemyHpBar` to accept `renderSize` and center its fixed 48-pixel bar with `(renderSize - 48) / 2`. Pass the final render size at the call site. Keep crest and status geometry derived from `drawX`, `drawY`, and `renderSize`.

**Step 4: Run the enemy tests to verify GREEN**

Run: `node --test tests/hd-enemy-assets.test.js tests/hd-renderer.test.js tests/hd-status-emblems.test.js`

Expected: PASS; standard enemies remain 64x64, brute/totem are 80x80, and overlays remain centered.

**Step 5: Commit**

```bash
git add render/hd-renderer-layers.js tests/hd-enemy-assets.test.js
git commit -m "fix: strengthen HD brute and totem silhouettes"
```

### Task 2: Reduce the HD merchant footprint

**Files:**
- Modify: `tests/hd-room-assets.test.js`
- Modify: `render/hd-renderer-layers.js:316-322`
- Modify: `assets/hd/objects/room-profiles.json:128-151`

**Step 1: Write the failing merchant geometry test**

Update the four merchant profile expectations from 128 to 96 and add a draw assertion at logical tile `(4,4)`:

```js
assert.deepEqual(context.calls, [
  { key: "object.merchant.idle01", x: 240, y: 224, width: 96, height: 96 }
]);
```

**Step 2: Run the test to verify RED**

Run: `node --test tests/hd-room-assets.test.js`

Expected: FAIL because runtime and metadata still declare 128x128.

**Step 3: Apply the approved merchant profile**

Change the merchant draw width and height to `96`, preferably through one named `MERCHANT_RENDER_SIZE` constant. Update all four `object.merchant.idleXX` entries in `room-profiles.json` to width and height 96. Do not resample or republish PNG files.

**Step 4: Run the room tests to verify GREEN**

Run: `node --test tests/hd-room-assets.test.js tests/hd-release-gates.test.js`

Expected: PASS with the merchant bottom-center anchored at 96x96 and all other room objects unchanged.

**Step 5: Commit**

```bash
git add render/hd-renderer-layers.js assets/hd/objects/room-profiles.json tests/hd-room-assets.test.js
git commit -m "fix: rebalance HD merchant scale"
```

### Task 3: Deterministic visual comparison

**Files:**
- Modify: `scenario-overrides.js`
- Modify: `game.js:11651-11840`
- Modify: `tests/scenario-overrides.test.js`
- Create: `scripts/capture-hd-actor-proportions-qa.mjs`
- Create: `tests/hd-actor-proportions.test.js`

**Step 1: Write failing scenario and runner contracts**

Require an `actor_proportions_hd` scenario with a fixed corruption room, player, merchant, brute, totem, and standard skeleton. Require the browser runner to capture desktop `1440x1000` and responsive `390x844` views, assert HD `576x576`, zero overflow, unchanged logical positions, and no console diagnostics.

**Step 2: Run the contracts to verify RED**

Run: `node --test tests/scenario-overrides.test.js tests/hd-actor-proportions.test.js`

Expected: FAIL because the scenario and runner do not exist.

**Step 3: Add the deterministic comparison state**

Register `actor_proportions_hd` in `scenario-overrides.js`. Arrange a room with wide spacing so the player, standard skeleton, 80x80 brute, 80x80 totem, and 96x96 merchant can be compared without combat movement or random hazards. Keep all gameplay coordinates valid and unchanged by rendering.

**Step 4: Add the focused browser capture**

Implement the approved standalone Playwright runner following the existing QA scripts. Save viewport, canvas, state, metrics, diagnostics, and a summary under `output/hd-actor-proportions-qa/`.

**Step 5: Run contracts and browser QA**

Run:

```powershell
node --test tests/scenario-overrides.test.js tests/hd-actor-proportions.test.js
node scripts/capture-hd-actor-proportions-qa.mjs http://127.0.0.1:8765/index.html output/hd-actor-proportions-qa
```

Expected: desktop and responsive captures use HD 576x576, actor coordinates match, there are no browser errors, and the canvas is unclipped.

**Step 6: Inspect images**

Compare the new screenshots against the existing `enemy_roster_hd` and `corruption_merchant_hd` references. Confirm the brute/totem read with more mass, merchant no longer dominates, bottom anchors are stable, and HP/status/crest elements do not overlap actors or the viewport.

**Step 7: Commit**

```bash
git add scenario-overrides.js game.js scripts/capture-hd-actor-proportions-qa.mjs tests/scenario-overrides.test.js tests/hd-actor-proportions.test.js
git commit -m "test: verify HD actor proportions"
```

### Task 4: Release verification and documentation

**Files:**
- Modify: `progress.md`

**Step 1: Run focused release tests**

Run:

```powershell
node --test tests/hd-actor-proportions.test.js tests/hd-enemy-assets.test.js tests/hd-room-assets.test.js tests/hd-renderer.test.js tests/hd-release-gates.test.js tests/hd-status-emblems.test.js tests/graphics-toggle.test.js tests/ui-polish.test.js
node --test tests/audio-freeze.test.js
node --check game.js
node --check scenario-overrides.js
node --check render/hd-renderer-layers.js
node --check scripts/capture-hd-actor-proportions-qa.mjs
git diff --check
```

Expected: all selected tests and syntax checks pass; soundtrack freeze remains 5/5.

**Step 2: Verify Classic isolation**

Confirm `git diff main...HEAD -- game.js` contains scenario-only changes and no Classic drawing paths, and `git diff main...HEAD -- assets/sprite assets/audio` is empty.

**Step 3: Record evidence**

Append the approved sizes, visual findings, test totals, Classic isolation, and soundtrack result to `progress.md`.

**Step 4: Commit**

```bash
git add progress.md
git commit -m "docs: record HD actor proportion verification"
```

**Step 5: Finish the branch**

Use `superpowers:verification-before-completion`, then `superpowers:finishing-a-development-branch`. Preserve the worktree and branch until the user chooses whether to merge.
