# Online v3 - Current handoff

Updated: 2026-08-03

## Task authority

There is no standing file-based task. The current user prompt in chat defines
the task and allowed scope. `docs/tasks/CURRENT.md` is `Status: NONE`.

Do not infer implementation, push, deployment, migration, backfill, or
ruleset-activation authority from this handoff.

## Architecture boundary

Online v3 is checkpoint-authoritative meta progression around the local v0.8
game. Combat simulation and presentation remain local and offline during
movement, combat, AI, animation, audio, and rendering.

The Worker controls only documented meta-state such as directives, sequential
depth, canonical gold/build/transactions, server-issued offers, checkpoint
revisions, campaign lifecycle, and final leaderboard publication.

Do not describe the system as server-authoritative combat or cheat-proof.

## Current production snapshot

- Latest deployed source commit: `566455c` on `origin/main`.
- `57f6846` remains the functional game/UI commit for the unified Gothic
  Ranked Leaderboard and Practice Records archive.
- `origin/main` remains at the deployed `566455c`. Local `HEAD -> main`
  contains only additional repository-hygiene and documentation commits and is
  ahead because no push is authorized, so the two refs are not currently
  synchronized.
- Production Worker version:
  `19b9174c-f720-4484-8f7b-c0918215c29b` at 100%.
- Production Pages deployment:
  `37b06f98-c602-4825-a336-9b391ee88e4a`.
- Automatic production Pages deployments
  `d46c6bb5-4dfd-47ae-8045-ce87e371a7f3` and
  `59fc0e6c-491e-4e7b-9b63-c17cad9bf247` failed. The active working Pages
  deployment was uploaded manually afterward.
- Active production ruleset:
  `sha256:bc0d548d204557d0cc0ec7f8a358e18246778a13b27c58f5c6cdd73e73621711`.
- Retained previous ruleset:
  `sha256:d784208aad891119b71c52324cea358997ee376313914d5799affa68c8678ff3`.
- D1 migrations were already current (`No migrations to apply`). No D1
  mutator backfill was performed: ranked profiles import the authoritative
  Practice unlock state on first use, which cannot be reconstructed in D1.

The latest Pages release adds support-first Acolyte behavior, the Game Over
music repair, and the unified Gothic Ranked Leaderboard / Practice Records
archive. Main-menu and Ranked-terminal leaderboard routes now use the same
canonical online table; Practice terminal results remain local. The Worker,
D1 schema/data, and active ruleset are unchanged. The Observer Bot gate was
not preserved in the deployed Pages bundle: the current production config has
the bot disabled because its build-time password was absent.

## Latest release evidence

- Focused leaderboard, production-package, and M4 renderer set: 20/20 PASS.
- `verify:full`: 800/800 PASS, including Wrangler/D1 21/21, clean committed
  baseline, and clean committed Ranked lifecycle.
- Pages build: 3109 files; 3108 uploaded by Wrangler.
- Independent live checks: HTTP 200 and active compatible availability on the
  deployment URL and project alias. `game.js`, the Ranked leaderboard module,
  and `style.css` match the clean local bundle byte-for-byte on both URLs.
- Remote D1 reports `No migrations to apply`. No migration, backfill, Worker
  rollout, or ruleset activation was needed; production remains on
  `sha256:bc0d548d204557d0cc0ec7f8a358e18246778a13b27c58f5c6cdd73e73621711`.

These totals are point-in-time release evidence. They do not require rerunning
the same suites for unrelated small changes.

## Browser QA workflow

Package B separates fast, current-tree browser checks from committed release
coverage without reducing release scope:

- `verify:ui-current -- --scenario boot|hd|save` runs one affected baseline
  surface from the current working tree;
- `verify:ranked-headed -- --scenario recovery|lifecycle|camp` runs one
  affected Ranked browser surface from the current working tree;
- `verify:baseline` runs the complete protected baseline from committed
  `HEAD`, without Ranked;
- `verify:full` / `verify:release` still runs phase checks, the complete
  committed baseline, complete committed Ranked lifecycle, and Wrangler/D1.

Ranked QA uses the marked `output/pages-test-dist` bundle. The deployable
`output/pages-dist` contains no QA marker or test-only boot-readiness hook.
Passing receipts are scenario-specific and reusable when their fingerprint is
unchanged. The latest fresh full headed timings were 28.0 seconds for
the baseline and 87.3 seconds for Ranked, with zero unexpected console/page
errors. Package C has not started.

## Protected working tree

At this snapshot there are no protected Vault Guardian WIP entries, no local
`.wrangler` entries, and no ordinary working-tree changes.

Always confirm with `npm run status:compact`. Before staging or committing,
also inspect the full `git status --short`.

## History

This file intentionally contains only the current operational snapshot.
Completed handoff history remains available through Git history and the
relevant `docs/ONLINE_V3_*` or `docs/history/` records. Do not load that
history automatically for a small isolated task.
