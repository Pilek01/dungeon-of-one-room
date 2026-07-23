# Player Mobile Render Scale Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve mobile player and bump-attack readability by drawing the unchanged 64×64 player frames at 80×80 HD canvas pixels.

**Architecture:** Keep the animation asset pipeline, frame contract, snapshot data, selection, gameplay coordinates, and simulation untouched. Add one renderer presentation constant and continue using the existing bottom-center draw helper, which already supports actor overhang larger than one logical tile.

**Tech Stack:** Browser Canvas 2D, UMD/CommonJS JavaScript, Node test runner, Playwright browser capture.

---

### Task 1: Lock and implement 80 px player presentation

**Files:**
- Modify: `tests/hd-player-assets.test.js`
- Modify: `render/hd-renderer-layers.js`

**Step 1: Write the failing draw-geometry assertion**

Change the existing player-layer test to require the selected frame at `[image, 120, 176, 80, 80]` for logical tile `(2,3)`. This proves bottom-center overhang while leaving the logical coordinate unchanged.

**Step 2: Run the focused test to verify RED**

Run: `node --test --test-name-pattern "player layer draws" tests/hd-player-assets.test.js`

Expected: FAIL because the current call remains `[image, 128, 192, 64, 64]`.

**Step 3: Implement the minimal renderer change**

Add `const PLAYER_RENDER_SIZE = 80;` beside the HD tile constants. Pass `PLAYER_RENDER_SIZE` for both width and height in `drawPlayerLayer`; do not change `TILE_SIZE`, player coordinates, snapshot fields, selection, or timing.

**Step 4: Verify focused and regression suites**

Run:

```powershell
node --test --test-name-pattern "player layer draws" tests/hd-player-assets.test.js
node --test tests/hd-player-assets.test.js
$tests = Get-ChildItem -LiteralPath tests -Filter '*.test.js' | ForEach-Object FullName; node --test $tests
```

Expected: focused PASS 1/1, Task 6 PASS 20/20, full suite PASS.

**Step 5: Repeat browser QA**

Temporarily enable the existing HD flag, run the supplied Playwright client and dedicated 1280×800 / 390×844 capture, open desktop/mobile gameplay and mobile attack screenshots, confirm HD 576×576 plus zero console warnings/errors, then restore the flag to `false` and stop the server.

**Step 6: Commit**

Commit the renderer correction with the remaining Task 6 production implementation after formal code and visual reviews report no unresolved Critical or Important findings.
