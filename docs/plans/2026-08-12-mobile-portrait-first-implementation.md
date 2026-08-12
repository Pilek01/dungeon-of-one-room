# Mobile Portrait-First Experience Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the existing landscape-only touch adaptation into a polished portrait-first mobile game while preserving canonical gameplay, landscape, tablet, and desktop behavior.

**Architecture:** Keep the current mobile command/HUD/control DOM and canonical input/overlay dispatch. Separate capability detection from orientation presentation, add a dedicated portrait grid in the final mobile stylesheets, and make mobile overlays use one viewport shell with one content scroller and persistent actions.

**Tech Stack:** HTML, CSS, vanilla JavaScript, Node test runner, Playwright, canvas game runtime.

---

### Task 1: Portrait capability and gameplay shell

**Files:**
- Modify: `tests/mobile-v1.test.js`
- Modify: `tests/mobile-repair-pass.test.js`
- Modify: `scripts/mobile-v1-smoke.mjs`
- Modify: `scripts/mobile-v1-gallery.mjs`
- Modify: `game.js`
- Modify: `style-mobile-hd.css`
- Modify: `style-mobile-gothic.css`

1. Write static and Playwright assertions that portrait touch does not show the rotate gate or inert the app and that the command deck, D-pad, action bank, Menu, and square board are visible at 360x640, 390x844, and 430x932.
2. Run the focused test and portrait runner and confirm the expected RED is the current orientation gate.
3. Separate touch capability from orientation in `syncMobileOrientationState()` and `syncMobileUiState()`; keep `mobile-portrait` as presentation state, not a blocker.
4. Add the portrait three-zone grid and safe-area sizing. Preserve all IDs and canonical handlers.
5. Run focused tests, portrait smoke, and portrait gallery until GREEN; inspect every portrait screenshot.

### Task 2: Capability boundaries and canonical interaction

**Files:**
- Modify: `tests/mobile-v1.test.js`
- Modify: `scripts/mobile-v1-smoke.mjs`
- Modify: `game.js`

1. Add RED browser cases for a 1280x800 no-UA hybrid touch laptop, UA-only/no-touch desktop, narrow fine-pointer portrait/landscape, and focused menu-row activation.
2. Confirm current classification and stale focused-row activation fail for the expected reasons.
3. Require actual touch/coarse capability, keep true mobile/tablet UA devices inside documented limits, and preserve desktop mode for hybrid laptops above the 1200px width boundary.
4. Make Enter/Space activate the currently focused custom overlay row or synchronize focus and menu selection.
5. Run the capability and interaction matrix.

### Task 3: Full-screen Camp, Forge, and Merchant

**Files:**
- Modify: `scripts/mobile-v1-gallery.mjs`
- Modify: `scripts/mobile-v1-smoke.mjs`
- Modify: `style-mobile-hd.css`
- Modify: `style-mobile-gothic.css`
- Modify only when required for structure/copy: `game.js`

1. Add portrait RED assertions for viewport ownership, one scroll region, reachable last item, 48px actions, persistent primary/back action, and no root overflow.
2. Make Camp start-depth and dashboard purpose-built full-screen layouts.
3. Remove Merchant nested scrolling and provide Back in every touch renderer.
4. Make Forge mode, transmute list, and reward claim use a single scroller and persistent action hierarchy.
5. Capture and compare all three hubs at small, typical, and large portrait sizes.

### Task 4: Rewards, relic exchange, Pact, and confirmations

**Files:**
- Modify: `scenario-overrides.js`
- Modify: `tests/scenario-overrides.test.js`
- Modify: `scripts/mobile-v1-gallery.mjs`
- Modify: `scripts/mobile-v1-smoke.mjs`
- Modify: `style-mobile-hd.css`
- Modify: `style-mobile-gothic.css`
- Modify only when required for semantic actions: `game.js`

1. Add deterministic fixtures and RED runtime coverage for reward draft, dense relic exchange, Pact, and emergency extraction.
2. Implement full-screen one-column cards/lists with persistent claim/keep/back/confirm actions.
3. Ensure long names, descriptions, costs, gains, selected states, and disabled states remain readable and touch-operable.
4. Capture and inspect reward and dense-state evidence on all phone sizes.

### Task 5: Terminal, records, nickname, and settings flows

**Files:**
- Modify: `scenario-overrides.js`
- Modify: `tests/scenario-overrides.test.js`
- Modify: `scripts/mobile-v1-gallery.mjs`
- Modify: `style-mobile-hd.css`
- Modify: `style-mobile-gothic.css`
- Modify only when required for semantics: `game.js`, `index.html`

1. Add RED scenarios/assertions for death, final defeat, victory, records list/detail, nickname, Options, and Tutorial.
2. Give terminal screens a readable scroll body and persistent actions; make records/name controls at least 48px and label the nickname input.
3. Verify focus entry/return, error/empty/disabled states, and keyboard/touch copy separation.
4. Capture the dense terminal/records evidence.

### Task 6: Visual polish and final hostile audits

**Files:**
- Modify as findings require: `style-mobile-hd.css`, `style-mobile-gothic.css`, mobile tests/runners
- Update: `design-qa.md`
- Update: `progress.md`

1. Compare current/reference or previous/current screenshots side by side at the same viewport and state.
2. Fix P0/P1/P2 material, hierarchy, typography, spacing, safe-area, scroll endpoint, transition, and intermediate-state issues.
3. Run independent visual and code audits; fix every Critical/Important finding and repeat until two consecutive audits report only minor polish.
4. Run focused tests, all-profile smoke, gallery, `verify:ui-current -- --scenario hd`, `verify:baseline`, `verify:guard`, and `git diff --check` once on the stable tree.
5. Record final score, cycles, evidence paths, exact branch/HEAD, checks, changed-file count, and remaining imperfections without pushing, merging, or deploying.
