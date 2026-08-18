# Online v3 - Current handoff

Updated: 2026-08-18

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
  `b9e8999988c5e49347da64154852c6f66c1f23fb` from
  `codex/ranked-boundary-checkpoints-release`.
- Release provenance is the annotated tag
  `online-v3-production-2026-08-18-b9e8999`, which points exactly to the
  deployed source commit.
- Production Worker version:
  `2e19d227-7c2e-4da4-b375-3c1995673de3` at 100% (deployment
  `83be5f16-66e3-4120-890b-3c57600d3da4`).
- Recorded Worker rollback version:
  `ad6dd38c-cb91-43c2-a0ef-20890695a2d2`.
- Production Pages deployment:
  `b0e329a1-a037-41a3-aca9-7e2907a8e2a7`, source `b9e8999`.
- Active production ruleset:
  `sha256:87c30b2c011b5103398f9b03f6bf018d71f2a35427c0a04ef7a31b2559a7a6d9`.
- Retained previous ruleset:
  `sha256:0672eb9aaae11865ebae75a4c6d6dc77cc29f4a079afe562355172d26f073bca`.
- D1 migration `0006_leaderboard_snapshots.sql` is applied. The pre-migration
  Time Travel bookmark is
  `00000712-00000000-000050c7-dcc35a66a3fd387efd989c1bce79b263`, and D1 now
  reports `No migrations to apply`.

This release moves Ranked room settlement from enemy clear to explicit portal,
normal extraction, emergency extraction, and fatal boundaries. Emergency and
fatal settlement do not clear the room, award a room-clear reward, or advance
depth. Identical retries remain idempotent, prevented fatal events keep the
same room journal open, and impossible integrity state makes the run
provisional without disqualifying transport failures. Combat simulation remains
local and no movement, combat, AI, animation, audio, or render traffic was
added. Existing runs pinned to `0672` remain supported by the retained runtime.

## Latest release evidence

- Exact clean source `b9e8999988c5e49347da64154852c6f66c1f23fb`
  passed fresh `npm run verify:full -- --force`: 875/875. The release log is
  `output/verification/full-20260818T201431512Z.log`.
- Kamil approved all six current screenshots. The recorded visual source
  fingerprint is
  `sha256:1025da4527ce115f5b8ae53faab85084144705853e059f9b2d84371cf0a48ad1`.
- Candidate-version override smoke proved the inactive Worker accepted the new
  boundary-settlement capability and reported the candidate `87c3...` ruleset
  while default traffic still served the prior `0672...` ruleset.
- The candidate remained at 0% until validation, then Worker and Pages used a
  coordinated cutover to avoid client/Worker checkpoint-schema version skew.
  The Pages upload came from the repository root and included the Functions
  bundle, routes, and service binding.
- Post-release checks confirm the stable and versioned Pages URLs return the
  exact local `b9e8999` assets, availability and leaderboard reads pass, 30/30
  routing probes on each URL reached the new Worker, and a real Chromium boot
  test found no JavaScript errors on either URL.
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
unchanged. The Worker-only release did not modify Pages/UI sources or visual
receipts.

## Protected working trees and release refs

- The deployed source is fixed by
  `online-v3-production-2026-08-18-b9e8999`; subsequent documentation commits
  are not part of the Worker or Pages artifact.
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
