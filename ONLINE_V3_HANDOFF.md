# Online v3 - Current handoff

Updated: 2026-08-08

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

- Latest deployed source commit: `ab546dc` on
  `origin/codex/ranked-reference-plates`. It was uploaded manually from a
  clean detached worktree and is not merged into `origin/main`.
- `origin/main` remains at `566455c`.
- Production Worker version:
  `19b9174c-f720-4484-8f7b-c0918215c29b` at 100%.
- Production Pages deployment:
  `8c77e656-426e-43a8-bc2b-45843fe62cc6`.
- Automatic preview deployment
  `341b3a66-4d51-43de-9f88-446747183dd2` failed. The production deployment
  was uploaded manually from the verified bundle afterward.
- Active production ruleset:
  `sha256:bc0d548d204557d0cc0ec7f8a358e18246778a13b27c58f5c6cdd73e73621711`.
- Retained previous ruleset:
  `sha256:d784208aad891119b71c52324cea358997ee376313914d5799affa68c8678ff3`.
- D1 migrations were already current (`No migrations to apply`). No D1
  mutator backfill was performed: ranked profiles import the authoritative
  Practice unlock state on first use, which cannot be reconstructed in D1.

The latest Pages release replaces the Ranked desktop Leaderboard and Inspect
Build presentation with the approved reference plates, keeps Top 3 visible
across ten local pages, aligns the seven-row ledger, and uses an icon-only
ten-relic loadout with accessible relic and mutator tooltips. The Worker, D1
schema/data, active ruleset, Practice gameplay, and Forge behavior are
unchanged. The Observer Bot remains disabled because its build-time password
was absent.

## Latest release evidence

- Focused reference/UI/M4 tests: 15/15 PASS.
- `verify:full`: 803/803 PASS, including Wrangler/D1 21/21, clean committed
  baseline, and clean committed Ranked lifecycle.
- Pages build: 3111 files; Wrangler uploaded 7 changed files and reused 3103
  of 3110 uploadable assets.
- Independent live checks: HTTP 200 and active compatible availability on the
  immutable deployment URL and stable project alias. The Ranked leaderboard
  module, `style.css`, and both reference plates match the clean local bundle
  byte-for-byte on both URLs.
- No migration, backfill, Worker rollout, or ruleset activation was performed;
  production remains on
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
unchanged. The latest clean release timings were 31.3 seconds for the
baseline and 103.0 seconds for Ranked, with zero unexpected console/page
errors. Package C has not started.

## Protected working tree

At this snapshot there are no protected Vault Guardian WIP entries and no
local `.wrangler` entries. Preserve without staging or editing these seven
ordinary working-tree changes:

- `cloudflare/leaderboard-v3/test/observer-bot-runtime.test.js`;
- `cloudflare/leaderboard-v3/test/online-ranked-boundary-repair.test.js`;
- `cloudflare/leaderboard-v3/test/r2-campaign-parity.test.js`;
- `online-v3/ranked-v3-runtime.js`;
- `scripts/build-pages-v3.mjs`;
- the remaining unstaged Forge hunks in
  `scripts/online-v3-ranked-headed.mjs`;
- `tests/hd-relic-draft-screen.test.js`.

Always confirm with `npm run status:compact`. Before staging or committing,
also inspect the full `git status --short`.

## History

This file intentionally contains only the current operational snapshot.
Completed handoff history remains available through Git history and the
relevant `docs/ONLINE_V3_*` or `docs/history/` records. Do not load that
history automatically for a small isolated task.
