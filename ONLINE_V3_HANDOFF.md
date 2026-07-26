# Online v3 — Current Handoff

## Repository

- Workspace: `D:\Codex workstation\Dungeon\dungeon-online-v3`
- Branch: `main`
- HEAD: local `Add compact Codex workflow and project instructions` commit on
  Phase 3B2C3A base `0a9ca773979b4873883a4f7636045054093f1cf3`
- Working tree contract: workflow committed; preserve the unrelated untracked
  `cloudflare/leaderboard-v3/Nowy Dokument tekstowy.txt` outside commits
- Protected baseline: `f98820c99066d810169e100beb23a54a332734bd`
- Game integration: absent; `index.html` does not load Online v3
- Active Worker: fixture ruleset; no staging or production activation
- Test-only ruleset: `v08-meta-1`
- Test-only hash:
  `sha256:7c60b9af6bdf309c860c2daa2534a3d527d1469433921bc8db3766a654cb40f9`

## Completed milestones

- Phase 0 — `f98820c` protected v0.8.0 baseline.
- Phase 1 — `0fe1423` architecture and no-op boundary.
- Phase 2 — `52e363e` isolated Worker and fixture tests.
- Phase 2 baseline — `22633d4` protected browser regression smoke.
- Phase 2.5 — `f2cf627` local Wrangler and D1 validation.
- Phase 3A — `080b758` v0.8 authority matrix and ruleset map.
- Phase 3B1 — `4486211` room directives and deterministic ruleset RNG.
- Phase 3B2A — `4cc400a` reward envelopes and authoritative gold ledger.
- Phase 3B2B1 — `5e84f46` starting relic and canonical build ledger.
- Phase 3B2B2A — `e264343` Warden relic offers and rarity policy.
- Phase 3B2B2B1 — `3e8d313` Otter relic reward policy.
- Phase 3B2B2B2 — `5452c9f` Vault/Arena source classification.
- Phase 3B2C1 — `42de354` canonical run modifiers and derived effects.
- Phase 3B2C2 — `36bf177` canonical relic replacement transactions.
- Phase 3B2C3A — `0a9ca77` canonical relic reward fallback policy.

## Current architecture state

- The original v0.8 game, UI, audio, assets, saves, and gameplay are untouched.
- Online v3 client modules remain disconnected from `index.html`.
- The Worker remains isolated from combat, DOM, renderers, audio, HUD, and
  Ranked v2.
- Local D1 migrations and E2E validation exist; this workflow changes no D1
  schema, storage implementation, endpoint, or Wrangler configuration.
- Active endpoints still resolve the fixture ruleset; `v08-meta-1` is
  disconnected and test-only.
- Implemented meta systems include sequential room directives, canonical gold
  and build ledgers, Warden/Otter offers, run modifiers, relic replacement, and
  source-bound fallback resolution.

## Open blockers

- Phase 3B2C3B — canonical Arena relic offer.
- Phase 3B2C4 — compact idempotency response reconstruction. The maximum
  replacement response is 14,484 B; projected `recent_ops` rings are about
  176 KB at 12 entries and 352 KB at 24 entries.
- Transactional Merchant, Forge, and Crossroads sources.
- Further offer/build systems, including skills, elixirs, and deferred meta.
- Client integration.
- Staging, ruleset activation, and release.

## Current task

See `docs/tasks/CURRENT.md`.

## Verification commands

- `npm run verify:fast`
- `npm run verify:phase`
- `npm run verify:baseline`
- `npm run verify:full`

## Prohibited without explicit authorization

- Modify the protected baseline.
- Activate a ruleset.
- Integrate Online v3 into the game.
- Push or deploy.