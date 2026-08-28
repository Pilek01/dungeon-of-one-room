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
  `ff0a0a2dac3ae0785818f4072091d1b2c2e92323` from `main`.
- Production provenance is the annotated tag
  `online-v3-production-2026-08-28-ff0a0a2`, which points exactly to the
  deployed source commit.
- Production Worker version:
  `5b4a41e4-a0c5-4c11-9dfb-f67a6506f93b` at 100% (deployment
  `f71d42fc-245b-44cb-aee2-d1e01dc3cb48`).
- Recorded Worker rollback version:
  `0fef666a-eee4-43a8-b29f-f635d47fe4f1`.
- Production Pages deployment:
  `284844be-b8f4-49cc-a0db-67b01553d9fb`, source `ff0a0a2`, immutable URL
  `https://284844be.dungeon-of-one-room.pages.dev`.
- Recorded Pages rollback deployment:
  `dcbfbc0b-bb37-494e-9054-2229fda4c6a3`, source `617ef19`.
- Active production ruleset:
  `sha256:78ae2f6f797063b7f364e5652e3367f6b26d651302f5c6038576d304dc442ec3`.
- Retained previous ruleset:
  `sha256:25dbdb962a478b3a46375ad5b25a3603041edd95ff45b51e2846b13ce7ea2989`.
- No D1 migration was required for this release; production reports
  `No migrations to apply`. Pre-release Time Travel bookmark:
  `00000d08-00000000-000050d5-26b50efec54268b0114cf17cbeaf1066`.

This release adds bounded, redacted correlation across Ranked recovery,
Observer Bot trace exports, and Worker error logs. The reconnect screen exposes
the complete trace ID and a diagnostic export. Tokens, credentials, nonces,
digests, and arbitrary request fields remain excluded. Gameplay, canonical
state, anti-cheat decisions, ruleset behavior, D1 schema, and Practice remain
unchanged. The previous Worker and Pages deployments are the direct rollback
pair.

## Latest release evidence

- Exact committed source `ff0a0a2dac3ae0785818f4072091d1b2c2e92323`
  passed a forced fresh `verify:full`: 1104/1104. The release log is
  `output/verification/full-20260828T183722545Z.log`.
- Codex visually reviewed all six current archive screenshots after the source
  fingerprint changed without a record-archive UI change. The recorded visual
  source fingerprint is
  `sha256:52d389001ab98b282608a4c96cc90ce5c3d86484db6ac99487b99134ac22834b`.
- The complete Worker suite passed 1080/1080, real local Wrangler/D1 passed
  21/21, protected baseline guard passed 3/3, and both committed browser
  scenarios passed.
- Pages was deployed first and `284844be...` includes the Functions bundle and
  production service binding. It was built from the exact source commit with
  2,175 files and the current sanitized visual receipt.
- Post-deploy byte checks confirm both stable and immutable Pages URLs return
  the exact local `config.js`, `game.js`, Ranked runtime, and sanitized visual
  receipt. Stable and immutable root, availability, and leaderboard smoke
  checks return HTTP 200 with JSON on API routes.
- Worker rollout progressed through 5%, 25%, and 100%. The 5% stage completed
  60/60 read-only availability checks over 15 minutes. The 25% stage remained
  active for about 56 minutes across a local PC restart; its pre-restart sample
  reached 56/56 and its post-restart gate passed 50/50 availability plus 10/10
  leaderboard checks. After activation, production passed 50/50 availability,
  10/10 leaderboard, and 4/4 exact asset checks.
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
  `online-v3-production-2026-08-28-ff0a0a2`. Subsequent documentation commits
  are not part of either deployed artifact. The direct Worker and Pages
  rollback source is fixed by `online-v3-production-2026-08-28-617ef19`.
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
