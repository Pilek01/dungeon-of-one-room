# Dungeon of One Room — Mobile v1 design

Status: approved design for implementation planning only. docs/tasks/CURRENT.md is Status: NONE; the chat task is the authority. This document does not authorize a release, deployment, Ranked mobile, or a Worker/ruleset change.

## Scope and invariants

Mobile v1 is a browser-only touch presentation of the local Practice/v0.8 game. It is not a second simulation and does not make combat server authoritative. Movement, combat, AI, animation, audio, rendering, saves, and existing room rules stay local and deterministic. Ranked mobile UX remains deferred to a separate approved phase.

The product contract is:

- Landscape is the playable orientation. Portrait shows a body-level rotate prompt and does not accept gameplay input.
- The complete local game UI is touch-operable: boot, main menu, Options and Tutorial, pause/menu, rooms, relic choices, Camp, Merchant, Forge, Pact, extraction, Continue, death, victory, and local records.
- Desktop behavior and layout remain unchanged. A fine-pointer desktop or a viewport wider than the mobile threshold uses the existing keyboard/mouse path.
- Mobile mode is selected by coarse/touch capability through 1200 CSS px, not by a user-agent allowlist. Narrow desktop emulation remains useful for responsive QA, while real touch contexts exercise the same code path.
- Existing art and semantic labels are reused. New bitmap assets are not part of v1.

## Input decision

| Option | Decision | Reason |
| --- | --- | --- |
| Tap/hold a direction relative to the player | Recommended | Four cardinal directions are discoverable without covering the board. A tap maps to one existing tryMove(dx, dy) call, and a hold repeats bounded turns without changing cadence rules. |
| Virtual D-pad | Rejected for v1 | It consumes scarce landscape width, duplicates the legacy controls, and makes the board/HUD feel like a form. The legacy D-pad is hidden on mobile. |
| Tap a destination/pathfinding | Rejected for v1 | It changes the one-turn-at-a-time rule, introduces pathfinding/collision ambiguity, and makes hold cadence, hazards, and enemy turns harder to reason about. |

The movement surface is the board. Compute the pointer vector from the rendered player center, apply a configurable deadzone, select the largest absolute axis, and call only canonical tryMove(dx, dy). A pointer hold uses one bounded repeat timer with a maximum repeat count and stops on pointer release, cancellation, leaving the board, orientation change, or a second pointer. It never queues a path and never calls a different movement rule. Dash aim uses the same cardinal direction resolver and calls the existing dash action; it does not introduce free-form aim or pathfinding.

## Mobile composition

- Keep the existing three-pane model and swipe navigation. The board is the center pane; a horizontal swipe moves between Player, Board, and Info. A visible Menu action returns to the canonical menu flow.
- Replace the legacy mobile D-pad with a side two-column action dock. The dock uses existing icon/skill presentation and 48 CSS-pixel minimum targets: Z, X, C (skills), F (potion), G (elixir), E (interact/confirm), and Q (extract/cancel). Buttons dispatch the same canonical key/action semantics used by desktop; they do not mutate state directly.
- Keep the dock and Menu affordance reachable in landscape without a precision tap. Action labels and aria-label values remain present even when the visual treatment is icon-led.
- Use safe-area insets around the board, dock, Menu, and overlays. Use 100dvh for the playable shell with a fallback for browsers lacking dynamic viewport units. Do not use a fixed viewport height that traps address-bar resize.
- The rotate prompt is a body-level fixed layer above the app. It is shown for portrait coarse/touch contexts, hides the game controls, and is removed on resize/orientationchange. The prompt is static, high contrast, and screen-reader announced.
- Interactive overlays are body-fixed so they are not clipped by the board’s overflow. Long menus/cards scroll inside their own content region while title, close/cancel action, and safe-area padding stay visible.

## Architecture and state flow

1. A small capability/viewport adapter derives desktop, mobile-landscape, or mobile-portrait from coarse-pointer media, touch points, viewport width (through 1200), and orientation. It owns no game state.
2. syncMobileUiState() applies the mode to layout, dock, swipe panes, Menu, and rotate prompt. It runs on startup, resize, and orientationchange and is safe when storage or media-query change listeners are unavailable.
3. Board pointer events go through a mobile input adapter. The adapter owns pointer id, deadzone, repeat timer, and cancellation; each accepted step invokes tryMove and lets the existing turn lock and enemy cadence decide whether the step is accepted.
4. Dock actions and generic overlay taps resolve to a canonical key/action (keyboard-equivalent or existing action dispatcher). One resolver is shared by mouse, touch, and keyboard so mobile cannot drift from desktop semantics.
5. Existing render_game_to_text remains the browser test oracle. No mobile-only state is serialized into a run save. Existing window.advanceTime may drive repeat-timer tests without real-time waits.

Touch movement flow: pointerdown on the board passes the capability/orientation gate, applies the deadzone, chooses a cardinal direction, and calls tryMove; a bounded repeat timer may call additional tryMove steps; pointerup, pointercancel, orientation change, or a second pointer clears the timer and ownership.

Touch action flow: a tap on a dock button or control carrying a canonical action/key goes through the shared resolver, invokes the existing handler, updates state, and rebuilds the overlay/mobile UI. Element and window bubbling must not produce two actions for one tap.

## Accessibility

- Every dock, Menu, rotate, close, cancel, and overlay action has a meaningful accessible name, role, and focus-visible state. Keyboard remains a complete fallback on desktop and touch laptops.
- Minimum touch target is 48 by 48 CSS pixels with at least 4 pixels of separation where neighboring actions have different consequences. Meaning is not encoded by color alone.
- Respect prefers-reduced-motion: remove decorative pane/rotate transitions but retain immediate state feedback and danger/reward transitions needed for comprehension.
- Keep live state text (aria-live) for orientation, action outcome, and error/cancel feedback. Focus a newly opened body-fixed overlay without moving focus into hidden panes.
- Maintain readable contrast at 320 CSS px landscape and 390 CSS px portrait; test enlarged text/zoom without horizontal document overflow.

## Risk and error handling

- Ignore secondary pointers and stale pointer ids. Clear the repeat timer on every cancellation path.
- Ignore taps while a turn, modal transition, or orientation prompt locks input. Enabled/disabled presentation comes from the same canonical state as desktop.
- A blocked or throwing storage API must not prevent the mobile shell from loading; swipe-hint persistence falls back to memory.
- A missing PointerEvent, media-query change listener, or dynamic viewport unit falls back to tap-only movement, resize polling, or a static viewport value. It must not show the old Mobile Not Supported Yet dead end.
- Do not add a network fallback. Practice remains offline and Ranked remains behind its existing Online v3 boundary.
- Avoid accidental double actions from element and window pointerdown bubbling. The shared resolver must mark handled events or stop propagation where necessary, then test one tap equals one canonical action.
- The Pages builder currently replaces source snippets containing MOBILE_UNSUPPORTED_BLOCKED in scripts/build-pages-v3.mjs. If the guard is renamed or removed, update those replacement anchors and their tests in the same implementation change.
- Build identity remains generated. Keep the boot metadata in the form GAME_VERSION · short commit · commit date; commit hash/date come from the build checkout and must not be hardcoded.

## Real-touch device and browser matrix

| Profile | Viewport/orientation | Input | Expected mode |
| --- | --- | --- | --- |
| Chrome Android phone | 360 by 800 portrait, then 800 by 360 landscape | coarse, touch | rotate prompt, then full mobile UI |
| Safari iPhone | 390 by 844 portrait, then 844 by 390 landscape | coarse, touch | rotate prompt, then full mobile UI |
| Chrome Android tablet | 800 by 1280 portrait, then 1280 by 800 landscape | coarse, touch | rotate prompt; explicitly assert the 1200 boundary policy in landscape |
| iPad Safari | 1024 by 768 landscape | coarse, touch | full mobile UI with no horizontal overflow |
| Narrow desktop emulation | 390 by 844 | fine pointer/no touch | responsive visual layout without the real-device blocker; keyboard remains usable |
| Desktop | 1440 by 900 and 1920 by 1080 | fine pointer/keyboard | existing desktop UI and rules remain compatible |
| Touch laptop | 1280 by 800 | coarse touch plus keyboard | desktop mode because width is above 1200; keyboard path remains complete |

The 1200 CSS-pixel boundary is a product decision, not an excuse to infer a device from UA text. The tablet boundary case remains a named test so future CSS changes cannot silently change it.

## TDD and playtest acceptance

The implementation should begin with a RED contract test for mobile capability/orientation states, removal of the unsupported lock, action-dock IDs and mappings, hidden legacy D-pad, 48-pixel targets, safe-area/dvh rules, deadzone/repeat/dash wiring, and generic overlay tap routing.

A real-touch Playwright runner should exercise fresh iPhone/Android contexts and capture boot, portrait rotate, landscape gameplay, tap movement, bounded hold movement, dash, all seven dock actions, swipe panes, Menu, every overlay family, local save/Continue, death/victory, screenshots, render_game_to_text, geometry, overflow, and console/page diagnostics. Require no unsupported lock, no horizontal overflow, reachable controls, no duplicate actions, and zero unexpected diagnostics. Retain evidence under output/mobile-v1/.

Desktop smoke and baseline checks must remain green after the mobile changes. The mobile work is complete only when fresh real-touch captures show full local UI autonomy and desktop captures show unchanged presentation and rules.
