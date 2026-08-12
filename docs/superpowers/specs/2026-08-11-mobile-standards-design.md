# Mobile standards hardening design

## Goal

Bring the accepted gothic mobile build up to modern touch and accessibility expectations without changing game rules, desktop UX, the square board, or the command-deck architecture.

## Considered approaches

1. **Standards hardening in place — chosen.** Retain the approved composition and assets; repair modal semantics, touch completion, focus, readable terms, accessible state, and explicit exits.
2. **Rebuild the mobile UI again.** It could solve the same problems, but it would discard an accepted visual direction and add unnecessary gameplay/UI regression risk.
3. **Minimal CSS/ARIA patch.** Lower risk, but it cannot solve pointer cancellation, focus restoration, touch dead ends, or dynamic action state.

## Interaction contract

- Touch actions arm on pointer-down and execute once on pointer-up inside the same enabled control.
- Pointer cancel, pointer leave, secondary pointers, orientation changes, and outside release abort the pending action.
- Enter and Space activate focused controls exactly once.
- Mobile overlays expose one dialog at a time, receive initial focus, keep Tab focus inside, make the background inert, and return focus when closed.
- Every Options/Tutorial/Merchant surface has a visible 48 px Back/Close control; keyboard shortcuts remain secondary.
- Cooldown and resource availability are reflected in visible text and accessible labels. Disabled resource/skill actions are programmatically disabled without changing game rules.

## Content and visual contract

- English document language and English accessible labels match visible UI.
- Pact boon and sacrifice text wraps instead of truncating meaningful decisions.
- Primary command labels are at least 10 px and secondary status text at least 8 px in the short landscape composition.
- Existing gothic frames, textures, art, and colors remain authoritative.
- Reduced-motion mode removes meter and control transitions.
- The portrait gate keeps its gothic card and clear text but removes the decorative text glyph.

## Non-goals

- No gameplay balancing or input rule changes.
- No desktop layout redesign.
- No claim of complete WCAG conformance or full nonvisual playability.
- No deploy, release, or Ranked changes.
