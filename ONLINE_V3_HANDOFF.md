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
  `e7271b35d7501527152ce3144a778a7192a74bcc` from `main`, `v0.8.3`.
- Production provenance is the annotated tag
  `online-v3-production-2026-09-04-e7271b3`, which points exactly to the
  deployed Pages source commit.
- Production Worker source commit:
  `e7271b35d7501527152ce3144a778a7192a74bcc` from `main`, fixed by the same
  annotated production tag.
- Production Worker version:
  `e0e2f9c6-6ede-4c5f-9106-ca009743abae` at 100% (message
  `e7271b3-production-100-percent`, created `2026-09-04T19:21:39.768Z`).
- Recorded Worker rollback version:
  `8657997c-3b6f-48c8-b25d-4d6af7b948f5`.
- Production Pages deployment:
  `d3c90d21-ccf9-4eb6-b717-6f5d8bf9c690`, source `e7271b3`, immutable URL
  `https://d3c90d21.dungeon-of-one-room.pages.dev`.
- Recorded Pages rollback deployment:
  `d595de32-9428-4573-b8d9-b35b2e28ed96`, source `1562a29`.
- Active production ruleset:
  `sha256:dc8b9d11a97fe35d670089a03141b70174d62d9af39a8dabd12733193ae2ce3e`.
- The direct predecessor production ruleset is
  `sha256:6f3df4c80298d16c42ca9277adb533f63a6c767fed209000aa17340ad7da8758`;
  its compatibility descriptor remains retained.
- No D1 migration was required for this release; production reports
  `No migrations to apply`. Pre-release Time Travel bookmark:
  `00000fd7-00000000-000050dc-3988f506dee72cc7b2db95b14bacbd79`.

This release adds a password-gated production Observer Bot profile chooser.
After unlock, Endurance D50, Player-like, or Endgame coverage starts
immediately; launcher-injected profiles continue to bypass the chooser, and
Toggle still pauses or resumes the selected profile. The ruleset's canonical
gameplay data and capabilities are unchanged; its new hash records updated
`game.js` source provenance while retaining the prior production hash for
active runs. The prior Worker and last known-good Pages deployment are the
direct rollback pair.

## Latest release evidence

- Exact committed source `e7271b35d7501527152ce3144a778a7192a74bcc`
  passed a fresh `verify:full`: 1157/1157. The release log is
  `output/verification/full-20260904T190908375Z.log`.
- The complete Worker suite passed 1133/1133, real local Wrangler/D1 passed
  21/21, protected baseline guard passed 3/3, and both committed browser
  scenarios passed.
- Kamil approved and Codex verified all six fresh archive screenshots. The
  recorded visual source fingerprint is
  `sha256:f7b2f1aea0b716422d57cbaaa193b8f9cab41cd11c84a2191e35b41f95e381cd`.
- Worker version `e0e2f9c6-6ede-4c5f-9106-ca009743abae` passed 5% and 25%
  canaries. Availability sampled the exact new/prior distributions 5/115
  and 30/90 with zero errors. It is active at 100%; after propagation, final
  availability sampled the new hash 100/100 with zero errors.
- Pages deployment `d3c90d21...` includes the Functions bundle, production
  service binding, and 2,175-file verified bundle. Stable and immutable roots,
  availability, and leaderboard return HTTP 200 with JSON API responses;
  `config.js`, `game.js`, the Ranked protocol, and the Ranked runtime match the
  local release byte-for-byte on both hosts.
- The first otherwise-correct `fe512e95...` upload carried an incorrect full
  commit metadata value after the correct `e7271b3` prefix. It was immediately
  superseded by `d3c90d21...` with the exact full commit hash; the stable
  hostname resolves to the corrected deployment.
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
  `online-v3-production-2026-09-04-e7271b3`. Subsequent documentation commits
  are not part of either deployed artifact. The direct Pages and Worker
  rollback source is `online-v3-production-2026-09-04-1562a29`.
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
