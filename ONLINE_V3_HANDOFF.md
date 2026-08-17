# Online v3 - Current handoff

Updated: 2026-08-18

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

- Deployed source commit:
  `d441a856cb7d3360ea1579a80cdbc25f92f703a6` from `main`.
- Release provenance is the annotated tag
  `online-v3-production-2026-08-18-d441a85`, which points exactly to the
  deployed source commit.
- Production Worker version:
  `ad6dd38c-cb91-43c2-a0ef-20890695a2d2` at 100% (deployment
  `94680f03-4e60-4119-a116-276c699e62d1`).
- Recorded Worker rollback version:
  `671304f1-de75-4eed-8d1c-a8556d72093b`.
- Production Pages deployment:
  `b7d11cb2-c951-4912-bf60-fca4cec4cfeb`, source `d441a85`.
- Active production ruleset:
  `sha256:0672eb9aaae11865ebae75a4c6d6dc77cc29f4a079afe562355172d26f073bca`.
- Retained previous ruleset:
  `sha256:bc0d548d204557d0cc0ec7f8a358e18246778a13b27c58f5c6cdd73e73621711`.
- D1 migration `0006_leaderboard_snapshots.sql` is applied. The pre-migration
  Time Travel bookmark is
  `00000712-00000000-000050c7-dcc35a66a3fd387efd989c1bce79b263`, and D1 now
  reports `No migrations to apply`.

This release preserves the active ranked playtest ruleset while aligning the
leaderboard rows and adding checkpoint-time Ranked integrity checks. Suspicious
runs become provisional instead of being published, and the room-start gold
context prevents post-combat rewards from causing a false positive. Combat
simulation remains local and no movement or combat-event traffic was added.
Existing runs pinned to `bc0d` remain supported by the retained runtime.

## Latest release evidence

- Exact clean source `d441a856cb7d3360ea1579a80cdbc25f92f703a6`
  passed fresh `npm run verify:full`: 864/864. The release log is
  `output/verification/full-20260817T224954099Z.log`.
- Kamil approved all six current screenshots. The recorded visual source
  fingerprint is
  `sha256:095cda65922fa5434226e7c4263fe8d67331a532b70903f33a4dd9b72622df87`.
- Candidate-version override smoke proved the inactive Worker accepted the new
  checkpoint-integrity schema while default traffic still served the prior
  version. Both paths reported the unchanged active `0672...` ruleset.
- The candidate remained at 0% until validation, then Worker and Pages used a
  coordinated cutover to avoid client/Worker checkpoint-schema version skew.
  The Pages upload came from the repository root and included the Functions
  bundle, routes, and service binding.
- Post-release checks confirm the stable and versioned Pages URLs return the
  exact local `d441a85` assets, availability and leaderboard reads pass, 30/30
  default-routing probes reached the new Worker, and a real Chromium boot test
  found no JavaScript errors on either URL.
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
unchanged. The Worker-only release did not modify Pages/UI sources or visual
receipts.

## Protected working trees and release refs

- The deployed source is fixed by
  `online-v3-production-2026-08-18-d441a85`; subsequent documentation commits
  on `main` are not part of the Worker or Pages artifact.
- `npm run status:compact` reported zero protected Vault Guardian WIP entries
  and zero local Wrangler-state entries before the release record was written.
- The untracked user file
  `docs/plans/2026-08-13-ranked-playtest-fixes.md` remains intentionally
  untouched and is not part of the release.

Always confirm with `npm run status:compact`. Before staging or committing,
inspect the full `git status --short` and stage only explicit paths.

## History

This file intentionally contains only the current operational snapshot.
Completed handoff history remains available through Git history and the
relevant `docs/ONLINE_V3_*` or `docs/history/` records. Do not load that
history automatically for a small isolated task.
