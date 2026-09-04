# Online v3 - Current handoff

Updated: 2026-09-04

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

- Production Pages source commit and game version:
  `1562a29dbc73167315da4d57c90465fca4ac9bbc` from `main`, `v0.8.3`.
- Production provenance is the annotated tag
  `online-v3-production-2026-09-04-1562a29`, which points exactly to the
  deployed Pages source commit.
- Production Worker source commit:
  `1562a29dbc73167315da4d57c90465fca4ac9bbc` from `main`, fixed by the same
  annotated production tag.
- Production Worker version:
  `8657997c-3b6f-48c8-b25d-4d6af7b948f5` at 100% (message
  `1562a29-production-100-percent`, created `2026-09-04T16:55:29.469Z`).
- Recorded Worker rollback version:
  `21927095-1d9e-4501-be9a-f68477fb4960`.
- Production Pages deployment:
  `d595de32-9428-4573-b8d9-b35b2e28ed96`, source `1562a29`, immutable URL
  `https://d595de32.dungeon-of-one-room.pages.dev`.
- Recorded Pages rollback deployment:
  `5eb58a9d-0e04-4eae-9987-ccd6dd2e14f8`, source `f5a3aae`.
- Active production ruleset:
  `sha256:6f3df4c80298d16c42ca9277adb533f63a6c767fed209000aa17340ad7da8758`.
- The direct predecessor production ruleset is
  `sha256:125736f040dfd77d8d7a1fe26126a235dc80dd39c7899c2e84d55dcaf7ea5ea5`;
  its compatibility descriptor remains retained.
- No D1 migration was required for this release; production reports
  `No migrations to apply`. Pre-release Time Travel bookmark:
  `00000fc9-00000000-000050dc-e927053b30d03bdbc29c865604717dc7`.

This release activates fatal-potion ordering and Shrine summoned-elite budget
repairs, keeps starting-relic uniqueness, and ships bounded transient-response
recovery for Ranked. It also includes local-only Observer profiles and movement
repairs plus the `v0.8.3` identity. Retries preserve the exact idempotency key
and body, canonical resync remains server-derived, and non-retryable or invalid
responses continue to fail closed. The prior Worker and last known-good Pages
deployment are the direct rollback pair.

## Latest release evidence

- Exact committed source `1562a29dbc73167315da4d57c90465fca4ac9bbc`
  passed a fresh `verify:full`: 1155/1155. The release log is
  `output/verification/full-20260904T162324952Z.log`.
- The complete Worker suite passed 1131/1131, real local Wrangler/D1 passed
  21/21, protected baseline guard passed 3/3, and both committed browser
  scenarios passed.
- Kamil approved and Codex verified all six fresh archive screenshots. The
  recorded visual source fingerprint is
  `sha256:f5c903f96da4cb9c16f9b32f1ab3a0c5178ebd2a847df18c8533f42877234b9d`.
- Worker version `8657997c-3b6f-48c8-b25d-4d6af7b948f5` passed 5% and 25%
  canaries. Availability sampled the expected new/prior distributions 9/111
  and 26/94 with zero errors. It is active at 100%; after propagation, final
  availability sampled the new hash 100/100 with zero errors.
- Pages deployment `d595de32...` includes the Functions bundle, production
  service binding, and 2,175-file verified bundle. Stable and immutable roots,
  availability, and leaderboard return HTTP 200 with JSON API responses;
  `config.js`, `game.js`, the Ranked protocol, and the Ranked runtime match the
  local release byte-for-byte on both hosts.
- Smoke caught that the first `4306e67f...` upload was invoked from the Worker
  subdirectory and therefore lacked the Pages Functions bundle. It was
  immediately superseded by `d595de32...`, deployed from the repository root;
  the stable hostname now resolves only to the corrected deployment.
- No release smoke mutated D1. Production reported no pending migrations and
  the pre-release Time Travel bookmark is recorded above.

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
unchanged. This release changed the game version and Ranked runtime source;
Kamil approved and Codex verified the six required screenshots after the
source fingerprint changed.

## Protected working trees and release refs

- The deployed Pages and Worker source is fixed by
  `online-v3-production-2026-09-04-1562a29`. Subsequent documentation commits
  are not part of either deployed artifact. The direct Pages and Worker
  rollback source is `online-v3-production-2026-09-02-f5a3aae`.
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
