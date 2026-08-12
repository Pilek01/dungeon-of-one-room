# Dungeon of One Room — Mobile v1 implementation plan

Status: implementation plan only. The isolated worktree starts at commit 1c087ec on codex/mobile-v1, with docs/tasks/CURRENT.md at Status: NONE. Do not commit, deploy, push, activate a ruleset, or bump GAME_VERSION as part of this plan. The final implementation must preserve desktop presentation, v0.8 rules, local Practice authority, saves, audio, and the existing Online v3 boundary. Ranked mobile remains a separately authorized phase; its narrow layout may receive only compatibility guards required by shared CSS.

## Task 0 — Establish the RED baseline

Before code edits:

1. Run npm run status:compact in the isolated worktree and confirm no unrelated changes.
2. Read the nearest AGENTS.md and preserve all protected baseline paths.
3. Keep the existing design document and do not edit it during implementation.
4. Inspect the current mobile blocker, the mobile controls in index.html, the responsive sections in style.css, render_game_to_text and window.advanceTime in game.js, and the Pages replacement anchors in scripts/build-pages-v3.mjs.

Create the new tests before implementation:

- tests/mobile-v1-contract.test.js: static contracts for capability/orientation states, no dead-end unsupported-mobile lock, action IDs Z/X/C/F/G/E/Q, hidden legacy D-pad, 48 px targets, safe-area and dynamic viewport CSS, touch adapter wiring, dash reuse, generic overlay tap routing, and desktop guard conditions.
- tests/mobile-v1-playwright.test.mjs: a lightweight contract test for the browser runner, its profile names, metrics, diagnostics, and real-touch context options. It must not weaken existing baseline tests.
- scripts/mobile-v1-playwright.mjs: the deterministic real-browser runner described below. It must start its own loopback static server, write only output/mobile-v1/, and close browser/server resources in success and failure paths.

The first RED command is:

    node --test tests/mobile-v1-contract.test.js tests/mobile-v1-playwright.test.mjs

Expected result: failure against the current unsupported-device guard and missing G/action-dock/orientation contracts. Do not alter assertions merely to obtain a pass.

## Task 1 — Add the mobile DOM contract

Authorized file: index.html.

Implement only the markup needed by the approved mobile UX:

- Keep the existing viewport declaration and extend it with viewport-fit=cover if needed for safe-area insets.
- Add a body-level rotate prompt with a stable id, role/status semantics, and concise accessible copy. It must be outside the board overflow container.
- Add the side two-column action dock with stable ids and labels for Z, X, C, F, G, E, and Q. Reuse existing art/icon nodes where available; do not remove desktop controls or change keyboard labels.
- Keep legacy D-pad nodes available only as compatibility markup if existing code/tests require them, but hide them from the mobile presentation and remove their pointer hit area. Do not leave two visible movement systems.
- Mark menu and overlay controls with one canonical action/key data attribute so touch, mouse, and keyboard can share a resolver.
- Preserve script order and all existing Online v3 script boundaries.

Run the RED static test again, then run the focused markup/style tests once they exist:

    node --test tests/mobile-v1-contract.test.js tests/ui-polish.test.js

## Task 2 — Implement capability, orientation, and touch input

Authorized file: game.js.

Replace the current real-mobile dead-end without changing desktop behavior:

- Replace MOBILE_UNSUPPORTED_BLOCKED with a capability model that recognizes coarse/touch input through the 1200 CSS-pixel product threshold and derives portrait versus landscape. Do not use a UA-only allowlist.
- Keep the fine-pointer desktop path and touch laptops wider than 1200 on the existing desktop interaction model.
- Extend syncMobileUiState and the viewport listeners to update layout, dock, swipe panes, Menu, and rotate prompt on startup, resize, and orientationchange. Portrait must block gameplay input until landscape; the rotate overlay must be body-level.
- Add a small mobile input adapter for board pointerdown/move/up/cancel. It must own pointer id, deadzone, one bounded repeat timer, and cancellation. A tap resolves exactly one cardinal direction relative to the rendered player center and calls only tryMove(dx, dy). A hold calls additional tryMove steps only while the turn lock permits them, with a maximum repeat count and no path queue.
- Route dash aim through the same cardinal resolver and existing dash action. Do not add free-form aim or pathfinding.
- Add G elixir input through the canonical existing action path. Z/X/C, F, E, and Q must also dispatch the same action/key semantics as desktop; buttons must not mutate game state directly.
- Add generic overlay tap routing for main menu, Options/Tutorial, New Game confirmation, local records, room menus, relic choices, Camp, Merchant, Forge, Pact, extraction, death, and victory. Resolve the tapped control’s canonical action/key rather than always activating the currently selected keyboard row.
- Prevent element/window pointer bubbling from causing duplicate actions. Ignore secondary pointers and stale ids. Clear hold state on pointerup, pointercancel, pointerleave, orientation change, and modal transitions.
- Keep render_game_to_text and window.advanceTime stable as test oracles. Do not serialize mobile-only state into run saves.
- Preserve the existing audio bootstrap and avoid any new network request.

After each small change, run:

    node --check game.js
    node --test tests/mobile-v1-contract.test.js

## Task 3 — Implement landscape layout and body-fixed overlays

Authorized file: style.css.

Add mobile rules without rewriting the desktop cascade:

- Scope the mobile presentation to the coarse/touch-through-1200 capability class and landscape mode. Keep the current three-pane swipe structure.
- Position the board and side action dock in a two-column landscape composition. Hide the legacy D-pad, keep seven action targets at least 48 by 48 CSS px, and preserve a visible Menu control.
- Use env(safe-area-inset-top/right/bottom/left) and 100dvh with a fallback. Avoid horizontal document overflow at the smallest supported landscape width.
- Add a body-level portrait rotate layer above the app. While visible, controls must be noninteractive; with prefers-reduced-motion, remove decorative transitions.
- Make screen overlays body-fixed and scrollable inside their content region. Keep title, close/cancel controls, focus, and safe-area padding visible on short mobile viewports. Do not clip overlays inside the board.
- Preserve the existing Ranked desktop/reference presentation. At narrow widths, provide only safe wrapping/overflow containment for shared hosts; do not implement the deferred Ranked mobile redesign.
- Keep existing HD/Classic renderer sizing, canvas identity, and HUD semantics intact.

Run:

    node --test tests/mobile-v1-contract.test.js tests/ui-polish.test.js
    git diff --check

## Task 4 — Keep the Pages build and identity contract intact

Authorized file: scripts/build-pages-v3.mjs, with tests updated only when their source contract changes.

The current Pages builder contains string-replacement anchors for source snippets with MOBILE_UNSUPPORTED_BLOCKED in the keydown and pointerdown handlers. If game.js renames or removes those guards, update the corresponding replacement anchors in the same change so pages:build still succeeds. Do not hardcode the commit or date: the builder must continue to read git rev-parse --short=7 HEAD and git show --format=%cs HEAD and inject DUNGEON_BUILD_COMMIT and DUNGEON_BUILD_COMMIT_DATE.

Run the focused build checks:

    node --test tests/pages-test-build-metadata.test.mjs tests/pages-production-bundle.test.mjs
    npm run pages:build -- --target test
    git diff --check

A release build or deployment is not part of this plan.

## Task 5 — Build the real-touch Playwright runner

Authorized files: scripts/mobile-v1-playwright.mjs, tests/mobile-v1-playwright.test.mjs.

Use the repository’s existing Playwright loading pattern (DUNGEON_PLAYWRIGHT_NODE_MODULES, then the bundled develop-web-game runtime). The runner must:

1. Start a safe loopback static server and serve the current checkout.
2. Create fresh contexts with real-touch options: userAgent, isMobile, hasTouch, viewport, and deviceScaleFactor as appropriate. Also run a narrow desktop context with no touch to prove the responsive layout does not rely on UA text.
3. Capture diagnostics for console errors/warnings, page errors, failed requests, and unexpected /api requests. Practice must remain offline.
4. Exercise portrait mode first and assert the rotate prompt is visible, the dock/gameplay controls are inert, and no horizontal overflow exists.
5. Resize/orient to landscape and assert the prompt disappears, the game is playable, the mobile dock is visible, every target is at least 48 CSS px, and all controls are reachable after any intentional scroll.
6. Use deterministic scenario URLs and render_game_to_text to cover: boot/menu; descent combat and a move tap; a bounded move hold; Dash aim; potion, elixir, skill, interact, and extract actions; swipe to Player/Info panes; Menu and return; relic draft; Camp; Merchant; Forge; Pact; local records; Continue/save; death and victory overlays.
7. Tap every overlay family through the generic action resolver and assert the expected canonical state transition. Assert one tap produces one action and one hold never exceeds the configured repeat bound.
8. Capture viewport and canvas screenshots, state JSON, geometry metrics, and diagnostics under output/mobile-v1/. Require no unsupported lock text, no horizontal overflow, no clipped body-fixed overlay, no duplicate action, and zero unexpected diagnostics.
9. Close pages, contexts, browser, and server on every path.

Run the runner directly during development:

    node scripts/mobile-v1-playwright.mjs --profile all

## Task 6 — Use the real-touch device matrix

The required matrix is:

- Chrome Android phone: 360x800 portrait, then 800x360 landscape.
- Safari iPhone: 390x844 portrait, then 844x390 landscape.
- Chrome Android tablet boundary: 800x1280 portrait, then 1280x800 landscape; assert the explicit 1200 policy.
- iPad landscape: 1024x768 coarse/touch.
- Narrow desktop emulation: 390x844 fine pointer/no touch; responsive layout and keyboard remain usable without the real-device blocker.
- Desktop regression: 1440x900 and 1920x1080 fine pointer/keyboard.
- Touch laptop boundary: 1280x800 coarse touch plus keyboard; it remains desktop mode because width is above 1200.

Use the smallest fresh profile that proves the changed behavior while developing; run all profiles for milestone acceptance. Never accept cached screenshots as proof of a fresh mobile behavior.

## Task 7 — Focused verification and repository gates

After the implementation is green, run the affected focused tests once:

    node --test tests/mobile-v1-contract.test.js tests/mobile-v1-playwright.test.mjs tests/ui-polish.test.js tests/scenario-overrides.test.js tests/pages-test-build-metadata.test.mjs
    node --check game.js
    node --check scripts/build-pages-v3.mjs
    node --check scripts/mobile-v1-playwright.mjs
    git diff --check

Because this crosses game UI, browser QA, and Pages build integration, run the repository gates exactly once when the relevant files have settled:

    npm run verify:guard
    npm run verify:phase
    npm run verify:baseline

Run exactly the affected current-tree UI scenarios, with no redundant reruns:

    npm run verify:ui-current -- --scenario boot
    npm run verify:ui-current -- --scenario hd
    npm run verify:ui-current -- --scenario save

If a focused change demonstrably affects only a subset, run only that subset and record the reason. Do not run verify:full unless a later release/staging/deployment prompt explicitly requires it.

## Task 8 — Completion boundary

Before handoff:

- Run npm run status:compact and inspect the full git status.
- Confirm only authorized implementation files and tests changed; do not stage or commit.
- Confirm GAME_VERSION is still v0.8.0 unless a later prompt explicitly authorizes a version change, and boot metadata remains generated as GAME_VERSION · short commit · commit date.
- Report the mobile behavior implemented, desktop/rules preservation, real-touch profiles exercised, exact checks run, changed-file count, and any unresolved device/browser issue.
- Do not deploy, publish, push, merge, or recommend Ranked mobile as an implicit follow-up.
