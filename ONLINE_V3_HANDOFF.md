# Online v3 - Current handoff

Updated: 2026-09-09

## Task authority

The current user prompt defines the task. `docs/tasks/CURRENT.md` is
`Status: NONE`. This release was explicitly authorized in chat: commit and
full deployment of the current version. This handoff does not authorize
future deployment, migration, backfill, or ruleset activation.

## Architecture boundary

Online v3 controls checkpoint meta-progression around the local v0.8 game.
Combat, movement, AI, animation, audio and rendering remain local. Do not
call the system server-authoritative combat or cheat-proof.

## Current production snapshot

- Pages and Worker source: `26c921b1ff1738e4cbb13aa5a58cd7f4611a7607`,
  game version `v0.8.3`, branch `main`.
- Release source tag: `online-v3-production-2026-09-09-26c921b`.
- Worker: `a238e27d-d283-4e6b-84f0-3012f9bbf125` at 100%, deployment message
  `26c921b-production-100-percent`.
- Pages: `97ffd8bf-d3bb-4fed-ada2-8b543109b3d5`, immutable URL
  https://97ffd8bf.dungeon-of-one-room.pages.dev.
- Stable URL: https://dungeon-of-one-room.pages.dev.
- Active ruleset:
  `sha256:c381c23e71385fec5e411e53b657e4429c3fa2d57edc59f91f984dd3e109f3cb`.
- Previous production hash remains registered for existing runs:
  `sha256:dc8b9d11a97fe35d670089a03141b70174d62d9af39a8dabd12733193ae2ce3e`.

The release includes the previously committed player-motion polish, approved
special-room rotation (scheduled Merchant, map-only Vault, natural special
room cooldowns), and Ranked false-positive fixes. Potion settlement applies
room uses/chests before reward-time Flask transitions; newly acquired Flask
cannot finance earlier uses. Crossroads excludes transaction gold from room
earnings and durably projects a single choice, including retry/recovery and
POWER cost before relic effects. The 66-file source commit includes the
related fixtures and regressions. Old failed test sessions were not migrated
or automatically repaired; a fresh run is required to exercise the fix.

## Verification and deployment evidence

- Exact committed source passed `npm run verify:full`: 1173/1173
  (Worker 1149, Wrangler/D1 21, protected guard 3), plus complete committed
  baseline and Ranked browser scenarios. Log:
  `output/verification/full-20260908T220617323Z.log`.
- Current-tree save scenario passed before commit:
  `output/verification/ui-current-20260908T220437625Z.log`.
- Codex inspected all six required archive screenshots. Visual fingerprint:
  `sha256:4246f22fa54f01ca78f210bbe533a341fde2595532d05a7720b833999cbcebc0`.
- `npm run pages:build` and `node scripts/verify-pages-production-bundle.mjs`
  passed; release bundle contains 2175 files and preserves the configured
  password gate. The build identity derives commit and date automatically.
- Worker was uploaded inactive, then deployed at 5%, 25%, and 100%.
  Availability samples were 6 new / 114 old at 5%, 37 new / 83 old after
  25% propagation, then 120 new / 0 old at 100%, with no failed responses.
  These are short availability samples, not long-duration load testing.
- Stable and immutable roots, availability, and season-1 leaderboard return
  HTTP 200. config.js, game.js, Ranked protocol and runtime match the local
  release byte-for-byte on both hosts. Reports:
  `output/verification/release-stable-20260909.json` and
  `output/verification/release-immutable-20260909.json`.
- Initial smoke leaderboard requests omitted the required season and returned
  HTTP 400. Corrected requests passed; no application change was needed.
- Production D1 reports no pending migrations. No production data mutation
  was performed by the read-only smoke checks.
- The complete eight-bot session was not rerun as part of this release.

## Rollback

- Previous Worker: `e0e2f9c6-6ede-4c5f-9106-ca009743abae`.
- Previous Pages: `d3c90d21-ccf9-4eb6-b717-6f5d8bf9c690`.
- Previous source: `e7271b35d7501527152ce3144a778a7192a74bcc`, tag
  `online-v3-production-2026-09-04-e7271b3`.
- Pre-release D1 Time Travel bookmark:
  `00001162-00000000-000050e0-63dcf7b8d6f4098320ddceaa13d643e7`.
- No schema migration accompanied this release. A rollback involving runs
  already created with the new hash requires checking predecessor support;
  do not assume the old Worker understands the newly activated hash.

## Working tree and verification workflow

The deployment-record commit after the source commit changes documentation
only and is not the source of deployed artifacts. No Git push was performed.
The local launcher can now use the committed fixed source.

The following unrelated untracked files remain intentionally excluded:
`.tmp-apply-probe.txt`, `docs/audits/2026-09-07-game-design-and-hd-v2-audit.md`,
`docs/plans/2026-08-13-ranked-playtest-fixes.md`, and
`docs/plans/2026-08-18-ranked-boundary-checkpoints-design.local-untracked.md`.

Use `npm run status:compact` and the verification levels in AGENTS.md for the
next task. Current-tree browser checks are scenario-specific; baseline tests
committed HEAD, and verify:full includes the complete committed baseline,
Ranked browser scenarios and Wrangler/D1. Reuse identical passing receipts.

Completed release history remains in Git; do not load it automatically for
small unrelated tasks.
