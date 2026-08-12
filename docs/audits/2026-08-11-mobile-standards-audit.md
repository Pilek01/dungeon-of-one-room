# Mobile standards audit — 2026-08-11

## Scope and evidence

This audit covers the current touch/mobile build in the `codex/mobile-v1` worktree. Evidence was captured from a fresh Playwright gallery run at 844×390 and the current mobile smoke profiles. The review compares the implementation with WCAG 2.2 interaction requirements, Apple 44×44 pt guidance, Android 48×48 dp guidance, and the game's approved gothic mobile reference.

## What already meets the target

- The 9×9 playfield remains square and readable in landscape.
- The right command deck exposes named, illustrated skills, consumables, context actions, and a visible D-pad.
- Primary touch targets are at least 48 CSS px in the tested landscape profiles.
- Safe-area insets, dynamic viewport units, the portrait rotate gate, and bounded hold-to-move are present.
- Camp, Forge, Merchant, Pact, Menu, Options, and Tutorial use the game's gothic art direction rather than a generic mobile skin.
- Fury uses an unbounded effective current/max meter and correctly supports the 7/7 fixture.

## Findings to fix

### P1 — interaction and accessibility

1. **Document language is wrong.** The page declares Polish while the product UI is English; several mobile labels are also Polish. This causes incorrect pronunciation and an inconsistent accessible name surface.
2. **Mobile overlays are not true modal dialogs.** `#screenOverlay` lacks a dialog role, modal state, an accessible title, focus entry, a Tab loop, background inerting, and focus restoration.
3. **Some touch flows have no visible exit.** Options/Tutorial root screens and Merchant rely on an `Esc` hint instead of a reachable Back/Close control.
4. **Mobile action buttons fire on pointer-down.** A drag-away or cancelled gesture can execute an action before the user releases, contrary to safe pointer cancellation behavior.
5. **Keyboard focus is incomplete.** D-pad, command buttons, and restart lack the same visible focus treatment as Menu/Stats.
6. **Dynamic action state is not exposed.** Cooldown, armed, active, empty-potion, and empty-elixir states are visual only; accessible names and disabled/pressed states remain static.
7. **Pact terms are clipped.** Meaningful boon/sacrifice text is forced to one-line ellipsis even though the card has room to wrap.

### P2 — readability and robustness

8. Several command labels and decision details render below a comfortable mobile text size. Increase primary labels/status text without reducing target size.
9. Reduced-motion rules do not cover all HUD meter transitions.
10. The rotate screen uses a text glyph as decoration instead of existing product art; the title and instruction already communicate the state, so the glyph should be removed.
11. The canvas lacks a concise text alternative that reports the changing run state. Add a live status summary without claiming complete screen-reader playability.

## Accepted exception

Landscape is treated as essential to the approved composition: a square 9×9 board, full command deck, and 48 px controls cannot coexist meaningfully in the supported narrow portrait viewport. The portrait screen explains how to continue and is focusable.

## Decision

The build is visually coherent but not yet standards-ready. The chosen remediation is to preserve the approved gothic architecture and harden semantics, focus, pointer cancellation, touch exits, readable decision text, and test coverage. A visual rebuild is unnecessary and a CSS-only patch would leave behavioral dead ends.
