# Mobile Gothic UI Design

## Goal

Make every player-facing mobile control and overlay look native to the current PC HD game while preserving the accepted mobile v2 layout, full D-pad, square 9 x 9 field, canonical inputs and touch-operable flows.

## Considered approaches

### A. CSS-only recolor

Recolor existing gradients and borders. Lowest risk, but it keeps the visibly generic geometry and cannot achieve the PC frame quality.

### B. Shared gothic component layer + real assets — selected

Add one final mobile stylesheet. Reuse `panel-texture.png`, `menu-frame.png`, `section-plaque.png`, sanctuary backgrounds, skill/status art and rarity frames. Use purpose-built transparent gothic button and D-pad assets only where the repository has no suitable source. This gives a coherent result without changing state or flow logic.

### C. Full bespoke atlas per screen

Potentially richest art, but expensive, brittle under localization/state changes and unnecessary because the project already has strong HD assets and semantic markup.

## Visual language

- blackened iron and dark stone as the base
- aged silver bevels and restrained antique-gold focus/primary accents
- arcane blue only for skills, red for potion, teal for elixir, amber for context, crimson for danger
- compact engraved uppercase labels; keyboard hints remain secondary
- no generic blue rounded rectangles, neon sci-fi, emoji or placeholder glyph art

## Component system

### Gameplay controls

- Stats/Menu: framed plaque buttons with clear focus/pressed state
- D-pad: one ornamental iron plate, existing real arrow asset, four independent ≥48px hit targets
- skills/resources: framed real artwork, readable semantic name, compact state/count, rarity/state accent
- Interact/Extract/Restart: semantic labels and variants; keys secondary
- Fury/HP/SH/BR/Gold: existing values preserved; styling brought into the same plaque/rail family

### Shared overlays

- viewport-safe fixed dimmer
- gothic frame + panel texture
- title plaque, one deliberate scroll region and sticky action footer
- rows, tabs, key tiles and CTAs use the same component tokens
- all primary actions and tabs ≥48px

### Surface variants

- Main/Pause/Options/Tutorial/dialogs/records/nickname: menu-frame family
- Camp: ember sanctuary, gothic tabs/inventory rows, sticky Start Next Run
- Forge: anvil sanctuary, framed Temper/Transmute choices, sacrifice/reward states, sticky Leave/Confirm
- Merchant: curio sanctuary, framed wallet/summary/item rows, explicit price/action/disabled states
- Pact/relic drafts/extract/death/victory: board/menu frames with semantic danger/reward accents

## Interaction and accessibility

- preserve existing IDs, `data-action-key` contracts and canonical handlers
- visible keyboard focus, pressed and disabled states
- no color-only meaning; labels remain visible
- reduced-motion support
- portrait rotate gate, safe areas and dvh behavior unchanged
- desktop/fine-pointer styles remain unchanged

## Visual source

`docs/design-references/mobile-gothic-ui-approved.png` is the strict normalized
fidelity target for the gameplay command deck. Treat the asset as an exact
844 x 390 comparison canvas, not as a directional mood board: every fresh
capture must be normalized to 844 x 390 before review, and the board geometry,
HUD/deck proportions, control placement, frame continuity, material treatment,
icon scale and label hierarchy are all authoritative. The current 9 x 9 board
and accepted touch density remain functional constraints, but they do not
override a visible mismatch against this target.
