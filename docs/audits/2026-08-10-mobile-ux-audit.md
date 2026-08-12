# Mobile UX audit — 2026-08-10

## Verdict

**FAIL — the current mobile presentation layer should be replaced, not polished.**

The implementation is functionally touch-capable, but it is not a mobile adaptation of the current HD desktop UX. It is a compact shell layered over the old responsive structure. On the physical Android capture, the room is about 220×220 px and occupies roughly 10% of the usable game viewport. Persistent HP, Shield, Barrier, Fury, Elixir and Potion icon rails from the current desktop UI are hidden. Their place is taken by tiny fallback text and a letter-only Z/X/C/F/G/E/Q dock.

## Evidence

- Physical Android/Chrome: `output/mobile-remake-audit/accepted/01-physical-phone.jpg`
- Current desktop HD reference: `output/mobile-remake-audit/accepted/02-desktop-current-hd.png`
- Current mobile gameplay: `output/mobile-remake-audit/accepted/03-mobile-gameplay.png`
- Camp guide and panel: `04-mobile-camp-guide.png`, `05-mobile-camp-panel.png`
- Forge, Merchant, pause menu and portrait gate: `06-mobile-forge.png` through `09-portrait-rotate.png`
- Additional flow captures: `output/mobile-audit/`

## Current PC versus mobile

| Surface | Current desktop HD | Current mobile v1 | Result |
|---|---|---|---|
| Playfield | 552×552 canvas inside a 610×610 framed stage; dominant central surface | 246×246 at 844×390 emulation; ~220×220 in the physical capture | Critical hierarchy failure |
| Vitals | Persistent HP rail plus Shield/Barrier rails beside the room | Hidden; player must discover/swipe to another pane | Critical combat information missing |
| Resources | Real Fury, Elixir and Potion icon rails using current HD assets | Tiny `FURY`, `ELIXIR`, `POTIONS` text in a 36 px badge | Current PC UX discarded |
| Skills | HD rarity frames, art, full names and state/cooldown | 68 px clipped cards plus separate letter-only buttons | Duplicated and unreadable |
| Navigation | Desktop panels and keyboard copy make sense for PC | 300% swipe carousel with hidden hint; keyboard letters remain primary | Undiscoverable |
| Menu | Current ornate HD frame and selected-row treatment | Cropped/scrolling card, keyboard hints, stale menu trigger visible | Desktop fallback, not mobile design |
| Camp | Rich persistent progression surface | 2698 px inner scroll in a 366 px card; primary CTA far below fold | Task flow broken |
| Forge | Dedicated sanctuary with visible mode choices | 1108 px scroll; hero art consumes the first viewport | Primary decision hidden |
| Merchant | Structured current dashboard with compact rows | 1655 px scroll; giant rows and concatenated metadata | Inventory flow broken |

## Severity-ranked findings

### P0 — the game is not the primary surface

Mobile reserves a 36 px depth row, a 72 px skills row and a 112–152 px side dock. CSS then caps the room to `calc(100dvh - 144px)`. In a normal landscape browser with visible Chrome UI, the visual viewport is much shorter than the nominal screen, so the logical room collapses to approximately 145 CSS px / 220 physical px.

The mobile remake must make the square playfield consume **at least 88% of the current visual viewport height**. At a chrome-reduced ~844×288 CSS viewport that means roughly 270–276 px; at 844×390 it means roughly 350–374 px. Persistent controls must live beside or over the frame, not in vertical rows above and below it.

### P0 — current HD combat information is removed

`index.html` already contains HP, Shield/Barrier, Fury/Elixir and Potion rails. `style-hd-composition.css` hides them globally and re-enables them only at `min-width: 1201px`. Mobile never adapts or re-enables those components. The physical screenshot therefore has no persistent HP readout and replaces the current potion icons with `POTIONS 1/5` microtext.

### P0 — touch actions are keyboard legends

The dock shows Z/X/C/F/G/E/Q rather than Dash, Shockwave, Shield, Potion, Elixir, Interact and Extract. The visible names in the bottom skill cards are clipped. Menu overlaps the X target on the physical phone. Tap-near-player movement works technically but has no visible instruction or directional feedback.

### P0 — phase screens are desktop content inside a scroll box

Mobile overlays merely become body-fixed and scrollable. The actual HD Menu, Camp, Forge, Merchant, Pact and Defeat skins are still gated to desktop media queries. Measured content heights at an 844×390 touch viewport:

- Camp: 2698 px inside 366 px
- Merchant buyback: 1655 px inside 366 px
- Forge mode: 1108 px inside 366 px
- Pact: 865 px inside 366 px
- Tutorial: 888 px; Close is initially below the fold
- Main menu: 566 px; Tutorial and Options begin below the fold

Scrolling is not a substitute for a mobile information architecture. Primary actions require sticky placement and the screens need dedicated mobile compositions.

### P1 — conflicting canvas sizing and CSS cascade

JavaScript computes an integer canvas scale using one budget. Mobile CSS overrides the resulting inline size with `width/height: 100% !important` and a second, stricter height budget. The mobile block is appended to `style.css`, but HD styles are loaded after it, so the cascade is patched with more overrides instead of having one authoritative mobile composition layer.

### P1 — technical QA validated the wrong outcome

The current checks prove that buttons are at least 48 px, events route to canonical actions, the page does not overflow and the browser emits no errors/API calls. They do not enforce playfield share, visible HP, current-HD asset reuse, readable labels, non-overlap, above-fold task completion or physical-device legibility. A passing smoke result therefore approved a product failure.

## What should be retained

- portrait rotation gate and safe-area/`dvh` handling;
- capability-based touch detection;
- canonical board tap/hold movement, repeat cancellation and Dash direction semantics;
- canonical action dispatch and overlay action attributes;
- current HD renderers, skill/resource data and art assets;
- desktop HD layout unchanged;
- local LAN preview and real-touch test harness.

## What should be removed or replaced

- the compact mobile visual block in `style.css` (current 36/1fr/72 board rows);
- the 300% swipe carousel as the primary mobile navigation;
- the bottom three-card skill strip during active play;
- the static Z/X/C/F/G/E/Q visual dock;
- tiny fallback resource text and hidden desktop rails;
- duplicate JS/CSS canvas size budgets and `!important` sizing;
- blanket generic mobile overlay styling;
- keyboard-first instructions on touch screens.

## Target mobile architecture

### 1. Canvas-first combat view

- One stable landscape screen, not three swipe panes.
- Playfield size: `min(visualViewport height - safe gap, viewport width - 170 px control rail)`.
- Target logical tile size: at least 30 CSS px in the shortest supported browser viewport.
- Current board frame, room rendering and combat silhouettes remain intact.
- Depth/room/boss information becomes a compact plaque over the frame, not a full row.
- HP, Shield and Barrier become slim current-HD rails attached to the playfield edge.
- Fury and Elixir use current icon pips; Potion is an actual icon with a `1/5` badge.

### 2. Semantic right-thumb control rail

- Three skill buttons use existing Dash/Shockwave/Shield art and show READY, ARMED, ACTIVE or cooldown.
- Potion and Elixir use existing resource art and charge badges.
- Interact is contextual and names the verb: `Open Forge`, `Trade`, `Descend`, `Bind Pact`.
- Extract is contextual/confirmed, not a permanent ambiguous `Q` button.
- Keyboard letters may appear only as secondary PC hints, never as the primary mobile label.
- Menu must have its own non-overlapping 48 px target.

### 3. Progressive disclosure

- Default combat view shows only information needed this turn.
- Player stats, Relics, Active Effects, Mutators and Log move into a deliberate details sheet opened by a clear button.
- No gesture-only navigation. If sheets can swipe, they also have visible tabs/buttons.
- First successful movement dismisses a short coach mark explaining tap/hold around the hero; Dash adds directional feedback.

### 4. Dedicated mobile phase screens

- **Camp:** compact header with icon stats, visible tabs, one readable list, sticky `Start Next Run`.
- **Forge:** Temper/Transmute choices visible together; art supports the decision instead of pushing it below the fold; sticky Leave/Confirm.
- **Merchant:** current dashboard semantics and assets, but one/two-column compact rows with visible price/action and sticky Back.
- **Pact/Relic:** touch cards with one primary decision per card and sticky leave/confirm.
- **Menu/Options/Tutorial:** fully contained inside safe area, no negative top, no keyboard instructions, no stale Menu trigger.
- **Defeat/Victory:** require new deterministic mobile captures; current audit had no reliable scenario and makes no visual claim about them.

## Acceptance criteria for the remake

1. On physical Android Chrome with browser chrome visible, the playfield occupies ≥88% of `visualViewport.height`; logical tiles are ≥30 CSS px.
2. HP is always visible during combat. Shield/Barrier, Fury, Elixir and Potion use the current HD icon/rail language.
3. No primary action is represented only by Z/X/C/F/G/E/Q.
4. Every visible action has icon + name/state, a ≥48×48 target and no intersection with Menu/safe areas.
5. Skill names and states are fully visible; no `.48rem` combat metadata or clipped card text.
6. Camp, Forge, Merchant, Pact and Menu show the primary action in the first viewport or in a sticky footer.
7. Overlays use one intentional scroll area, a visible close/back action, dialog semantics, initial focus and focus return.
8. A new player can discover movement and complete one move without knowing desktop controls.
9. Test matrix includes real-touch 844×390, 800×360 and a chrome-reduced height ≤300 px, plus at least one physical Android and iPhone/Safari review.
10. Visual regression assertions measure canvas share, HP/resource visibility, icon asset use, text clipping, target intersections and primary-action visibility—not only overflow and event routing.

## Recommended next phase

Do not continue patching the current compact CSS. First produce three screenshot-level mobile combat concepts grounded in the current HD assets and select one. Then implement a dedicated mobile composition layer loaded after the HD sheets, leaving desktop untouched.
