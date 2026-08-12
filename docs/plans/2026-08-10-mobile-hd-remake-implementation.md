# Mobile HD Remake Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the mobile landscape UX around an undistorted square 9x9 room, a right-side HD command deck with a full D-pad, and touch-complete responsive overlays while preserving desktop and gameplay rules.

**Architecture:** Keep the canonical game state, renderers, skill/resource builders, and action handlers. Add a mobile view-model/rendering adapter and one final `style-mobile-hd.css` composition layer loaded after all desktop HD styles. Drive implementation test-first with deterministic real-touch browser scenarios at normal and Chrome-reduced landscape heights.

**Tech Stack:** Existing HTML/CSS/vanilla JavaScript game, Node `node:test`, Playwright, `render_game_to_text`, deterministic scenario overrides, existing HD PNG assets.

**Repository rule:** Do not commit, push, deploy, merge, or version-bump during this plan. The project instructions override generic plan templates that suggest frequent commits.

---

### Task 1: Freeze the approved mobile composition as RED contracts

**Files:**
- Create: `tests/mobile-hd-remake.test.js`
- Modify: `tests/mobile-v1.test.js`
- Modify: `scripts/mobile-v1-smoke.mjs`
- Modify: `scenario-overrides.js`
- Test: `tests/scenario-overrides.test.js`

**Step 1: Write static RED assertions**

Assert that:

- `index.html` loads `style-mobile-hd.css` after `style-hd-boot.css`.
- `#mobileCommandDeck`, `#mobileHud`, `#mobileFuryMeter`, `#mobileDetailsButton`, the existing action IDs, and all four D-pad IDs exist once.
- visible skill/resource controls contain image assets and semantic labels, not single-letter primary text.
- the dedicated Fury component exposes `role="meter"`, current/max text, and a fill variable.
- the final mobile stylesheet defines a single-surface board, square playfield, visible D-pad, safe areas, 100vh/100dvh fallback, 48px targets, and no 300% mobile track.

**Step 2: Add deterministic fixture states**

Add `fury_seven_hd` to `scenario-overrides.js`. It starts an HD run with effective Fury 7/7 by using canonical max-Adrenaline and Fury Blessing state. Add `defeat_hd` only if no existing deterministic terminal fixture can cover the final defeat surface.

**Step 3: Extend browser metrics**

Measure:

```js
{
  viewport,
  playfield,
  canvas,
  commandDeck,
  dpadButtons,
  skillButtons,
  fury: { text, meterFill, box },
  menu,
  documentOverflow,
  intersections
}
```

Add 844x390 and 844x288 touch profiles. Assert playfield width/height differ by at most one pixel, the playfield is left of the deck, every touch target is at least 48px, and Menu intersects no control.

**Step 4: Run RED**

Run:

```powershell
node --test tests/mobile-hd-remake.test.js tests/mobile-v1.test.js tests/scenario-overrides.test.js
node scripts/mobile-v1-smoke.mjs --profile iphone
```

Expected: failures for missing mobile command deck, missing final stylesheet, hidden D-pad, old letter controls, absent Fury meter/fixture, and current 144px/246px geometry.

### Task 2: Build the semantic mobile command deck

**Files:**
- Modify: `index.html`
- Modify: `game.js`
- Modify: `scripts/build-pages-v3.mjs` only if its exact source anchors require synchronization
- Test: `tests/mobile-hd-remake.test.js`

**Step 1: Add the command-deck markup**

Add one `#mobileCommandDeck` inside `.board`. It contains:

- compact Depth/room context;
- HP, Shield, and Barrier meter elements;
- fixed Fury icon + numeric meter;
- Run Gold;
- Menu and Details buttons;
- three existing skill buttons with HD `<img>` art, visible names, and status spans;
- Potion and Elixir image buttons with count spans;
- Interact/Descend and Extract buttons;
- the existing four-way `.mobile-dpad` and restart action.

Preserve IDs `mbtnZ/X/C/F/G/E/Q`, `mbtnUp/Down/Left/Right`, and `mbtnR`. Give each control a canonical `data-action-key`.

**Step 2: Add a mobile HUD view model**

Create a small pure helper inside `game.js`, for example:

```js
function getMobileHudViewModel() {
  return {
    depth: state.depth,
    hp: { value: hp, max: maxHp },
    shield: { value: shield, max: shieldMax },
    barrier: { value: barrier, max: barrierMax },
    fury: {
      value: getEffectiveAdrenaline(),
      max: getEffectiveMaxAdrenaline()
    },
    gold: getDisplayedRunGold(),
    potion: { value: potionNow, max: potionMax },
    elixir: { value: loadoutCharges, max: ELIXIR_STACK_MAX },
    skills,
    context
  };
}
```

Share calculations with `updateRoomVitalRails()`/`buildSkillsBar()` rather than introducing different gameplay rules.

**Step 3: Render state without changing actions**

Update text, ARIA values, fill variables, disabled classes, images, skill state, and context labels in `syncMobileCommandDeck()`. Always render Fury as icon + `value/max` + fill percentage; never `Array.from({length: furyMax})` in the mobile component.

`mbtnE` may display Interact, Merchant, Forge, Pact, or Descend according to canonical state. `mbtnQ` remains Extract. Every press continues through `dispatchCanonicalMobileKey()`.

**Step 4: Make the D-pad primary and canvas touch secondary**

Keep the existing D-pad bindings and board cardinal adapter. Confirm D-pad direction during Dash uses `tryUseDashSkill`, and movement uses `tryMove`. Keep pointer ownership, cancel/leave/orientation cleanup, bounded repeat, and turn locks.

**Step 5: Run GREEN for DOM/runtime contracts**

Run:

```powershell
node --test tests/mobile-hd-remake.test.js tests/mobile-v1.test.js
node --check game.js
node --check scripts/build-pages-v3.mjs
```

Expected: semantic HUD/action tests pass; geometry remains RED until Task 3.

### Task 3: Replace compact mobile-v1 CSS with the final HD landscape layer

**Files:**
- Create: `style-mobile-hd.css`
- Modify: `style.css`
- Modify: `index.html`
- Test: `tests/mobile-hd-remake.test.js`
- Test: `scripts/mobile-v1-smoke.mjs`

**Step 1: Remove the stale compact composition**

Remove or reduce the `style.css` mobile-v1 block that owns the 300% swipe track, 33.333% board, 36/246/72 rows, hidden D-pad, bottom skill strip, and generic letter dock. Keep reusable orientation/accessibility rules only if they do not compete with the new sheet.

**Step 2: Load the final sheet last**

Add `style-mobile-hd.css` after `style-hd-boot.css`. Scope it to `body.mobile-touch.mobile-landscape` and use the existing CSS variables/assets.

**Step 3: Implement square playfield geometry**

Define a single landscape board with:

```css
--mobile-command-width: clamp(220px, 29vw, 280px);
--mobile-playfield-size: min(
  576px,
  calc(100dvh - var(--mobile-safe-top) - var(--mobile-safe-bottom) - 16px),
  calc(100vw - var(--mobile-safe-left) - var(--mobile-safe-right) - var(--mobile-command-width) - 24px)
);
```

Use `aspect-ratio: 1` for `.room-stage`, `.canvas-wrap`, and the displayed canvas. Reuse `board-frame.png`. Ensure the command deck consumes remaining width without changing the square.

**Step 4: Style the command deck**

- horizontal compact HP/SH/BR meters;
- stable Fury meter that fits 7/7;
- three illustrated skill controls with visible name/status;
- illustrated Potion/Elixir counts;
- labeled context controls;
- true 3x3 D-pad cross with four real arrow images and an empty center;
- Menu/Details in reserved header slots;
- 48px minimum targets and safe-area clearance.

At `max-height: 320px`, collapse descriptions and decorative padding before reducing the board or target size.

**Step 5: Resolve canvas sizing authority**

Update the mobile branch of `updateCanvasScale()` so the square container owns CSS display size. Preserve desktop integer scaling behavior and canvas backing/render mode. Pointer-to-logical coordinate mapping must continue to use the actual canvas rect.

**Step 6: Run geometry GREEN**

Run:

```powershell
node scripts/mobile-v1-smoke.mjs --profile iphone
node scripts/mobile-v1-smoke.mjs --profile android
node --test tests/mobile-hd-remake.test.js tests/mobile-v1.test.js tests/ui-polish.test.js
```

Expected: square room, visible four-way D-pad, Fury 7/7 fits, no intersections/overflow, and targets at least 48px at 844x390 and 844x288.

### Task 4: Adapt all mobile overlays to the current HD UX

**Files:**
- Modify: `style-mobile-hd.css`
- Modify: `game.js` only for missing semantic wrappers/action attributes/focus behavior
- Modify: `scripts/mobile-v1-gallery.mjs`
- Test: `tests/mobile-hd-remake.test.js`

**Step 1: Write overlay RED assertions**

For Main Menu, Options, Tutorial, Camp, Merchant, Forge, Pact, relic draft, extract confirmation, defeat, victory, and records assert:

- outer overlay fits safe viewport;
- title and primary close/back/confirm are reachable;
- only the content pane scrolls;
- no action relies on a keyboard-only hint;
- focus enters and returns;
- no document overflow or page/console errors.

**Step 2: Add mobile HD overlay composition**

Reuse the existing HD menu, sanctuary, panel, icon, and row assets. Add mobile-scoped layouts instead of copying business logic:

- Main Menu/Options/Tutorial: compact one-column sheet.
- Camp: fixed header, scrollable content, sticky `Start Next Run`.
- Merchant: compact row/list with wallet and sticky Back.
- Forge/Pact: mode/offer cards that fit initially, scrollable choices, sticky Leave/Confirm.
- Relic/death/victory/records: responsive HD cards with reachable navigation.

**Step 3: Run scenario gallery**

Run the gallery for gameplay, Menu, Camp, Forge, Merchant, Pact, terminal states, and portrait rotation at both landscape heights. Open every screenshot and fix P0/P1/P2 differences.

### Task 5: Design QA against the approved target

**Files:**
- Create: `design-qa-mobile-hd.md`
- Modify: product files only when the comparison finds P0/P1/P2 issues

**Step 1: Capture matching evidence**

Capture `fury_seven_hd` gameplay at 844x390 and 844x288. Compare each against `docs/design-references/mobile-hd-remake-approved.png` in a side-by-side composite.

**Step 2: Review fidelity**

Check:

- square room scale and visual priority;
- right command-deck hierarchy;
- D-pad ergonomics and separation;
- real skill/resource art;
- readable HP/SH/BR/Fury/Gold;
- no key-letter grid;
- current gothic HD materials;
- no clipping or accidental overlap.

Write `design-qa-mobile-hd.md` and iterate until it says `final result: passed`. P3-only polish may remain documented.

### Task 6: Final verification without release actions

**Files:**
- Inspect all intended diffs
- Update: `progress.md` with the original current prompt, completed scope, checks, and remaining P3 notes without deleting historical entries

Run exactly once where relevant:

```powershell
node --check game.js
node --check scenario-overrides.js
node --check scripts/mobile-v1-smoke.mjs
node --check scripts/mobile-v1-gallery.mjs
node --test tests/mobile-hd-remake.test.js tests/mobile-v1.test.js tests/ui-polish.test.js tests/scenario-overrides.test.js tests/pages-test-build-metadata.test.mjs
node scripts/mobile-v1-smoke.mjs --profile all
npm run verify:guard
npm run verify:ui-current -- --scenario hd
npm run verify:baseline
git diff --check
git status --short
```

Expected: all focused and required baseline checks pass; desktop HD remains unchanged; build identity remains `GAME_VERSION · generated short commit · generated commit date`; no deployment, commit, push, merge, version bump, ruleset activation, or production change occurs.
