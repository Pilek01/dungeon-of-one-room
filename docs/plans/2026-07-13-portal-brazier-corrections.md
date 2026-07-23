# Portal and Brazier Corrections Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stabilize every HD portal animation and replace HD torch art with grounded themed braziers without changing legacy identifiers or audio.

**Architecture:** Add deterministic Pillow compositing helpers to the existing HD asset builders. Active portal frames share a fixed shell outside a motion mask; brazier frames share a fixed base and vary only inside a flame mask. Existing manifest keys, renderer selection, filenames, and map markers remain intact.

**Tech Stack:** Python 3, Pillow 12.1.1, Node.js built-in test runner, existing HTML5 Canvas renderer and Playwright visual harness.

---

### Task 1: Lock the visual invariants with failing tests

**Files:**
- Modify: `tests/hd-environment.test.js`
- Modify: `tests/hd-room-assets.test.js`

**Step 1: Write the failing tests**

Add PNG comparison assertions requiring identical portal pixels outside each aperture mask, stable portal alpha bounds, identical brazier bases outside flame masks, and unchanged technical `torch` keys.

**Step 2: Run tests to verify they fail**

Run: `node --test tests/hd-environment.test.js tests/hd-room-assets.test.js`

Expected: FAIL because current full-frame animations change their outer silhouettes and current torch frames do not share a stable brazier base.

**Step 3: Commit the regression tests**

Run: `git add tests/hd-environment.test.js tests/hd-room-assets.test.js && git commit -m "test: lock portal and brazier animation silhouettes"`

### Task 2: Add deterministic fixed-shell compositing

**Files:**
- Modify: `scripts/build-descent-environment-assets.py`
- Modify: `scripts/build-hd-room-assets.py`

**Step 1: Implement the minimal compositor**

Add helpers that copy a fixed base frame, paste only pixels inside an elliptical/rectangular motion mask, preserve the base alpha outside that mask, and validate stable frame bounds.

**Step 2: Apply it to common and themed portals**

Use the inactive or best representative normalized frame as the immutable shell. Composite only the inner swirl for common, vault, and otter portals; allow forge flame pockets in its explicit motion mask.

**Step 3: Run targeted tests**

Run: `python scripts/build-descent-environment-assets.py --update-lock; python scripts/build-hd-room-assets.py --update-lock; node --test tests/hd-environment.test.js tests/hd-room-assets.test.js`

Expected: portal assertions PASS; brazier assertions still FAIL.

**Step 4: Commit**

Run: `git add scripts assets art tests && git commit -m "fix: stabilize HD portal animation shells"`

### Task 3: Replace HD torch visuals with braziers

**Files:**
- Create or modify: `art/source/abyssal-gothic-hd/descent-environment-source-original.png`
- Create or modify: `art/source/task8-hd/corruption-env-source-original.png`
- Create or modify: `art/source/task8-hd/abyss-env-source-original.png`
- Modify: `scripts/build-descent-environment-assets.py`
- Modify: `scripts/build-hd-room-assets.py`
- Modify generated lockfiles and `assets/hd/**/torch-*.png`

**Step 1: Generate approved-style source art**

Create grounded common, corruption, and abyss brazier source frames on removable chroma backgrounds. Preserve generous padding and a common fixed base within each theme.

**Step 2: Normalize the art deterministically**

Build one immutable base plus unlit and three flame-state composites at 64 x 64. Keep output paths and `torch` keys unchanged.

**Step 3: Run targeted tests**

Run: `node --test tests/hd-environment.test.js tests/hd-room-assets.test.js`

Expected: all portal and brazier assertions PASS.

**Step 4: Commit**

Run: `git add art assets scripts tests && git commit -m "feat: replace HD torches with themed braziers"`

### Task 4: Full regression and visual audit

**Files:**
- Modify only if a reproduced defect requires it.

**Step 1: Run the complete unit suite**

Run: `node --test tests/*.test.js`

Expected: all tests PASS.

**Step 2: Verify deterministic asset pipelines and audio freeze**

Run: `python scripts/build-descent-environment-assets.py --check; python scripts/build-hd-room-assets.py --check; node --test tests/audio-freeze.test.js tests/hd-release-gates.test.js`

Expected: all checks PASS and soundtrack hashes remain unchanged.

**Step 3: Run the browser visual matrix**

Run the repository's existing final-audit capture command and inspect common, forge, vault, otter, corruption, and abyss scenes at multiple animation phases on desktop and mobile.

Expected: no portal translation or clipping; every `torch` marker renders as a grounded brazier; no menu or audio regression.

**Step 4: Commit final audit fixes if needed**

Run: `git add <verified-files> && git commit -m "fix: close portal and brazier visual audit"`
