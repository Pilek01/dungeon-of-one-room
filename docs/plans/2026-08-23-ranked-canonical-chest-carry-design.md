# Ranked Canonical Chest Carry Design

## Goal

Preserve chest-earned `+HP`, `+ARM`, and `+ATK` for the complete lifetime of one Ranked campaign (dungeon -> extraction -> Camp -> next dungeon), reset them only for `Start New Ranked`, and keep Practice storage fully isolated.

## Authority model

- The Worker is the sole authority for Ranked chest outcomes and accumulated chest bonuses.
- Each ordinary Ranked chest slot receives a deterministic server-issued outcome bound to run, ruleset hash, revision, directive, and slot ID.
- The browser consumes slots in order and renders/applies that issued outcome. It never chooses or reports a stat amount.
- The Worker derives stat amounts and depth buckets from the canonical room scaling depth, enforces the existing five-per-bucket cap, and persists only bounded bucket counters.
- Gold remains exactly checked under the existing gold policy. Potion limits and all existing fail-closed rules remain unchanged.

## Canonical lifecycle

`campaign.chestBonuses` stores versioned attack, armor, and health bucket counters. Flat totals are derived from those counters, never trusted from the client.

- Normal room checkpoint: a valid issued stat outcome increments the matching canonical bucket once.
- Replay: the existing settlement digest returns the prior result and cannot increment twice.
- Fatal or emergency boundary: stat bonuses are not awarded because the room was not completed.
- Extraction and Camp: the profile retains `campaign.chestBonuses`.
- Start next descent from Camp: the new run hydrates the retained counters and the client applies the derived totals once.
- Start New Ranked: a fresh campaign starts with empty counters.
- Legacy profile/run without this field: normalize to empty counters.

## Client lifecycle and Practice isolation

Ranked uses server-projected chest counters/totals as its only persistence source. The existing `sessionChest*` fields remain the presentation layer used by combat, but Ranked replaces them from canonical projection before `startRun` and reconciles them after accepted checkpoints.

Practice continues using its existing local snapshot. Ranked fresh start, terminal reset, extraction, and Camp transitions must not write or delete Practice storage keys.

## Anti-cheat behavior

The new behavior strengthens chest authority: a modified client cannot select a better HP/ARM/ATK outcome, invent an amount, exceed a bucket cap, reuse a slot, or carry bonuses from another campaign. All claims stay envelope/revision/nonce-bound. Historical ruleset hashes retain their previous capability contract; the new authority model is activated only by a new ruleset capability and hash.

If a reward claim is invalid at an emergency boundary, the run remains provisional with `BOUNDARY_SETTLEMENT_INVALID`. The zero-award fallback must not create secondary `REPORTED_GOLD_*` diagnostics; valid emergency settlements with edited gold still receive the exact gold mismatch reasons.

## Verification

- Unit/property tests for issued outcomes, caps, tampering, replay, boundary behavior, profile carry, and fresh reset.
- Client tests for recorder claims, canonical projection, Camp-to-dungeon carry, and Practice storage isolation.
- A headed browser playtest covering chest award -> checkpoint -> extraction -> Camp -> next descent -> Start New Ranked.
- Full Worker and Pages release verification before deployment.
