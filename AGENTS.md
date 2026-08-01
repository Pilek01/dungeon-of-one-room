# Dungeon of One Room — Online v3

## Required context

Before modifying code:

1. Treat the current user prompt as the task and scope authority.
2. Run `npm run status:compact`.
3. Read the nearest relevant subsystem `AGENTS.md` when one exists.
4. Read `docs/tasks/CURRENT.md` only when it says `Status: ACTIVE` or the
   user explicitly asks to use it.
5. Read `ONLINE_V3_HANDOFF.md` only for continuation, release, deployment,
   production-state, or cross-subsystem work.

Do not automatically read completed task history or every
`docs/ONLINE_V3_*` file. For a small isolated change, inspect only the
affected code, its direct tests, and the instructions above.

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
Final Defeat, assets, or loading behavior unless the current user prompt
explicitly authorizes the exact scope and paths. When `docs/tasks/CURRENT.md`
is `Status: ACTIVE`, it must authorize them too.

Do not load Online v3 from `index.html` until an explicit integration phase.

## Process

- Work on exactly the task requested in the current prompt with one agent and
  no delegation.
- Do not automatically expand the task or start a follow-up phase.
- Do not guess unclear v0.8 rules; stop and report unresolved source evidence.
- Keep changes inside paths authorized by the current prompt and, when active,
  `docs/tasks/CURRENT.md`.
- Do not use `git add .` or `git add -A`.
- Do not modify unrelated files or weaken tests or schemas to obtain a PASS.
- Do not push, deploy, rebase, merge, or activate a ruleset without explicit
  authorization in the current task.
- `v08-meta-1` remains test-only until an explicit release phase.

## Verification

Verification must be proportional to the changed behavior and paths.

- During edits, run only directly affected tests and syntax checks.
- Documentation-only changes require `git diff --check`; do not run product
  test suites unless the documentation generates or validates code.
- For a small isolated code change, run its focused regression test(s), syntax
  checks for changed JavaScript, and `git diff --check`. Run
  `npm run verify:guard` at most once before completion when relevant.
- `verify:guard` checks core safety, generator drift, changed JavaScript
  syntax, and whitespace. It is not a feature regression test and cannot
  replace the focused test for changed behavior.
- Run `npm run verify:phase` once before completion only for Worker, ruleset,
  protocol, shared Ranked runtime, or cross-subsystem changes.
- For a visible current-working-tree change, run exactly the affected browser
  scenario: `npm run verify:ui-current -- --scenario boot|hd|save`.
- Run `npm run verify:baseline` (alias
  `verify:baseline-committed`) only when protected game, UI, loading,
  renderer, build integration, or baseline-sensitive paths changed, or for a
  milestone/release. It tests the complete baseline scenario from committed
  `HEAD`; it no longer includes the Ranked lifecycle.
- For Ranked browser behavior, run exactly the affected current-tree scenario:
  `npm run verify:ranked-headed -- --scenario recovery|lifecycle|camp`.
  Use `--scenario all` only for a milestone or release.
- Run `npm run verify:full` (alias `verify:release`) only for a milestone,
  D1/Wrangler change, staging, release, deployment, or an explicit
  current-prompt requirement.
- `verify:full` includes phase, committed baseline, the complete committed
  Ranked lifecycle, and Wrangler/D1 checks. When full is required, it replaces
  separate lower-level runs.
- Do not rerun a passing command unless files relevant to that command changed
  after it ran or the user explicitly requests a rerun.
- Verification receipts reuse an identical PASS. Use `--force` only when the
  user requests a fresh run or relevant external test state changed.
- Do not run headed QA for documentation, tests-only, or isolated pure-domain
  changes unless the visible/browser behavior is in scope.
- Full logs belong in ignored `output/verification/`; stdout stays concise.
- Read the full log only after a FAIL.
- Before completion, run `git diff --check`. Update the handoff or create a
  local commit only when the current prompt requests it or durable
  release/production state changed.
- Before staging or committing, run the full `git status --short`, inspect the
  exact intended diff, and stage only explicit paths.

## Reporting

Keep the final response proportional to the task:

- Always report implemented scope, unresolved items, changed-file count, and
  the exact checks that ran.
- Report a commit only when one was created.
- Report ruleset hashes only when a ruleset or release binding changed.
- Report a protected baseline result only when baseline verification was
  required and executed.
- Report production or deployment state only when it was in scope.
- Recommend a next phase only when the user requested phased work or a real
  follow-up remains.

Do not repeat the task specification or full test logs.
