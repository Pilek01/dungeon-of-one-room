# Current task — Milestone M1

## Task name

Online v3 Meta Transactions

## Objective

Implement one deterministic, immutable, atomic meta-transaction contract and
use it for the active v0.8 Merchant, Forge Temper, Forge Transmute, Crossroads,
Camp, and Pact policies without integrating the game or Worker endpoints.

## Allowed paths

- `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/**`
- `scripts/generate-online-v3-meta-rules.mjs`
- `scripts/verify-online-v3.mjs`
- `cloudflare/leaderboard-v3/test/**`
- `docs/ONLINE_V3_*`
- `docs/tasks/CURRENT.md`
- `ONLINE_V3_HANDOFF.md`

## Required work

- Record exact active-v0.8 source evidence before implementing each source.
- Add canonical server-issued source, offer, choice, and transaction IDs bound
  to run, ruleset hash, revision, and state/build digest.
- Add pure preflight/evaluate and immutable atomic commit with fail-closed
  validation, exact idempotent retry, conflicting-retry rejection, bounded
  receipts, rollback, serialization, and restart determinism.
- Mutate the existing canonical gold, build, reward, offer, replacement, and
  fallback state only; do not create parallel ledgers.
- Implement Merchant, Forge Temper, Forge Transmute, Crossroads, Camp, and Pact
  only where active-v0.8 source evidence is unambiguous.
- Preserve exact v0.8 costs, pools, RNG order, limits, consumption, cancel,
  retry, replacement, fallback, and no-reward behavior.
- Keep `v08-meta-1` disconnected and test-only.

## Out of scope

- `game.js`, `index.html`, CSS, audio, HUD, rendering, cheats, Observer Bot,
  special rooms, assets, and the Online v3 client
- Active endpoints, HTTP contracts, D1, migrations, `recent_ops`, protocol,
  Wrangler, and deployment configuration
- Active Worker fixture-ruleset replacement or `v08-meta-1` activation
- Push, deployment, rebase, merge, staging, production, and later milestones
- The unrelated 172 Vault Guardian package deletions

## Stop conditions

Stop only the affected source and record a blocker instead of guessing when:

- active-v0.8 trigger, cost, pool, RNG order, limit, consumption, cancel,
  replacement, fallback, or state effect is ambiguous;
- parity would require client, endpoint, D1, protocol, Wrangler, fixture
  ruleset, or protected baseline changes;
- the shared transaction contract cannot reuse the existing canonical gold,
  build, reward, offer, replacement, or fallback mechanisms.

## Acceptance

- Source evidence and golden fixtures cover every implemented source.
- Exact retry succeeds once; payload-conflicting retry and every stale binding
  fail closed.
- Client-reported price, amount, gold, target, rarity, stacks, RNG result, and
  final state are ignored or rejected as appropriate.
- Atomic failures leave the complete input state unchanged.
- Receipts are bounded and deterministic across serialization/restart.
- Seeded property/invariant tests report their case counts.
- Existing Arena, Warden, Otter, replacement, fallback, and gold regressions
  pass.
- Protected baseline and all 172 unrelated deletions remain unchanged.

## Verification

- During work: `npm run verify:fast`
- After each completed subsystem: targeted tests
- Before milestone completion:
  - `npm run verify:phase`
  - `npm run verify:baseline`
  - `npm run verify:full`
  - `git diff --check`

Full logs belong in ignored `output/verification/`.

## Internal commits

1. `Implement Online v3 atomic meta transaction core`
2. `Implement Online v3 canonical Merchant transactions`
3. `Implement Online v3 canonical Forge transactions`
4. `Implement Online v3 canonical Crossroads transactions`
5. `Implement Online v3 canonical Camp and Pact transactions`
6. Optional documentation-only milestone handoff commit

Stage only explicit owned files for each commit.
