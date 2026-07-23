# Player mobile render-scale correction

## Decision

Render the existing 64×64 player frame at 80×80 HD canvas pixels, bottom-centered on the same logical 64 px tile. Keep all source sheets, final PNGs, anchors, semantic keys, animation selection, gameplay coordinates, hitboxes, action timing, turn timing, and simulation behavior unchanged.

## Rationale

The 576 px HD canvas is displayed at about 289 px on the 390×844 mobile viewport. Native one-tile rendering therefore halves the already narrow sword and dark silhouette. Increasing only the presentation size to 80 px improves the mobile body and weapon footprint while retaining the established actor-overhang model and bottom-center root. A contrast rim would alter the approved material treatment, while a slash cue belongs to the later VFX task.

## Verification

Update the player-layer draw contract first and observe its RED at the old 64 px geometry. Then introduce one player render-size constant, run the focused player suite and full regression, and repeat desktop/mobile gameplay captures. Acceptance requires HD mode, zero console errors/warnings, stable bottom-center placement, no HUD collision, and materially clearer mobile attack direction.
