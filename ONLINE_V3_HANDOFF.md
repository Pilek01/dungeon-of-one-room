# Online v3 - Current handoff

Updated: 2026-09-01

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
  `cbd9d6916e6cef3c95537f4a1460bd28af214fa4` from `main`.
- Production provenance is the annotated tag
  `online-v3-production-2026-09-01-cbd9d69`, which points exactly to the
  deployed Pages source commit.
- Production Worker source commit:
  `cbd9d6916e6cef3c95537f4a1460bd28af214fa4` from `main`, fixed by the same
  annotated production tag.
- Production Worker version:
  `4555b56a-24d0-413d-a743-c3dbe2c0c7f2` at 100% (deployment message
  `cbd9d69-production-100-percent`, created `2026-09-01T03:52:05.581Z`).
- Recorded Worker rollback version:
  `eefeeff3-ec66-499b-bfb4-6eb6968e2a9f`.
- Production Pages deployment:
  `858eb6c0-b0f1-47bb-bef1-b7c853d69e20`, source `cbd9d69`, immutable URL
  `https://858eb6c0.dungeon-of-one-room.pages.dev`.
- Recorded Pages rollback deployment:
  `8bfbe730-9bc6-4f0a-b510-756653f67ce6`, source `09d69e5`.
- Active production ruleset:
  `sha256:ce2e838fc8359c266396e98ed3ab87b54c92725b7e4d235c0dd96b770ba31389`.
- Retained predecessor descriptors include room-navigation candidate
  `sha256:eaa89c82df5b7053f55e81fc4f8cf641e8b0bb115cbe446979bab52916886212`
  and the previous actual production ruleset
  `sha256:5ba35a1c03cf160787c553d55782ddb1ec4612a9a08f2dc26da562feeccc73c2`.
- No D1 migration was required for this release; production reports
  `No migrations to apply`. Pre-release Time Travel bookmark:
  `00000e65-00000000-000050d9-355312488c68af32a9ded6b949f1f044`.

This release promotes the room-elite-budget ruleset and ships the accumulated
Ranked transition, duplicate-settlement, Merchant, post-room Pact, Otter, and
Observer navigation repairs. It also includes the eight-bot local test wall,
durable launcher telemetry/restarts, distributed starting relic choices,
campaign Chronicle turns and Warden totals, muted automated tests, and the Help
layout repair. Worker validation remains exact and fail-closed. The prior
Worker and Pages deployments are the direct rollback pair.

## Latest release evidence

- Exact committed source `cbd9d6916e6cef3c95537f4a1460bd28af214fa4`
  passed a fresh `verify:full`: 1139/1139. The release log is
  `output/verification/full-20260901T034144046Z.log`.
- The complete Worker suite passed 1115/1115, real local Wrangler/D1 passed
  21/21, protected baseline guard passed 3/3, and both committed browser
  scenarios passed.
- Kamil approved and Codex verified all six fresh archive screenshots. The
  recorded visual
  source fingerprint is
  `sha256:9809930dab887292f1ffd8a163b6a332dfc5b732c03ebba888592c9956daaa32`.
- Worker version `4555b56a-24d0-413d-a743-c3dbe2c0c7f2` passed 5% and 25%
  canaries. Availability sampled the expected new/prior distributions 4/56
  and 10/30 with zero errors. It is active at 100%; final availability sampled
  the new hash 30/30 with zero errors.
- Pages deployment `858eb6c0...` includes the Functions bundle, production
  service binding, and 2,175-file verified bundle. Stable and immutable roots,
  availability, and leaderboard return HTTP 200; `config.js`, `game.js`, and
  the Ranked runtime match the local release byte-for-byte on both hosts.
- A non-mutating POST probe returned JSON `400 IDEMPOTENCY_KEY_REQUIRED`,
  confirming the Functions proxy without creating a run or changing D1.
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
unchanged. This release modified archive Chronicle output; Kamil approved and
Codex verified the six required screenshots after the source fingerprint
changed.

## Protected working trees and release refs

- The deployed Pages and Worker source is fixed by
  `online-v3-production-2026-09-01-cbd9d69`. Subsequent documentation commits
  are not part of either deployed artifact. The direct Pages and Worker
  rollback source is `online-v3-production-2026-08-29-09d69e5`.
- `npm run status:compact` reported zero protected Vault Guardian WIP entries
  and zero local Wrangler-state entries before the release record was written.
- The untracked files `.tmp-apply-probe.txt`,
  `docs/plans/2026-08-13-ranked-playtest-fixes.md`, and
  `docs/plans/2026-08-18-ranked-boundary-checkpoints-design.local-untracked.md`
  plus the pre-existing `progress.md` modification remain intentionally
  untouched and are not part of the release.

Always confirm with `npm run status:compact`. Before staging or committing,
inspect the full `git status --short` and stage only explicit paths.

## History

This file intentionally contains only the current operational snapshot.
Completed handoff history remains available through Git history and the
relevant `docs/ONLINE_V3_*` or `docs/history/` records. Do not load that
history automatically for a small isolated task.
