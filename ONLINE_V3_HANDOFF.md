# Online v3 - Current handoff

Updated: 2026-08-12

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

- Production Worker source commit:
  `4041faa4836183b819a64a58d0ef351cd07ba020` on
  `codex/ranked-fatal-worker-compat`. It is a direct child of the live/GitHub
  base `f67eb9554a1395d8399e23fda6094c6e22d7305d`.
- Remote provenance is the release branch plus annotated tag
  `online-v3-worker-production-2026-08-12-4041faa`, which points exactly to
  `4041faa4836183b819a64a58d0ef351cd07ba020`.
- `origin/main` remains at
  `f67eb9554a1395d8399e23fda6094c6e22d7305d`. Local `main` is a separate,
  stale/diverged line and is not a release source.
- Production Worker version:
  `b03cb1ae-25e2-458f-8297-6aeeb298778d` at 100% in deployment
  `cc896f3f-eb6f-40ba-989f-663e423af6c7`.
- Recorded Worker rollback version:
  `19b9174c-f720-4484-8f7b-c0918215c29b`.
- Production Pages stayed unchanged at deployment
  `4236fef9-1e2d-4e6c-aac8-752cc2f71b55`, source `f67eb95`, during this
  Worker-only release.
- Active production ruleset:
  `sha256:bc0d548d204557d0cc0ec7f8a358e18246778a13b27c58f5c6cdd73e73621711`.
- Retained previous ruleset:
  `sha256:d784208aad891119b71c52324cea358997ee376313914d5799affa68c8678ff3`.
- D1 reports `No migrations to apply`. No D1 migration, backfill, restore, or
  schema/data release action was performed.

The Worker hotfix accepts and validates the legacy f67 cause-bearing fatal
payload, then strips `presentationCause` before applying the legacy `bc0d`
ruleset. Cause-free clients remain valid, and omitted versus stripped cause
produces identical canonical `bc0d` state, digests, checkpoint tokens, and
terminal summaries. Genuine unexpected internal failures remain 500-class.
No Pages/UI artifact, visual receipt, D1 state, or ruleset activation changed.

## Latest release evidence

- Exact clean source `4041faa4836183b819a64a58d0ef351cd07ba020` passed
  fresh `verify:full`: 815/815, including the committed baseline, committed
  Ranked lifecycle, and Wrangler/D1 coverage.
- Candidate-version override smoke passed for malformed cause validation,
  legacy cause-bearing fatal events, cause-free fatal events, idempotent replay,
  changed-body idempotency conflict, Resume, and cleanup. All six disposable
  diagnostic runs were abandoned.
- Worker rollout passed inactive override testing, 5%/95% and 25%/75% canary
  holds, then 100% promotion. Post-promotion default-routing smoke passed and
  the candidate-version error tail remained quiet. No rollback was required.
- Read-only post-release checks confirm deployment
  `cc896f3f-eb6f-40ba-989f-663e423af6c7` serves Worker version
  `b03cb1ae-25e2-458f-8297-6aeeb298778d` at 100%, Pages remains
  `4236fef9-1e2d-4e6c-aac8-752cc2f71b55`, D1 reports
  `No migrations to apply`, and public availability remains active on the
  exact `bc0d` hash above.
- No migration, backfill, Pages deployment, visual-receipt change, new ruleset
  activation, or rollback occurred.

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
unchanged. The Worker-only release did not modify Pages/UI sources or visual
receipts.

## Protected working trees and release refs

- The production Worker release was built from the isolated clean worktree on
  `codex/ranked-fatal-worker-compat`; do not reconstruct it from local `main`.
- Local `main` is at `22eb0626404cc61b9c8a6260d0dbcefb8d404683`, diverges
  from `origin/main` at `1c087ec3bc23598399fbd3dfbc9aff74c1ae0e1b`, and
  contains unrelated changes.
- `codex/mobile-v1` remains based at
  `1c087ec3bc23598399fbd3dfbc9aff74c1ae0e1b` with substantial isolated WIP.
  Do not merge, stage, clean, or otherwise modify that worktree as part of an
  Online v3 release.
- `codex/ranked-fatal-reconciled` contains separate uncommitted QA/test work
  and is not the deployed source.

Always confirm with `npm run status:compact`. Before staging or committing,
inspect the full `git status --short` and stage only explicit paths.

## History

This file intentionally contains only the current operational snapshot.
Completed handoff history remains available through Git history and the
relevant `docs/ONLINE_V3_*` or `docs/history/` records. Do not load that
history automatically for a small isolated task.
