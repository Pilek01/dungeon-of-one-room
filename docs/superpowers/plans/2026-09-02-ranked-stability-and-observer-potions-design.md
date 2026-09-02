# Ranked Stability and Observer Potion Policy Design

## Authority and scope

This design records the behavior approved by the user in the current task. It covers four defects only:

1. A fresh Ranked run whose first room is Crossroads must complete the legal `ENTERING_ROOM -> ROOM_ACTIVE -> AWAITING_REWARD_OR_TRANSACTION` sequence.
2. The Worker must treat the game's exact legacy local elite `+3` report as an allowed integrity attestation everywhere, without changing the canonical server award, score economy, maximum bound, or pinned historical rulesets.
3. Forced movement must not place the player on blocked Forge tiles. If an Observer Bot is already trapped on such a tile, the bot may perform one emergency extract; a real player must never be auto-extracted by this recovery.
4. The Observer Bot must prefer a useful potion or viable defensive escape over an ordinary emergency extract. A potion is useful at roughly 50% of its effective heal in ordinary danger and 35% during a boss fight or with at most two lives, while near-full waste remains prohibited. Extraction remains valid when healing is unavailable/blocked or modeled post-heal damage is still lethal.

The pre-online gameplay flow, player controls, special-room rules, and historical Ranked rulesets remain unchanged outside these fixes.

## Safety constraints

- Preserve every pre-existing working-tree change and stage or commit nothing in this task.
- Keep canonical ruleset definitions, hashes, authoritative awards, score economy, and maximum bounds unchanged.
- Do not relax gold-delta validation. Reuse the same exact, version-gated elite compatibility calculation already used by rank eligibility when classifying settlement anomaly flags; any value outside the canonical or permitted local pair must still fail closed.
- Forge recovery is Observer-Bot-only and must be idempotent.
- Potion thresholds affect only Observer Bot decisions, not player potion behavior or potion balance.

## Acceptance criteria

- A synchronous initial Crossroads callback produces no invalid state transition and opens its offer normally.
- Exact legacy elite `+3` reports create no false anomaly while the Worker still credits only its canonical delta; manipulated deltas still fail; incompatible historical policies remain fail-closed.
- Every forced landing respects Forge blocked tiles, and a pre-trapped Observer Bot extracts once without changing real-player behavior.
- A bot carrying a useful potion does not take the ordinary emergency-extract branch first; boss/low-life and ordinary thresholds are deterministic; blocked or insufficient healing can still extract.
- Focused regression tests, relevant syntax checks, `verify:phase` for Worker/ruleset work, affected current-tree browser verification, `verify:guard`, and `git diff --check` pass.
