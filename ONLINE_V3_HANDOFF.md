# Online v3 - Current handoff

Updated: 2026-09-21

## Task authority

The user requested commit and deployment of the completed HD1 presentation work.
docs/tasks/CURRENT.md is Status: NONE. This record does not authorize a future
release or migration.

## Architecture boundary

Online v3 validates checkpoint meta-progression; combat, movement, AI, rendering
and audio remain local. This is not server-authoritative combat or cheat-proof.
No combat rules, reward timings, historical capabilities or image files changed.

## Current production snapshot

- Source: 9e4c6fd55bf3da6cd2ca3ce7fb86509c5f4e7bef (55 changed files).
- Source branch: codex/hd2-early-animations; game v0.8.3.
- Worker: c0fe3ac0-305f-49ae-a09f-c4c22015efc1 at 100%.
- Pages: 3e23cf8c-ab72-45bd-abc0-5acb5aac6b0f, production channel main.
- Immutable URL: https://3e23cf8c.dungeon-of-one-room.pages.dev.
- Stable URL: https://dungeon-of-one-room.pages.dev.
- Active ruleset: sha256:f3101eee949400ce36eb65ebe4ccf211125960d4e5223855e451693d55bd1f2b.
- Retained predecessor: sha256:8c5c26851cbf440a62c2c2acf5f168fc13495de6601abd2e9681d6fa0f2d6c32.
- Older descriptors remain registered with their original capabilities.

The default game retains original HD1 sprites and now enables actor streaming,
NPC material SFX, distinct skill VFX, foot anchoring, event-driven attack timing
and enemy death presentation. Existing status effects remain active. HD1 death
uses the two original frames, then expires; removal, rewards and free tiles are
immediate. Totem does not select movement/cast poses for a passive aura.

Bootstrap asset count fell from 1919 to 884: 1035 enemy/boss frames are loaded on
demand. This is not a measured startup-time claim. Original directional idle
fallbacks, bounded cache and retry behavior remain. HD2 artwork remains optional
through the existing ?hd2=1 preview flag; none is requested in default mode.

Thirty-four generated data files changed only game.js source metadata, verified
by canonical comparison. The manifest/hash and compatibility registrations were
updated without changing canonical rule values. No schema migration, progress
reset, score rewrite, secret or Wrangler configuration change was performed.

## Verification

- npm run verify:full: 1179/1179 PASS, no failures or skips on committed 9e4c6fd; Worker 1154,
  local Wrangler/D1 21, protected guard 4, plus clean committed baseline and
  complete Ranked lifecycle.
  Log: output/verification/full-20260921T144331445Z.log.
- Fresh Practice save and Ranked lifecycle checks produced six archive
  screenshots; all inspected and approved before the release build.
- Previous implementation verification: 87 focused presentation/audio/loader
  tests, 17 snapshot tests, 23 compatibility checks, default-HD1 browser smoke,
  current-tree HD scenario, Ranked recovery and installed gameplay client.
  Details and exact commands are in progress.md.
- npm run pages:build and node scripts/verify-pages-production-bundle.mjs:
  PASS (4597 files). Existing hashed gate and production instrumentation exclusion
  preserved. Build identity derives commit and date from checkout.
- Worker traffic: 5%, 25%, 100%; availability sampling passed at each stage.
  Final stage returned 120/120 responses with the new hash.
- Stable and immutable availability/root/leaderboard and 20 representative
  assets: PASS. Asset bytes match the local production bundle.
  Reports: output/verification/hd1-release-stable.json and
  output/verification/hd1-release-immutable.json.
- Desktop 1440x900 and touch 915x412 / 390x844 default-HD1 smoke:
  PASS; screenshots inspected. Correct source identity, actual playing phase, no JS errors,
  missing assets or HD2 image requests; mobile control geometry verified.
  Report: output/verification/release-hd1-browser-20260921.json.
- Production D1 had no pending migrations.
- Physical-phone performance and subjective SFX listening were not repeated.
  Six historical asset-pipeline test failures were reproduced against the
  previous renderer before this release (external chroma helper, old catalog/
  phase/tween expectations); they are documented in progress.md and are outside
  the passing standard release gate.

## Deployment and rollback

Publish Pages from repository root so wrangler.jsonc and functions/api/v3 are
included; its RANKED_V3_BACKEND service binding connects to the production Worker.
Worker uses cloudflare/leaderboard-v3/wrangler.production.toml.

- Previous known-good Worker: 95fe249a-74fe-4dbd-9485-4cd5401a76a5.
- Previous known-good Pages: f58db056-8905-4f6d-8813-5113ba9d0b1f.
- Previous source: aa1f12896a9160529778d0227654117b202b4eea.
- No schema migration. Do not blindly roll the Worker back after new-hash runs
  have started; preserve support for their issued hash.

## Working tree

The source and separate deployment-record commit are local on
codex/hd2-early-animations. No Git push or merge was requested in this task.
Pages uses production channel main without changing the Git branch.

Four unrelated untracked files remain excluded: .tmp-apply-probe.txt,
docs/audits/2026-09-07-game-design-and-hd-v2-audit.md,
docs/plans/2026-08-13-ranked-playtest-fixes.md, and
docs/plans/2026-08-18-ranked-boundary-checkpoints-design.local-untracked.md.
