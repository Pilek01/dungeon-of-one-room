# Acolyte Support AI Design

## Goal

Make Acolytes act as support casters in the shared Practice and Ranked combat
AI. Healing remains the first priority, buffing the second, and attacking the
player is allowed only when no legal support target exists.

## Considered approaches

1. **Dedicated support role (selected).** Give Acolytes support-aware movement
   that stays within range of the best ally while preserving the existing
   heal, buff, and attack spell implementations.
2. **Increase support range.** This would hide some failures but would leave
   Acolytes moving according to player-facing ranged logic.
3. **Adjust generic ranged weights.** This would couple Skeleton and Acolyte
   behavior and still provide no explicit support invariant.

## Design

- `enemy-director.js` assigns Acolytes the `support` role.
- The director receives the same support eligibility facts used by combat:
  healable allies, buffable allies, and the four-tile support range.
- A support Acolyte scores positions by retaining or obtaining range to the
  highest-priority legal support target. Generic anti-clumping penalties must
  not push it out of support range.
- When no support target exists, the Acolyte may use the current ranged
  fallback against the player.
- `game.js` remains authoritative for spell priority and resolution:
  `heal -> buff -> attack`.
- Practice and Ranked keep one shared local combat implementation.

## Verification

- Deterministic unit tests cover heal positioning, buff positioning, retained
  support range, attack fallback, and non-regression for Skeleton ranged AI.
- Focused gameplay tests cover the actual cast priority and target lifecycle.
- Run JavaScript syntax checks, `git diff --check`, the proportional baseline
  guard, and a headed gameplay scenario with screenshot/state inspection.

