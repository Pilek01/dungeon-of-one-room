# Dungeon of One Room — Online v3

## Required context

Before modifying code:

1. Read `ONLINE_V3_HANDOFF.md`.
2. Read `docs/tasks/CURRENT.md`.
3. Read the nearest relevant subsystem `AGENTS.md`.
4. Run `git status --short`.

Do not automatically read phase history or every `docs/ONLINE_V3_*` file.

## Architecture

Online v3 is a checkpoint-authoritative meta-progression layer around the
untouched v0.8 game. The local game remains authoritative for combat
presentation and makes no network requests during movement, combat, AI,
animation, audio, or rendering.

The Worker may control only documented meta-state: room directives and
sequential depth, gold and transaction ledgers, server-issued offers,
canonical build, checkpoint revisions, and final leaderboard publication.

Do not describe Online v3 as server-authoritative combat or cheat-proof.

## Baseline protection

The pre-online v0.8 game is protected by default. Do not modify gameplay, UI,
animation, audio, HUD, cheats, Observer Bot, special rooms, save/Continue,
Final Defeat, assets, or loading behavior unless `docs/tasks/CURRENT.md`
explicitly allows the exact paths.

Do not load Online v3 from `index.html` until an explicit integration phase.

## Process

- Work on exactly one phase per run with one agent and no delegation.
- Do not automatically start the next phase.
- Do not guess unclear v0.8 rules; stop and report unresolved source evidence.
- Keep changes inside the allowed paths in `docs/tasks/CURRENT.md`.
- Do not use `git add .` or `git add -A`.
- Do not modify unrelated files or weaken tests or schemas to obtain a PASS.
- Do not push, deploy, rebase, merge, or activate a ruleset without explicit
  authorization in the current task.
- `v08-meta-1` remains test-only until an explicit release phase.

## Verification

- During edits: `npm run verify:fast`.
- Before a phase commit: `npm run verify:phase` and
  `npm run verify:baseline`.
- Use `npm run verify:full` only for a milestone, staging, release, or when
  `docs/tasks/CURRENT.md` requires it.
- Full logs belong in ignored `output/verification/`; stdout stays concise.
- Read the full log only after a FAIL.
- Before completion, run `git diff --check`, update the handoff, create the
  exact local commit requested by `CURRENT.md`, and stop.

## Reporting

Keep the final response short:

- commit;
- implemented scope and unresolved items;
- test totals;
- ruleset hash before/after;
- protected baseline result;
- changed-file count;
- next recommended phase.

Do not repeat the task specification or full test logs.