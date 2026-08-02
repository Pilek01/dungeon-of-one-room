# Ranked Practice-Parity Mutator Unlocks Design

## Goal

Make Online Ranked mutators follow the same unlock, activation, deactivation,
persistence, and fresh-campaign reset rules as Practice. Online adds canonical
storage and leaderboard publication; it does not change the game rules.

## Confirmed Practice rules

The ten unlocks are derived from the existing `mutator-data.js` thresholds:

- Berserker: 200 total kills.
- Bulwark: depth highscore 15.
- Alchemist: 25 Merchant potion purchases.
- Greed: 12,000 total earned gold.
- Hunter: 90 elite kills.
- Resilience: 60 Shield uses in the current campaign.
- Momentum: depth highscore 20.
- Famine: extract at depth 10+ without using a potion in that run.
- Elitist: 250 elite kills.
- Ascension: depth highscore 30.

Unlocks and active selections persist through Extract -> Camp -> Start Next
Run. Start New Ranked and terminal campaign defeat reset campaign progress,
unlocks, and active selections.

## Canonical profile model

Add a versioned mutator progression object to canonical run/profile state:

- non-negative counters for total kills, elite kills, total earned gold,
  Merchant potion purchases, Shield uses, and potion-free qualifying extracts;
- depth highscore;
- a sorted allowlisted `unlockedMutatorIds` projection;
- a one-time Practice import receipt/version.

The Worker recomputes unlock IDs from counters after every relevant canonical
mutation. Clients never directly add an unlock after the import is consumed.
Unknown IDs, negative/unsafe counters, replayed imports, and stale transactions
fail closed.

## One-time Practice import

The first eligible Ranked start after this release may submit a bounded
Practice snapshot. The server allowlists IDs and sanitizes counters, then
re-evaluates the existing thresholds. Nine unlocks come from their stored
Practice metrics. Resilience may also use the historical unlocked flag because
Practice does not persist a standalone lifetime Shield-use counter.

The import is consumed exactly once per profile. Its receipt survives fresh
campaign resets, so local data cannot be imported again. This is the explicitly
accepted trust exception; all later progress is server-derived.

## Canonical evidence flow

- Accepted room reward claims advance total and elite kill counters.
- Accepted canonical gold awards advance total earned gold.
- Server-issued Merchant potion purchases advance the potion counter.
- Accepted room/checkpoint progress advances depth highscore.
- Bounded Shield-use claims advance campaign Shield uses.
- Successful normal extraction at depth 10+ with zero canonical potion-use
  claims for that run advances potion-free extraction.

All updates are idempotent under the existing operation/retry model.

## Camp transactions and UI

Camp issues `mutator_add` for unlocked inactive mutators when fewer than three
are active, and `mutator_remove` for every active mutator. Removal is always
available in Camp. Both actions carry the expected active set and commit by
rebuilding the canonical run-modifier ledger.

The game bridge projects `unlockedMutatorIds` and active modifier IDs as two
separate maps. It never infers unlocks from the transient Camp offer. Continue,
Camp reopen, transaction refresh, and Start Next Run therefore render the same
locked/unlocked state.

## Failure and compatibility behavior

Legacy profiles hydrate with an empty progression object and become eligible
for the one-time import. Old active modifier ledgers remain valid and their IDs
are included in the unlocked projection during migration. No D1 backfill or
historical leaderboard rewrite is required.

Import and Camp failures use the existing Ranked recovery surface. Practice
code and offline persistence remain unchanged.

## Verification

Tests cover all ten thresholds, import idempotency, legacy hydration, canonical
counter sources, add/remove, the three-active limit, transient-offer refresh,
Continue, Start Next Run, and fresh-campaign reset. Focused domain/runtime
tests precede the exact headed Camp scenario, then guard, phase, baseline, and
release-level verification required for Worker/ruleset/protocol changes.
