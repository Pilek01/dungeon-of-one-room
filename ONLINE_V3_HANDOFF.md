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

- Production Pages source commit:
  `188649567ca4668b55126e1f615eaeac1b9bce6e` from `main`.
- Production Pages provenance is the annotated tag
  `online-v3-production-2026-08-26-1886495`, which points exactly to the
  deployed source commit. The unchanged Worker source remains
  `10d90d1665d8228983cdb87622964f720c00c45d`.
- Production Worker version:
  `93f13ca6-ba16-4833-b1ee-c5ee997a11d3` at 100% (deployment
  `fedbcd08-d778-4e97-903f-318437d46ec1`).
- Recorded Worker rollback version:
  `6fa1a64a-3b28-4e69-8657-4c42f4e04987`.
- Production Pages deployment:
  `0e3091d4-dd78-4fe2-b597-d82601539dfe`, source `1886495`, immutable URL
  `https://0e3091d4.dungeon-of-one-room.pages.dev`.
- Recorded Pages rollback deployment:
  `5ac8a9f8-5e6f-42fc-8608-92390c18e1e9`, source `10d90d1`.
- Active production ruleset:
  `sha256:9d6069993fd07784ecfdc146825a8a7b82cde1fd7412f351aeba1ab86c539dbe`.
- Retained previous ruleset:
  `sha256:48b5bd86604a5f8dae58a4dcf2b1ed9a72252b3e4942fc20693b3e0a8e91438e`.
- No D1 migration was required for this release; production reports
  `No migrations to apply`.

This release prevents repeated Ranked Merchant leave decisions from advancing
multiple canonical depths while the Observer Bot remains in one local room.
The generated bot policy now marks the Merchant visit complete after issuing
leave, and the Ranked runtime latches a successful leave to the active local
directive so the same room cannot checkpoint twice.

The Worker, protocol, ruleset, D1 schema, and protected local combat/UI code
did not change. The previous Pages deployment remains the direct rollback.

## Latest release evidence

- Exact committed source `188649567ca4668b55126e1f615eaeac1b9bce6e`
  passed a forced fresh `npm run verify:full`: 1085/1085. The release log is
  `output/verification/full-20260826T065032090Z.log`.
- Kamil explicitly reviewed and approved all six current archive screenshots.
  The recorded visual source fingerprint is
  `sha256:efb4cc22e813d378cb65666111db7303ec910c2dc6eaf0bb6f31b85b190d17a9`.
- Focused pre-release checks passed: the Merchant RED/GREEN regression suite
  at 9/9, JavaScript syntax checks, fresh
  `verify:ranked-headed -- --scenario lifecycle`, and `git diff --check`.
- The Pages upload came from the repository root and included the Functions
  bundle, routes, and service binding.
- No Worker upload or rollout was performed because the Worker source,
  production config, migrations, and protocol are byte-unchanged from the
  active Worker release.
- Post-deploy byte checks confirm both stable and immutable Pages URLs return
  the exact local `config.js`, `game.js`, Ranked runtime, Ranked protocol, and
  sanitized visual receipt. Both roots return HTTP 200. Availability reports
  production active with ruleset `9d606999...`, and Worker deployment
  `fedbcd08...` continues to serve version `93f13ca6...` at 100%.
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
unchanged. This Pages runtime fix did not modify archive UI or the protected
baseline; Kamil re-approved the six required screenshots for the new runtime
source fingerprint.

## Protected working trees and release refs

- The deployed Pages source is fixed by
  `online-v3-production-2026-08-26-1886495`; the unchanged Worker remains fixed
  by `online-v3-production-2026-08-26-10d90d1`. Subsequent documentation
  commits are not part of either deployed artifact.
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
