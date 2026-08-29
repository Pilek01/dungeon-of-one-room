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
  `5fef218ab69a35e2d4d6e8415ebd5bf0315b820a` from `main`.
- Production provenance is the annotated tag
  `online-v3-production-2026-08-29-5fef218`, which points exactly to the
  deployed Pages source commit.
- Production Worker source commit:
  `f384eea02a39ce5f6ee36f372625131133d2b37a` from `main`, fixed by the
  annotated tag `online-v3-production-2026-08-29-f384eea`.
- Production Worker version:
  `fec399a9-7ae6-4191-b281-a3b8f3fa4e94` at 100% (deployment
  `0bbb3ce7-3b90-4fcb-8f0b-d2994b573323`).
- Recorded Worker rollback version:
  `5b4a41e4-a0c5-4c11-9dfb-f67a6506f93b`.
- Production Pages deployment:
  `dad85291-4ee2-499c-9f39-8cc43cbd9b17`, source `5fef218`, immutable URL
  `https://dad85291.dungeon-of-one-room.pages.dev`.
- Recorded Pages rollback deployment:
  `284844be-b8f4-49cc-a0db-67b01553d9fb`, source `ff0a0a2`.
- Active production ruleset:
  `sha256:78ae2f6f797063b7f364e5652e3367f6b26d651302f5c6038576d304dc442ec3`.
- Retained previous ruleset:
  `sha256:25dbdb962a478b3a46375ad5b25a3603041edd95ff45b51e2846b13ce7ea2989`.
- No D1 migration was required for this release; production reports
  `No migrations to apply`. Pre-release Time Travel bookmark:
  `00000d1c-00000000-000050d5-2fb356d453a892670917e10600ef85a5`.

This release repairs the Worker-side settlement of a legal Health chest when
the browser sends its pre-settlement HP boundary. The compatibility layer uses
only the server-issued, slot-bound canonical Health award, then leaves the
authoritative ruleset to validate the normalized boundary. True `BOUNDARY_*`
validation failures now remain actionable 422 diagnostics instead of becoming
generic `INTERNAL_ERROR`. Rulesets, bindings, D1, Pages, Practice, and ordinary
combat remain unchanged. The prior Worker version is the direct rollback.

## Latest release evidence

- Exact committed Worker source `f384eea02a39ce5f6ee36f372625131133d2b37a`
  passed the focused Health/boundary regression suite: 30/30. The release
  gate reused an identical passing `verify:full` receipt: 1106/1106,
  `output/verification/receipt-full.json`.
- Worker version `fec399a9-7ae6-4191-b281-a3b8f3fa4e94` is active at 100%.
  Production availability and leaderboard reads returned HTTP 200, the active
  ruleset hash remained unchanged, and D1 reported `No migrations to apply`.
- Exact committed source `5fef218ab69a35e2d4d6e8415ebd5bf0315b820a`
  passed a forced fresh `verify:full`: 1106/1106. The release log is
  `output/verification/full-20260828T221825804Z.log`.
- Codex visually reviewed all six current archive screenshots after the source
  fingerprint changed without a record-archive UI change. The recorded visual
  source fingerprint is
  `sha256:aae4bd33a91adb28c507284e734155e0e8a02a55a2dda2d7b903d41ee3d8cdd8`.
- The complete Worker suite passed 1082/1082, real local Wrangler/D1 passed
  21/21, protected baseline guard passed 3/3, and both committed browser
  scenarios passed.
- Pages deployment `dad85291...` includes the Functions bundle and
  production service binding. It was built from the exact source commit with
  2,175 files and the current sanitized visual receipt.
- Post-deploy byte checks confirm both stable and immutable Pages URLs return
  the exact local `config.js`, `game.js`, Ranked runtime, and sanitized visual
  receipt. Stable and immutable root, availability, and leaderboard smoke
  checks return HTTP 200 with JSON on API routes.
- The previous Pages release kept Worker version `5b4a41e4...` at 100%. Stable
  and immutable Pages roots, availability, and leaderboard checks returned
  HTTP 200, and all four exact asset comparisons matched that verified local
  release bundle.
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
