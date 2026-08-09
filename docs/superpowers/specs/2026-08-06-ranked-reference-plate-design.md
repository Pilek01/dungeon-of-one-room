# Ranked Leaderboard and Build Inspect -- Reference Plate Design

## Status

Approved design. This document defines only the desktop Ranked presentation;
implementation, deployment, data migration, and mobile UX require separate
approval.

## Goal

Replace the current generic Ranked record-archive presentation with two
literal, text-free desktop plates derived from the supplied visual references:

1. **Ranked Leaderboard** -- a permanent Top 3 podium and a seven-row ranked
   ledger.
2. **Inspect build** -- a run header, a 2 x 5 equipment grid, and a concise Run
   Chronicle.

The stonework, frame, candles, skulls, medal mounts, panel borders, and empty
equipment slots come from the cleaned reference art. Every word, number,
player name, icon label, control, and tooltip is a live DOM element. The art
is therefore decorative; it never contains stale rank, score, or player data.

## Scope and guardrails

- Applies only to **Ranked Online v3**. Practice Records retain their current
  record-archive presentation and data flow.
- Desktop is the only designed target. No mobile redesign or new mobile UX is
  part of this work; narrow displays retain a minimal readable fallback rather
  than a second interpretation of the reference plate.
- The existing Ranked source of truth remains unchanged: leaderboard rows come
  from the existing leaderboard endpoint and an inspected run comes from the
  existing run-detail endpoint.
- No score calculation, combat, campaign, ruleset, publication, deployment,
  merge, or D1 schema/migration change is required.
- The existing data for pacts, skills, camp upgrades, and elixirs stays stored
  and untouched, but is not rendered by the redesigned Inspect Build screen.

## Reference art

Create two 1536 x 1080 desktop background assets from the user-provided
references:

| Asset | Derived from | Cleanup |
| --- | --- | --- |
| `ranked-leaderboard-desktop-plate.png` | Ranked Leaderboard reference | Remove all title, subtitle, player, rank, score, stat, column, action, and example-row text/numbers while retaining the complete chrome, three medal mounts, ledger rules, and empty panel areas. |
| `ranked-build-inspect-desktop-plate.png` | Inspect Build reference | Remove all player/result/chronicle/equipment text, numbers, and example item art while retaining the chrome, empty 2 x 5 slot frames, chronicle panel, terminal-result panel, and Back-button frame. |

The background is rendered at `aspect-ratio: 1536 / 1080`, centered inside the
existing Ranked overlay. It must scale as one composition, without tiling,
cropping a side frame, or using text baked into the asset. A DOM overlay uses a
normalized plate-coordinate grid so the live elements stay aligned when the
plate scales.

## Leaderboard

### Composition

The plate always presents the current season's Top 3 as the three mounted
medallions above the ledger:

- rank 1 in the central gold mount;
- rank 2 in the left silver mount;
- rank 3 in the right bronze mount.

Each populated position displays the live player name, final score, depth, and
gold. A missing rank is left visually empty; no placeholder player or invented
result is shown.

The ledger beneath it always has seven physical rows and these live columns:

`Rank` / `Name` / `Score` / `Depth` / `Gold` / `Inspect build`

The player name and the Inspect Build control both open that run's detail
screen. They remain separate focusable controls, so keyboard users receive the
same destination as pointer users.

### Ten-page behaviour

The podium is not part of pagination. It remains visible on every page as the
season context, while the ledger page changes independently.

| Ledger page | Global ranks shown |
| --- | --- |
| 1 | 4-10 |
| 2 | 11-17 |
| 3 | 18-24 |
| ... | ... |
| 10 | 67-73 |

The current page is explicit, for example `Ranks 11-17` and `Page 2 / 10`.
Previous and next controls sit in the ledger/footer area without covering its
rows. The controls are keyboard-accessible and disabled when the selected page
would contain no received records. The UI never fabricates blank player rows.

The client requests up to 73 current-season rows, preserves the endpoint's
authoritative sort order, pins rows 1-3 to the podium, and chunks the remaining
rows into groups of seven. If the current endpoint's validation cap is below
73, expand only that existing cap/query path; do not add a D1 migration or
duplicate ranking data in the browser.

Loading and error states remain inside the Ranked overlay. They do not show a
Practice fallback or claim that stale local data is Ranked data.

## Inspect Build

### Header and loadout

The inspected rank, player name, final score, depth, and gold occupy the
reference header positions as live text. The `Build Loadout` panel contains ten
fixed slots arranged in two rows of five.

Only the stored Ranked equipment/relic entries are mapped into those ten slots,
in their canonical stored order. An entry renders its actual icon and visible
name. Unused slots stay empty. Data for pacts, skills, camp upgrades, and
elixirs is neither requested separately nor displayed in this view; it remains
preserved in the existing record snapshot for other code to use later.

### Run Chronicle

The right panel shows exactly these data fields when they are present in the
inspected run:

1. Time Played
2. Rooms Cleared
3. Bosses Defeated
4. Mutators
5. Highest Depth
6. Gold Earned
7. Final Score

`Mutators` is a focusable tooltip trigger. Hovering with a pointer or focusing
with a keyboard reveals the authoritative mutator name, key, and description.
No-mutator runs clearly say `No mutators used`; incomplete legacy data says it
is unavailable rather than guessing.

The terminal panel is live: it shows `Game Over` with the recorded defeat cause
when the run ended in defeat, or the truthful terminal equivalent for a victory
when the record says victory. The centered `Back to Leaderboard` control returns
to the exact page the player opened from. Escape keeps the existing safe overlay
close behaviour.

## Interaction, accessibility, and resilience

- Background plates are decorative (`aria-hidden`); all meaningful content is
  live text or a labelled control.
- Controls have a visible focus treatment, usable pointer target, keyboard
  activation, and descriptive accessible names containing the relevant player
  when helpful.
- Hover-only behaviour is never required: the Mutators tooltip also opens on
  keyboard focus and closes predictably.
- Record names are inserted as text, never HTML.
- Missing optional fields leave only their value/slot absent; no fictitious
  dates, item names, mutators, values, or causes are invented.
- Reduced-motion preference keeps the surfaces static or limits motion to the
  existing minimal overlay transition.

## Implementation boundaries

The expected implementation is isolated to the Ranked list/detail renderer,
the Ranked runtime's list-page state and data request limit, Ranked-specific
CSS, new decorative assets, and focused Ranked UI/API tests. Shared Practice
archive styling and its data flow must not be redesigned as a side effect.

The existing Worker endpoint may receive the smallest compatible adjustment
needed to return the first 73 ordered rows. This is a query-limit change only:
the D1 schema, migrations, historical rows, and result publication path stay
unchanged.

## Acceptance criteria

1. At desktop size, the Leaderboard and Inspect Build have the supplied
   reference composition rather than generic cards or a generic table.
2. Neither background asset contains visible dynamic copy or example data.
3. Live Ranked data populates Top 3, the active seven-row ledger page, the
   detail header, equipment grid, chronicle, terminal result, and controls.
4. The podium is still present while viewing pages 2-10, and page 2 starts at
   rank 11.
5. No more than 73 current-season rows are requested/displayed by this version;
   empty non-existent pages cannot be opened.
6. Inspect Build omits pacts, skills, camp upgrades, and elixirs without
   deleting them from stored records or changing the detail endpoint's
   persistence contract.
7. Mutator information is available by both hover and keyboard focus.
8. Practice Records and protected pre-Online v0.8 UI are unchanged.
9. Focused renderer/API tests, changed-JavaScript syntax checks, whitespace
   validation, and one current-tree headed Ranked lifecycle scenario pass before
   implementation is considered complete.
