# Mobile HD Remake Design

**Status:** Approved by the user on 2026-08-10.

**Visual target:** `docs/design-references/mobile-hd-remake-approved.png`

## Goal

Replace the compact mobile-v1 shell with a mobile-first adaptation of the current desktop HD experience. The game remains a browser game, portrait remains orientation-gated, the room remains an undistorted 9x9 square, and the desktop layout and gameplay rules remain unchanged.

## Approved composition

- The room is a true 1:1 square. Its size is derived from the real visual viewport height and the width remaining after the command deck. The renderer must never widen, crop, or distort the 9x9 room.
- In landscape, the framed room occupies the left side and is the largest single element. The right side is an intentional command deck, not leftover space.
- The command deck contains the compact combat HUD, three illustrated skill controls, potion and elixir controls, Interact/Descend and Extract actions, a full four-way D-pad, Menu, and a details entry point.
- The D-pad is mandatory. It uses a true cross layout with Up, Down, Left, and Right, no center action, at least 48x48 CSS px targets, and no overlap with Menu or other actions.
- Tap/hold movement on the room remains as an optional secondary input. Both input paths reuse the canonical `tryMove` and Dash direction logic.
- The old Z/X/C/F/G/E/Q letter grid is removed as the visible information architecture. Existing IDs and canonical key dispatch may remain underneath, but the visible controls use real art, names, state, and counts.

## HUD model

The mobile HUD reuses the current game state and the same calculations used by `buildDepthBadge`, `buildSkillsBar`, and `updateRoomVitalRails`.

- HP, Shield, and Barrier render as readable horizontal meters with current/max values.
- Depth, room/boss context, Run Gold, and Menu remain visible without covering the room.
- Dash, Shockwave, and Shield use the existing HD skill art and canonical states: READY, ARMED, ACTIVE, cooldown turns, and shield charges.
- Potion and Elixir use the existing `status/potion.png` and `status/elixir.png` assets and show counts such as `3/5` and `2/3`.
- Fury uses one fixed `status/fury.png` icon, a numeric `current/max` label, and a short fill meter. It never renders one mobile pip per maximum stack. This keeps `3/3`, `5/5`, and relic/blessing-enhanced `7/7` geometrically identical.
- The numeric Fury value uses `getEffectiveAdrenaline()` and `getEffectiveMaxAdrenaline()`, while its tooltip explains stored Fury and blessing bonuses.

## Responsive geometry

The landscape shell uses safe-area insets and `visualViewport`/dynamic viewport measurements.

- Primary profile: 844x390 CSS px.
- Chrome-reduced profile: approximately 844x288 CSS px.
- Android profile: 800x360 CSS px.
- Large coarse-pointer landscape: up to the supported mobile boundary without changing fine-pointer desktop behavior.
- The playfield variable is equivalent to `min(576px, available viewport height, width remaining after the command deck)` and keeps `aspect-ratio: 1`.
- The command deck is approximately `clamp(220px, 29vw, 280px)` but may use the wider remaining area on very wide phones.
- At low heights, secondary descriptions collapse before icons, names, state, counts, or 48px hit targets. The board is not sacrificed to preserve decorative copy.
- The old 300%-wide swipe carousel is not the primary landscape shell. Player/Info content remains reachable through a mobile details surface; desktop and fine-pointer narrow behavior remain intact.

## Visual system and assets

The mobile layer reuses current HD assets and markup wherever possible:

- `assets/hd/ui/abyssal-gothic/board-frame.png`
- `assets/hd/ui/abyssal-gothic/panel-texture.png`
- `assets/hd/ui/abyssal-gothic/section-plaque.png`
- `assets/hd/ui/abyssal-gothic/skill-dash.png`
- `assets/hd/ui/abyssal-gothic/skill-shockwave.png`
- `assets/hd/ui/abyssal-gothic/skill-shield.png`
- `assets/hd/ui/status/fury.png`
- `assets/hd/ui/status/elixir.png`
- `assets/hd/ui/status/potion.png`

One real arrow asset may be added for the D-pad and rotated for the four directions. No emoji, text-glyph arrows, generic blue gradients, or placeholder art are part of the final mobile surface.

## Menus and modal flows

Main Menu, Options, Tutorial, Camp, Merchant, Forge, Pact, relic draft, extraction confirmation, defeat, victory, and records remain canonical game flows. Mobile changes their composition, not their rules.

- Each overlay is body-fixed inside safe areas.
- The outer card always fits the visual viewport.
- Only the deliberate content region scrolls.
- Title and close/back/confirm actions remain visible or sticky.
- Core actions use at least 48px targets and explicit labels/prices/reasons.
- Focus enters the overlay and returns to the invoking control.
- Desktop HD overlay styling is unchanged.

## Architecture

1. Preserve the existing desktop DOM, runtime builders, input handlers, renderer, and game rules.
2. Add a dedicated mobile command-deck wrapper and mobile HUD values, hydrated from canonical state during `updateUi()`.
3. Keep existing button IDs and route every action through the current synthetic-key/canonical handlers.
4. Add `style-mobile-hd.css` after every HD stylesheet so it is the final mobile composition authority. Remove the stale compact mobile layout from `style.css` instead of adding more competing overrides.
5. Let the mobile container own display size while canvas backing/render mode remains authoritative; remove the current duplicate JS/CSS sizing conflict.
6. Use deterministic scenarios and browser geometry assertions as the implementation contract.

## Acceptance criteria

- The room is square to within one CSS pixel and never overlaps the command deck.
- At 844x390 the room uses the maximum safe height; at 844x288 it is materially larger than the current 144px baseline.
- Menu, D-pad, skill, resource, and context targets do not overlap and are at least 48px.
- Fury `7/7` fits without adding pips, wrapping, or resizing the HUD.
- Current desktop HD at 1440x1000 is visually and functionally unchanged.
- Gameplay, Menu, Camp, Forge, Merchant, Pact, extraction, death, victory, records, and portrait rotation are touch-operable with no console/page errors or document overflow.
