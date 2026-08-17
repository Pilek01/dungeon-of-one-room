# Ranked checkpoint integrity implementation plan

**Goal:** Stop simple DevTools room-clear and gold manipulation while keeping legitimate Ranked gameplay and network cadence unchanged.

**Architecture:** Extend the current checkpoint payload with a versioned integrity envelope. The generated bridge supplies an in-memory room capability and measured gold delta; the Worker records a monotonic eligibility decision after canonical reward settlement. Publication adapters suppress all leaderboard snapshots for provisional runs.

**Tech stack:** Browser JavaScript, Cloudflare Worker JavaScript, Node test runner, generated Pages v3 bundle, Playwright Ranked verification.

## 1. Worker regression tests

- Extend the real v08 HTTP harness with versioned integrity fields.
- Prove that an invalid room capability signal makes public state provisional.
- Prove that a mismatched local gold delta makes public state provisional.
- Prove that eligibility never returns to official.
- Prove that provisional death and final snapshots are absent from leaderboard storage.

## 2. Client and runtime regression tests

- Prove that the checkpoint client sends integrity version, signals, and gold telemetry.
- Prove that a room clear without the active capability emits the downgrade signal.
- Prove that a valid generated-room capability produces no downgrade signal.
- Prove that a provisional response shows the one-time continuation notice.

## 3. Worker implementation

- Add `official`/`provisional` eligibility helpers outside the versioned v08 ruleset.
- Initialize new runs as official and default legacy runs to official.
- Validate the small versioned integrity payload.
- Feed reported gold values into the existing reward settlement.
- Downgrade only on trusted integrity reasons and preserve the result monotonically.
- Expose eligibility in public meta state and gate death, extraction, and final leaderboard effects.

## 4. Generated game bridge and runtime implementation

- Create one opaque object per entered room in the Ranked runtime.
- Hand it to the generated game bridge without serializing it or exposing it in public state.
- Measure local gold from room entry to actual room clear.
- Consume the capability once, forward only versioned signals and numeric telemetry, and never send it over the network.
- Pause only a provisional run at its next boundary for the one-time message; legitimate runs remain visually unchanged.

## 5. Verification

- Run the new focused Worker/runtime/client tests through red-green cycles.
- Run syntax checks for changed JavaScript.
- Run the focused Ranked lifecycle browser scenario.
- Run `npm run verify:phase`, `npm run verify:guard`, and `git diff --check` once when the implementation is stable.
