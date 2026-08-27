# Online v3 - Current handoff

Updated: 2026-08-27

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

- Production source commit:
  `78c7bc19f910ae8b87bea446444b1b58b9e357da` from `main`.
- Production provenance is the annotated tag
  `online-v3-production-2026-08-27-78c7bc1`, which points exactly to the
  deployed source commit.
- Production Worker version:
  `3e869b66-2d86-4fdf-add3-af7efcce49c2` at 100% (deployment
  `5c84cfa5-749f-4d97-8994-0fcf88ebd5b1`).
- Recorded Worker rollback version:
  `93f13ca6-ba16-4833-b1ee-c5ee997a11d3`.
- Production Pages deployment:
  `b67e0708-b301-44e5-99d6-eff408586355`, source `78c7bc1`, immutable URL
  `https://b67e0708.dungeon-of-one-room.pages.dev`.
- Recorded Pages rollback deployment:
  `0e3091d4-dd78-4fe2-b597-d82601539dfe`, source `1886495`.
- Active production ruleset:
  `sha256:25dbdb962a478b3a46375ad5b25a3603041edd95ff45b51e2846b13ce7ea2989`.
- Retained previous ruleset:
  `sha256:9d6069993fd07784ecfdc146825a8a7b82cde1fd7412f351aeba1ab86c539dbe`.
- No D1 migration was required for this release; production reports
  `No migrations to apply`.

This release restores Practice-compatible maximum-HP ordering at Ranked run
start, preserves and retries a completed checkpoint only when canonical resume
returns the exact same directive ID and nonce, and stops generic internal
errors in recoverable UI instead of rebuilding a completed room indefinitely.
It also makes D1 retention delete dependent non-finalized leaderboard rows
before their expired runs and exposes bounded reward-validation diagnostics.

The release includes the previously prepared Observer Bot safety work for
early potion upgrades, depth-scaled gold banking, offensive mine escapes, and
certain-lethal survival/extraction decisions. The previous Worker and Pages
deployments remain the direct rollback pair.

## Latest release evidence

- Exact committed source `78c7bc19f910ae8b87bea446444b1b58b9e357da`
  passed a fresh `verify:full`: 1089/1089. The release log is
  `output/verification/full-20260827T145723372Z.log`.
- Kamil explicitly reviewed and approved all six current archive screenshots.
  The recorded visual source fingerprint is
  `sha256:fd1fd34d820d4ad0385eee7127b6a6cb84953aacdc75e0a3df70d82e5d85b969`.
- Focused current-tree browser checks passed for Ranked lifecycle, Camp,
  recovery, and Practice save/Continue. The complete Worker suite passed
  1065/1065 and the real local Wrangler/D1 suite passed 21/21.
- Pages was deployed first so the new client could accept both the retained
  `9d606...` ruleset and the new `25dbdb...` ruleset during Worker rollout.
  An initial identical-byte Pages upload was immediately superseded to correct
  its full-SHA provenance metadata; `b67e0708...` is the recorded deployment.
- Post-deploy byte checks confirm both stable and immutable Pages URLs return
  the exact local `config.js`, `game.js`, Ranked runtime, Ranked protocol, and
  sanitized visual receipt. Both roots return HTTP 200.
- Worker rollout progressed through 5%, 25%, and 100%. Read-only availability
  sampling observed 6/80 new responses at 5%, 19/80 at 25%, and 50/50 new
  responses after activation. Root and leaderboard smoke checks return 200.
- No release smoke mutated D1. The production database still reports no
  pending migrations; the pre-release Time Travel bookmark was recorded in
  the Wrangler output.

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

- The deployed Worker and Pages source is fixed by
  `online-v3-production-2026-08-27-78c7bc1`. Subsequent documentation commits
  are not part of either deployed artifact. The prior Pages rollback source is
  fixed by `online-v3-production-2026-08-26-1886495`; the prior Worker rollback
  source remains fixed by `online-v3-production-2026-08-26-10d90d1`.
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
