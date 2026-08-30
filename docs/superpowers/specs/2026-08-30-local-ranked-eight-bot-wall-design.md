# Local Ranked eight-bot wall — design

Date: 2026-08-30
Status: APPROVED
Baseline: `31e13e09622001e6c349416b182215b678c4a91f`

## Goal

Extend the existing Windows Local Ranked Test launcher with one command that
starts eight visible Observer Bot runs from the newest local commit. Every run
uses HD graphics, a fresh isolated Chrome profile, and the automatic player
name `bot 1` through `bot 8`.

The eight windows are arranged as a two-column by four-row wall on the detected
secondary portrait display. The current machine exposes that display as
`DISPLAY2` with a 1080 by 1920 pixel working area.

The tool is local test infrastructure. It must not deploy, access production
D1, submit assisted runs to the leaderboard, or alter Practice or production
gameplay.

## Selected architecture

Keep the current `Launch-Local-Ranked-Test.cmd` and WinForms launcher as the
entry point. Add an eight-bot mode to that UI and a focused Node supervisor for
browser ownership and telemetry.

One invocation prepares the newest eligible local commit, builds its test Pages
bundle once, applies local migrations once, and starts one loopback Worker with
one local D1 state directory. The supervisor then opens eight separate
persistent Chrome contexts against that one URL.

The browser controller uses `playwright-core` with the already installed
Google Chrome. It must not download or bundle another browser. Each context has
its own user-data directory, so localStorage, IndexedDB, cookies, device
identity, player identity, and Ranked recovery state cannot leak between bots.
Sharing one local Worker deliberately exercises concurrent run handling while
the Worker's existing run IDs and operation keys keep the eight runs separate.

The base `game.js`, Worker validation, ruleset data, protocol contracts, D1
schema, and production configuration remain unchanged.

## Launcher UI

The existing launcher keeps its commit history and single-session controls.
The multi-bot action always binds to the newest displayed eligible commit,
regardless of an older row selection, and displays the full selected short hash
before launch.

Add these local controls:

- `Start 8 Observer Bots`;
- `Stop All`;
- `Open diagnostics folder`;
- one row per bot showing name, lifecycle status, depth, score, HP, last
  decision, and the latest error;
- a per-row `Stop` or `Focus` action for an individual bot.

The launcher remains on the primary display. Chrome windows use application
window presentation and are placed on the secondary display without address
bars. Window bounds are calculated from the monitor working area, including
deterministic distribution of remainder pixels so there are no gaps or overlap.
The current 1080 by 1872 working area therefore yields two columns and four
rows close to 540 by 468 pixels each.

If the configured secondary monitor is unavailable, startup fails before
opening any bot and explains the missing display. It does not silently cover
the primary monitor.

## Startup sequence

1. Resolve the newest eligible local commit using the launcher's existing
   branch and commit rules.
2. Prepare the detached cached worktree and build the local test bundle once
   with the user-entered Observer Bot password.
3. Start one loopback Worker and local D1 state through the existing launcher
   controller.
4. Create a timestamped session directory and manifest containing the commit,
   local URL, monitor bounds, bot names, and start time. Secrets and the bot
   password are never written.
5. Start eight isolated Chrome application windows in bounded succession to
   avoid an eight-process startup spike.
6. In each visible page, dismiss the boot screen, enter the exact assigned
   player name, start a fresh Ranked run, provide the local password to the
   existing F9 unlock flow, enable Observer Bot, and verify the blue assisted
   Ranked status.
7. Mark the wall ready only after all eight bots are active. A startup failure
   in one bot is captured as that bot's failure and does not close bots that
   already started.

Automation uses visible UI and existing public test/runtime surfaces wherever
possible. It must not write game state directly or bypass Ranked boundaries.

All eight runs use the normal HD mode. Audio is muted. Chrome background timer
and renderer throttling are disabled for these owned test windows so an
unfocused bot continues to advance.

## Session and profile lifecycle

Every wall launch creates a new session ID and new profile directories under
the repository's ignored `output` tree. Profiles are never reused, including
after a crash.

On `Stop All`, the supervisor first flushes diagnostics, closes the eight
owned Chrome contexts, stops only its tracked local Worker process tree, and
then removes the bulky disposable profile directories. Reports, screenshots,
traces, and the session manifest remain.

Closing the launcher follows the same orderly stop path. If the launcher or
computer exits unexpectedly, the next launch uses a new session. Stale profile
cleanup must target only paths proven to be below that launcher's owned session
root; diagnostic artifacts are never removed automatically.

## Live monitoring

The supervisor polls each page at a low fixed rate and emits compact JSON status
events to the WinForms process. A status sample uses
`window.render_game_to_text()`, the public Ranked session snapshot, and
visible overlay text. It includes only the current state needed for supervision,
not an unbounded history.

Immediate failure signals are:

- visible `Ranked reconnect required`;
- visible `Ranked integrity check failed`;
- Ranked fatal or provisional-integrity state;
- uncaught page error;
- unexpected browser/context exit;
- local checkpoint or event request failure that leaves Ranked blocked;
- Observer Bot becoming inactive without an intentional stop.

The stall detector ignores known checkpoint, reward, transaction, tutorial,
and loading waits. Outside those states it watches a compact gameplay
fingerprint: phase, depth, room identity, turn, player position, enemy count and
HP, portal state, and Observer decision. No fingerprint progress for 30 seconds
is a stall. A repeating two-to-four-state movement fingerprint sustained for
30 seconds is a loop. Existing Observer loop flags can trigger the same
capture sooner.

Detection is per bot. One failed bot never stops the other seven.

## Failure capture

Capture is idempotent per failure incident. Before changing the page, the
supervisor records:

- a full-page PNG screenshot;
- visible Ranked and game overlay text;
- `render_game_to_text` output;
- the public Ranked session snapshot and redacted diagnostic history;
- buffered console errors and failed network request metadata;
- current URL, commit, bot name, timestamps, depth, score, HP, and last
  Observer decision.

The local test bundle may expose one narrowly scoped, test-only telemetry hook
that returns `buildObserverBotTraceText()` without mutating state. The build
must prove that hook is absent from the release bundle. Ranked diagnostics are
collected through the existing export control when present, with a structured
fallback built only from already public redacted diagnostics.

After capture, the supervisor disables that Observer Bot if it is still active
and leaves the Chrome window open on the failure state. Its launcher row turns
red. The other bots continue.

Artifacts use this predictable layout:

```text
output/multi-bot-runs/<session-id>/
  manifest.json
  worker.log
  bot-01/
    failure-summary.json
    screenshot.png
    ranked-diagnostics.json
    observer-bot-trace.txt
    game-state.json
    console.log
    network-errors.json
  ...
  bot-08/
```

The launcher prints and opens this exact session directory. Because it is
inside the shared repository workspace, a later Codex task can locate the
latest failed bot without the user copying files into chat.

## Error handling and security

The Worker signing secret and local Observer password stay process-local and
are redacted from launcher events, logs, manifests, console output, and failure
artifacts. Browser profiles and diagnostics remain under the local ignored
`output` directory on drive D.

The supervisor owns exact process and path handles. Stop operations never scan
for unrelated Chrome or Node processes. Cleanup never targets a computed path
until its resolved absolute location is proven to be below the current session
root.

If the shared Worker exits, all eight bots are marked blocked, the Worker log
is flushed once, and their windows remain visible until the user chooses Stop
All. If an artifact write fails, the affected bot remains stopped and the
launcher displays the failing absolute path rather than resuming silently.

## Implementation boundaries

Expected implementation surfaces are:

- `scripts/local-ranked-test-launcher.ps1` for the control panel;
- `scripts/local-ranked-test-launcher-core.mjs` for the shared Worker/session
  lifecycle;
- a new focused multi-bot browser supervisor under `scripts/`;
- `scripts/build-pages-v3.mjs` only for a test-target telemetry hook if the
  existing exported controls cannot provide the trace safely;
- `package.json` and a lockfile for `playwright-core`;
- focused launcher, layout, isolation, monitoring, artifact, and bundle-leak
  tests;
- `progress.md`.

No production deployment, push, ruleset activation, D1 migration, version
change, or manual build-identity edit is part of implementation.

## Verification

Use test-driven development for pure layout, path ownership, process planning,
status classification, stall/loop detection, redaction, and artifact naming.
Controller tests must prove one build and one Worker serve eight unique
profiles and names.

An automated integration smoke starts at least two isolated browser contexts
and proves distinct player identity, localStorage, run ID, and recovery state.
It then injects a local test failure into one context and verifies that only
that bot stops and the complete artifact set is written.

Final current-tree QA starts all eight HD bots on the detected portrait display,
visually confirms the 2-by-4 wall, verifies all names and assisted status, and
checks that the remaining bots continue after one controlled capture. The
owned browsers and Worker are stopped after evidence is saved.

Run the focused launcher tests, changed JavaScript syntax checks,
`verify:guard`, the directly affected current-tree Ranked headed scenario if
the test bundle hook changes, and `git diff --check`. Release verification is
not required because this design does not authorize a release.
