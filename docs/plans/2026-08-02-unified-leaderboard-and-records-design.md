# Unified Leaderboard and Practice Records — Design

## Purpose

Replace two confusing, visually unrelated result lists with one Gothic record
presentation system:

- **Ranked Leaderboard** is the canonical current-season Online ranking.
- **Practice Records** is a local, offline archive of completed Practice
  campaigns.

The two views use the same visual language and information hierarchy, but never
share a data source or fall back into one another.

## Navigation contract

| Entry point | Destination |
| --- | --- |
| Main menu, Online build | Ranked Leaderboard only |
| Ranked terminal defeat or victory | Main Menu or Ranked Leaderboard |
| Practice terminal defeat or victory | Main Menu or Practice Records |
| Practice Records | no network request and no Ranked fallback |

The existing native menu option remains the bridge hook that Online v3 replaces
with `Ranked Leaderboard`. In non-Ranked presentation it becomes
`Practice Records`. The Online build therefore does not acquire a second
Practice button in its main menu.

## Record eligibility and data ownership

Ranked rows continue to come only from `GET /api/v3/leaderboard` and Ranked
build details only from `GET /api/v3/leaderboard/:runId`. The existing Worker
already persists the canonical build and terminal summary, so this redesign does
not change the Worker, D1 schema, endpoint contract, migration, or ruleset.

Practice writes one record only when a campaign reaches a terminal result:

- final defeat after the last life;
- final victory.

Practice extraction and an ordinary non-final death do not write a record. A
Practice record snapshots the terminal build and truthful Game Over summary
before Practice state resets. Existing local records without that snapshot stay
visible, but their detail action explicitly says that the older record has no
stored build chronicle; no fields are fabricated.

## List content

The primary ledger contains exactly these columns:

1. Rank
2. Name
3. Score
4. Depth
5. Gold

It deliberately excludes outcome and duration. Clicking the name or the
`Inspect build` affordance opens the record chronicle.

## Shared Gothic presentation

Both surfaces use the existing Abyssal Gothic chrome, dark stone/metal panels,
muted parchment text, existing relic icons, and responsive card sizing. They
share CSS custom properties and record selectors rather than duplicating two
independent themes.

The top three records receive an elevated podium above the normal ledger:

- Rank 1: gold-tinted existing skull asset and Champion treatment.
- Rank 2: silver-tinted existing skull asset.
- Rank 3: bronze-tinted existing skull asset.

All three remain readable and keyboard-accessible. The ordinary ledger begins
at the fourth rank, or contains every row if fewer than three records exist.
Color is decorative only; rank text remains explicit. Motion is limited to a
short entrance/emphasis transition and respects reduced-motion preferences.

## Build Chronicle

The detail surface is a full Gothic record page, not an unstyled list. It
contains:

- rank, player name, score, depth, and gold header;
- visual relic build, pacts, skills, upgrades, and elixirs where the stored
  record contains them;
- a Run Chronicle with time played, rooms cleared, bosses defeated, highest
  depth, earned gold, and final score only when the canonical/local snapshot
  provides each value;
- a terminal result section with the available Game Over statistics;
- a clear Back control.

## Mutator disclosure

The detail header/chronicle displays a `Mutators` chip. Hovering or focusing it
opens a tooltip containing the exact active mutators stored for that run. Each
entry uses the authoritative active ID and the current client catalogue's name,
key, and description. A run with none displays `No mutators used`; a legacy
record whose full mutator snapshot is unavailable says so rather than guessing.

## Accessibility and resilience

- The record list and detail page support pointer, keyboard, and visible focus.
- Name and `Inspect build` are separate accessible controls with the same safe
  destination.
- Ranked loading/error states stay within the Ranked overlay; Practice cannot
  present an online loading, offline-mode, or source-fallback message.
- Narrow screens collapse ledger columns into labelled values while retaining
  rank, name, score, depth, and gold.
- Text content is created with DOM text APIs or escaped by the native overlay;
  record names never become HTML.

## Non-goals

- No publication of Practice records to the Online service.
- No Ranked score recalculation in the browser.
- No D1 migration, backfill, ruleset activation, deployment, push, or merge.
- No change to combat, reward, mutator, or campaign rules.
