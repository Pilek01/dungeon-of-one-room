# Complete Graphics Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace every active world, character, object, combat-effect, and HUD graphic with the approved Abyssal Gothic HD presentation while preserving gameplay, saves, input, menu flows, and the soundtrack.

**Architecture:** Keep the existing Canvas 2D runtime and simulation. Add a read-only visual snapshot, an HD asset manifest/loader, and a layered 64 px/tile renderer behind a feature flag; retain the legacy renderer as a fallback until final acceptance. Keep menus and text-heavy HUD in DOM/CSS, and protect audio with file hashes plus configuration-contract tests.

**Tech Stack:** Vanilla JavaScript, Canvas 2D, HTML/CSS, Node.js built-in test runner, Playwright, ImageGen, Game Studio sprite normalization scripts.

---

## Execution notes

- Work only in `C:/Users/Kamil/Downloads/claudeodeallowed/Dungeon/dungeon-2.0`.
- The folder is not currently a Git repository. Commit steps are conditional: execute them only if the user initializes or supplies a repository. Otherwise record each checkpoint in `progress.md` with the verification command and result.
- Do not edit, rename, move, re-encode, or normalize any `.mp3` file.
- Do not change `MUSIC_TRACKS`, track volumes, looping, autoplay handling, mute handling, or `syncBgmWithState()`.
- Use `@imagegen` for bitmap generation and `@game-studio:sprite-pipeline` for character strip normalization.
- Use `@develop-web-game` for the short implement/run/screenshot loop and `@game-studio:game-playtest` for final browser QA.
- Every production batch must be inspected at in-game scale before the next batch starts.

### Task 1: Freeze the gameplay and audio baseline

**Files:**
- Create: `scripts/capture-audio-baseline.js`
- Create: `tests/audio-freeze.test.js`
- Create: `tests/fixtures/audio-baseline.json`
- Modify: `progress.md`

**Step 1: Correct the misleading v1 path in the existing scenario test**

Change `tests/scenario-overrides.test.js` to resolve `../scenario-overrides.js` relative to the test file instead of reading `dungeon-1.0` through an absolute path.

**Step 2: Run the complete current test suite**

Run in PowerShell:

```powershell
$tests = Get-ChildItem -LiteralPath tests -Filter '*.test.js' | ForEach-Object FullName
node --test $tests
```

Expected: all current tests pass against `dungeon-2.0`.

**Step 3: Write the failing audio-freeze test**

The test must:

- load `tests/fixtures/audio-baseline.json`;
- SHA-256 every active music file listed in the fixture;
- compare size and hash;
- compare an exact stored hash of the protected audio configuration extracted from `game.js` lines containing `MUSIC_TRACKS`, splash/death/victory constants, `createBgmTrack`, `ensureBgmTracks`, and `syncBgmWithState`;
- fail clearly on a renamed file, changed byte, changed path, changed volume, changed loop, or changed selection logic.

Run:

```powershell
node --test tests/audio-freeze.test.js
```

Expected: FAIL because the fixture does not exist yet.

**Step 4: Implement and run the baseline capture script**

The script must use only Node core modules (`fs`, `path`, `crypto`) and write deterministic, sorted JSON. It must include only the thirteen active soundtrack/event tracks, not old or unused audio files.

Run:

```powershell
node scripts/capture-audio-baseline.js
node --test tests/audio-freeze.test.js
```

Expected: PASS.

**Step 5: Store visual baselines**

Copy the seven approved audit screenshots into `tests/fixtures/visual-baseline/` without altering their source files. Record canvas size, desktop viewport, and mobile viewport in `tests/fixtures/visual-baseline/README.md`.

**Step 6: Checkpoint**

Record the passing command in `progress.md`. If Git exists:

```powershell
git add scripts tests progress.md
git commit -m "test: freeze graphics and audio baseline"
```

### Task 2: Add a pure visual snapshot boundary

**Files:**
- Create: `render/visual-snapshot.js`
- Create: `tests/visual-snapshot.test.js`
- Modify: `index.html`
- Modify: `game.js`

**Step 1: Write the failing snapshot tests**

Cover these contracts:

```js
const source = {
  phase: "playing",
  depth: 25,
  roomType: "cursed",
  bossRoom: false,
  player: { x: 4, y: 7, hp: 80, maxHp: 100, facing: "north" },
  enemies: [{ id: "e1", type: "slime", x: 2, y: 3, hp: 5, maxHp: 10 }],
  spikes: [{ x: 1, y: 1, active: true }],
  mines: [], chests: [], particles: [], floatingTexts: []
};

const snapshot = api.createVisualSnapshot(source, 1200);
assert.notStrictEqual(snapshot.player, source.player);
snapshot.player.x = 99;
assert.strictEqual(source.player.x, 4);
assert.strictEqual(snapshot.nowMs, 1200);
assert.strictEqual(snapshot.tileSize, 64);
```

Also assert that functions, audio objects, localStorage data, bot state, and save metadata are not copied into the snapshot.

**Step 2: Verify failure**

```powershell
node --test tests/visual-snapshot.test.js
```

Expected: FAIL because `render/visual-snapshot.js` does not exist.

**Step 3: Implement the minimal UMD-style module**

Expose `DungeonVisualSnapshot` on `window` and `module.exports` in Node. Clone only the documented render fields. Do not serialize the entire `state` object and do not use JSON stringify in the render loop.

**Step 4: Integrate without changing output**

Load the module before `game.js`. In the animation loop, create one snapshot per rendered frame and pass it to the renderer selection boundary. Keep legacy drawing active.

**Step 5: Verify**

```powershell
node --test tests/visual-snapshot.test.js
node --check render/visual-snapshot.js
node --check game.js
```

Expected: PASS and no syntax errors.

**Step 6: Checkpoint**

If Git exists:

```powershell
git add render/visual-snapshot.js tests/visual-snapshot.test.js index.html game.js
git commit -m "refactor: add read-only visual snapshot boundary"
```

### Task 3: Build the HD manifest and resilient loader

**Files:**
- Create: `render/hd-asset-manifest.js`
- Create: `render/hd-asset-loader.js`
- Create: `tests/hd-asset-loader.test.js`
- Create: `assets/hd/README.md`
- Modify: `index.html`

**Step 1: Write failing loader tests**

Test stable keys, group loading, progress reporting, optional assets, critical failures, and fallback status. The core result must have this shape:

```js
{
  ready: true,
  fallbackRequired: false,
  loaded: new Map(),
  failures: []
}
```

A missing critical player or environment asset must set `fallbackRequired: true`. A missing optional decal must not.

**Step 2: Verify failure**

```powershell
node --test tests/hd-asset-loader.test.js
```

Expected: FAIL because the modules do not exist.

**Step 3: Implement the manifest**

Use keys such as:

```js
"environment.descent.floor.base"
"environment.corruption.wall.north"
"actor.player.south.idle"
"enemy.slime.south.move"
"boss.warden.phase2.idle"
"object.shrine.active"
"hazard.mine.armed"
"fx.shockwave.base"
```

The public API must never expose raw filenames as gameplay identifiers.

**Step 4: Implement the loader**

Inject the image factory in tests. In browser use `new Image()`, `decode()` when available, and deterministic timeout/error handling. Never touch audio.

**Step 5: Verify**

```powershell
node --test tests/hd-asset-loader.test.js
node --check render/hd-asset-manifest.js
node --check render/hd-asset-loader.js
```

Expected: PASS.

### Task 4: Add the 64 px renderer shell and legacy fallback

**Files:**
- Create: `render/hd-renderer.js`
- Create: `render/hd-renderer-layers.js`
- Create: `tests/hd-renderer.test.js`
- Modify: `config.js`
- Modify: `index.html`
- Modify: `game.js`

**Step 1: Write failing coordinate and layer-order tests**

Required assertions:

```js
assert.deepStrictEqual(api.gridToScreen(0, 0), { x: 0, y: 0 });
assert.deepStrictEqual(api.gridToScreen(8, 8), { x: 512, y: 512 });
assert.strictEqual(api.WORLD_SIZE, 576);
assert.deepStrictEqual(api.LAYER_ORDER, [
  "floor", "decals", "hazards", "objects", "enemies",
  "player", "telegraphs", "vfx", "lighting"
]);
```

Also assert bottom-center sprite anchors and that a 128 px boss can render without changing its logical tile.

**Step 2: Verify failure**

```powershell
node --test tests/hd-renderer.test.js
```

Expected: FAIL.

**Step 3: Implement the renderer shell**

Add `window.DUNGEON_HD_GRAPHICS_ENABLED = false` initially. The HD renderer owns its canvas dimensions and render layers. The legacy path must keep the current 144×144 dimensions and current draw functions.

**Step 4: Add controlled activation and fallback**

On boot:

- if HD is disabled, run legacy exactly as before;
- if HD is enabled and critical assets load, set canvas to 576×576 and use HD;
- if loading fails, reset canvas to 144×144, report the diagnostic, and run legacy;
- never restart or reset simulation state during renderer switching.

**Step 5: Verify**

```powershell
node --test tests/hd-renderer.test.js tests/visual-snapshot.test.js tests/hd-asset-loader.test.js
node --check render/hd-renderer.js
node --check render/hd-renderer-layers.js
node --check game.js
```

Expected: PASS.

### Task 5: Produce and integrate the Descent environment vertical slice

**Files:**
- Create: `art/briefs/abyssal-gothic-hd.md`
- Create: `assets/hd/environment/descent/`
- Create: `assets/hd/objects/common/`
- Modify: `render/hd-asset-manifest.js`
- Modify: `render/hd-renderer-layers.js`
- Create: `tests/hd-environment.test.js`

**Step 1: Write the asset completeness test**

Require floor, four walls, four corners, cracks, grate, rubble, three decal variants, torch frames, normal chest, shrine, portal, spikes, and mine. Assert PNG dimensions and alpha support where required.

**Step 2: Verify failure**

```powershell
node --test tests/hd-environment.test.js
```

Expected: FAIL with missing Descent keys.

**Step 3: Generate the approved environment kit**

Use `@imagegen` with the Abyssal Gothic HD brief. Generate production assets, not concept boards. Normalize tiles to 64×64, larger setpieces to exact multiples of 64, and animated strips to fixed slots. Keep directional lighting consistent: upper-left key light, warm local torch emission.

**Step 4: Implement floor, wall, decal, object, and hazard layers**

Tile selection must be deterministic from room/depth/tile coordinates and must not consume gameplay RNG. Use a local visual hash.

**Step 5: Verify in browser**

Run a local server and deterministic `?scenario=` rooms. Capture 1440×1000 and 390×844 screenshots. Inspect tile seams, playfield bounds, object readability, and fallback behavior.

**Step 6: Verify tests**

```powershell
node --test tests/hd-environment.test.js tests/hd-renderer.test.js
```

Expected: PASS.

### Task 6: Produce the player animation set

**Files:**
- Create: `assets/hd/actors/player/source/`
- Create: `assets/hd/actors/player/frames/`
- Create: `assets/hd/actors/player/player-manifest.json`
- Modify: `render/hd-asset-manifest.js`
- Modify: `render/hd-renderer-layers.js`
- Create: `tests/hd-player-assets.test.js`

**Step 1: Write the failing frame/anchor test**

Require north, south, east, and west sets for idle, move/attack, hit, and death. Assert 64×64 frames, consistent bottom-center anchor, transparency, and complete manifest entries.

**Step 2: Create and approve one seed frame**

Use `@imagegen` for a south-facing player seed with steel armor, dark-purple mantle, readable weapon silhouette, and no scenery. The game director checks silhouette at 64 px, palette, center of mass, and contrast against all three floors.

**Step 3: Generate whole strips**

Use `@game-studio:sprite-pipeline`: build edit canvases from the approved seed, generate each complete strip in one request, normalize with one shared scale and bottom-center anchor, and render preview sheets. Do not generate frames independently.

**Step 4: Integrate animation selection**

Map existing movement, bump attack, hit flash, death, and idle timing to visual clips only. Do not add or delay gameplay actions.

**Step 5: Verify**

```powershell
node --test tests/hd-player-assets.test.js
```

Expected: PASS, followed by desktop/mobile screenshot inspection.

### Task 7: Produce the standard enemy roster

**Files:**
- Create: `assets/hd/enemies/{slime,skeleton,brute,acolyte,skitter,totem,otter}/`
- Create: `tests/hd-enemy-assets.test.js`
- Modify: `render/hd-asset-manifest.js`
- Modify: `render/hd-renderer-layers.js`

**Step 1: Write the failing roster test**

Assert every active enemy type maps to a valid visual profile. Mobile enemies require four directions and the approved clips. Totem requires idle, awaken, cast, hit, and death. Assert that unknown types use a visible diagnostic placeholder.

**Step 2: Generate one approved seed per enemy**

Preserve role readability:

- slime: low, wet swarm silhouette;
- skeleton: angular ranged attacker;
- brute: wide, heavy melee silhouette;
- acolyte: tall caster with violet focus;
- skitter: low, fast multi-leg silhouette;
- totem: stationary vertical threat;
- otter: rare, distinct silhouette without breaking the dark-fantasy material language.

**Step 3: Generate and normalize complete strips**

Follow the same seed → whole strip → normalization → preview process as the player. Reject drifting proportions, palettes, or anchors before integration.

**Step 4: Integrate visuals without changing AI**

Read only existing type, facing, tween, hit flash, cast state, HP, elite, and affix information. Do not touch movement or combat code.

**Step 5: Verify**

```powershell
node --test tests/hd-enemy-assets.test.js
```

Expected: PASS plus scenario screenshots containing every roster member.

### Task 8: Produce special rooms, remaining environments, and props

**Files:**
- Create: `assets/hd/environment/corruption/`
- Create: `assets/hd/environment/abyss/`
- Create: `assets/hd/objects/{merchant,forge,pact,vault,otter,boss}/`
- Create: `tests/hd-room-assets.test.js`
- Modify: `render/hd-asset-manifest.js`
- Modify: `render/hd-renderer-layers.js`

**Step 1: Write the failing room matrix test**

Require visual coverage for combat, treasure, shrine, cursed, merchant, vault, otter, forge, pact, and boss rooms across their valid depth themes.

**Step 2: Generate Corruption and Abyss kits**

Keep identical tile metrics and wall grammar. Change material and light language, not collision geometry.

**Step 3: Generate room setpieces**

Create merchant, 3×3 forge, pact sigil, vault props, otter reward chest, portals, and boss-room ornaments. Interactive objects must remain readable when inactive, ready, used, and blocked.

**Step 4: Integrate deterministic visual variants**

Room decoration must use visual-only hashing and never consume simulation RNG.

**Step 5: Verify**

```powershell
node --test tests/hd-room-assets.test.js tests/hd-environment.test.js
```

Expected: PASS and one reviewed screenshot per room type.

### Task 9: Produce guardians and the two-phase Warden

**Files:**
- Create: `assets/hd/bosses/vault-guardian/`
- Create: `assets/hd/bosses/blacksmith-guardian/`
- Create: `assets/hd/bosses/warden/phase-1/`
- Create: `assets/hd/bosses/warden/phase-2/`
- Create: `tests/hd-boss-assets.test.js`
- Modify: `render/hd-asset-manifest.js`
- Modify: `render/hd-renderer-layers.js`

**Step 1: Write failing boss-profile tests**

Assert 128 px guardian profiles, 128–192 px Warden profiles, bottom-center anchors, phase-specific art, barrier/aegis layers, hit/death clips, and telegraph mappings.

**Step 2: Generate and normalize boss assets**

Bosses may overhang logical tiles but may not alter hitboxes. Phase 2 must read as escalation through silhouette, material breakup, void emission, and animation intensity rather than a simple recolor.

**Step 3: Integrate state-driven boss layers**

Map existing `blacksmithBarrier`, `voidAegisShield`, cast flash, HP, phase, and telegraph data. No combat changes.

**Step 4: Verify**

```powershell
node --test tests/hd-boss-assets.test.js tests/final-boss-flow.test.js tests/boss-campaign.test.js
```

Expected: PASS plus screenshots of both Warden phases and both guardians.

### Task 10: Implement combat VFX, telegraphs, and lighting

**Files:**
- Create: `render/hd-vfx.js`
- Create: `render/hd-lighting.js`
- Create: `tests/hd-vfx.test.js`
- Create: `tests/hd-lighting.test.js`
- Create: `assets/hd/fx/`
- Modify: `render/hd-renderer-layers.js`

**Step 1: Write failing pure-function tests**

Cover effect lifetime normalization, deterministic particle seeds, tile-safe telegraph geometry, light quality tiers, reduced-flash settings, and maximum particle budgets.

**Step 2: Implement visual-only effect adapters**

Map existing dash trails, shockwave rings, ranged bolts/impacts, particles, floating text, shield, blood barrier, void aegis, low-HP warning, mines, volatile warnings, and aiming lines.

**Step 3: Add composited lighting**

Use an offscreen light canvas. Combine ambient darkness, torch/object lights, spell flashes, and boss emission. Keep actors and hazard telegraphs readable. Provide `high`, `medium`, and `low` quality profiles.

**Step 4: Add accessibility limits**

Respect reduced motion for nonessential movement and limit full-screen flash opacity. Strong motion remains reserved for danger, reward, and phase changes.

**Step 5: Verify**

```powershell
node --test tests/hd-vfx.test.js tests/hd-lighting.test.js
```

Expected: PASS and no gameplay-state mutation in tests.

### Task 11: Apply minimal menu/HUD and mobile corrections

**Files:**
- Modify: `style.css`
- Modify: `index.html`
- Modify: `game.js`
- Create: `tests/menu-contract.test.js`
- Create: `tests/mobile-layout.spec.mjs`
- Create: `assets/hd/ui/`

**Step 1: Write the menu contract test**

Assert existing menu option labels, ordering, IDs, keyboard commands, Continue flow, Options audio entry, and DOM regions remain present. This test must prevent an accidental menu redesign.

**Step 2: Add visual tokens and icon mappings**

Use CSS variables for HD borders, panels, accent colors, focus rings, and state colors. Add icons for skills, effects, relics, and elixirs without changing their behavior.

**Step 3: Correct layout defects**

Fix title clipping, visible keyboard focus, selected states, long labels, mobile horizontal overflow, and canvas/skill-card scaling. Preserve the existing three-panel desktop hierarchy and mobile panel navigation.

**Step 4: Add reduced-motion CSS**

Use `@media (prefers-reduced-motion: reduce)` to disable decorative transitions while retaining state feedback.

**Step 5: Verify**

```powershell
node --test tests/menu-contract.test.js
node tests/mobile-layout.spec.mjs
```

Expected: PASS at 1440×1000, 920×900, and 390×844 with no horizontal document overflow.

### Task 12: Expand deterministic visual scenarios and screenshot QA

**Files:**
- Modify: `scenario-overrides.js`
- Modify: `tests/scenario-overrides.test.js`
- Create: `scripts/graphics-scenarios.mjs`
- Create: `tests/graphics-scenarios.test.js`
- Create: `output/graphics-overhaul/`

**Step 1: Write failing scenario coverage tests**

Add deterministic URLs for every room family, each enemy profile, each guardian, and both Warden phases. Scenarios may set presentation state but must not alter production balance tables.

**Step 2: Implement minimal scenario overrides**

Use stable seeds, fixed positions, and exact render state. Keep scenario code behind the existing test/debug boundary.

**Step 3: Build the Playwright capture runner**

For each scenario:

- load the page;
- wait for the HD asset-ready marker;
- advance animation time deterministically where possible;
- capture desktop and mobile screenshots;
- collect console errors;
- save `render_game_to_text` output beside each image.

**Step 4: Run QA**

```powershell
node --test tests/scenario-overrides.test.js tests/graphics-scenarios.test.js
node scripts/graphics-scenarios.mjs
```

Expected: PASS, zero unexpected console errors, and a complete screenshot matrix.

### Task 13: Performance, fallback, save, and audio regression gate

**Files:**
- Create: `scripts/graphics-performance.mjs`
- Create: `tests/renderer-fallback.test.js`
- Create: `tests/save-compatibility.test.js`
- Modify: `config.js`
- Modify: `progress.md`

**Step 1: Write failing fallback and save tests**

Verify a forced critical asset failure selects legacy rendering without resetting phase, depth, player HP, enemies, current run, or localStorage. Load at least one pre-overhaul save fixture and assert equivalent gameplay state.

**Step 2: Implement the fallback path fully**

Ensure canvas dimensions, CSS classes, diagnostics, and asset state reset correctly. Do not reload the page and do not recreate simulation state.

**Step 3: Measure frame performance**

Capture average and p95 render-frame cost for normal combat, dense cursed room, forge setpiece, and Warden phase 2. Targets:

- desktop p95 rendering below 16.7 ms;
- mobile quality profile stable without unbounded particle growth;
- no per-frame image construction;
- no gameplay RNG consumption by rendering.

**Step 4: Run the full regression suite**

```powershell
$tests = Get-ChildItem -LiteralPath tests -Filter '*.test.js' | ForEach-Object FullName
node --test $tests
node --test tests/audio-freeze.test.js tests/save-compatibility.test.js tests/renderer-fallback.test.js
node scripts/graphics-performance.mjs
node --check game.js
```

Expected: all tests pass, audio hashes match, save fixtures load, fallback works, and performance targets are met or documented with a corrective task.

### Task 14: Activate HD by default and perform final cleanup

**Files:**
- Modify: `config.js`
- Modify: `render/hd-asset-manifest.js`
- Modify: `assets/hd/README.md`
- Modify: `progress.md`
- Modify: `docs/plans/2026-07-12-complete-graphics-overhaul.md`

**Step 1: Audit active asset coverage**

Search all renderer paths and assert every active HD key resolves. Legacy assets may exist only behind the fallback path. Remove no old files.

**Step 2: Enable HD graphics by default**

Set `window.DUNGEON_HD_GRAPHICS_ENABLED = true` only after every preceding gate passes.

**Step 3: Run final playtest**

Play boot → menu → new game → combat → shrine → treasure → merchant → forge → pact → vault → boss → Warden phase change → death/victory. Repeat core checks on mobile.

**Step 4: Run final verification**

```powershell
$tests = Get-ChildItem -LiteralPath tests -Filter '*.test.js' | ForEach-Object FullName
node --test $tests
node --test tests/audio-freeze.test.js
node scripts/graphics-scenarios.mjs
node scripts/graphics-performance.mjs
```

Expected: all tests pass, all screenshots render in HD, no unexpected console errors, mobile has no horizontal overflow, fallback remains functional, and soundtrack hashes/configuration match the original baseline.

**Step 5: Document completion**

Update `progress.md` with:

- active renderer version;
- asset batch inventory;
- screenshot output location;
- performance numbers;
- full test command and result;
- audio-freeze verification result;
- any accepted limitations.

If Git exists:

```powershell
git add .
git commit -m "feat: complete Abyssal Gothic HD graphics overhaul"
```
