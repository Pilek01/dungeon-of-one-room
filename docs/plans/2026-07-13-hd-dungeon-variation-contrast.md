# HD Dungeon Variation and Abyss Contrast Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore Classic-equivalent semantic floor variation in HD, improve Abyss actor readability, and add theme-specific spikes without changing gameplay or audio.

**Architecture:** Extend the two existing transactional Pillow builders so every theme publishes seven deterministic full floor tiles and a themed spike. Add optional manifest entries and a pure Classic-compatible floor selector in the HD layer renderer, retaining `floor-base` and the common spike as fallbacks. Tune only the Abyss lighting profile, then verify the presentation through deterministic browser scenarios.

**Tech Stack:** JavaScript UMD/CommonJS render modules, Node test runner, Python 3 with pinned Pillow 12.1.1, Playwright browser QA, Git worktree.

---

### Task 1: Define the floor-variation and contrast contract

**Files:**
- Create: `tests/hd-floor-variants.test.js`
- Modify: `tests/hd-environment.test.js`
- Modify: `tests/hd-room-assets.test.js`

**Step 1: Write the failing tests**

Add tests that require:

```js
const FLOOR_VARIANTS = ["base", "b", "c", "skull", "crack_cross", "var3", "var4"];

assert.equal(layers.selectFloorVariant(0), "base");
assert.equal(layers.selectFloorVariant(1), "b");
assert.equal(layers.selectFloorVariant(2), "crack_cross");
assert.equal(layers.selectFloorVariant(3), "base");
assert.equal(layers.selectFloorVariant(4), "var3");
assert.equal(layers.selectFloorVariant(5), "crack_cross");
assert.equal(layers.selectFloorVariant(6), "c");
assert.equal(layers.selectFloorVariant(7), "skull");
assert.equal(layers.selectFloorVariant(8), "var4");
assert.equal(layers.selectFloorVariant(9), "b");
```

Require six new optional manifest keys per theme, three themed spike keys, 64x64 PNGs, unique hashes within each theme, stable floor edge bands, and an Abyss floor luminance band of 50–62. Freeze hashes for the six original Classic tileset/torch files.

**Step 2: Run RED**

Run:

```powershell
node --test tests/hd-floor-variants.test.js tests/hd-environment.test.js tests/hd-room-assets.test.js
```

Expected: failures for missing manifest entries, files, selector, themed spikes, and Abyss luminance.

**Step 3: Commit the RED contract**

```powershell
git add -- tests/hd-floor-variants.test.js tests/hd-environment.test.js tests/hd-room-assets.test.js
git commit -m "test: require HD dungeon floor variation"
```

### Task 2: Extend the deterministic asset builders

**Files:**
- Modify: `scripts/build-descent-environment-assets.py`
- Modify: `scripts/build-hd-room-assets.py`
- Modify: `art/source/abyssal-gothic-hd/descent-environment-assets.lock.json`
- Modify: `art/source/task8-hd/room-assets.lock.json`
- Create: `assets/hd/environment/{descent,corruption,abyss}/floor-{b,c,skull,crack-cross,var3,var4}.png`
- Create: `assets/hd/hazards/{descent,corruption,abyss}/spikes-armed.png`
- Modify: existing Abyss environment PNGs only where the builder's approved tone correction applies.

**Step 1: Add shared deterministic helpers**

Implement helpers in the Descent builder and reuse them through the existing `runpy` API:

```python
FLOOR_VARIANT_FILENAMES = (
    "floor-base.png", "floor-b.png", "floor-c.png", "floor-skull.png",
    "floor-crack-cross.png", "floor-var3.png", "floor-var4.png",
)

def build_floor_variants(source, crack, classic_skull, theme):
    # Produce seven 64x64 RGB/RGBA tiles from immutable real sources.
    # Preserve compatible edge bands, apply the Classic skull as a carved mask,
    # and apply theme-specific value/color treatment without gameplay RNG.
    ...

def tune_abyss_midtones(image):
    # Lift midtones while preserving black cracks and cool accents.
    ...

def theme_spike(common_spike, theme):
    # Recolor/material-tune the approved common HD spike; preserve alpha exactly.
    ...
```

Do not draw replacement art from geometric primitives. Every visible mark must derive from the approved HD atlas, approved decal, common HD spike, or real Classic skull pixels.

**Step 2: Publish and validate the Descent outputs**

Extend the Descent output contract and validators. Assert variant uniqueness, edge continuity, exact dimensions, alpha/chroma policy, and unchanged non-target files.

**Step 3: Publish and validate Corruption/Abyss outputs**

Extend `ENVIRONMENT_FILENAMES`, the exact output count, and the room lock. Apply `tune_abyss_midtones` before variant derivation and to the matching Abyss structural assets where needed for coherent value range.

**Step 4: Regenerate locks**

Run:

```powershell
python scripts/build-descent-environment-assets.py --update-lock
python scripts/build-hd-room-assets.py --update-lock
python scripts/build-descent-environment-assets.py --check
python scripts/build-hd-room-assets.py --check
```

Expected: both lock checks pass and no transaction directories remain.

**Step 5: Run GREEN for asset tests**

```powershell
node --test tests/hd-floor-variants.test.js tests/hd-environment.test.js tests/hd-room-assets.test.js
```

Expected: asset/lock tests pass; selector tests may remain RED until Task 3.

**Step 6: Commit**

```powershell
git add -- scripts/build-descent-environment-assets.py scripts/build-hd-room-assets.py art/source/abyssal-gothic-hd/descent-environment-assets.lock.json art/source/task8-hd/room-assets.lock.json assets/hd/environment assets/hd/hazards tests/hd-floor-variants.test.js tests/hd-environment.test.js tests/hd-room-assets.test.js
git commit -m "feat: build varied HD dungeon floors"
```

### Task 3: Restore `floorPattern` semantics in the HD renderer

**Files:**
- Modify: `render/hd-asset-manifest.js`
- Modify: `render/hd-renderer-layers.js`
- Modify: `tests/hd-floor-variants.test.js`

**Step 1: Verify selector tests are RED**

```powershell
node --test tests/hd-floor-variants.test.js
```

Expected: `selectFloorVariant` and manifest assertions fail.

**Step 2: Add manifest entries**

For each theme add optional semantic entries:

```js
environment.<theme>.floor.b
environment.<theme>.floor.c
environment.<theme>.floor.skull
environment.<theme>.floor.crack_cross
environment.<theme>.floor.var3
environment.<theme>.floor.var4
hazard.<theme>.spikes.armed
```

Keep `environment.<theme>.floor.base` critical and the existing common spike available.

**Step 3: Implement pure selection and fallback**

Export `selectFloorVariant(noise)`. In `drawFloorLayer`, select the semantic tile from `snapshot.floorPattern` for inner cells and fall back to `floor.base` when the optional asset is absent. Continue to draw the eight directional wall/corner assets on the boundary.

**Step 4: Restrain unrelated decals**

Skip random decals when the floor noise maps to `skull`, `crack_cross`, `var3`, or the brazier marker. Keep the existing deterministic visual hash and never call `Math.random`.

**Step 5: Select themed spikes with fallback**

In `drawHazardsLayer`, prefer `hazard.<theme>.spikes.armed`; fall back to `hazard.common.spikes.armed`.

**Step 6: Run GREEN and commit**

```powershell
node --test tests/hd-floor-variants.test.js tests/hd-environment.test.js tests/hd-room-assets.test.js tests/hd-wall-topology.test.js
git add -- render/hd-asset-manifest.js render/hd-renderer-layers.js tests/hd-floor-variants.test.js
git commit -m "feat: restore HD floor pattern semantics"
```

### Task 4: Correct Abyss lighting without flattening the theme

**Files:**
- Modify: `render/hd-lighting.js`
- Modify: `tests/hd-lighting.test.js`
- Modify: `tests/hd-floor-variants.test.js`

**Step 1: Write RED lighting tests**

Require a depth-45 high-quality ambient opacity no greater than 0.18, with reduced-effects no greater than 0.12. Require Descent and Corruption profile behavior to remain unchanged.

**Step 2: Run RED**

```powershell
node --test tests/hd-lighting.test.js tests/hd-floor-variants.test.js
```

Expected: current Abyss opacity of 0.26 fails.

**Step 3: Implement theme-aware ambient command**

Keep profile budgets and colors. Cap only depth-40+ ambient opacity. Do not add enemy lights unless visual QA after the asset correction still demonstrates insufficient separation.

**Step 4: Run GREEN and commit**

```powershell
node --test tests/hd-lighting.test.js tests/hd-floor-variants.test.js tests/hd-vfx.test.js
git add -- render/hd-lighting.js tests/hd-lighting.test.js tests/hd-floor-variants.test.js
git commit -m "fix: improve Abyss combat readability"
```

### Task 5: Add deterministic visual QA scenarios

**Files:**
- Modify: `scenario-overrides.js`
- Modify: `game.js`
- Modify: `tests/scenario-overrides.test.js`
- Create: `scripts/capture-hd-dungeon-variation-qa.mjs`
- Modify: `progress.md`

**Step 1: Write RED scenario tests**

Require `descent_floor_variants_hd`, `corruption_floor_variants_hd`, and `abyss_floor_variants_hd`, each with a fixed 9x9 pattern exposing all noise values `0..9`, one player, one enemy, and no random hazards covering the tiles.

**Step 2: Implement the minimal scenario setup**

Reuse `forceRoomHDShowcaseSetup`; add only the fixed pattern and clean combat presentation needed to inspect actors and tiles. Do not alter production room generation.

**Step 3: Build the capture matrix**

Capture the three variant showcases plus `abyss_combat_hd` at desktop 1440x1000 and mobile 390x844. Save viewport, canvas, state, diagnostics, and luminance metrics under `output/hd-dungeon-variation-qa/`. Recycle Chromium between small batches.

Automated gates:

- HD 576x576 active;
- no scroll/overflow;
- no console diagnostics;
- no blank/transparent/magenta frames;
- desktop Abyss combat mean luminance 45–55;
- all semantic variants selected at least once.

**Step 4: Inspect every accepted screenshot**

Reject captures with loading overlays, clipped art, unreadable actors, incorrect corners, visually repeated single-floor grids, or overpowering braziers. If a visual defect remains, return to a new RED test before correction.

**Step 5: Commit**

```powershell
git add -- scenario-overrides.js game.js tests/scenario-overrides.test.js scripts/capture-hd-dungeon-variation-qa.mjs progress.md
git commit -m "test: add HD dungeon variation QA matrix"
```

### Task 6: Release verification

**Files:**
- Modify: `progress.md` only if final evidence changes the recorded result.

**Step 1: Locked build checks**

```powershell
python scripts/build-descent-environment-assets.py --check
python scripts/build-hd-room-assets.py --check
python scripts/build-boss-animation-assets.py --check
python scripts/build-protection-vfx-assets.py --check
```

**Step 2: Targeted tests**

```powershell
node --test tests/hd-floor-variants.test.js tests/hd-environment.test.js tests/hd-room-assets.test.js tests/hd-wall-topology.test.js tests/hd-lighting.test.js tests/scenario-overrides.test.js
```

**Step 3: Full sequential suite and audio freeze**

```powershell
$tests = Get-ChildItem tests -Filter '*.test.js' | Sort-Object Name | ForEach-Object FullName
node --test --test-concurrency=1 $tests
node --test tests/audio-freeze.test.js
```

**Step 4: Browser performance**

```powershell
node scripts/benchmark-hd-render.mjs http://127.0.0.1:<fresh-port>/index.html output/hd-dungeon-variation-qa/performance.json
```

Require HD retained, mean frame time no greater than 24 ms, p95 no greater than 40 ms, and zero console diagnostics.

**Step 5: Final hygiene**

Run syntax checks, `git diff --check`, remove only generated `scripts/__pycache__` after resolving and validating its worktree path, and confirm no tracked worktree changes remain. Preserve the unrelated untracked `assets/hd/hd.zip`.
