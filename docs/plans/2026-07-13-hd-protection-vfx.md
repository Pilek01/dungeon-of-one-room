# HD Protection VFX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the placeholder HD shield circles with stable, layered animations for player Shield, player barrier, Blacksmith Barrier, and Warden Void Aegis.

**Architecture:** A pinned Pillow builder derives four eight-frame visual identities from the immutable Classic palettes and publishes separate rear/front RGBA layers. The actor renderer selects frames from existing snapshot state and draws rear -> actor -> front; the generic VFX layer no longer duplicates player protection with a single circle.

**Tech Stack:** JavaScript UMD renderer and Node test runner, Python 3 with Pillow 12.1.1, deterministic JSON asset lock, Playwright browser QA.

---

### Task 1: Freeze the four-effect contract with failing tests

**Files:**
- Create: `tests/hd-protection-vfx.test.js`
- Modify: `tests/hd-vfx.test.js`

**Step 1: Define the immutable source and output contract**

Require the three unchanged Classic reference sheets and hashes:

```js
const CLASSIC_SOURCES = {
  shield: ["assets/sprite/shield/shield.png", "953e7fe0e492a3f96da7bf6e0f2e00713d3ef5d74239e10687e816953fba2d48"],
  barrier: ["assets/sprite/shield/barrier.png", "7ed2afaf5ee81113a8c2ea72cb1499d46d06c46bcba3f81f7e705c8d21b07613"],
  aegis: ["assets/sprite/shield/voidaegis.png", "261972fe3dad253b6914467f99f7feee5a34b6a9063551d0292910f511d6e017"]
};
```

Require four effects, two layers, eight frames, stable semantic keys, optional `fx` grouping, exact 128 px player canvases, and exact 256 px boss canvases.

**Step 2: Define animation-quality invariants**

Use a Pillow probe to require transparent corners, fixed canvas/alpha bounds, a stable shell across frames, meaningful contained phase changes, palette separation, nonempty rear/front layers, zero visible chroma key, and no frame-to-frame center/diameter drift.

**Step 3: Define renderer order and state selection**

Require exported pure helpers that select:

```js
player.skillShield > 0                 -> player-shield
sum(player barrier fields) > 0         -> player-barrier
enemy.blacksmithBarrier > 0            -> blacksmith-barrier
enemy.voidAegisShield > 0              -> warden-aegis
```

Require exact `rear -> actor -> front` draw order, nested player Shield plus barrier, stable bottom-center placement, `hitFlash` alpha boost without geometry changes, and reduced-motion frame freezing.

**Step 4: Reject the duplicate generic circle**

Update `tests/hd-vfx.test.js` so protection state is intentionally absent from `collectVfxCommands`; the actor layer owns the new effect.

**Step 5: Run RED**

Run:

```powershell
node --test tests/hd-protection-vfx.test.js tests/hd-vfx.test.js
```

Expected: FAIL because the builder, assets, manifest entries, selection helpers, split layers, and duplicate-circle removal do not exist.

**Step 6: Commit the RED contract**

```powershell
git add tests/hd-protection-vfx.test.js tests/hd-vfx.test.js
git commit -m "test: require layered HD protection VFX"
```

### Task 2: Build the deterministic protection asset set

**Files:**
- Create: `scripts/build-protection-vfx-assets.py`
- Create: `art/source/protection-vfx-hd/protection-vfx-assets.lock.json`
- Create: `assets/hd/vfx/protection/player-shield/rear-01.png` through `front-08.png`
- Create: `assets/hd/vfx/protection/player-barrier/rear-01.png` through `front-08.png`
- Create: `assets/hd/vfx/protection/blacksmith-barrier/rear-01.png` through `front-08.png`
- Create: `assets/hd/vfx/protection/warden-aegis/rear-01.png` through `front-08.png`

**Step 1: Implement pinned inputs and isolated staging**

Pin Pillow `12.1.1`, all three Classic source hashes, schema version, exact effect profiles, and unique transaction directories. Support only `--check` and `--update-lock`; never edit the Classic sheets.

**Step 2: Implement the shared supersampled renderer**

Render at 4x and downsample with LANCZOS. Use fixed profile geometry and an eight-phase deterministic loop. Every frame must contain a faint fixed shell while phase-dependent bands/runes/motes stay inside its motion mask.

Profiles:

```python
PROFILES = {
    "player-shield": {"size": 128, "palette": "gold", "geometry": "hex-sphere"},
    "player-barrier": {"size": 128, "palette": "cyan", "geometry": "crystal-shell"},
    "blacksmith-barrier": {"size": 256, "palette": "molten", "geometry": "iron-dome"},
    "warden-aegis": {"size": 256, "palette": "void", "geometry": "counter-rings"},
}
```

Split each composition into rear and front hemispheres without changing the shared center or shell diameter.

**Step 3: Validate and publish all 64 PNGs**

Require RGBA, transparent corners, profile size, minimum coverage, stable bounds, meaningful layer entropy, and zero exact/near-key magenta. Publish assets and lock transactionally:

```powershell
python scripts/build-protection-vfx-assets.py --update-lock
```

Expected: 64 assets and one lock publish; Classic sources remain byte-identical.

**Step 4: Verify the locked rebuild**

```powershell
python scripts/build-protection-vfx-assets.py --check
```

Expected: exit 0 and no published file changes.

**Step 5: Run the asset-focused tests**

```powershell
node --test tests/hd-protection-vfx.test.js
```

Expected: asset/lock tests pass while renderer tests may remain RED.

**Step 6: Commit the asset pipeline**

```powershell
git add scripts/build-protection-vfx-assets.py art/source/protection-vfx-hd/protection-vfx-assets.lock.json assets/hd/vfx/protection
git commit -m "feat: build layered HD protection effects"
```

### Task 3: Integrate rear/actor/front rendering

**Files:**
- Modify: `render/hd-asset-manifest.js`
- Modify: `render/hd-renderer-layers.js`
- Modify: `render/hd-vfx.js`
- Test: `tests/hd-protection-vfx.test.js`
- Test: `tests/hd-vfx.test.js`

**Step 1: Register all frames as optional FX**

Add 64 semantic entries under `fx.protection.<effect>.<rear|front>.<NN>`, `group: "fx"`, `critical: false`. Preserve every old boss overlay key and file for compatibility.

**Step 2: Implement pure selection**

Add effect profiles and helpers that compute active effect kinds, frame `(floor(nowMs / 90) % 8) + 1`, reduced-motion frame `1`, render size/offset, and hit alpha. Do not read global simulation state or consume RNG.

**Step 3: Implement the split draw pass**

Add `drawProtectionPass(context, snapshot, assets, actor, logicalX, logicalY, phase)` and call it:

```js
drawProtectionPass(..., "rear");
drawAsset(...actor...);
drawProtectionPass(..., "front");
```

For simultaneous player states, draw gold Shield inside and cyan barrier outside. Missing optional assets use phase-specific procedural arcs rather than the old full circle.

**Step 4: Remove generic circle duplication**

Remove `kind: "shield"` production from `collectVfxCommands` and its single-circle draw branch. Keep player shield lighting and all gameplay state unchanged.

**Step 5: Run GREEN**

```powershell
node --test tests/hd-protection-vfx.test.js tests/hd-vfx.test.js tests/hd-boss-assets.test.js tests/hd-lighting.test.js tests/hd-environment.test.js
```

Expected: all selected tests pass.

**Step 6: Commit integration**

```powershell
git add render/hd-asset-manifest.js render/hd-renderer-layers.js render/hd-vfx.js tests/hd-protection-vfx.test.js tests/hd-vfx.test.js
git commit -m "feat: layer HD protection VFX around actors"
```

### Task 4: Add deterministic protection QA scenarios

**Files:**
- Modify: `scenario-overrides.js`
- Modify: `game.js`
- Modify: `tests/scenario-overrides.test.js`
- Create: `scripts/capture-hd-protection-vfx-qa.mjs`
- Modify: `progress.md`
- Create: `output/hd-protection-vfx-qa/` evidence (ignored)

**Step 1: Write scenario RED**

Require `player_shield_hd` and `player_barrier_hd` scenarios with exactly one corresponding player protection state. Reuse `blacksmith_guardian_hd` and `warden_phase2_aegis_hd` for bosses.

**Step 2: Add debug-only setups**

Arrange unobstructed player showcases without changing normal generation. Ensure Shield and barrier states remain frozen long enough for capture.

**Step 3: Build the capture matrix**

Capture four scenarios at desktop `1440x1000` and mobile `390x844`, three animation phases each. Record viewport, canvas, `render_game_to_text`, layout metrics, and console diagnostics. Require HD `576x576`, no clipping/overflow, correct scenario state, and no errors.

**Step 4: Run and inspect browser QA**

Use the installed web-game Playwright runtime. Open every latest canvas image and verify actor readability, stable shells, distinct palettes, nested player effects, and no oversized UI-like circles.

**Step 5: Commit QA integration**

```powershell
git add scenario-overrides.js game.js tests/scenario-overrides.test.js scripts/capture-hd-protection-vfx-qa.mjs progress.md
git commit -m "test: add HD protection VFX showcase matrix"
```

### Task 5: Release verification

**Files:**
- No production changes expected

**Step 1: Run locked asset verification**

```powershell
python scripts/build-protection-vfx-assets.py --check
python scripts/build-boss-animation-assets.py --check
```

Expected: both pass without publishing.

**Step 2: Run complete tests sequentially**

```powershell
$tests = Get-ChildItem tests -Filter '*.test.js' | Sort-Object Name | ForEach-Object FullName
node --test --test-concurrency=1 $tests
```

Expected: zero failures.

**Step 3: Run audio and syntax gates**

```powershell
node --test tests/audio-freeze.test.js
node --check render/hd-asset-manifest.js
node --check render/hd-renderer-layers.js
node --check render/hd-vfx.js
node --check game.js
```

Expected: all pass; soundtrack contract remains unchanged.

**Step 4: Run the performance gate**

Run `scripts/benchmark-hd-render.mjs` against the heavyweight VFX scene and require the existing desktop/mobile thresholds with zero diagnostics.

**Step 5: Confirm repository scope**

Run `git diff --check`, inspect `git status --short`, and verify that no Classic sprite, menu, audio, save, or gameplay-balance file changed outside the explicit debug scenario additions.

