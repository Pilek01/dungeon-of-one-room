# Mobile Gothic UI Audit — 2026-08-11

## Scope and evidence

Fresh current-tree screenshots were captured at 844×390 with a real touch/mobile browser profile:

- `output/mobile-v1-gallery/01-gameplay.png`
- `output/mobile-v1-gallery/01b-fury-seven.png`
- `output/mobile-v1-gallery/05-mobile-menu.png`
- `output/mobile-v1-gallery/02-camp.png`
- `output/mobile-v1-gallery/03-forge.png`
- `output/mobile-v1-gallery/04-merchant.png`

The structural mobile HD remake is healthy: the 9×9 field is square and readable, the command deck is reachable, the D-pad is present, Fury 7/7 fits, and the main Camp/Forge/Merchant flows fit the viewport. The failure is visual consistency rather than navigation architecture.

## Findings

1. **Gameplay command deck — inconsistent visual language.** Stats, Menu, D-pad and all action buttons are generic blue rounded rectangles. They do not reuse the blackened iron, aged silver, gold, stone and framed skill language of the current PC HD UI.
2. **Action hierarchy — keyboard-era residue.** Skill art is present, but the shared blue tiles dominate it. Interact/Extract and Restart still foreground keyboard-era key/glyph treatments instead of semantic gothic controls.
3. **Camp — good structure, flat components.** The sanctuary background and sticky action work, but tabs, relic rows and the primary CTA look like flat dashboard blocks rather than carved plaques and framed inventory rows.
4. **Forge — split personality.** The sanctuary background and lower board frame are gothic; the mode cards, status cells and selection state are flat and visually detached.
5. **Merchant — readable but utilitarian.** The repaired full-width buyback grid is legible, yet wallet cells, summary, item rows and sell controls lack the textured frames and rarity/action states of the PC merchant.
6. **Menu — closest to target.** It already uses `menu-frame.png` and panel texture. Row/key treatment still needs the same touch-sized component language used elsewhere.
7. **Unskinned mobile surfaces.** Options, Tutorial, confirmations, nickname, records, Pact, relic drafts, extraction, defeat and victory largely fall back to generic/classic mobile cards because the authoritative HD styles are gated to desktop widths.
8. **Touch-size drift.** Several menu rows and Camp tabs are below the 48px target specified by the mobile design.

## Root cause

`style-mobile-hd.css` solved layout and reachability, but it implements multiple one-off visual systems. The PC HD surface styles are mostly wrapped in desktop-only media queries, so mobile receives a mix of sanctuary backgrounds, generic gradients and classic overlay cards. There is no final, shared mobile gothic component layer loaded after all HD styles.

## Decision

Keep the approved mobile geometry and canonical action routing. Add one final `style-mobile-gothic.css` layer loaded last, backed by real game assets and two purpose-built raster assets:

- `assets/hd/ui/mobile/gothic/gothic-button-frame.png`
- `assets/hd/ui/mobile/gothic/gothic-dpad-plate.png`

The target reference is `docs/design-references/mobile-gothic-ui-approved.png`.

## Out of scope

- gameplay rules or balance
- desktop/fine-pointer composition
- Ranked/debug-only surfaces
- deploy, release, merge or version bump
