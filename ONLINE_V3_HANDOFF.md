# Online v3 - Current handoff

Updated: 2026-08-26

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
  `10d90d1665d8228983cdb87622964f720c00c45d` from `main`.
- Production provenance is the annotated tag
  `online-v3-production-2026-08-26-10d90d1`, which points exactly to the
  deployed source commit.
- Production Worker version:
  `93f13ca6-ba16-4833-b1ee-c5ee997a11d3` at 100% (deployment
  `fedbcd08-d778-4e97-903f-318437d46ec1`).
- Recorded Worker rollback version:
  `6fa1a64a-3b28-4e69-8657-4c42f4e04987`.
- Production Pages deployment:
  `5ac8a9f8-5e6f-42fc-8608-92390c18e1e9`, source `10d90d1`, immutable URL
  `https://5ac8a9f8.dungeon-of-one-room.pages.dev`.
- Recorded Pages rollback deployment:
  `dbf167e8-f51b-40bd-8b88-69684f1ac097`, source `388c179`.
- Active production ruleset:
  `sha256:9d6069993fd07784ecfdc146825a8a7b82cde1fd7412f351aeba1ab86c539dbe`.
- Retained previous ruleset:
  `sha256:48b5bd86604a5f8dae58a4dcf2b1ed9a72252b3e4942fc20693b3e0a8e91438e`.
- No D1 migration was required for this release; production reports
  `No migrations to apply`.

This release repairs a Ranked integrity false positive in elite reward
settlement. The Worker now accepts either the exact canonical gold pair or the
known v0.8 local elite presentation pair. Arbitrary settlement values still
fail closed, and authoritative wallet settlement remains canonical.

The previous production descriptor remains executable for recovery of runs
pinned to `48b5...`. No D1 schema or protected local combat/UI code changed.

## Latest release evidence

- Exact committed source `10d90d1665d8228983cdb87622964f720c00c45d`
  passed `npm run verify:full`: 1084/1084. The release log is
  `output/verification/full-20260826T053453625Z.log`.
- Kamil explicitly reviewed and approved all six current archive screenshots.
  The recorded visual source fingerprint is
  `sha256:29ff5286b404360a4838d789c9bc7d7870005f3bba7ca1af9ed0c7292b797fe9`.
- Focused pre-release checks passed: the 13/13 Ranked integrity regression
  suite, syntax checks, `verify:phase`, `verify:guard` 15/15, fresh
  `verify:ranked-headed -- --scenario lifecycle`, and `git diff --check`.
- The Pages upload came from the repository root and included the Functions
  bundle, routes, and service binding.
- Worker rollout used explicit version IDs at 5%, 25%, and 100%. Availability
  smoke returned 20/20 valid responses at 5%, 24/24 at 25%, and 12/12 after
  the 100% switch.
- Post-deploy byte checks confirm both stable and immutable Pages URLs return
  the exact local `config.js`, Ranked protocol, and sanitized visual receipt.
  Both roots return HTTP 200. Availability reports production active with
  ruleset `9d606999...`, and Worker deployment `fedbcd08...` serves version
  `93f13ca6...` at 100%.
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
unchanged. This Worker integrity fix did not modify archive UI, the protected
baseline, or the reviewed visual source fingerprint.

## Protected working trees and release refs

- The deployed Pages and Worker source is fixed by
  `online-v3-production-2026-08-26-10d90d1`. Subsequent documentation commits
  are not part of either deployed artifact.
- `npm run status:compact` reported zero protected Vault Guardian WIP entries
  and zero local Wrangler-state entries before the release record was written.
- The untracked files `.tmp-apply-probe.txt`,
  `docs/plans/2026-08-13-ranked-playtest-fixes.md`, and
  `docs/plans/2026-08-18-ranked-boundary-checkpoints-design.local-untracked.md`
  remain intentionally untouched and are not part of the release.

Always confirm with `npm run status:compact`. Before staging or committing,
inspect the full `git status --short` and stage only explicit paths.

## History

This file intentionally contains only the current operational snapshot.
Completed handoff history remains available through Git history and the
relevant `docs/ONLINE_V3_*` or `docs/history/` records. Do not load that
history automatically for a small isolated task.
