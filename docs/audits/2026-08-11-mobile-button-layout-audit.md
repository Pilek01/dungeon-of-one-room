# Mobile Button Layout Audit

## Scope and evidence

This audit covers only the in-run touch command deck in landscape mobile mode:
the D-pad, seven action buttons, Stats/Menu controls, and the space they consume
beside the square playfield. It does not redesign gameplay rules, desktop HD,
Camp, Forge, Merchant, or other overlays.

Fresh evidence captured on 2026-08-11:

- `output/mobile-v1-gallery/01-gameplay.png` at 844 x 390 CSS px.
- `output/mobile-v1/iphone-gameplay.png` and `output/mobile-v1/summary.json`.
- `output/mobile-button-audit/00-current-vs-approved.jpg`, which places the
  current implementation beside `docs/design-references/mobile-gothic-ui-approved.png`.

## Verdict

The current button skin uses the correct game assets, but the composition is
not acceptable. The problem is the fixed 210 px control shelf layered over a
much taller command deck. At normal phone height the controls collapse against
the bottom while the middle of the deck is empty, making the playfield smaller
without using the sacrificed space.

## Measured findings

| Finding | 844 x 390 | 844 x 288 | Impact |
| --- | ---: | ---: | --- |
| Command deck | 337.6 x 376 | 337.6 x 274 | The deck consumes about 40% of viewport width. |
| Control shelf | 337.6 x 210 at y=173 | 337.6 x 210 at y=71 | A fixed height creates about 102 px of dead space only on the normal-height phone. |
| Action dock | 171.6 x 204 | 175.6 x 204 | Action rows never use added vertical space. |
| D-pad | 146 x 146 | 146 x 146 | It stays pinned to the lower shelf instead of centering in the available command area. |
| Extract row | one half-width 48 px tile | one half-width 48 px tile | The empty sibling cell makes the panel look unfinished. |
| Playfield | 354 x 354 | 252 x 252 | The wide deck is only justified if its full height is useful. |

## Severity-ranked issues

1. **P1 — large dead command area.** `#mobileCommandDeck` reserves 210 px with
   bottom padding and `#mobileControls` is fixed to the same height. This fits
   844 x 288, but leaves a visually dominant black void at 844 x 390.
2. **P1 — broken final action row.** Seven buttons are auto-placed into a 2 x 4
   grid, leaving the cell beside Extract empty. The asymmetry reads as a missing
   control rather than intentional emergency hierarchy.
3. **P1 — no responsive reward for a taller screen.** Button rows stay 48 px and
   icons stay 29 px even when more than 100 px of vertical room is available.
4. **P2 — weak grouping.** The D-pad and action bank are visually a bottom bar,
   not two balanced control instruments inside one Gothic command console.
5. **P2 — equal visual weight.** Combat skills, consumables, contextual action,
   and emergency extraction all use nearly identical tile weight. The full-row
   Extract control should be deliberately separated while the six regular
   actions remain a balanced 2 x 3 bank.

## Selected repair direction

Use the previously approved Gothic reference as the source of truth:

- keep the existing square playfield and command-deck width;
- preserve the real D-pad plate, button frame, skill art, potion/elixir icons,
  and every existing DOM ID/canonical handler;
- make the control layer fill the command deck from the HUD to the bottom;
- center the D-pad in the left half;
- stretch the action bank through the available height in the right half;
- span Extract across both columns in the last row;
- scale D-pad cells from 48 to 52 px and action art from 29 to 36 px only when
  height allows, while retaining 48 px targets at 844 x 288;
- preserve safe-area, pointer-event, portrait, desktop, and fine-pointer paths.

## Evidence limits

Screenshot and computed-geometry evidence can verify hierarchy, clipping,
spacing, and target size. Physical-device follow-up is still needed for hand
comfort, left-handed preference, and long-session fatigue.
