# Ranked Stability and Observer Potion Policy Implementation Plan

> **Spec:** `docs/superpowers/plans/2026-09-02-ranked-stability-and-observer-potions-design.md`
>
> **Execution constraint:** Work in the existing checkout because it contains authorized user changes that must remain present. Use fresh Luna implementers and reviewers sequentially for code tasks; Sol owns integration and final verification. Do not commit, push, deploy, or activate a ruleset.

## Task 1: Initial Crossroads state ordering

**Files:**
- Modify: `online-v3/ranked-v3-runtime.js`
- Test: `cloudflare/leaderboard-v3/test/observer-bot-runtime.test.js`

1. Add a failing real-session regression whose synchronous `startRanked` bridge callback enters an initial Crossroads and opens its meta offer.
2. Confirm the regression fails with `RANKED_STATE_TRANSITION_INVALID:ENTERING_ROOM:AWAITING_REWARD_OR_TRANSACTION`.
3. Promote `ENTERING_ROOM` to `ROOM_ACTIVE` at room entry before Crossroads handling, and make the post-bridge transition conditional so a synchronously opened offer is preserved.
4. Run `node --test cloudflare/leaderboard-v3/test/observer-bot-runtime.test.js cloudflare/leaderboard-v3/test/m4-client-bootstrap.test.js` and `node --check online-v3/ranked-v3-runtime.js`.

## Task 2: Elite gold integrity-attestation parity

**Files:**
- Modify the shared version-gated elite compatibility helper and Worker settlement anomaly classification identified by the investigation.
- Test the production-release checkpoint path and focused integrity domain behavior.
- Preserve all canonical ruleset data, hashes, awards, and maximum bounds.

1. Add an exact regression for an elite report whose game-side calculation includes `+3`, plus canonical and manipulated-delta controls.
2. Confirm the current rank-eligibility compatibility accepts the local pair while settlement still emits false mismatch anomaly flags.
3. Reuse one exact compatibility calculation in both rank eligibility and anomaly classification, gated by the relevant integrity/claim-policy capability. Keep canonical settlement delta and credited gold unchanged.
4. Assert canonical reports remain clean, exact permitted local reports remain official and clean, one unit beyond the permitted local pair records mismatch/provisional, and incompatible historical policies do not gain compatibility.
5. Run the focused gold/integrity tests and `npm run verify:phase` once after all Worker edits are complete. No ruleset regeneration or activation is expected.

## Task 3: Forge blocked-tile movement and Observer recovery

**Files:**
- Modify: `game.js`
- Modify shared forced-movement code only if the proven landing path bypasses its predicate.
- Test: `tests/forced-movement.test.js` and the closest Observer Bot behavior test.

1. Add failing regressions for the proven Forge landing path and for a bot already standing on a blocked Forge tile.
2. Route the invalid forced landing through the existing blocked-tile predicate or choose a legal fallback tile without changing ordinary movement.
3. Add an Observer-Bot-only, one-shot emergency-extract recovery for a currently trapped Forge position. Do not invoke it for a human-controlled run.
4. Run the focused movement/bot tests and `node --check game.js`.

## Task 4: Potion before ordinary emergency extract

**Files:**
- Modify: `game.js`
- Modify: `bot-safety.js` only for deterministic pure decision logic.
- Test: `tests/bot-safety.test.js`

1. Add failing cases for ordinary 50% effective-heal usefulness, boss/at-most-two-lives 35%, near-full no-op, blocked potion, viable defensive action, and modeled post-heal lethality.
2. Pass all potion eligibility fields, including cooldown/duplicate-use locks, into the shared decision.
3. Ensure the ordinary pre-clear emergency gate yields to a useful potion or viable defense. Keep the certain-lethal branch able to extract when post-heal survival is still impossible.
4. Run `node --test tests/bot-safety.test.js` and `node --check game.js bot-safety.js`.

## Task 5: Integration and verification

1. Inspect the exact diff against the pre-task working tree and confirm no unrelated user change was overwritten.
2. Run each focused regression once after its last relevant edit.
3. Run the affected current-tree browser scenarios: Ranked lifecycle for Crossroads/Ranked behavior and HD only if the Observer Bot gameplay path is exercised there.
4. Run `npm run verify:guard` once, `npm run verify:phase` once for the Worker/ruleset changes, and `git diff --check`.
5. Perform a final Sol review for player-flow preservation, anti-cheat strictness, historical ruleset compatibility, and bot-only recovery boundaries.
