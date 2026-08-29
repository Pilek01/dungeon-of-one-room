# Online v3 - Current handoff

Updated: 2026-08-29

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
  `09d69e5d6521533f47a43eb7d79c29005cd3c225` from `main`.
- Production provenance is the annotated tag
  `online-v3-production-2026-08-29-09d69e5`, which points exactly to the
  deployed Pages source commit.
- Production Worker source commit:
  `09d69e5d6521533f47a43eb7d79c29005cd3c225` from `main`, fixed by the same
  annotated production tag.
- Production Worker version:
  `eefeeff3-ec66-499b-bfb4-6eb6968e2a9f` at 100% (deployment
  `3d781e55-0ac5-4c4d-a747-e1cf3e5e6af5`).
- Recorded Worker rollback version:
  `fec399a9-7ae6-4191-b281-a3b8f3fa4e94`.
- Production Pages deployment:
  `8bfbe730-9bc6-4f0a-b510-756653f67ce6`, source `09d69e5`, immutable URL
  `https://8bfbe730.dungeon-of-one-room.pages.dev`.
- Recorded Pages rollback deployment:
  `dad85291-4ee2-499c-9f39-8cc43cbd9b17`, source `5fef218`.
- Active production ruleset:
  `sha256:5ba35a1c03cf160787c553d55782ddb1ec4612a9a08f2dc26da562feeccc73c2`.
- Retained previous ruleset:
  `sha256:78ae2f6f797063b7f364e5652e3367f6b26d651302f5c6038576d304dc442ec3`.
- No D1 migration was required for this release; production reports
  `No migrations to apply`. Pre-release Time Travel bookmark:
  `00000d75-00000000-000050d6-ca57f10d044401fec88aec5830af14e4`.

This release aligns Ranked local gold arithmetic with the Worker's exact
floating-point mutator order, preventing legal Observer runs from receiving
`REPORTED_GOLD_DELTA_MISMATCH`. Observer economy now spends on Vitality, Blade,
Guard, potion slots, and potion strength through depth 10, reserves 326 gold
from depth 11, and reserves 694 gold from depth 16. Worker validation remains
exact and fail-closed; Practice combat arithmetic is unchanged. The prior
Worker and Pages deployments are the direct rollback pair.

## Latest release evidence

- Exact committed source `09d69e5d6521533f47a43eb7d79c29005cd3c225`
  passed a fresh `verify:full`: 1112/1112. The release log is
  `output/verification/full-20260829T171630446Z.log`.
- The complete Worker suite passed 1088/1088, real local Wrangler/D1 passed
  21/21, protected baseline guard passed 3/3, and both committed browser
  scenarios passed. Exhaustive gold parity coverage checked 352,000 legal
  combinations without a mismatch.
- Codex reviewed and verified all six archive screenshots. The recorded visual
  source fingerprint is
  `sha256:845a0f981f9d579cd9eb658dc3837cd3dc6a7b98d26e1a841709b6a49e4e4ebd`.
- Worker version `eefeeff3-ec66-499b-bfb4-6eb6968e2a9f` passed 5% and 25%
  canaries: 80/80 availability at each stage, with observed distributions 8/72
  and 19/61 between new and prior rulesets. It is active at 100%; final
  availability sampled the new hash 40/40 with zero errors.
- Pages deployment `8bfbe730...` includes the Functions bundle, production
  service binding, and 2,175-file verified bundle. Stable and immutable roots,
  availability, and leaderboard return HTTP 200; `config.js`, `game.js`, and
  the Ranked runtime match the local release byte-for-byte on both hosts.
- Eight non-mutating POST probes across stable and immutable Pages returned
  JSON `400 IDEMPOTENCY_KEY_REQUIRED`, confirming the Functions proxy without
  creating a run or changing D1.
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
unchanged. This release did not modify archive UI; Codex reviewed the six
required screenshots after the source fingerprint changed.

## Protected working trees and release refs

- The deployed Pages source is fixed by
  `online-v3-production-2026-08-29-5fef218`; the deployed Worker source is fixed
  by `online-v3-production-2026-08-29-f384eea`. Subsequent documentation commits
  are not part of either deployed artifact. The direct Pages rollback source
  is `online-v3-production-2026-08-28-ff0a0a2`; the direct Worker rollback
  source is `online-v3-production-2026-08-28-ff0a0a2`.
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
