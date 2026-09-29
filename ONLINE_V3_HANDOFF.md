# Online v3 - Current handoff

Updated: 2026-09-30 (Europe/Warsaw)

## Task authority

The user explicitly requested push and deployment of v0.8.4 with the approved
balance and Ranked recovery changes. docs/tasks/CURRENT.md is Status: NONE.
This record does not authorize a future release or migration.

## Architecture boundary

Online v3 validates checkpoint meta-progression. Combat, movement, AI, rendering
and audio remain local; this is not server-authoritative combat or cheat-proof.

## Current production snapshot

- Source: efd68f7888c9d6878d88f1950d100b7065b67793, main, game v0.8.4.
- Implementation: 3ceabe7; production activation: b0fe8b0; release test alignment: efd68f7.
- Worker: 3a335d84-44d5-472a-93b2-5924bdf8cf74 at 100%.
- Pages: 0e2a16c3-e54d-4388-a7e3-4514f89529e5, production channel main.
- Immutable URL: https://0e2a16c3.dungeon-of-one-room.pages.dev.
- Stable URL: https://dungeon-of-one-room.pages.dev.
- Active ruleset: sha256:69d2e17ee6d5f8a104f82ae5000c738229d0807f9ab23b9cbe0bfbc9da61317c.
- Previous candidate retained: sha256:dd2bc67015aabc40cb833aec4f224e9a0e9a952a5d3bcd05e33f6144a2f59c05.
- Previous deployed ruleset retained: sha256:f3101eee949400ce36eb65ebe4ccf211125960d4e5223855e451693d55bd1f2b.
- Historical descriptors retain their original capabilities. New runs use difficultyRebalance v1.

## Released behavior

Ordinary mobs lose the additional late-depth HP/ATK multiplier; Warden encounters
and special guardians retain it. Ordinary enemy gold scales by 1 + 0.02 * depth.
Skitter applies bleed at most once per six combat turns and cannot refresh an
active bleed. Standard combat rooms from depth 20 roll 4/5/6 enemies at 25/50/25%.
Ordinary room elites are limited to min(3, floor(cumulative enemies / 2)), including
reinforcements. Boss, Duel and Pact exceptions remain separate. Camp prices and ARM
are unchanged. Old Ranked runs retain their previous balance and gold semantics.

The deployment also includes accepted-checkpoint result preservation, respawn
potion synchronization, extraction recovery and launcher reconnect handling from
the previously local commits. Original HD1 artwork remains the default.

No schema migration, progress reset, score rewrite or secret change was performed.

## Verification

- npm run verify:full: 1212/1212 PASS, no failures or skips, committed efd68f7.
  Worker 1187, local Wrangler/D1 21, protected guard 4, plus complete committed
  baseline and Ranked lifecycle. Log: output/verification/full-20260929T215248071Z.log.
- Focused release tests: 28 PASS; additional descriptor checks: 6 PASS;
  historical release compatibility regressions: 47 PASS.
- Fresh Practice save and Ranked lifecycle screenshots were inspected and approved
  before the release build; six archive views passed.
- npm run pages:build and node scripts/verify-pages-production-bundle.mjs: PASS,
  4597 files, automatic checkout identity, hashed Observer gate and no local telemetry.
- Worker upload dry run: PASS. Production D1: no pending migrations.
- Public availability: 120/120 responses with the new active hash.
- Stable and immutable URLs: root, leaderboard and 20 representative asset byte
  comparisons against the release bundle: PASS.
- Production desktop 1440x900 and mobile 915x412 / 390x844: reached playing phase,
  v0.8.4 / efd68f7 identity, no JS errors or missing assets; screenshots inspected.
  Reports: output/verification/v084-production-sample.json, v084-stable.json,
  v084-immutable.json and release-hd1-browser-20260929.json.
- git diff --check: PASS. main pushed to origin; this documentation is a separate
  deployment-record commit and does not change the deployed source identity.
- Physical-phone performance and subjective audio were not retested. The six
  historical asset-pipeline failures documented in progress.md remain outside
  the standard release gate; this release does not claim to resolve them.

## Deployment and rollback

Pages was published from repository root, including functions/api/v3 and its
RANKED_V3_BACKEND service binding. Worker configuration remains
cloudflare/leaderboard-v3/wrangler.production.toml.

- Previous Worker: c0fe3ac0-305f-49ae-a09f-c4c22015efc1.
- Previous Pages: 3e23cf8c-ab72-45bd-abc0-5acb5aac6b0f.
- Previous deployed source: 9e4c6fd55bf3da6cd2ca3ce7fb86509c5f4e7bef.
- Do not blindly roll the Worker back after new-hash runs have started: preserve
  support for their issued hash and capabilities.

## Working tree

Four unrelated untracked files remain excluded: .tmp-apply-probe.txt,
docs/audits/2026-09-07-game-design-and-hd-v2-audit.md,
docs/plans/2026-08-13-ranked-playtest-fixes.md, and
docs/plans/2026-08-18-ranked-boundary-checkpoints-design.local-untracked.md.
