# Record Archive Visual Parity and Keyboard Navigation Design

Date: 2026-08-09
Status: Approved

## Goal

Give the Practice record archive the same presentation system as the Online
Ranked leaderboard and build inspector, correct the remaining Online alignment
and readability defects, and make both leaderboard flows fully operable with a
keyboard.

This is a presentation and input change only. It does not change scoring,
record storage, season state, Worker behavior, game rules, or publication
semantics.

## Chosen approach

Practice and Online will share the canonical Ranked reference-plate renderer,
layout rules, assets, and keyboard controller. Practice data will be projected
into the canonical presentation model by a narrow adapter.

This approach is preferred over copying the Ranked markup or restyling the
legacy Practice archive because a single renderer prevents the two modes from
drifting apart again. The legacy `record-archive-ui.js` path may remain as an
isolated compatibility implementation during this change, but the active
Practice flow must no longer depend on its visual structure or CSS.

## Architecture

### Shared presentation

The canonical leaderboard renderer remains responsible for:

- the three-place podium;
- the seven-row ledger page;
- the previous-page, next-page, and close controls;
- the build-inspection reference plate;
- equipment slots, run chronicle, terminal outcome, and tooltips;
- focusable action metadata used by keyboard navigation.

Online continues to supply its existing public leaderboard rows and detail
payloads. Practice supplies local rows and records through a presentation-only
adapter. The adapter must preserve local scores, depth, gold, ordering, outcome,
relics, mutators, and chronicle values. It must not synthesize missing values or
change stored records.

Practice keeps its existing local record limit and sorting semantics, but `Tab`
is no longer a sort shortcut because it must retain standard focus navigation.
If the existing score/depth toggle remains available, `T` is its sole shortcut.
The canonical seven-row ledger pagination is applied after the podium.

### Practice projection

The Practice adapter maps local data into the canonical presentation shape:

- local rows become Ranked-compatible leaderboard rows;
- `mutatorIds` become presentation-only active modifier entries;
- local relic stacks remain intact;
- local duration, rooms, bosses, gold, and outcome feed the canonical chronicle;
- a non-victory Practice outcome uses the existing Game Over presentation;
- no network request is introduced.

Records that predate complete build or summary capture retain an explicit
"details unavailable" state inside the canonical plate. Missing information is
never displayed as zero or fabricated data.

The richer legacy Practice-only sections remain stored but are not duplicated
onto the canonical build plate. The visible Practice inspector follows the same
information hierarchy as Online so the two views remain visually identical.

## Visual behavior

### Practice parity

The Practice list and inspector use the same reference-plate DOM structure,
background art, podium/ledger geometry, equipment grid, chronicle panel,
terminal panel, typography, and responsive fallback as Online. Mode-specific
accessible labels and supported contextual copy may differ, but no second
visual implementation is introduced.

### Leaderboard headings

The `NAME` and `DEPTH` headings are aligned using the same geometric column
offsets as their rendered values. Literal whitespace is not used for layout.
At the reference 1536x1080 plate size:

- the Name heading and player-name value share the same horizontal anchor;
- the Depth heading and depth value share the same horizontal anchor;
- Score, Gold, and Inspect Build retain their current centered anchors.

Headed geometry checks compare heading and value rectangles so future text or
font changes cannot silently recreate the mismatch.

### Build rank

The rank element exposes its digit class or equivalent presentation metadata.
Ranks `1` through `9` receive a small optical shift to the right within the
decorative skull plaque. Ranks `10` and above keep the existing anchor.

The exact offset is calibrated from a headed screenshot, not guessed from
character spaces. Regression measurements cover ranks `1`, `9`, `10`, and
`73`, including containment and center alignment.

### Tooltips

Equipment and mutator tooltips use one shared large overlay panel inside the
inspector plate instead of being constrained to the narrow space between slot
rows. At the 1536x1080 reference size, typography and internal spacing target
approximately 2.5 times the current size. The panel may cover decorative empty
space but must not be clipped by the plate, viewport, chronicle panel, or back
control.

Tooltip placement selects an above or below orientation based on the focused or
hovered slot. Smaller desktop layouts may clamp the scale enough to stay on
screen, while preserving a material readability improvement. Hover and keyboard
focus produce the same content and placement behavior.

## Keyboard interaction

Keyboard handling is scoped to an open leaderboard or inspector so gameplay
controls do not fire underneath the overlay. Native `Tab` and `Shift+Tab`
behavior is preserved.

### Leaderboard list

- `ArrowUp` / `ArrowDown` and `W` / `S` move between record rows.
- `ArrowLeft` / `ArrowRight` and `A` / `D` move between the Name and Inspect
  Build actions in a row.
- Moving down from the final actionable row enters the footer.
- In the footer, Left/Right moves through Previous Page, Next Page, and Close.
- Disabled footer controls are skipped.
- Moving up from the footer returns to the final actionable record row.
- `PageUp` and `PageDown` request the previous or next available page.
- `Enter` and `Space` activate the focused action.
- `Escape` closes the leaderboard.

After a page change, focus moves to the first sensible action on the new page.
The same rules apply to Online and Practice.

### Build inspector

Arrow keys move through the equipment grid in its visual directions, then to
the mutator control and the Back control where applicable. Focusing an equipment
slot reveals the same enlarged tooltip as hovering it.

`Escape` returns to the leaderboard. Returning from Inspect restores focus to
the exact Inspect Build action that opened the record when that action still
exists. A subsequent `Escape` closes the list and restores focus to the control
that opened the leaderboard.

## Error and edge handling

- Empty leaderboards retain the canonical empty-state treatment and expose the
  Close action to the keyboard.
- A one-page result disables and skips both paging controls.
- A page change clamps to the available page range.
- Missing or stale record detail renders an in-plate unavailable state and a
  working Back action.
- Focus restoration falls back to the first available list action, then Close,
  if the original row is no longer present.
- The Practice integration stops its overlay key events before the global game
  shortcut handler, eliminating the current `Tab` and `Enter` conflict.
- No keyboard handler traps `Tab` inside the overlay.

## Verification strategy

Implementation follows test-driven development.

Focused unit and DOM tests cover:

- Practice-to-canonical row and detail projection;
- legacy Practice records with unavailable details;
- identical canonical list/detail DOM shape for Online and Practice fixtures;
- row, action, footer, paging, activation, Escape, and focus-restoration rules;
- disabled footer controls;
- keyboard focus revealing equipment and mutator tooltips;
- rank metadata for one- and two-digit values.

Headed checks at the canonical desktop size cover:

- Name and Depth heading/value alignment;
- tooltip scale, placement, and plate containment;
- optical rank alignment for `1`, `9`, `10`, and `73`;
- a complete keyboard-only Online list-to-detail-to-list flow;
- a complete keyboard-only Practice list-to-detail-to-list flow;
- Practice and Online reference-plate geometry parity;
- updated approved screenshots for both modes.

Because this changes protected Practice UI and shared Ranked presentation, final
verification includes the focused tests, syntax checks, the affected current-tree
Practice/browser scenario, the affected Ranked headed lifecycle, phase
verification, committed baseline verification, `verify:guard`, and
`git diff --check`. A release/full verification or deployment is outside this
task unless separately authorized.

## Scope boundaries

Included:

- Practice archive presentation integration;
- shared leaderboard and inspector presentation/controller changes;
- the specified header, tooltip, rank, and keyboard corrections;
- directly affected tests, browser checks, screenshots, and visual receipts.

Excluded:

- scoring or leaderboard ordering rule changes;
- Worker, D1, protocol, ruleset, or production changes;
- gameplay input changes outside the active archive overlay;
- record migration or storage schema changes;
- push or deployment.
