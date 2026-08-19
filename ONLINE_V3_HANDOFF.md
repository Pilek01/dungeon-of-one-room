# Online v3 - Current handoff

Updated: 2026-08-19

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

- Production Pages and Worker source commit:
  `b89678f0de4b77098ad4086c4b5221949a42463f` from
  `codex/ranked-boundary-checkpoints-release`.
- Production provenance is the annotated tag
  `online-v3-production-2026-08-19-b89678f`, which points exactly to the
  deployed source commit.
- Production Worker version:
  `1811ba2d-986d-4271-a577-d6b7796ad8ba` at 100% (deployment
  `cc4ca52e-d1ab-4366-90eb-e5992d5bc52a`).
- Recorded Worker rollback version:
  `2e19d227-7c2e-4da4-b375-3c1995673de3`.
- Production Pages deployment:
  `fdfdb0fa-c787-4e6c-a1d6-ef64f776f267`, source `b89678f`.
- Active production ruleset:
  `sha256:87c30b2c011b5103398f9b03f6bf018d71f2a35427c0a04ef7a31b2559a7a6d9`.
- Retained previous ruleset:
  `sha256:0672eb9aaae11865ebae75a4c6d6dc77cc29f4a079afe562355172d26f073bca`.
- D1 migration `0006_leaderboard_snapshots.sql` is applied. The pre-migration
  Time Travel bookmark is
  `00000712-00000000-000050c7-dcc35a66a3fd387efd989c1bce79b263`, and D1 now
  reports `No migrations to apply`.

This release repairs normal-extraction recovery after a rejected or expired
checkpoint. A resync now continues extraction only when canonical state proves
that the room checkpoint committed; a same-room resync cancels the stale local
intent and safely restarts the uncommitted room. It also adds bounded,
token-free browser diagnostics and structured Worker diagnostics for the first
provisional transition and sanitized request errors.

The release also restores the crimson pre-Warden portal warning on every depth
before the canonical five-depth Warden schedule (4, 9, 14, and so on) without
moving checkpoint timing. No `game.js`, D1 schema, canonical ruleset source,
ruleset manifest, or ruleset hash changed. Existing runs pinned to older hashes
remain supported, and the active production ruleset remains `87c3...`.

## Latest release evidence

- Exact committed source `b89678f0de4b77098ad4086c4b5221949a42463f`
  passed fresh `npm run verify:full -- --force`: 879/879. The release log is
  `output/verification/full-20260819T162110879Z.log`.
- Codex visually inspected and approved all six current archive screenshots.
  The recorded visual source fingerprint is
  `sha256:466f3515e0d44adc8d45f5f29da0e5df89cb1a79d489893668e24464d983938c`.
- The Pages upload came from the repository root and included the Functions
  bundle, routes, and service binding.
- Post-deploy byte checks confirm the stable Pages URL returns the exact local
  `b89678f` `index.html`, `config.js`, `game.js`, and Ranked runtime assets.
  Availability reports production active with ruleset `87c3...`, and Worker
  deployment `cc4ca52e...` serves version `1811ba2d...` at 100%.
- No release smoke mutated D1. The production database still reports no
  pending migrations.

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
unchanged. The Pages-only hotfix did not modify archive UI, but the shared
runtime source fingerprint required a fresh visual receipt.

## Protected working trees and release refs

- The deployed Pages and Worker source is fixed by
  `online-v3-production-2026-08-19-b89678f`. Subsequent documentation commits
  are not part of either deployed artifact.
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
