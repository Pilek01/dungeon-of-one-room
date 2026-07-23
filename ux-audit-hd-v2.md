# HD UI/UX audit and staged rework plan

## Audit scope

- Surface: desktop HD HUD and the menu opened with `Esc` during a run.
- Current evidence: `output/ux-audit-hd-v2/01-current-esc-menu.png` (2048 x 765).
- Visual target: `output/ux-audit-hd-v2/02-target-mockup.png` (1680 x 945).
- User goal: preserve a readable playfield while making HUD, pause menu and skill controls feel like one authored gothic interface.

## Overall verdict

The current build has useful individual raster pieces, but the composition is still driven by a stretched three-column web layout. At ultrawide/short viewport ratios it stops reading as one game frame: side panels inflate, the fixed-size board floats in a large empty center, and the in-run menu replaces live HUD content instead of behaving like a pause layer. The user's 4/10 assessment is consistent with the visible evidence.

## Numbered flow review

1. Gameplay shell — poor
   - The 23.5% / 53% / 23.5% tracks scale with the full viewport, while the board remains capped near 610 px.
   - This produces large texture-only areas around the board and gives the center less visual importance than in the target.
   - The outer chrome is stretched instead of preserving a designed composition ratio.

2. Left player and relic rail — weak
   - The Player heading occupies an oversized nested frame and leaves a large dead block above the data.
   - Menu-mode stats are spread vertically across the full rail, which makes the panel feel empty instead of dense and deliberate.
   - Standard relic capacity incorrectly displays ten sockets. The default must be eight sockets in a 2 x 4 grid; only `Abyssal Reliquary` should switch the grid to 2 x 5.

3. Central board and information hierarchy — poor
   - The actual room is too small relative to the available center column.
   - Title, depth strip, board and menu do not form one compact vertical stack.
   - On the current short ultrawide viewport, the menu begins too high and is visually detached from the room.

4. Skill controls — weak
   - Cards touch each other and sit on a shared black rectangular backing.
   - The black bar breaks the transparency of the ornamental frames and makes the three controls read as one web component.
   - The target uses three individually framed cards with visible air between them and rarity-specific silhouettes.

5. `Esc` during a run — broken
   - `enterMenu()` changes `state.phase` to `menu`; `buildHud()` then swaps the run HUD for profile/menu stats and `buildSkillsBar()` removes the in-run skill state.
   - The result is not a pause overlay. It is a main-menu data mode rendered over a leftover room.
   - The run HUD, current relics, active effects, log and skill cards must remain visible and frozen behind the menu.

6. Accessibility and interaction — needs verification
   - Keyboard navigation exists, but the selected menu row is too subtle against the textured backing.
   - Several labels are very small at a 765 px viewport height.
   - Screenshot evidence cannot verify focus order, screen-reader announcements, reduced motion or contrast ratios; these require browser checks during implementation.

## Highest-impact corrections

1. Replace percentage-stretched desktop tracks with a capped composition shell that preserves the target proportions and letterboxes gracefully on ultrawide displays.
2. Introduce an explicit in-run pause/menu context so `Esc` freezes and dims gameplay without rebuilding the HUD as the title-screen menu.
3. Make relic capacity drive the DOM and grid: 8 slots / 2 x 4 normally, 10 slots / 2 x 5 only with the cap relic.
4. Remove the shared skill-bar backing, give each skill card transparent margins, and increase the gap between cards.
5. Replace oversized nested heading frames with shallow plaques and denser panel sections matching the target.

## Staged implementation plan

### Stage 1 — Composition shell and central proportions

- Establish a desktop design canvas capped around the target's 16:9 composition.
- Define fixed/clamped left, center and right tracks instead of full-width percentages.
- Scale the board from available height and keep the central stack compact.
- Acceptance: at 1680 x 945 and 2048 x 765 the board remains dominant and there is no large texture-only void.

### Stage 2 — In-run `Esc` menu

- Add a distinct pause/menu context while preserving the saved run state.
- Keep run HUD, board, effects, log, relics and skills rendered behind the overlay.
- Center and constrain the menu inside the board frame; add a clear selected state.
- Acceptance: opening and closing `Esc` does not replace or reflow the live HUD.

### Stage 3 — Left rail and adaptive relic inventory

- Rebuild the Player/Dungeon/Relics hierarchy as compact sections.
- Render only the actual relic capacity: 2 x 4 normally, 2 x 5 with `Abyssal Reliquary`.
- Keep icon hooks, tooltip, rarity border, inactive state and stack badge.
- Acceptance: no locked placeholder sockets appear before the capacity upgrade.

### Stage 4 — Skill cards

- Remove the black shared background and isolate each card on transparency.
- Add deliberate spacing and preserve three distinct rarity frames: blue, purple and orange.
- Rebalance art, hotkey, name, status and description inside each card.
- Acceptance: cards never touch and their outer silhouettes remain readable at both target viewports.

### Stage 5 — Right rail and menu/overlay consistency

- Rebuild Info, Active Effects, Mutators and Dungeon Log with the same plaque and spacing system.
- Apply the same overlay frame rules to Options, Tutorial, merchant and confirmation dialogs where relevant.
- Acceptance: no empty oversized panels and no overlay starts outside the safe center region.

### Stage 6 — Asset cohesion and final QA

- Generate or refine only the raster pieces still missing after layout measurements are stable.
- Test gameplay, `Esc`, Options, Continue, empty/full relic states and all skill rarities.
- Compare fresh captures against the mock at 1680 x 945 and the reported 2048 x 765 viewport.
- Acceptance: no actionable P0/P1/P2 mismatches remain.

## Worktree decision

A separate worktree is recommended for the implementation, but not from the current `main` HEAD yet. The shared working tree contains a large set of uncommitted guardian, shrine, portal, room and UI changes, and the existing `.worktrees/graphics-overhaul` is already in use. Creating a clean UX worktree now would omit the current UI baseline or require mixing unrelated changes into a checkpoint. The safe sequence is:

1. let the parallel graphics/spawning task reach a commit/checkpoint;
2. create `.worktrees/hd-ui-ux-rework` from that known baseline;
3. transfer only the UI assets and UI-specific hunks;
4. implement the stages above without touching guardian/shrine/ritual code.

The `.worktrees/` directory already exists and is correctly ignored by Git.

## Skill coverage

- Product Design audit: current evidence and prioritized findings.
- Game UI Frontend: playfield protection, hierarchy, overlay and HUD constraints.
- Image-to-code: faithful implementation from the selected mockup.
- Image generation: only for measured missing raster frames/assets.
- Game playtest: keyboard flow, responsive captures and regression QA.
- Git worktrees: isolated implementation after a clean baseline exists.

No additional skill/plugin is currently missing for this rework. Figma is not required.

## Evidence limits

The current screenshot proves the ultrawide `Esc` state and visible layout defects. It does not prove hover/focus behavior, screen-reader output, all relic capacities or all skill rarity states; those are explicit checks in Stages 2, 3, 4 and 6.
