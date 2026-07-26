# Current task — Phase 3B2C3B

## Task name

Online v3 Arena relic offer

## Objective

Implement the canonical Arena relic offer without integrating the game.

## Allowed paths

- `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/**`
- `scripts/generate-online-v3-meta-rules.mjs`
- `cloudflare/leaderboard-v3/test/**`
- `docs/ONLINE_V3_*`
- `ONLINE_V3_HANDOFF.md`

## Required work

- Reconfirm Arena trigger, pool, and rarity from active v0.8 source evidence.
- Use the existing Arena directive and `RoomRewardEnvelopeV3`.
- Use canonical run modifiers and `extraRelicChoices`: three normally, four
  with Ascension.
- Reuse `RegularRelicOfferV3`, the canonical replacement transaction, and the
  canonical fallback policy.
- Preserve the exact v0.8 rarity and candidate pool.
- Use the confirmed 60-base-gold fallback only for an existing canonical empty
  Arena chest.
- Add source-bound fixtures and seeded property tests.
- Keep the ruleset disconnected and test-only.

## Out of scope

- Client integration, `game.js`, and `index.html`
- Endpoints, D1, `recent_ops`, protocol, and Wrangler
- Merchant, Forge, and Crossroads
- Ruleset activation
- Push or deployment

## Stop conditions

Stop and report instead of guessing when:

- Arena trigger, pool, or rarity differs from confirmed v0.8 evidence;
- a missing rule cannot be resolved from the protected baseline;
- implementation requires client, endpoint, or D1 changes;
- parity would require changing v0.8 economy or gameplay.

## Acceptance

- Exact source evidence is recorded.
- Generator `--check`, new fixtures, property tests, and existing regressions
  pass.
- Manifest and ruleset hash are canonical and remain test-only.
- Protected baseline passes with no protected-file changes.
- No client, active endpoint, D1, `recent_ops`, or Worker runtime change.
- Create the exact local commit below and stop.

## Verification

- `npm run verify:phase`
- `npm run verify:baseline`

## Commit message

`Implement Online v3 Arena relic reward policy`

## Required final report

- Commit and implemented scope
- Unresolved evidence or blockers
- Test totals and protected baseline result
- Ruleset hash before/after
- Changed-file count and next recommended phase