# Online v3 - Current handoff

Updated: 2026-09-21

## Task authority

The user explicitly requested commit, push and deployment of the agreed changes.
The current user prompt remains the scope authority; docs/tasks/CURRENT.md is
Status: NONE. This record does not authorize a future release or data migration.

## Architecture boundary

Online v3 controls checkpoint meta-progression. Combat, movement, AI, animation,
audio and rendering remain local. This is not server-authoritative combat or
cheat-proof gameplay. Existing checkpoint validation and historical capabilities
remain enabled.

## Current production snapshot

- Deployed source: aa1f12896a9160529778d0227654117b202b4eea (69 changed files).
- Source branch: codex/hd2-early-animations, pushed to origin; game v0.8.3.
- Worker: 95fe249a-74fe-4dbd-9485-4cd5401a76a5 at 100%.
- Deployment message: aa1f128 production rollout complete.
- Pages: f58db056-8905-4f6d-8813-5113ba9d0b1f, production channel main.
- Immutable URL: https://f58db056.dungeon-of-one-room.pages.dev.
- Stable URL: https://dungeon-of-one-room.pages.dev.
- Active ruleset: sha256:8c5c26851cbf440a62c2c2acf5f168fc13495de6601abd2e9681d6fa0f2d6c32.
- Immediate predecessor retained: sha256:79078f4f51858209c9c493333824f9e8077403452fef1cff4d1906a1d9661f5a.
- Earlier supported releases remain registered with their existing capabilities.

HD2 remains opt-in at https://dungeon-of-one-room.pages.dev/?hd2=1.
This release enables death presentation using existing frames, improves anchoring
and NPC skill/VFX/SFX presentation, removes inappropriate Totem movement clips,
and streams HD2 actor assets on demand. Gameplay kill/reward timing is unchanged.
Status overlays follow actual player/enemy statuses in both HD1 and HD2; no new
status mechanics were introduced.

Offline and newly issued Ranked runs schedule merchants at depth 9/19/29/etc.
The merchantDepthSchedule v1 capability preserves older Ranked run behavior.
Camp mutators use a 5+5 layout; no mutators were added. Boot identity derives
commit/date automatically. No schema migration, data reset or leaderboard rewrite
was performed.

## Verification and deployment evidence

- Exact source aa1f128 passed npm run verify:full: 1178/1178, no failures or
  skips (Worker 1153, local Wrangler/D1 21, protected guard 4), plus complete
  clean committed baseline and Ranked browser lifecycle.
  Log: output/verification/full-20260921T133156800Z.log.
- Focused checks passed 13/13:
  node --test tests/hd-actor-status-fx.test.js tests/hd2-presentation.test.js
  tests/hd2-stream.test.js tests/hd2-mix.test.js tests/merchant-depth-schedule.test.js.
  Log: output/verification/release-focused-20260921.log.
- Archive prerequisites passed:
  node scripts/online-v3-baseline-smoke.mjs --scenario save
  node scripts/online-v3-ranked-headed.mjs --scenario lifecycle.
  All six record archive screenshots were inspected and approved.
- npm run pages:build and node scripts/verify-pages-production-bundle.mjs passed;
  4597 bundle files. Existing password gate retained; QA instrumentation excluded.
- Worker rollout 5%, 25%, 100%: read-only availability samples returned
  6 new / 114 old, 47 new / 73 old, then 120 new / 0 old without failures.
  These are short availability checks, not load testing.
- Initial Pages deployment 8681b2a8-48af-4d6b-8709-6590e0ef8dc2 omitted the API
  proxy because deployment was launched from the Worker directory. Production
  smoke detected HTML instead of API JSON. It was superseded by f58db056 from
  repository root, including Pages Functions and RANKED_V3_BACKEND binding.
  Do not use the superseded deployment for rollback.
- Stable and final immutable root, availability and season-1 leaderboard
  returned HTTP 200; active hash correct. Nineteen representative assets matched
  local release bytes. Reports: output/verification/release-stable-20260921.json
  and output/verification/release-immutable-20260921.json.
- node output/verification/release-browser-20260921.mjs passed on the final
  deployment at 915x412 HD2 touch, 390x844 HD1 touch and 1440x900 HD2 desktop.
  Correct commit/date, actual playing phase, no JavaScript errors or missing
  resources; mobile geometry passed. Gameplay screenshots inspected.
  Report: output/verification/release-browser-20260921.json.
- Production D1 reported no migrations to apply.
- Mobile checks used Chromium emulation, not a physical phone. No new listening
  session or eight-bot production run was performed for this deployment.

## Deployment procedure and rollback

Publish Pages from the repository root, using its wrangler.jsonc and functions:
node cloudflare/leaderboard-v3/node_modules/wrangler/bin/wrangler.js pages deploy
output/pages-dist --project-name dungeon-of-one-room --branch main
(with the actual source commit metadata). Worker deployments use their own
cloudflare/leaderboard-v3/wrangler.production.toml configuration.

- Previous known-good Worker: 3545811b-a55b-404b-aff6-817805d49620.
- Previous known-good Pages: 7dfa7cd5-b6f2-4c06-8f87-ff0b78ee7dd4.
- Previous deployed source: 227f65fc60292fffc40f47f0dd460561e95c0deb.
- No schema migration accompanied this release. Do not blindly roll the Worker
  back: the old Worker does not register the new hash used by newly started
  runs. Preserve compatibility for runs already issued under the new hash.

## Working tree

The separate documentation commit recording deployment is not the source of
published artifacts. The source and release record are pushed to the same
codex/hd2-early-animations branch; no branch merge was performed. Pages uses
its production channel main without changing the source branch.

Four unrelated untracked files remain excluded: .tmp-apply-probe.txt,
docs/audits/2026-09-07-game-design-and-hd-v2-audit.md,
docs/plans/2026-08-13-ranked-playtest-fixes.md, and
docs/plans/2026-08-18-ranked-boundary-checkpoints-design.local-untracked.md.
