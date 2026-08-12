
# Mobile Button Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed 210 px mobile control shelf with a balanced, height-adaptive Gothic command console matching the approved reference.

**Architecture:** Keep all DOM IDs and canonical runtime handlers. Extend the existing Playwright smoke/gallery measurement layer first, then change only mobile layout CSS in `style-mobile-hd.css` and visual sizing CSS in `style-mobile-gothic.css`.

**Tech Stack:** HTML, CSS, vanilla JavaScript, Node test runner, Playwright.

## Global Constraints

- Preserve the square playfield and all gameplay rules.
- Use only existing real Gothic assets.
- Minimum visible touch target is 48 x 48 CSS px.
- Preserve portrait, desktop, fine-pointer, hybrid, tablet, and iPad paths.
- Do not deploy, push, or activate a ruleset.

---

### Task 1: Add failing runtime geometry coverage

**Files:**
- Modify: `scripts/mobile-v1-smoke.mjs`
- Modify: `tests/mobile-v1.test.js`

**Interfaces:**
- Consumes: existing `pageMetrics(page)` geometry and touch profile loop.
- Produces: action-bank, D-pad-union, HUD, Extract, and overlap metrics plus reusable layout assertions.

- [ ] Add measurements for `#mobileHud`, D-pad button union, each visible action,
  and `#mbtnQ` width.
- [ ] Add assertions for HUD-to-action gap, deck-bottom gap, D-pad/action center
  alignment, Extract spanning, 48 px targets, clipping, and overlap.
- [ ] Run `node scripts/mobile-v1-smoke.mjs --profile iphone` and confirm RED on
  the current fixed shelf/dead-space layout.

### Task 2: Implement adaptive control geometry

**Files:**
- Modify: `style-mobile-hd.css`

**Interfaces:**
- Consumes: existing `#mobileCommandDeck`, `#mobileControls`, `.mobile-dpad`, and
  `#mobileActionDock` structure.
- Produces: a control layer that spans from HUD to command-deck bottom.

- [ ] Replace the fixed bottom padding and `height: 210px` shelf with a
  full-height control layer whose top inset matches the compact HUD.
- [ ] Keep the D-pad in the left bay and allow responsive 48–52 px cells.
- [ ] Keep six regular actions in 2 x 3 placement and make Extract span both
  columns in row four.
- [ ] Run the iPhone and chrome-height smoke profiles and confirm GREEN.

### Task 3: Restore visual hierarchy at normal phone height

**Files:**
- Modify: `style-mobile-gothic.css`
- Modify: `scripts/mobile-v1-gallery.mjs`

**Interfaces:**
- Consumes: adaptive geometry from Task 2 and the current real Gothic assets.
- Produces: scaled icons/labels and visual gallery assertions.

- [ ] Scale action art between 29 and 36 px based on viewport height without
  dropping below the short-height contract.
- [ ] Keep regular button labels/status visible and unclipped; give Extract a
  deliberate full-width emergency treatment.
- [ ] Add gallery diagnostics for empty vertical space, Extract span, D-pad
  centering, action clipping, and reference-profile geometry.
- [ ] Run `node scripts/mobile-v1-gallery.mjs`, inspect the new gameplay and
  Fury 7/7 screenshots beside the approved reference, and iterate until the
  visible layout matches.

### Task 4: Verify all responsive and input paths

**Files:**
- Verify only unless a failing regression requires an in-scope fix.

**Interfaces:**
- Consumes: complete redesigned command deck.
- Produces: final verification receipts and inspected screenshots.

- [ ] Run focused mobile/UI tests and JavaScript syntax checks.
- [ ] Run `node scripts/mobile-v1-smoke.mjs --profile all`.
- [ ] Run `node scripts/mobile-v1-gallery.mjs` and inspect all accepted images.
- [ ] Run `npm run verify:ui-current -- --scenario hd` and
  `npm run verify:baseline`.
- [ ] Run `npm run verify:guard` once and `git diff --check`.
- [ ] Request independent code and visual reviews; resolve every Critical or
  Important finding before handoff.

## Plan self-review

The plan covers every spec acceptance criterion through a runtime browser
assertion or visual comparison. It changes no runtime game handler and contains
no placeholder step. Tests precede production CSS changes.

## 2026-08-12 exact command-deck fidelity plan

- [ ] Normalize the fresh 844 x 390 gameplay capture and the approved
  `docs/design-references/mobile-gothic-ui-approved.png` to the same pixel
  canvas before comparing; do not treat the reference as directional.
- [ ] Close the P0/P1/P2 differences in the fresh comparison: continuous
  framed left control bay, blackened-iron material and restrained accents,
  icon-first action labels, centered D-pad/action bays, and unstretched frame
  assets.
- [ ] Re-run the fresh comparison and accept only when no actionable P0, P1 or
  P2 mismatch remains in both full-view and 12-panel normalized evidence.
