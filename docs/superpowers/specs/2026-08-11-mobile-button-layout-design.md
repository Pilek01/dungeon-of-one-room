# Mobile Button Layout Redesign

## Goal

Make the mobile command deck feel like a deliberate Gothic game controller
instead of a fixed bottom shelf inside a mostly empty panel, without changing
any gameplay rule or canonical input handler.

## Visual target

`docs/design-references/mobile-gothic-ui-approved.png` is authoritative and is
a fidelity target, not merely a directional mood board. The implementation is
judged from a normalized side-by-side capture of the same 844 x 390 gameplay
state. Current gameplay data and the square 9 x 9 board remain live, but the
visible proportions, panel hierarchy, frame continuity, material treatment,
control balance, icon dominance and engraved type must match the reference.

The previous pass is explicitly rejected because it met ergonomic geometry
while retaining an unfinished floating-D-pad shelf. A passing implementation
cannot rely only on target-size and no-overflow checks.

## Layout

The board remains a two-column mobile layout: square playfield on the left and
the existing command deck on the right. The command deck retains the Depth,
room, HP, Shield, Barrier, Fury, Gold, Stats, and Menu header.

The command deck is one continuous framed console. Its full-width header/HUD
occupies the upper band and a framed control region occupies the lower band.
The header, lower region and outer deck share aligned edges, visible inset
dividers and the same blackened-iron texture. There is no unframed black void
behind either control bay.

Below the header:

- left control bay: centered 3 x 3 cardinal D-pad using the existing plate;
- right control bay: Dash, Shockwave, Shield, Potion, Elixir, and Interact in a
  2 x 3 grid;
- final right-bank row: Extract spans both columns;
- no empty grid cell;
- the D-pad is vertically centered within an inset left bay rather than
  floating in an empty panel;
- the action bank has even inner gutters and Extract is centered as a
  deliberate final plaque;
- the lower control region begins immediately after the framed HUD divider,
  while ornamental texture may remain visible around the centered controls.

At 844 x 390, the action bank grows vertically and its icons may grow up to
36 px. At 844 x 288, every visible target remains at least 48 x 48 px and the
layout stays within the viewport. At widths at or below 760 px, the existing
command-width clamp remains authoritative and the D-pad falls back to 48 px
cells.

## Visual language and asset fidelity

Only existing real assets are used:

- `assets/hd/ui/mobile/gothic/gothic-dpad-plate.png`
- `assets/hd/ui/mobile/dpad-arrow.png`
- `assets/hd/ui/mobile/gothic/gothic-button-frame.png`
- existing Dash, Shockwave, Shield, Potion, Elixir, Interact, and Extract art

The layout layer remains in `style-mobile-hd.css`; the visual skin remains in
`style-mobile-gothic.css`. No new placeholder, glyph, CSS-drawn, or unrelated
art is introduced.

- `screen-chrome.png` keeps its native 16:9 proportion and may crop via
  `cover`; it must not be stretched to the 2.16:1 viewport.
- `panel-texture.png` tiles at a fixed size; it must not be distorted with
  `cover`.
- `gothic-button-frame.png` and the 3:1 skill rarity frame keep their native
  proportions through `border-image` or proportional cropping; they must not
  be squashed into square tiles.
- the control console uses blackened iron/dark stone, aged silver bevels and
  restrained antique gold. Arcane blue is limited to skill art/state, not the
  panel body.
- the D-pad plate is subdued charcoal with muted brass arrows. Bright arrows
  and studs must not dominate the HUD or action icons.

Action icons are the primary visual. The visible action names use compact
engraved uppercase type. `READY`, `NONE`, `ACTION`, `EMERGENCY` and numeric
counts remain accessible through `aria-label`/tooltips and dynamic state, but
do not render as large ribbons over the normal 844 x 390 reference state.

## Interaction and accessibility

All existing IDs, `data-action-key` values, pointer ownership, canonical
keyboard dispatch, Dash aiming, bounded D-pad hold, disabled states, ARIA
labels, focus styling, and reduced-motion behavior remain intact.

The wrapper keeps `pointer-events: none`; the D-pad and action bank keep
`pointer-events: auto`. Stats and Menu remain outside the combat hit regions.

## Acceptance criteria

- At 844 x 390 and 800 x 360, the action bank starts no more than 12 px below
  the mobile HUD and ends within 10 px of the command deck bottom.
- At 844 x 288, all D-pad and action targets are at least 48 x 48 CSS px.
- Extract occupies the final action row as a centered plaque between 1.18 and
  1.4 times the visible width of a regular action tile, matching the source,
  while its transparent touch target continues to span both columns.
- D-pad and action-bank vertical centers differ by no more than 28 px because
  the approved four-row action bank extends below the three-row D-pad.
- No control overlaps another control, the canvas, Stats, or Menu.
- No action label is clipped.
- At 844 x 390, the lower control region has a visible textured/frame-backed
  left bay and right bay; neither is a transparent void.
- At 844 x 390, regular action labels are 9-10 CSS px engraved uppercase and
  status ribbons are visually suppressed; icons occupy more visual area than
  their labels.
- D-pad and action-bank outer gutters differ by no more than 8 CSS px, and the
  D-pad/action vertical centers differ by no more than 28 CSS px.
- Outer chrome, command header, lower control divider and console frame read as
  one continuous blackened-iron system in the normalized comparison.
- The final design-QA comparison contains no actionable P0, P1 or P2 mismatch;
  automated geometry is necessary but not sufficient for PASS.
- The canvas remains square and at least its current measured size for each
  tested profile.
- Portrait rotation, fine-pointer narrow, hybrid touch-laptop, tablet, iPad,
  and desktop paths retain their current behavior.

## Non-goals

- No gameplay balance or action semantics changes.
- No new left-handed preference in this pass.
- No redesign of Camp, Forge, Merchant, Pact, menus, or desktop HD.
- No deployment or production activation.

## Self-review

The scope is limited to the in-run mobile command deck. Every layout value has
a responsive acceptance criterion, all canonical controls remain named, and
the short-height constraint is explicit. The visual reference is now a strict
target, correcting the earlier contradictory statement that treated it as
directional. There are no placeholders or conflicting requirements.
