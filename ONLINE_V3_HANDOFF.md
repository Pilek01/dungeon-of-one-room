# Online v3 - Current handoff

Updated: 2026-08-28

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
  `617ef19aff832810abcbbb77fd7866ef2963146d` from `main`.
- Production provenance is the annotated tag
  `online-v3-production-2026-08-28-617ef19`, which points exactly to the
  deployed source commit.
- Production Worker version:
  `0fef666a-eee4-43a8-b29f-f635d47fe4f1` at 100% (deployment
  `2ff3925b-b0e8-4e83-8dcc-72cd9ecabbe2`).
- Recorded Worker rollback version:
  `3e869b66-2d86-4fdf-add3-af7efcce49c2`.
- Production Pages deployment:
  `dcbfbc0b-bb37-494e-9054-2229fda4c6a3`, source `617ef19`, immutable URL
  `https://dcbfbc0b.dungeon-of-one-room.pages.dev`.
- Recorded Pages rollback deployment:
  `b67e0708-b301-44e5-99d6-eff408586355`, source `78c7bc1`.
- Active production ruleset:
  `sha256:78ae2f6f797063b7f364e5652e3367f6b26d651302f5c6038576d304dc442ec3`.
- Retained previous ruleset:
  `sha256:25dbdb962a478b3a46375ad5b25a3603041edd95ff45b51e2846b13ce7ea2989`.
- No D1 migration was required for this release; production reports
  `No migrations to apply`. Pre-release Time Travel bookmark:
  `00000cda-00000000-000050d5-5946549897606f7d94287dd03616720f`.

This release preserves exact Shrine-adjusted HP at Ranked boundaries, gates
Map Fragment drops to depth 11+, retains potion-use ordering around canonical
potion chests, and carries exact Worker-issued chest ATK/ARM/HP totals through
checkpoint recovery. Practice Continue uses the same exact carry behavior.
Armor balance, its 70% cap, chest probabilities, and per-depth bucket limits
remain unchanged. The previous Worker and Pages deployments remain the direct
rollback pair.

## Latest release evidence

- Exact committed source `617ef19aff832810abcbbb77fd7866ef2963146d`
  passed a forced fresh `verify:full`: 1100/1100. The release log is
  `output/verification/full-20260828T082734684Z.log`.
- Codex visually reviewed all six current archive screenshots after the source
  fingerprint changed without a record-archive UI change. The recorded visual
  source fingerprint is
  `sha256:e898d8875b47b8d0acac295cc42d8615c67c8311eb8ba6d55f6444e038b9f3b3`.
- The complete Worker suite passed 1076/1076, real local Wrangler/D1 passed
  21/21, protected baseline guard passed 3/3, and both committed browser
  scenarios passed.
- Pages was deployed first so the new client could accept both the retained
  `25dbdb...` ruleset and the new `78ae2...` ruleset during Worker rollout.
  The first static-only upload `6c376290...` was immediately superseded after
  smoke testing detected that it omitted Functions. `dcbfbc0b...` includes
  the Pages Functions bundle and service binding and is the recorded deployment.
- Post-deploy byte checks confirm both stable and immutable Pages URLs return
  the exact local `config.js`, `game.js`, Ranked runtime, Ranked protocol, and
  sanitized visual receipt. Stable and immutable root, availability, and
  leaderboard smoke checks return HTTP 200 with JSON on API routes.
- Worker rollout progressed through 5%, 25%, and 100%. Read-only availability
  sampling observed 5/80 new responses at 5%, 22/80 at 25%, and 50/50 new
  responses after activation.
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
unchanged. This release did not modify archive UI; Codex reviewed the six
required screenshots after the source fingerprint changed.

## Protected working trees and release refs

- The deployed Worker and Pages source is fixed by
  `online-v3-production-2026-08-28-617ef19`. Subsequent documentation commits
  are not part of either deployed artifact. The direct Worker and Pages
  rollback source is fixed by `online-v3-production-2026-08-27-78c7bc1`.
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
