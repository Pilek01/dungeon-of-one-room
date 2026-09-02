# Online v3 - Current handoff

Updated: 2026-09-02

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
  `f5a3aae3cb0650e7d33ade5d8561d388e1784c6c` from `main`.
- Production provenance is the annotated tag
  `online-v3-production-2026-09-02-f5a3aae`, which points exactly to the
  deployed Pages source commit.
- Production Worker source commit:
  `f5a3aae3cb0650e7d33ade5d8561d388e1784c6c` from `main`, fixed by the same
  annotated production tag.
- Production Worker version:
  `21927095-1d9e-4501-be9a-f68477fb4960` at 100% (deployment
  `ca73676d-23ea-4692-ab99-d08cc398c4ce`, message
  `f5a3aae-production-100-percent`, created `2026-09-02T04:01:49.271654Z`).
- Recorded Worker rollback version:
  `4555b56a-24d0-413d-a743-c3dbe2c0c7f2`.
- Production Pages deployment:
  `5eb58a9d-0e04-4eae-9987-ccd6dd2e14f8`, source `f5a3aae`, immutable URL
  `https://5eb58a9d.dungeon-of-one-room.pages.dev`.
- Recorded Pages rollback deployment:
  `858eb6c0-b0f1-47bb-bef1-b7c853d69e20`, source `cbd9d69`.
- Active production ruleset:
  `sha256:125736f040dfd77d8d7a1fe26126a235dc80dd39c7899c2e84d55dcaf7ea5ea5`.
- The direct predecessor production ruleset is
  `sha256:ce2e838fc8359c266396e98ed3ab87b54c92725b7e4d235c0dd96b770ba31389`;
  its compatibility descriptor remains retained.
- No D1 migration was required for this release; production reports
  `No migrations to apply`. Pre-release Time Travel bookmark:
  `00000ecd-00000000-000050da-10c60ab699405cd4d1d095d1912c7fd4`.

This release activates the recovery ruleset containing the Crossroads start,
elite reported-gold parity, Forge blocked-tile recovery, and Observer potion
survival repairs. Canonical elite rewards and real-player gameplay flow remain
unchanged; the Ranked Worker continues exact, fail-closed validation. The prior
Worker and last known-good Pages deployment are the direct rollback pair.

## Latest release evidence

- Exact committed source `f5a3aae3cb0650e7d33ade5d8561d388e1784c6c`
  passed a fresh `verify:full`: 1146/1146. The release log is
  `output/verification/full-20260902T034642479Z.log`.
- The complete Worker suite passed 1122/1122, real local Wrangler/D1 passed
  21/21, protected baseline guard passed 3/3, and both committed browser
  scenarios passed.
- Kamil approved and Codex verified all six fresh archive screenshots. The
  recorded visual
  source fingerprint is
  `sha256:8f4c535ab9da10b3f17bb57616039093087a9b01c29a60c4804a94bd69e7217d`.
- Worker version `21927095-1d9e-4501-be9a-f68477fb4960` passed 5% and 25%
  canaries. Availability sampled the expected new/prior distributions 6/114
  and 19/61 with zero errors. It is active at 100%; after propagation, final
  availability sampled the new hash 100/100 with zero errors.
- Pages deployment `5eb58a9d...` includes the Functions bundle, production
  service binding, and 2,175-file verified bundle. Stable and immutable roots,
  availability, and leaderboard return HTTP 200; `config.js`, `game.js`, the
  Ranked protocol, and the Ranked runtime match the local release byte-for-byte
  on both hosts.
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
  `online-v3-production-2026-09-02-f5a3aae`. Subsequent documentation commits
  are not part of either deployed artifact. The direct Pages and Worker
  rollback source is `online-v3-production-2026-09-01-cbd9d69`.
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
