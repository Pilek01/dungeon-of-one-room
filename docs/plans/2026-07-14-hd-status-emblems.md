# HD Status Emblems Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace code-native buff, debuff, protection-summary, and enemy-affix markers with thirty-two hand-painted Gothic HD emblems shared by the HUD and HD actor renderer.

**Architecture:** Two immutable 4x4 ImageGen atlases feed one pinned transactional Pillow builder that publishes thirty-two optional 64x64 RGBA icons and a deterministic lock. A new pure UMD/CommonJS status-presentation module owns semantic mappings and actor priority; `game.js` uses it for HD HUD rows while `hd-renderer-layers.js` uses the same descriptors for fixed actor rails and affix crests. Classic rendering, gameplay state, RNG, saves, audio, and soundtrack remain unchanged.

**Tech Stack:** JavaScript UMD/CommonJS modules, Canvas 2D, DOM/CSS HUD, Node test runner, Python 3 with Pillow 12.1.1, built-in ImageGen, Playwright browser QA.

---

### Task 1: Freeze the semantic and fallback contract

**Files:**
- Create: `tests/hd-status-emblems.test.js`
- Modify: `tests/visual-snapshot.test.js`
- Modify: `tests/scenario-overrides.test.js`

**Step 1: Write the failing catalog test**

Require exactly these thirty-two identifiers:

```js
const COMBAT = [
  "bleed", "poison", "burn", "freeze", "disorient", "enemy_buff",
  "fury", "attack_up", "armor_up", "max_hp_up", "lifesteal", "elixir",
  "shield", "barrier", "second_chance", "shrine_blessing"
];
const SPECIAL = [
  "chaos", "pact", "hunger", "swap", "noise", "soul_harvest",
  "storm_sigil", "quickloader", "chest_upgrade", "last_stand",
  "elite", "relentless", "juggernaut", "blooddrinker", "thorned", "volatile"
];
```

Each descriptor must contain `id`, `key`, `src`, `tone`, `label`, and `priority`. Require unique keys and paths under `assets/hd/ui/status/`.

**Step 2: Write the failing actor-selection tests**

Specify pure selection behavior:

```js
const selected = status.selectActorStatuses({
  bleeding: true,
  poisoned: true,
  skillShield: 20,
  hpShield: 15,
  furyBlessed: true,
  shrineBlessed: true
}, { kind: "player", limit: 3 });

assert.deepEqual(selected.visible.map((item) => item.id), ["bleed", "poison", "shield"]);
assert.equal(selected.overflow, 3);
```

Require harmful status before protection before buffs, deterministic ordering, no mutation, and no `Math.random`.

**Step 3: Write failing enemy crest tests**

Require `selectEnemyCrests({ elite: true, affix: "vampiric" })` to return `elite` and canonical `blooddrinker`. Require aliases `fast -> relentless`, `tank -> juggernaut`, and `vampiric -> blooddrinker`.

**Step 4: Write failing HUD-family tests**

Require label/family mappings such as:

```js
assert.equal(status.getHudStatusId("Grave Whisper"), "attack_up");
assert.equal(status.getHudStatusId("Fractured Sigil"), "barrier");
assert.equal(status.getHudStatusId("Burn DPS"), "burn");
assert.equal(status.getHudStatusId("Shrine ARM"), "shrine_blessing");
```

Unknown labels must return `null`, preserving text-only fallback.

**Step 5: Write failing source/asset contract tests**

Require two immutable source atlases, a builder, lock, contact sheet, metadata, and thirty-two 64x64 RGBA finals. Require zero visible exact or near-key magenta, transparent corners, meaningful alpha coverage, readable 20 px downsample entropy, and unique pixel hashes.

**Step 6: Run RED**

Run:

```powershell
node --test tests/hd-status-emblems.test.js tests/visual-snapshot.test.js tests/scenario-overrides.test.js
```

Expected: failures for missing module, source atlases, builder, assets, manifest entries, snapshot fields, and scenario.

**Step 7: Commit the RED contract**

```powershell
git add -- tests/hd-status-emblems.test.js tests/visual-snapshot.test.js tests/scenario-overrides.test.js
git commit -m "test: require HD status emblems"
```

### Task 2: Generate and approve two whole-atlas sources

**Files:**
- Create: `art/source/status-emblems-hd/combat-status-atlas-source-original.png`
- Create: `art/source/status-emblems-hd/special-affix-atlas-source-original.png`
- Create: `art/briefs/status-emblems-hd.md`

**Step 1: Load the ImageGen skill**

Use `@imagegen` because the project has no real source icons for these states. Do not use CSS art, SVG approximations, emoji, or programmatically drawn substitute emblems.

**Step 2: Write the exact atlas brief**

Freeze a strict 4x4 layout, flat `#ff00ff` background, no text/numbers, one centered isolated emblem per cell, consistent orthographic camera, identical scale, broad silhouette, and no object crossing cell boundaries. Include the approved slot order from Task 1.

**Step 3: Generate the combat atlas as one image**

Prompt for hand-painted dark-fantasy Gothic metal/stone/glass emblems. Harmful icons must differ by silhouette: blood drop with cut, poison vial/serpent, burning brand, fractured ice crystal, split compass/eye, violet empowering chalice. Positive icons must likewise use distinct symbols.

**Step 4: Generate the special/affix atlas as one image**

Prompt for sigils and heraldic crests matching the HD dungeon palette. All six enemy affixes need unmistakably different silhouettes at 20 px.

**Step 5: Preserve the returned originals unchanged**

Record exact dimensions, mode, and SHA-256. Do not crop, overwrite, or re-encode the original files.

**Step 6: Inspect both full sources**

Reject and regenerate any source with text, missing cells, merged objects, inconsistent perspective, duplicated symbols, clipped cells, non-flat background, or unreadable small silhouettes.

**Step 7: Run the source-only RED subset**

```powershell
node --test --test-name-pattern="source atlases" tests/hd-status-emblems.test.js
```

Expected: source identity/layout checks pass; builder and final asset checks remain RED.

**Step 8: Commit approved immutable sources explicitly**

```powershell
git add -- art/briefs/status-emblems-hd.md art/source/status-emblems-hd/combat-status-atlas-source-original.png art/source/status-emblems-hd/special-affix-atlas-source-original.png
git commit -m "art: add HD status emblem sources"
```

### Task 3: Build the deterministic emblem pipeline

**Files:**
- Create: `scripts/build-status-emblem-assets.py`
- Create: `art/source/status-emblems-hd/status-emblems.lock.json`
- Create: `art/source/status-emblems-hd/status-emblems-contact-sheet.png`
- Create: `assets/hd/ui/status/status-emblems.json`
- Create: `assets/hd/ui/status/*.png` (32 files)
- Modify: `.gitignore` only if a new ignored work child is required

**Step 1: Implement source and toolchain verification**

Pin `Pillow==12.1.1` and the installed chroma helper SHA already used by the other HD builders. Verify exact source hashes, image modes, and dimensions before staging.

**Step 2: Implement isolated staging**

Create a unique child under `art/work/status-emblems-hd/`. Keep all source keying, slots, previews, and staged outputs inside that child. Clean it in `finally`; remove the empty parent only when safe.

**Step 3: Key and split each complete atlas**

Normalize to 1024x1024 only in staging, invoke the pinned helper on the whole image, then crop exact 256x256 logical cells in row-major order. Validate one meaningful emblem per slot and no meaningful alpha touching a slot boundary.

**Step 4: Normalize the family**

Compute one shared scale from all thirty-two alpha bounds. Place each result on a 64x64 transparent canvas with optical center near `(32, 32)` and visible bounds inside a safe 4 px margin. Do not redraw or invent pixels.

**Step 5: Publish metadata and review contact sheet**

Metadata must map every identifier to file, tone, label, source atlas, row, column, alpha bounds, and shared scale. Build a labeled contact sheet that shows native 64 px and 20 px nearest/linear previews on dark Descent, Corruption, and Abyss swatches.

**Step 6: Validate finals**

Require thirty-two unique RGBA PNGs, transparent corners, minimum visible coverage, zero exact/near-key magenta, stable family scale, safe bounds, and nonblank 20 px previews.

**Step 7: Add transactional lock behavior**

Support:

```powershell
python scripts/build-status-emblem-assets.py --update-lock
python scripts/build-status-emblem-assets.py --check
```

`--check` must build in isolation without publishing or changing hashes. `--update-lock` publishes the normalized review outputs, finals, metadata, contact sheet, and lock atomically with rollback.

**Step 8: Run GREEN asset tests**

```powershell
node --test --test-name-pattern="source atlases|final status emblems|locked status build" tests/hd-status-emblems.test.js
```

Expected: all selected asset tests pass.

**Step 9: Inspect the contact sheet**

Reject icons that collapse at 20 px, resemble another status, lose their frame, or blend into any of the three floor palettes. Return to the immutable source generation step if source art is the cause.

**Step 10: Commit pipeline and assets explicitly**

```powershell
git add -- scripts/build-status-emblem-assets.py art/source/status-emblems-hd/status-emblems.lock.json art/source/status-emblems-hd/status-emblems-contact-sheet.png assets/hd/ui/status
git commit -m "feat: build HD status emblems"
```

Never add the unrelated untracked `assets/hd/hd.zip`.

### Task 4: Add the shared pure status-presentation module

**Files:**
- Create: `render/hd-status-emblems.js`
- Modify: `index.html`
- Modify: `render/hd-asset-manifest.js`
- Modify: `tests/hd-status-emblems.test.js`

**Step 1: Implement a UMD/CommonJS module**

Expose:

```js
Object.freeze({
  entries,
  getDescriptor,
  getHudStatusId,
  selectActorStatuses,
  selectEnemyCrests
});
```

Snapshot all public records with `Object.freeze`. Do not read DOM, canvas, audio, storage, or random state.

**Step 2: Implement canonical descriptors and aliases**

Use the exact thirty-two identifiers. Set stable tones and priority numbers. Canonicalize affix aliases without changing gameplay affix strings.

**Step 3: Implement actor selection**

For players, derive Bleed, Poison, Shield, Barrier, Fury, Elixir, and Shrine Blessing from snapshot fields. For enemies, derive Freeze, Burn, Disorient, and enemy buff. Return `{ visible, overflow }` with a default limit of three.

**Step 4: Add optional manifest entries**

Add all thirty-two `ui.status.<id>` entries with group `ui-status`, `critical:false`. Preserve the existing critical environment/player/enemy/boss boundary.

**Step 5: Load the module before renderer layers and game code**

In `index.html`, load `render/hd-status-emblems.js` after the manifest and before `visual-snapshot.js`, `hd-renderer-layers.js`, and `game.js`.

**Step 6: Run GREEN module tests**

```powershell
node --test tests/hd-status-emblems.test.js tests/hd-asset-loader.test.js
```

Expected: catalog, mapping, purity, optional loading, and fallback tests pass; HUD/actor drawing tests may remain RED.

**Step 7: Commit**

```powershell
git add -- render/hd-status-emblems.js render/hd-asset-manifest.js index.html tests/hd-status-emblems.test.js
git commit -m "feat: add HD status presentation model"
```

### Task 5: Replace HD HUD status shapes with emblem rows

**Files:**
- Modify: `game.js:16778-17235`
- Modify: `style.css:2139-2260`
- Modify: `tests/hd-status-emblems.test.js`
- Modify: `tests/ui-polish.test.js`

**Step 1: Write failing HUD markup tests**

Require an HD helper that emits an actual `<img>` with semantic alt/title text and class names, not inline CSS drawings. Require legacy mode to retain the prior text/tag path.

**Step 2: Add HTML helpers**

Implement escaped helpers conceptually equivalent to:

```js
function hdStatusIcon(id, accessibleLabel) {
  const descriptor = statusEmblemsApi?.getDescriptor(id);
  if (!descriptor || canvas.dataset.graphicsMode !== "hd") return "";
  return `<img class="status-emblem" src="${descriptor.src}" alt="" aria-hidden="true">`;
}

function activeStatusRow(id, label, value, tooltip) {
  // Preserve visible label/value and tooltip even when the icon is unavailable.
}
```

Do not return handcrafted SVG, emoji, pseudo-element art, or base64 placeholders.

**Step 3: Replace HP-row HD shapes**

Use Bleed, Poison, Shield, and Barrier emblems in HD mode. Keep numeric Shield/Barrier values and tooltip text. Keep the current legacy shapes/tags when the canvas is in legacy mode.

**Step 4: Map every Active Effects row**

Pass explicit semantic IDs where known and use `getHudStatusId(label)` for the remaining existing labels. Preserve all names, values, durations, and tooltip strings byte-for-byte where practical.

**Step 5: Add restrained CSS layout**

Use a 24 px icon column, flexible label, and right-aligned value. Add tone border/accent classes but do not encode meaning only in color. Ensure 390 px mobile does not overflow. Reduced-motion mode disables any optional opacity pulse.

**Step 6: Run HUD tests**

```powershell
node --test tests/hd-status-emblems.test.js tests/ui-polish.test.js tests/audio-freeze.test.js
```

Expected: HD markup and layout contracts pass; Classic and audio hashes/contracts remain unchanged.

**Step 7: Commit**

```powershell
git add -- game.js style.css tests/hd-status-emblems.test.js tests/ui-polish.test.js
git commit -m "feat: style HD status HUD"
```

### Task 6: Replace HD actor rectangles with anchored emblem rails

**Files:**
- Modify: `render/visual-snapshot.js`
- Modify: `render/hd-renderer-layers.js:414-704`
- Modify: `tests/visual-snapshot.test.js`
- Modify: `tests/hd-status-emblems.test.js`
- Modify: `tests/hd-enemy-assets.test.js`

**Step 1: Extend only derived presentation state**

Add `player.poisoned` and any missing booleans/counts required for the approved rail. Continue to exclude damage values, simulation-only timers, relic inventory, audio, storage, and arbitrary state.

**Step 2: Write failing rail geometry tests**

Require a fixed top-center rail, 20 px icons, 2 px gaps, maximum three dynamic icons, and a `+N` overflow marker. Require positions to remain identical across animation frames and actor directions.

**Step 3: Write failing crest tests**

Require Elite and affix crests in separate fixed positions. An enemy may show both without reducing the three dynamic slots. Missing optional crest assets must omit the crest and never invoke procedural geometry.

**Step 4: Implement `drawStatusRail`**

Read descriptors from the shared module and images from the existing loaded asset `Map`. Use `drawImage` only for available emblems. Draw the overflow text with the existing readable monospace font and a dark backing plate; do not draw status symbols with rectangles.

**Step 5: Replace old procedural status and affix drawing**

Remove Freeze/Burn/Disorient/Acolyte solid bars and procedural Elite/affix geometry from the HD path. Keep the HP bar unchanged. Preserve Classic drawing code in `game.js`.

**Step 6: Add player rail after the actor/protection composition**

Draw protection rear -> player -> protection front -> compact status rail. The rail cannot change player root, logical position, tween, collision, hitbox, or protection frame selection.

**Step 7: Run renderer tests**

```powershell
node --test tests/hd-status-emblems.test.js tests/hd-enemy-assets.test.js tests/hd-player-assets.test.js tests/hd-protection-vfx.test.js tests/visual-snapshot.test.js
```

Expected: actor rails, priorities, crests, protection nesting, tweening, and snapshot purity pass.

**Step 8: Commit**

```powershell
git add -- render/visual-snapshot.js render/hd-renderer-layers.js tests/visual-snapshot.test.js tests/hd-status-emblems.test.js tests/hd-enemy-assets.test.js
git commit -m "feat: render HD actor status emblems"
```

### Task 7: Add deterministic status showcase and browser audit

**Files:**
- Modify: `scenario-overrides.js`
- Modify: `game.js:11594-11745`
- Modify: `tests/scenario-overrides.test.js`
- Create: `scripts/capture-hd-status-emblems-qa.mjs`
- Modify: `progress.md`

**Step 1: Write the failing scenario test**

Require `status_emblems_hd` with fixed depth, room, player states, enemies, and no random hazards. Assert that the setup covers player Bleed/Poison/Shield/Barrier/Fury/Shrine/Elixir, enemy Freeze/Burn/Disorient/buff, Elite, and all five affixes.

**Step 2: Implement minimal debug-only setup**

Reuse the existing showcase pattern. Arrange actors so rails do not overlap. Populate only existing gameplay fields; do not invent mechanics or save state.

**Step 3: Create the capture runner**

Capture desktop 1440x1000 and mobile 390x844 into `output/hd-status-emblems-qa/`. Save viewport, canvas, state, diagnostics, and layout metrics. Capture the contact sheet separately as asset evidence.

Automated gates:

- HD 576x576 active;
- phase `playing` and correct scenario;
- scrollY 0 and no horizontal overflow;
- zero console diagnostics;
- no transparent/blank canvas or near-key magenta;
- Active Effects rows remain inside the viewport/panel;
- actor rail bounds stay within the 576x576 canvas;
- mobile controls and skill bar remain visible.

**Step 4: Capture fresh evidence**

Use the in-app Browser selected by Product Design when available. If unavailable and standalone Playwright is required, obtain user approval before using that fallback. Never accept cached screenshots.

**Step 5: Inspect every accepted screenshot**

Reject any screenshot with loading overlays, clipped icons, unreadable 20 px symbols, actor-face coverage, HP-bar overlap, status/telegraph confusion, icon crowding, missing HUD text, or animation-induced movement.

**Step 6: Test Classic fallback**

Disable HD through the supported diagnostic flag and capture/read the same underlying state. Confirm legacy canvas dimensions and original status presentation remain functional.

**Step 7: Update progress evidence and commit**

```powershell
git add -- scenario-overrides.js game.js tests/scenario-overrides.test.js scripts/capture-hd-status-emblems-qa.mjs progress.md
git commit -m "test: add HD status emblem QA"
```

### Task 8: Release verification

**Files:**
- Modify: `progress.md` only if final evidence changes the recorded result

**Step 1: Run locked build checks**

```powershell
python scripts/build-status-emblem-assets.py --check
python scripts/build-descent-environment-assets.py --check
python scripts/build-hd-room-assets.py --check
python scripts/build-protection-vfx-assets.py --check
```

Expected: every check exits 0 without publishing or leaking transaction children.

**Step 2: Run the focused suite**

```powershell
node --test tests/hd-status-emblems.test.js tests/hd-enemy-assets.test.js tests/hd-player-assets.test.js tests/hd-protection-vfx.test.js tests/visual-snapshot.test.js tests/scenario-overrides.test.js tests/ui-polish.test.js
```

Expected: 0 failures.

**Step 3: Run the full sequential suite and audio freeze**

```powershell
$tests = Get-ChildItem tests -Filter '*.test.js' | Sort-Object Name | ForEach-Object FullName
node --test --test-concurrency=1 $tests
node --test tests/audio-freeze.test.js
```

Expected: 0 failures; audio freeze remains 5/5.

**Step 4: Run browser performance**

```powershell
node scripts/benchmark-hd-render.mjs http://127.0.0.1:<fresh-port>/index.html output/hd-status-emblems-qa/performance.json
```

Require HD retained, mean frame time no greater than 24 ms, p95 no greater than 40 ms, and zero console diagnostics on desktop and mobile.

**Step 5: Run syntax and hygiene checks**

Run `node --check` on every changed JS/MJS file, `python -B -m py_compile` on the new builder, and `git diff --check`. Resolve and validate any `scripts/__pycache__` path before removal. Confirm no asset work directories remain.

**Step 6: Confirm final Git status**

The only permitted unrelated entry is:

```text
?? assets/hd/hd.zip
```

Do not stage, modify, delete, or commit that file.

**Step 7: Commit final evidence if needed**

```powershell
git add -- progress.md
git commit -m "docs: record HD status emblem verification"
```
