# HD Mine Visibility Design

## Goal

Restore visual parity with the Classic renderer by making every HD mine visible before and after arming, while making its danger state immediately readable.

## Compatibility contract

- Preserve the existing `state.mines`, `armed`, and `fuseTurns` gameplay fields.
- Preserve mine placement, triggering, countdown, damage, saves, input, and AI behavior.
- Keep all Classic assets, menu behavior, soundtrack files, and audio code unchanged.
- Keep `hazard.common.mine.armed` and add only the matching HD semantic key `hazard.common.mine.unarmed`.

## Visual construction

Both states use the same 64 x 64 transparent canvas, alpha silhouette, position, and static metal housing. The deterministic Descent asset builder derives both variants from the approved mine source:

- Unarmed: dark metal housing with a clearly visible but unlit central lens.
- Armed: the same housing with a bright orange-red emissive core.

The renderer selects the variant from `mine.armed`. It never hides a valid mine. Existing HD VFX continues to provide the armed pulse and final-turn blast-area warning; the sprite itself does not bob, resize, or change anchor.

## Verification

Automated tests first reproduce the regression by requiring an unarmed mine draw call. Asset tests require both manifest entries and PNGs, matching alpha bounds/silhouettes, meaningful pixel difference in the central lens, and a deterministic locked rebuild. Browser QA captures one unarmed and one armed mine in HD, checks the gameplay text state, and confirms no console errors. The complete suite and audio freeze run before completion.
