# HD Mine Visibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make unarmed and armed mines visibly distinct in the HD renderer without changing gameplay or Classic mode.

**Architecture:** Extend the deterministic Descent environment pipeline to publish two silhouette-identical 64 px mine variants. Add one semantic manifest key and select the variant directly from the existing snapshot `armed` field; preserve current armed VFX and all simulation behavior.

**Tech Stack:** JavaScript UMD renderer and Node test runner, Python 3 with pinned Pillow asset builder, Playwright browser QA.

---

### Task 1: Lock the missing-state regression with failing tests

**Files:**
- Modify: `tests/hd-environment.test.js`

**Step 1: Add the asset contract**

Add `hazard.common.mine.unarmed` beside the armed descriptor, targeting `assets/hd/hazards/common/mine-unarmed.png` as an optional 64 x 64 RGBA hazard.

**Step 2: Add renderer expectations**

Change the hazard-layer fixture to include one armed and one unarmed mine and require both semantic draw calls at their exact 64 px grid positions. Add an explicit assertion that `armed: false` does not suppress the entity.

**Step 3: Add visual-state integrity assertions**

Decode both PNGs and require equal dimensions, equal alpha mask/bounds, a meaningful RGB difference within the central lens, and unchanged outer housing pixels outside the approved center mask.

**Step 4: Run the focused test and verify RED**

Run: `node --test tests/hd-environment.test.js`

Expected: FAIL because the unarmed manifest entry/file is absent and the renderer omits `armed: false` mines.

**Step 5: Commit the RED contract**

```powershell
git add tests/hd-environment.test.js
git commit -m "test: require visible HD mine states"
```

### Task 2: Generate and route both HD mine states

**Files:**
- Modify: `scripts/build-descent-environment-assets.py`
- Modify: `render/hd-asset-manifest.js`
- Modify: `render/hd-renderer-layers.js`
- Modify: `art/source/abyssal-gothic-hd/descent-environment-assets.lock.json`
- Create: `assets/hd/hazards/common/mine-unarmed.png`
- Modify: `assets/hd/hazards/common/mine-armed.png`

**Step 1: Build two silhouette-identical variants**

Add a pure builder helper that starts from the normalized approved mine source, preserves alpha and all housing pixels outside a small center mask, darkens/desaturates only the unarmed lens, and gives the armed lens an orange-red emissive treatment. Return `(unarmed, armed)` with identical size and alpha.

**Step 2: Publish both assets**

Write `mine-unarmed.png` and `mine-armed.png`, update the exact output count, and regenerate the deterministic lock intentionally:

```powershell
python scripts/build-descent-environment-assets.py --update-lock
```

Expected: both PNGs and the lock publish transactionally.

**Step 3: Add the semantic manifest entry**

Add `hazard.common.mine.unarmed` without renaming or removing `hazard.common.mine.armed`.

**Step 4: Select instead of suppressing**

In `drawHazardsLayer`, always draw a valid mine and select:

```js
const key = mine.armed === false
  ? "hazard.common.mine.unarmed"
  : "hazard.common.mine.armed";
drawGridAsset(context, assets, key, mine.x, mine.y);
```

**Step 5: Run focused GREEN verification**

Run: `node --test tests/hd-environment.test.js`

Expected: PASS.

Run: `python scripts/build-descent-environment-assets.py --check`

Expected: lock verification passes without publishing.

**Step 6: Commit the implementation**

```powershell
git add scripts/build-descent-environment-assets.py render/hd-asset-manifest.js render/hd-renderer-layers.js art/source/abyssal-gothic-hd/descent-environment-assets.lock.json assets/hd/hazards/common/mine-unarmed.png assets/hd/hazards/common/mine-armed.png
git commit -m "fix: render unarmed and armed HD mines"
```

### Task 3: Verify gameplay presentation and regressions

**Files:**
- Modify: `game.js` only if the existing debug-only Descent showcase needs a second mine state for deterministic capture
- Modify: `progress.md`
- Create: `output/hd-mine-qa/` browser evidence (ignored)

**Step 1: Arrange deterministic QA state**

Use the existing debug-only `descent_hd` scenario to display one unarmed and one armed mine on separate unobstructed tiles. Do not alter normal generation or gameplay.

**Step 2: Run browser QA**

Start the local static server, run the installed web-game Playwright client with a short input/pause sequence, and capture the canvas plus `render_game_to_text` state under `output/hd-mine-qa/`.

Expected: both mines are visible at stable tile anchors, the armed lens reads brighter/redder, gameplay text reports their correct `armed` values, and console diagnostics are empty.

**Step 3: Inspect the screenshot**

Open the latest canvas capture and verify that neither mine blends into the floor, overlaps another object, clips, bobs, or changes housing silhouette.

**Step 4: Run release verification**

Run the complete explicit Node suite, the audio freeze test, syntax checks for changed JavaScript, and a clean locked asset rebuild.

Expected: all tests pass, the soundtrack contract remains unchanged, and `git diff` contains no unrelated files.

**Step 5: Record progress and commit QA integration**

```powershell
git add game.js progress.md
git commit -m "test: cover both HD mine states in browser QA"
```

