# Ranked Bounded Proc Gold Design

## Goal

Keep honest Ranked runs eligible when Void Reaper or Chaos Orb awards legitimate proc gold, while continuing to reject arbitrary or impossible gold reports.

## Decision

Ranked will represent each supported client-observed proc as an explicit bounded reward claim. The server will not accept a generic gold tolerance. It will validate the named source, canonical relic ownership, room evidence, and a source-specific maximum before calculating and awarding the gold itself.

This deliberately permits a modified client to claim the small source-specific maximum, which the product owner accepts. It does not permit arbitrary amounts: all unnamed gold and every count above the canonical bound still makes the run provisional.

## Claims

### Void Reaper

- Claim type: `proc`.
- Claim ID: `void-reaper-crit-kill`.
- Client records one occurrence immediately when a qualifying critical kill receives the local Void Reaper bonus.
- Server requires canonical ownership of `voidreaper` at room entry.
- Claimed count cannot exceed the accepted enemy and elite kill count for that room.
- Server calculates each unit from base `10` through the canonical global gold multiplier, matching local `grantGold(10)`.

### Chaos Orb

- Claim type: `proc`.
- Claim ID: `chaos-orb-gold-roll`.
- Client records one occurrence when Chaos Orb rolls its gold outcome.
- Server requires canonical ownership of `chaosorb` at room entry.
- Claimed count cannot exceed `Math.ceil(roomTurnCount / 10)`. The ceiling safely accounts for a Chaos cadence already partially charged in the previous room; the persistent residual counter is not canonical. The existing run-global `state.turn` must not be used directly.
- Each unit is the canonical flat `20` awarded without the global multiplier, matching local `grantGold(20, { applyMultiplier: false })`.

## Data Flow

The existing room reward recorder aggregates proc occurrences and includes them in the sealed boundary snapshot. Reward-envelope settlement recognizes only the two named proc definitions. It validates them against the room-entry integrity snapshot, adds their server-calculated amount to authoritative gold, and includes them in the exact reported-delta and reported-total comparison.

The Pages bridge captures the run-global turn baseline when a room integrity context is installed and submits only the non-negative difference at the boundary. This makes Chaos Orb's cap specific to the current room and prevents later rooms from inheriting a wider allowance.

No min/max comparison is added to rank eligibility. Once valid proc claims are settled, the existing exact equality check remains unchanged. Missing relics, excess counts, duplicate claims, unknown proc IDs, and unexplained reported gold continue to fail closed.

## Compatibility

- The change receives a new production ruleset hash. Historical ruleset hashes remain byte-for-byte pinned.
- Practice keeps its existing local Void Reaper and Chaos Orb behavior.
- Ranked clients pinned to older hashes keep their existing policy; the new claims are sent only for a ruleset that advertises bounded proc support.
- Observer Bot assistance classification remains unchanged and cannot publish to the official leaderboard.
- The Ranked HUD status indicator is a separate presentation change and does not participate in reward validation.

## Verification

Tests must first fail for the missing behavior, then cover:

- honest zero, one, and maximum Void Reaper proc counts;
- rejection without Void Reaper and rejection above accepted kill count;
- multiplier parity for Void Reaper with Idol, mutators, and Pact of Avarice;
- honest zero, one, and maximum Chaos Orb roll counts;
- rejection without Chaos Orb and rejection above the turn-derived bound;
- Chaos Orb's unmultiplied flat amount;
- recorder aggregation, reset, sealing, and generated Pages wiring;
- exact reported gold delta and total after proc settlement;
- old-hash compatibility, unknown proc rejection, and unchanged Practice behavior;
- combined focused, full Worker phase, generated bundle, headed Ranked, and HUD status verification before deployment.
