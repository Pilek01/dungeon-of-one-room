# Ranked rank glyph polish — implementation plan

> **Execution mode:** inline, with Luna audit results already incorporated and a final independent review. The raster edit remains under Sol integration control because it must be visually accepted against the current plate.

**Goal:** Improve the baked leaderboard numerals `1` and `3`, and make the dynamic player rank in Inspect build readable and optically centered, without changing Ranked data, ordering, accessibility, or gameplay.

**Design source:** `docs/superpowers/specs/2026-08-09-ranked-rank-glyph-polish-design.md`

## Scope and invariants

- Preserve the 1536×1080 leaderboard plate and every non-numeral visual region.
- Keep the good baked `2` as the visual reference.
- Keep desktop podium DOM numerals hidden; accessible `Rank 1`, `Rank 2`, and `Rank 3` labels remain intact.
- Keep Inspect rank dynamic for one- and two-digit positions.
- Do not change leaderboard data, scores, ordering, APIs, Worker code, gameplay, or deployment state.
- Do not touch the pre-existing unstaged `AGENTS.md` user diff.

## Task 1 — Add failing visual regressions

**Files:**

- Modify: `tests/ranked-v3-reference-plate-assets.test.js`
- Modify: `scripts/online-v3-ranked-headed.mjs`
- If needed, modify: `tests/ranked-v3-reference-plate-style.test.js`

### Steps

1. Extend the PNG test helpers with a bounded bright-pixel measurement for the baked numeral regions.
2. Add contour assertions that detect the current short/misaligned `1` and especially the short `3`, while retaining the existing presence/contrast assertions.
3. Extend the headed Inspect audit with computed rank font size and rendered bounding-box dimensions.
4. Require a visibly readable single-digit rank at 1536×1080. Keep the threshold tolerant enough for Windows font rasterization and future one/two-digit values.
5. Run the focused asset test and the Ranked lifecycle once and capture the expected RED failures before changing production files.

**RED commands:**

```powershell
node --test tests/ranked-v3-reference-plate-assets.test.js tests/ranked-v3-reference-plate-style.test.js tests/ranked-v3-leaderboard-ui.test.js
npm run verify:ranked-headed -- --scenario lifecycle
```

## Task 2 — Retouch baked leaderboard numerals

**File:**

- Modify: `assets/hd/ui/ranked-reference-plates/ranked-leaderboard-desktop-plate.png`

### Steps

1. Use the existing plate as the image-edit source.
2. Retouch only the baked `1` and `3` glyph regions:
   - match the engraved metallic serif language, stroke hierarchy, brightness, and cap height of the existing `2`;
   - center `1` optically and remove its tall/bottom-heavy appearance;
   - make `3` full-height, balanced, and clearly formed;
   - preserve plaque borders, texture, frame, empty content regions, dimensions, and transparency/colour mode.
3. Reject and retry any generated result that materially changes non-numeral areas.
4. Visually compare magnified crops of `2`, `1`, and `3` before accepting the asset.
5. Run the focused asset regression and confirm GREEN.

## Task 3 — Calibrate the dynamic Inspect rank

**File:**

- Modify: `style.css`

### Steps

1. Change only `.ranked-v3-inspect-rank` desktop-HD styling.
2. Increase the rank from the current `1.65cqw` to approximately `2.3–2.5cqw`, using the smallest value that gives a strong readable glyph.
3. Raise it slightly from the current `top: 76%` so the ink is optically centered in the plaque.
4. Use a stronger lining-serif stack/weight, restrained warm engraved colour, and subtle shadow. Preserve sufficient width for two-digit ranks.
5. Do not change `.ranked-v3-leaderboard-rank`, `.ranked-v3-rank-label`, or the Inspect plate asset.
6. Run the headed lifecycle and inspect the produced leaderboard and Inspect screenshots at 1536×1080.

## Task 4 — Verification and integration review

### Focused checks

```powershell
node --test tests/ranked-v3-reference-plate-assets.test.js tests/ranked-v3-reference-plate-style.test.js tests/ranked-v3-leaderboard-ui.test.js
node --check scripts/online-v3-ranked-headed.mjs
npm run verify:ranked-headed -- --scenario lifecycle
git diff --check
```

### Manual receipt checks

- Podium: `2` remains unchanged; `1` and `3` have balanced contours and matching material treatment.
- Inspect build: rank is readable, centered, and visually belongs to its plaque.
- Podium DOM numerals remain `display: none`; accessible rank labels remain present.
- No clipping at 1536×1080 and no unexpected change outside the intended glyph masks.

### Git integration

1. Read full `git status --short` and exact diffs.
2. Stage only the explicit implementation/test files.
3. Create a local commit only after all required checks pass.
4. Leave `AGENTS.md` unstaged and unmodified by this task.
