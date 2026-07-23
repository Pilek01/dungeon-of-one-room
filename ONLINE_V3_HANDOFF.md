# Online v3 handoff — Phase 0 and Phase 1

Date: 2026-07-23
Workspace: `D:\Codex workstation\Dungeon\dungeon-online-v3`
Source snapshot: `D:\Codex workstation\Dungeon\dungeon-4.0` (read-only during this work)

## Completed

- Copied the v0.8.0 pre-Online game into a clean, separate workspace.
- Excluded obvious generated/cache/worktree output only.
- Initialized a new repository.
- Created root baseline commit:
  - SHA: `f98820c99066d810169e100beb23a54a332734bd`
  - subject: `Baseline v0.8.0 before Online v3`
- Confirmed copied `config.js`, `game.js`, and `index.html` hashes match the source.
- Added one baseline smoke runner and retained its output only under ignored `output/`.
- Added the isolated Phase 1 Online v3 contract modules and documents.
- Did not modify or load any original game/runtime file.
- Did not build a Worker, endpoint, network request, v2 compatibility layer, deployment, push, rebase, or worktree.

## Baseline verification

Command:

```text
node scripts/online-v3-baseline-smoke.mjs
```

Result:

```text
Online v3 baseline smoke PASS (headed)
```

Verified through local HTTP in a real headed Chromium session:

- game version `v0.8.0`;
- boot/loading presentation;
- Classic Shrine;
- HD Shrine;
- cheat menu and its options;
- Observer Bot enabled and acting;
- Vault with one Guardian;
- local save and Continue at the same depth;
- Final Defeat after the last life;
- animation/motion samples;
- audio toggle and SFX/audio inventory;
- HUD structure;
- zero `/api` requests;
- zero browser console errors;
- zero uncaught page errors.

Recorded `net::ERR_ABORTED` media preloads were navigation/context-close cancellations. No unexpected request failure occurred.

Reference output:

```text
output/online-v3-baseline/
  baseline-smoke-summary.json
  console-and-network.json
  sfx-and-audio.json
  hud-structure.json
  cheat-menu-options.json
  motion-timeline.json
  final-defeat-summary.json
  01-boot.png
  02-classic-shrine.png
  03-hd-shrine.png
  04-cheat-menu.png
  05-vault.png
  06-observer-bot.png
  07-save-continue-menu.png
  08-final-defeat.png
  motion-000ms.png
  motion-120ms.png
  motion-240ms.png
  motion-360ms.png
```

These files remain ignored and uncommitted.

Static baseline checks:

- `node --check game.js`: pass.
- `node tests/expansion-release.test.js`: pass.
- Focused active audio mapping test: pass.
- Full `tests/audio-freeze.test.js`: 4/5 pass; the existing meta-test “Duplicate active declarations must fail explicitly” fails, while the actual active soundtrack mapping contract passes. No audio source was changed.

## Phase 1 files

```text
online-v3/ranked-v3-hooks.js
online-v3/ranked-v3-client.js
online-v3/ranked-v3-recorder.js
online-v3/ranked-v3-protocol.js
online-v3/ranked-v3-checkpoints.js
online-v3/ranked-v3-storage.js
online-v3/ranked-v3-leaderboard-ui.js
docs/ONLINE_V3_ARCHITECTURE.md
docs/ONLINE_V3_PROTOCOL.md
ONLINE_V3_HANDOFF.md
```

The exact Practice adapter is synchronous and inert. None of these scripts is referenced by `index.html`; therefore Phase 1 cannot change gameplay or issue a request.

## Guardrail status

- Original game files: unchanged from baseline commit.
- Practice Online v3 traffic: zero.
- New Online v3 request implementation: none.
- Input/game-loop waits: none.
- Animation/audio/HUD/Classic/HD/cheat/Observer Bot/special-room edits: none.
- New selectors: `ranked-v3-*` only.
- New storage prefix: `dungeonRankedV3`.
- New route prefix: `/api/v3`.
- Ranked/Online v2 imports: none.

## Next phase — not started

1. Write Worker fixtures for all six route contracts without wiring the game.
2. Add protocol conformance fixtures for revisions, idempotency, room nonce, token expiry, retries and terminal replay.
3. Implement the two-table D1 repository behind an isolated test boundary.
4. Exercise checkpoint rejection and network-loss fixtures.
5. Review the eight-hook plan before inserting any hook into `game.js`.
6. Re-run the full headed baseline after each integration slice and compare the retained presentation/motion/audio/HUD references.

The detailed state model, D1 schema, hook plan, threat model, guardrails, and read-only v2 presentation inventory are in `docs/ONLINE_V3_ARCHITECTURE.md`. Exact request/response/error/retry contracts are in `docs/ONLINE_V3_PROTOCOL.md`.
