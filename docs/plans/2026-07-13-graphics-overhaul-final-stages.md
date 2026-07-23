# Graphics Overhaul Final Stages Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete Tasks 10–14 of the approved graphics overhaul, correct wall/corner orientation, and finish with evidence-backed desktop/mobile visual, performance, fallback, save, and audio audits.

**Architecture:** Preserve the existing Canvas 2D simulation/render boundary and read-only visual snapshot. Add pure VFX and lighting adapters as renderer-only modules, keep DOM menu flows intact, and extend deterministic scenario tooling so every visual state can be captured and reviewed. Correct wall topology at the asset/semantic-key boundary and protect it with edge-occupancy tests.

**Tech Stack:** Vanilla JavaScript, Canvas 2D, HTML/CSS, Node.js test runner, Playwright, Python/Pillow asset validators.

---

## Preconditions and invariants

- Worktree: `.worktrees/graphics-overhaul`, branch `feature/graphics-overhaul`.
- Baseline: commit `8c23955`, 180/180 tests passing.
- Preserve the user's local uncommitted `config.js=true` preview toggle until the final activation commit intentionally makes HD the repository default.
- Do not modify soundtrack files, paths, hashes, volumes, loop configuration, autoplay/mute behavior, or music-selection logic.
- Use RED → GREEN → review → browser evidence for each production batch.
- Do not change gameplay coordinates, collision, AI, damage, turn timing, RNG, save payloads, or input commands.

## Batch A — wall topology correction and VFX/lighting

### Task A1: Protect and correct wall/corner orientation

**Files:**
- Create: `tests/hd-wall-topology.test.js`
- Modify as required after RED: `render/hd-renderer-layers.js`
- Modify as required after RED: `scripts/build-descent-environment-assets.py`
- Modify as required after RED: `scripts/build-hd-room-assets.py`
- Regenerate only affected files under `assets/hd/environment/{descent,corruption,abyss}/`

**Steps:**

1. Write a failing test that classifies alpha/opaque occupancy on the north, south, east, and west edges of every wall and corner asset.
2. Assert NW touches north+west, NE north+east, SW south+west, and SE south+east, with opposite edges below the allowed occupancy threshold.
3. Add a renderer-call test proving each semantic corner is drawn at its matching board coordinate.
4. Run `node --test tests/hd-wall-topology.test.js` and retain the expected failure identifying the reversed mapping.
5. Correct the smallest asset index/name or renderer mapping responsible for the failure; do not redraw unrelated art.
6. Rebuild with the pinned scripts, run their `--check` modes, then run the topology, environment, and themed-room tests.
7. Capture all three themes at desktop and mobile sizes and inspect all twelve physical corners.
8. Commit the correction and its regression test.

### Task A2: Implement deterministic HD combat VFX

**Files:**
- Create: `render/hd-vfx.js`
- Create: `tests/hd-vfx.test.js`
- Modify: `index.html`
- Modify: `render/hd-renderer-layers.js`

**Steps:**

1. Write failing pure-function tests for lifetime normalization, deterministic particle seeds, tile-safe telegraphs, reduced-motion/reduced-flash behavior, and particle budgets.
2. Implement adapters for existing snapshot data: dash trails/afterline, shockwave rings, ranged bolts/impacts, particles, floating text, mines, volatile bursts, aiming lines, hit/death feedback, shield/barrier states, and boss phase feedback.
3. Draw VFX only inside the existing `telegraphs` and `effects` layers. Never mutate snapshot data or consume `Math.random()`.
4. Run `node --test tests/hd-vfx.test.js tests/visual-snapshot.test.js`.
5. Add deterministic VFX showcase scenarios and inspect gameplay-scale screenshots.
6. Commit after tests and visual review pass.

### Task A3: Implement composited HD lighting

**Files:**
- Create: `render/hd-lighting.js`
- Create: `tests/hd-lighting.test.js`
- Modify: `index.html`
- Modify: `render/hd-renderer-layers.js`

**Steps:**

1. Write failing tests for `high`, `medium`, and `low` profiles, clamped ambient opacity, bounded light counts, deterministic light selection, and telegraph readability.
2. Implement an offscreen light canvas that combines ambient darkness with torch, portal, forge, spell, hazard, and boss emission.
3. Keep danger telegraphs and actor silhouettes readable after compositing; mobile uses the bounded low/medium profile without gameplay changes.
4. Run `node --test tests/hd-lighting.test.js tests/hd-vfx.test.js tests/hd-renderer.test.js`.
5. Capture Descent, Corruption, Abyss, Forge, and Warden phase 2 screenshots; fix over-dark or clipped states.
6. Commit after review.

## Batch B — menu/HUD and deterministic audit matrix

### Task B1: Apply minimal menu/HUD/mobile polish

**Files:**
- Create: `tests/menu-contract.test.js`
- Create: `tests/mobile-layout.test.js`
- Modify: `style.css`
- Modify only when required by the contract: `index.html`, `game.js`

**Steps:**

1. Write RED tests freezing menu IDs, labels, order, keyboard commands, Continue flow, Options audio entry, and DOM regions.
2. Add CSS variables/focus/selected/reduced-motion rules without redesigning menu structure.
3. Correct title clipping, long-label wrapping, skill-card scaling, safe mobile controls, and horizontal overflow.
4. Verify 1440×1000, 920×900, and 390×844 through Playwright and screenshot inspection.
5. Run menu, mobile-layout, scenario, and audio-freeze tests; commit.

### Task B2: Build the complete deterministic visual scenario matrix

**Files:**
- Create: `scripts/graphics-scenarios.mjs`
- Create: `tests/graphics-scenarios.test.js`
- Modify: `scenario-overrides.js`
- Modify: `tests/scenario-overrides.test.js`

**Steps:**

1. Write RED coverage tests for every environment, room family, special object, enemy, guardian, Warden phase, VFX state, and menu/HUD state.
2. Add debug-only stable scenario state without changing production balance.
3. Capture desktop and mobile screenshots, `render_game_to_text`, layout metrics, asset failures, and console diagnostics.
4. Require HD mode, 576×576 canvas, no overflow, visible mobile skills/controls, and zero unexpected diagnostics.
5. Inspect every screenshot; record concrete findings and fix all Critical/Important visual defects before proceeding.
6. Commit the runner, scenarios, and fixes.

## Batch C — regression gates, activation, and final audit

### Task C1: Verify fallback, old saves, and performance

**Files:**
- Create: `tests/renderer-fallback.test.js`
- Create: `tests/save-compatibility.test.js`
- Create: `scripts/graphics-performance.mjs`
- Add minimal committed save fixtures under `tests/fixtures/` only when needed.

**Steps:**

1. Write RED tests proving critical asset failure switches only presentation to legacy while preserving run state and localStorage.
2. Verify representative pre-overhaul saves restore equivalent gameplay state.
3. Measure average/p95 render cost and particle/light budgets for normal combat, cursed room, Forge, and Warden phase 2.
4. Target desktop p95 below 16.7 ms and bounded mobile effects; document and correct any missed target.
5. Run fallback/save/performance/audio tests and commit.

### Task C2: Activate HD by default and clean up safely

**Files:**
- Modify: `config.js`
- Create or update: `assets/hd/README.md`
- Modify: `progress.md`
- Modify: `docs/plans/2026-07-12-complete-graphics-overhaul.md`

**Steps:**

1. Audit every active semantic key and verify all critical assets resolve.
2. Write/update the config contract test, watch it fail against the committed `false`, then intentionally set `DUNGEON_HD_GRAPHICS_ENABLED = true`.
3. Keep the legacy renderer and old assets intact as emergency fallback.
4. Document the asset inventory, test matrix, screenshot location, performance numbers, and soundtrack freeze.
5. Commit activation only after every prior gate passes.

### Task C3: Final player-facing audit and corrective loop

1. Run boot → menu → new game → combat → shrine → treasure → merchant → forge → pact → vault → boss → Warden phase transition → death/victory on desktop; repeat core flow on mobile.
2. Inspect the UI layer separately from the canvas layer.
3. Audit wall seams/corners, sprite roots, overhang/clipping, VFX obstruction, darkness/readability, HUD overlap, focus states, overflow, and fallback presentation.
4. For every defect: add a failing regression test, implement the smallest correction, rerun the affected scenario, and inspect the replacement screenshot.
5. Run the complete Node suite, audio-freeze suite, locked asset checks, scenario matrix, and performance runner from a clean detached checkout.
6. Obtain final spec and code/visual review with no remaining Critical or Important findings.

## Final acceptance evidence

- All tests green in a clean checkout.
- All locked asset builders pass `--check`.
- Full desktop/mobile screenshot matrix exists and has been visually inspected.
- Every wall and corner orientation passes semantic topology tests.
- No missing HD assets, unexpected console errors, or horizontal overflow.
- Performance budgets are met or corrected before activation.
- Save/fallback behavior preserves simulation state.
- Soundtrack files and protected audio configuration exactly match the baseline.
