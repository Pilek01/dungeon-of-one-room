# Online v3 - Current handoff

Updated: 2026-08-14

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

- Deployed source commit:
  `59aaaa283f223f2b5c17ec74a9c3aa4a397daee8` from `main`.
- Release provenance is the annotated tag
  `online-v3-production-2026-08-14-59aaaa2`, which points exactly to the
  deployed source commit.
- Production Worker version:
  `671304f1-de75-4eed-8d1c-a8556d72093b` at 100%.
- Recorded Worker rollback version:
  `b03cb1ae-25e2-458f-8297-6aeeb298778d`.
- Production Pages deployment:
  `40e1cb47-99ed-4c33-a4f2-9faebc5306c3`, source `59aaaa2`.
- Active production ruleset:
  `sha256:0672eb9aaae11865ebae75a4c6d6dc77cc29f4a079afe562355172d26f073bca`.
- Retained previous ruleset:
  `sha256:bc0d548d204557d0cc0ec7f8a358e18246778a13b27c58f5c6cdd73e73621711`.
- D1 migration `0006_leaderboard_snapshots.sql` is applied. The pre-migration
  Time Travel bookmark is
  `00000712-00000000-000050c7-dcc35a66a3fd387efd989c1bce79b263`, and D1 now
  reports `No migrations to apply`.

The release activates the ranked playtest ruleset with campaign-best extract
and death snapshots, assisted-run markers, special-room record-depth scaling,
the Forge/relic-flow fixes, the elixir and first-Warden balance changes, and
the refreshed Ranked UI/client behavior. Existing runs pinned to `bc0d` remain
supported by the retained runtime.

## Latest release evidence

- Exact clean source `59aaaa283f223f2b5c17ec74a9c3aa4a397daee8`
  passed fresh `npm run verify:full -- --force`: 846/846. The release log is
  `output/verification/full-20260814T044527015Z.log`.
- The approved six-screenshot visual receipt passed with fingerprint
  `sha256:6048d842512a34d47f6b98fb0a811d827f8f4fe357d78b722bdc719b52460e51`.
- Candidate-version override smoke proved that the inactive candidate served
  `0672...` while default traffic remained on `bc0d...`.
- Worker rollout completed a clean 15-minute 5% hold, a clean 30-minute 25%
  hold, and 100% promotion. Availability and leaderboard probes passed on both
  versions during canary, and the error-only tail stayed quiet.
- The first Pages upload from the Worker subdirectory omitted the Pages
  Functions bundle. The release smoke caught it immediately; deployment
  `40e1cb47-99ed-4c33-a4f2-9faebc5306c3` superseded it from the repository root
  with the Functions bundle and service binding. No D1 mutation or data loss
  occurred during that short static-only deployment.
- Post-release checks confirm Pages and its versioned URL return HTTP 200,
  `config.js` identifies `59aaaa2`, availability reports the exact active
  `0672...` hash, leaderboard reads pass, 30/30 default-routing probes reached
  the new Worker, and D1 reports no pending migrations.

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

- The deployed source is fixed by
  `online-v3-production-2026-08-14-59aaaa2`; subsequent documentation commits
  on `main` are not part of the Worker or Pages artifact.
- `npm run status:compact` reported zero protected Vault Guardian WIP entries
  and zero local Wrangler-state entries before the release record was written.
- The untracked user file
  `docs/plans/2026-08-13-ranked-playtest-fixes.md` remains intentionally
  untouched and is not part of the release.

Always confirm with `npm run status:compact`. Before staging or committing,
inspect the full `git status --short` and stage only explicit paths.

## History

This file intentionally contains only the current operational snapshot.
Completed handoff history remains available through Git history and the
relevant `docs/ONLINE_V3_*` or `docs/history/` records. Do not load that
history automatically for a small isolated task.
