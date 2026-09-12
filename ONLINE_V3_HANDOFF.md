# Online v3 - Current handoff

Updated: 2026-09-12

## Task authority

The user explicitly authorized commit and full deployment, then confirmed
publication to Cloudflare Worker dungeon-online-v3-production and Pages
dungeon-of-one-room after automatic approval review requested the exact targets.
The current user prompt remains the scope authority; docs/tasks/CURRENT.md is
Status: NONE. This record does not authorize a future release or data migration.

## Architecture boundary

Online v3 controls checkpoint meta-progression. Combat, movement, AI, animation,
audio and rendering remain local. This is not server-authoritative combat or
cheat-proof gameplay. Existing checkpoint validation and historical capabilities
remain enabled.

## Current production snapshot

- Deployed source: 227f65fc60292fffc40f47f0dd460561e95c0deb.
- Source branch: codex/hd2-early-animations; game version remains v0.8.3.
- Source tag: online-v3-production-2026-09-12-227f65f.
- Worker: 3545811b-a55b-404b-aff6-817805d49620 at 100%.
- Deployment message: 227f65f-production-100-percent.
- Pages: 7dfa7cd5-b6f2-4c06-8f87-ff0b78ee7dd4, production channel main.
- Immutable URL: https://7dfa7cd5.dungeon-of-one-room.pages.dev.
- Stable URL: https://dungeon-of-one-room.pages.dev.
- Active ruleset: sha256:79078f4f51858209c9c493333824f9e8077403452fef1cff4d1906a1d9661f5a.
- Immediate predecessor retained: sha256:c381c23e71385fec5e411e53b657e4429c3fa2d57edc59f91f984dd3e109f3cb.
- Earlier supported releases remain registered with their existing capabilities.

The source commit changes 2646 files, chiefly animation frames and source sheets.
The mobile redesign is enabled automatically for touch devices: larger circular
skills on the left, potion/elixir above the centred right D-pad, full-height
side resource rails, responsive Gothic menus and contextual portal/extraction
choices routed through the existing game actions.

HD2 remains opt-in at https://dungeon-of-one-room.pages.dev/?hd2=1. It includes
2400 RGBA frames for the player, all ordinary enemies and boss representations,
plus the NPC skill/SFX presentation audit. Default HD1 artwork remains selected
without the query parameter. Death animation frames are preview-only; combat
rules and turn timings are unchanged. Game identity derives commit/date from
the checkout automatically.

Ruleset data changes record the new source provenance and explicit predecessor
compatibility. Canonical gameplay rules did not change. No production schema
migration, player-data reset or leaderboard rewrite was performed.

## Verification and deployment evidence

- Exact source 227f65f passed npm run verify:full: 1176/1176, zero failed or
  skipped (Worker 1151, local Wrangler/D1 21, protected guard 4), plus the
  complete committed baseline and Ranked lifecycle.
  Log: output/verification/full-20260912T175347788Z.log.
- The source also fixes verification receipt reuse across different HEAD commits,
  locks reviewed HD2 assets with portable JSON checksums, and removes a second
  Enter from Ranked boot QA that could accidentally select Practice after a
  screenshot. Focused receipt, release-binding and checksum tests passed.
- Six archive screenshots were inspected and approved for source fingerprint
  sha256:3f5fe6c2b7d5961a476b5739beeeebbf1f26ff33313fe6e3a1676ca925829f05.
- npm run pages:build and node scripts/verify-pages-production-bundle.mjs passed.
  The production bundle contains 4595 files, preserves the existing password
  gate and excludes QA instrumentation. All 1408 default and 2512 HD2 manifest
  references exist in the bundle.
- Worker rollout: 5%, 25%, 100%. Read-only availability samples returned
  6 new / 114 old, 28 new / 92 old, then 120 new / 0 old, with no failed
  responses. These are short availability checks, not load testing.
- Stable and immutable roots, availability and season-1 leaderboard returned
  HTTP 200. Fifteen representative files including index/config/game, Ranked
  modules, mobile CSS/controller, renderer and new PNG frames matched the
  local release byte-for-byte. Reports:
  output/verification/release-stable-20260912.json and
  output/verification/release-immutable-20260912.json.
- Public Practice smoke passed at 915x412 (HD2 touch), 390x844 (default touch)
  and 1440x900 (HD2 desktop). Correct commit/date, actual playing phase, no
  JavaScript errors or missing resources. Mobile control geometry passed.
  Gameplay screenshots were inspected. Fresh-session guides were dismissed
  using their native Close guide/Escape controls. Reports:
  output/verification/release-browser-20260912.json and
  output/verification/release-browser-desktop-20260912.json.
- Mobile checks use Chromium touch emulation, not a physical phone.
- Production D1 had no pending migrations. Pre-release Time Travel bookmark:
  000012d0-00000000-000050e4-17abf411a80fb944e2fcae36dd7bd899.
- The eight-bot session was not rerun as part of this release.

## Rollback

- Previous Worker: a238e27d-d283-4e6b-84f0-3012f9bbf125.
- Previous Pages: 97ffd8bf-d3bb-4fed-ada2-8b543109b3d5.
- Previous deployed source: 26c921b1ff1738e4cbb13aa5a58cd7f4611a7607.
- No schema migration accompanied this release. Do not blindly roll the Worker
  back: the old Worker does not register the new hash used by newly started
  runs. Preserve compatibility for runs already issued under the new hash.

## Working tree

The documentation commit recording this deployment is not the source of the
published artifacts. No Git push or branch merge was performed. Pages uses
its production channel main without changing the local source branch.

Four unrelated untracked files remain excluded: .tmp-apply-probe.txt,
docs/audits/2026-09-07-game-design-and-hd-v2-audit.md,
docs/plans/2026-08-13-ranked-playtest-fixes.md, and
docs/plans/2026-08-18-ranked-boundary-checkpoints-design.local-untracked.md.
