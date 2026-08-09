# Ranked Rank Glyph Polish Design

## Approval Basis

The user requested an audit and correction of rank `1`, rank `3`, and the player rank shown in Inspect Build, then explicitly granted full implementation discretion. This document records the selected minimal design so the work can continue unattended.

## Root Cause

The desktop HD leaderboard and Inspect Build use two different rendering paths:

- Podium numerals `2`, `1`, and `3` are baked into `ranked-leaderboard-desktop-plate.png`. The live podium rank spans are intentionally hidden on desktop HD. The reported shape defects in `1` and `3` are therefore raster contour and optical-registration defects, not DOM or CSS defects.
- Inspect Build renders a dynamic `.ranked-v3-inspect-rank`. Its current Georgia glyph is approximately half the visual height and width of the plaque numeral reference and sits too low in the mount.

## Selected Design

Retouch only the baked podium `1` and `3`, using the existing `2` as the visual reference. Preserve the full 1536 x 1080 plate, all chrome, medallions, plaque geometry, colors, texture, and every pixel outside the two numeral regions as closely as the image workflow permits. The corrected numerals must be centered, share the `2`'s metallic engraved serif language, have comparable cap height and stroke weight, and remain distinct in gold and bronze.

Keep the baked podium architecture and hidden accessible DOM ranks unchanged.

For Inspect Build, retain the dynamic text node so ranks `1` through `73` remain supported. Change only its desktop HD typography and optical position: use a stronger lining serif, increase the glyph to fill the plaque similarly to the baked reference, raise it slightly, and add restrained engraved contrast. Do not affect the player name, score, stats, mobile layout, or leaderboard ledger ranks.

## Success Criteria

- Podium `1` no longer appears excessively tall, bottom-heavy, or off-center.
- Podium `3` has balanced upper and lower bowls and matches the visual height of `2`.
- Inspect Build rank is centered, visibly stronger, and readable for one- and two-digit ranks without escaping its plaque.
- Podium DOM ranks remain hidden in desktop HD and accessible labels remain present.
- The leaderboard asset remains a 1536 x 1080 PNG and the Inspect plate asset remains unchanged.

## Verification

- Extend focused asset tests so the two retouched regions retain sufficient contrast and the untouched `2` remains the reference.
- Add headed geometry assertions for Inspect rank font size, plaque-relative center, and bounds; first demonstrate the current glyph fails those constraints.
- Run the focused Ranked UI, plate style, and plate asset tests.
- Run exactly the Ranked headed lifecycle scenario and visually inspect both refreshed screenshots at 1536 x 1080.
- Run JavaScript syntax checks for changed scripts and `git diff --check`.

## Scope

Allowed changes are limited to the leaderboard plate PNG, Inspect rank desktop CSS, focused tests, headed visual audit assertions, and documentation/receipts needed for this correction. No Ranked data, ordering, scoring, pagination, build contents, gameplay, Worker, protocol, or deployment behavior changes.
