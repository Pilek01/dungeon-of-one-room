# Mobile Portrait-First Experience Design

## Status

Approved by the current user brief on 2026-08-12. The brief explicitly authorizes autonomous design decisions and repeated implementation/playtest cycles inside `codex/mobile-v1`.

## Problem

The existing touch experience is a polished landscape adaptation, not a complete mobile product. Portrait devices are blocked by a rotate dialog, contextual hubs inherit desktop composition in several flows, and important terminal/reward screens lack a deliberate mobile hierarchy. Green structural tests therefore overstate the quality of the player journey.

## Options considered

1. Keep landscape mandatory and polish the existing command deck. Lowest risk, but it directly fails the portrait-primary requirement and leaves the largest UX defect untouched.
2. Build a separate mobile DOM/application shell. It offers maximum visual freedom, but duplicates state, focus, input, and overlay behavior and creates long-term divergence risk.
3. Recompose the existing canonical DOM by orientation. This keeps one game state, one input dispatcher, one overlay router, and one accessibility model while giving portrait and landscape independent layouts. This is the selected approach.

## Visual direction

The mobile product keeps the established Abyssal Gothic identity: blackened iron, dark stone, aged silver edges, restrained antique gold, real relic/skill/resource art, engraved small-caps labels, and purposeful state glow. It must not become a generic rounded mobile dashboard.

Existing authoritative assets are reused rather than recreated: board/menu frames, panel texture, section plaques, mobile D-pad plate/arrows, skill art, status icons, and sanctuary backgrounds. CSS controls layout and nine-slice framing; raster assets are never stretched into the wrong aspect ratio.

## Gameplay shell

Portrait is the default touch layout. The existing `.board` becomes a three-zone vertical game shell:

1. A compact full-width command header and HUD shows location, HP, shield, barrier, Fury, gold, Stats, and Menu.
2. The square room board occupies the visual center and remains unobstructed.
3. A bottom thumb zone holds the four-way D-pad on the left and a two-column action bank on the right. Dash, Shockwave, Shield, Potion, Elixir, and contextual Interact occupy three rows; Extract spans the final row. All visible targets remain at least 48 CSS pixels.

The same DOM IDs and canonical dispatch paths remain authoritative. Portrait does not create alternate gameplay behavior. Nonessential status ribbons are visually suppressed; consumable counts remain available. Safe-area padding and `100dvh` keep controls clear of browser chrome.

Landscape retains the existing approved split composition. Tablet touch may scale the same touch composition without stretching controls. Fine-pointer desktop and narrow no-touch keep the desktop/keyboard experience and must never expose an offscreen touch dock.

## Full-screen contextual surfaces

On touch devices, `#screenOverlay` is a true viewport layer. Each major screen owns:

- a location/title header;
- one bounded content scroller;
- clearly selected and disabled states;
- a persistent primary/back action region above the safe area;
- no root-page scrolling and no nested scroll traps.

Camp keeps its stat summary and tab model, with the item grid as the sole scroller and Start Next Run persistent. Forge uses a strong mode/reward hierarchy, a dedicated relic scroller, and persistent Leave/claim actions. Merchant uses a single offer/buyback scroller, always-visible wallet/context, and persistent Back. Pact, reward draft, relic exchange, extraction, death, victory, records, nickname, and confirmations use the same shell rules but retain feature-specific compositions.

## Interaction and accessibility

- Native buttons are preferred; delegated custom rows must activate the focused row with Enter/Space and must not fall back to a stale keyboard index.
- Modal focus stays inside `#screenOverlay`; the underlying game is inert and focus returns to the initiating control.
- Touch copy replaces keyboard-only instructions without removing desktop shortcuts.
- Important state changes use the single atomic status region; static HUD surfaces are not chatty live regions.
- Reduced motion removes nonessential transitions, sweeps, pulses, and rarity animation.
- Selected, pressed, disabled, cooldown, unaffordable, and destructive states are visibly distinct without relying on color alone.

## Responsive targets

Primary portrait acceptance sizes are 360x640, 390x844, and 430x932 CSS pixels. Secondary coverage includes 844x390, 844x288, 800x360, 768x1024, 1280x800 tablet touch, 1280x800 hybrid touch laptop, 390x844 fine-pointer, and 1440x900 desktop.

## Verification strategy

Every implementation pass follows RED -> GREEN -> browser interaction -> screenshot inspection -> independent audit. Required visual evidence includes gameplay, Camp, Forge, Merchant, reward/choice, a dense state, and the small phone. Runtime assertions cover geometry, target sizes, safe areas, scroll ownership, sticky actions, focus/inert behavior, canonical action dispatch, desktop preservation, and browser errors.

The stopping gate is two consecutive independent audits with no Critical or Important issues, plus focused tests, all-profile mobile smoke, current-tree HD verification, baseline verification, guard verification, and `git diff --check`.
