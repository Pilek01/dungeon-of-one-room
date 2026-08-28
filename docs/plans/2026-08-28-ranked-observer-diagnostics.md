# Ranked Observer Diagnostics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Correlate every blocking Ranked client error with the Observer Bot trace and the production Worker log without exposing credentials or changing gameplay.

**Architecture:** Extend the existing bounded client diagnostic record, force a redacted diagnostic event into the existing Observer Bot trace, and enrich the Worker's structured error context from a cloned request. Keep canonical state, rulesets, D1, anti-cheat decisions, and retry behavior unchanged.

**Tech Stack:** Browser JavaScript, Node test runner, Cloudflare Workers, existing Ranked runtime and Observer Bot trace.

---

### Task 1: Worker request correlation

**Files:**
- Modify: `cloudflare/leaderboard-v3/test/m2b-real-runtime-http.test.js`
- Modify: `cloudflare/leaderboard-v3/src/index.js`

1. Extend the existing rejected-request diagnostic test to require redacted
   `operationId`, `runId`, event `action`, directive ID, and protocol version
   when those fields are present.
2. Run the focused test and confirm it fails because those fields are absent.
3. Add a request-scoped helper that reads only safe fields from a cloned JSON
   request and never returns tokens, credentials, digests, or arbitrary fields.
4. Merge the safe fields into `ranked_request_error`; preserve the current
   public error envelope and bounded `causeCode`.
5. Run the focused test and confirm it passes.

Run: `node --test cloudflare/leaderboard-v3/test/m2b-real-runtime-http.test.js`

### Task 2: Enriched client diagnostic and export

**Files:**
- Modify: `cloudflare/leaderboard-v3/test/observer-bot-runtime.test.js`
- Modify: `online-v3/ranked-v3-runtime.js`

1. Extend the internal-error regression to require the original trace ID in
   the reconnect message, safe pending-operation metadata in the diagnostic,
   and an `Export diagnostics` control.
2. Add a redaction regression proving checkpoint tokens, recovery credentials,
   request digests, and complete request bodies never appear in diagnostics or
   exported text.
3. Run the focused tests and confirm the new assertions fail.
4. Enrich `recordDiagnostic()` from the current snapshot and public state with
   safe operation/action/directive/depth/room/build fields.
5. Add a bounded JSON diagnostic export and UI control. Export failure must be
   non-fatal and must not alter the Ranked recovery state.
6. Keep `recoveryRootDiagnostic` unchanged across retry/resync failures and
   include its full trace ID in the visible diagnostic label.
7. Run the focused tests and confirm they pass.

Run: `node --test cloudflare/leaderboard-v3/test/observer-bot-runtime.test.js`

### Task 3: Observer Bot correlation

**Files:**
- Modify: `cloudflare/leaderboard-v3/test/observer-bot-runtime.test.js`
- Modify: `game.js`
- Modify: `online-v3/ranked-v3-runtime.js`

1. Add a failing runtime assertion that a blocking Ranked error calls a bridge
   hook with the redacted diagnostic exactly once.
2. Add a focused source/trace regression requiring `ranked_error` events and a
   Ranked diagnostics section in the Observer Bot export.
3. Run the focused regressions and confirm they fail for the missing bridge.
4. Expose a narrow game bridge hook that force-appends `ranked_error` using the
   existing bounded Observer trace and only the safe diagnostic fields.
5. Include the current bounded Ranked diagnostics in the manual Observer Bot
   trace export; do not include local storage, tokens, credentials, or bodies.
6. Call the bridge hook only after the client diagnostic has been redacted and
   persisted.
7. Run both focused regressions and confirm they pass.

Run: `node --test cloudflare/leaderboard-v3/test/observer-bot-runtime.test.js tests/observer-bot-trace.test.js`

### Task 4: Verification and documentation

**Files:**
- Modify: `progress.md`

1. Run JavaScript syntax checks for the changed production files.
2. Run the focused Worker/runtime/trace tests once.
3. Run `npm run verify:ranked-headed -- --scenario recovery` because reconnect
   UI and recovery diagnostics changed.
4. Run `npm run verify:ui-current -- --scenario boot` and
   `npm run verify:baseline` because protected `game.js` changed.
5. Run `npm run verify:phase` once because shared Ranked runtime and Worker
   behavior changed.
6. Run `npm run verify:guard` once and `git diff --check`.
7. Inspect the exact diff and full `git status --short`; update `progress.md`
   with scope, checks, and unresolved production root cause.
8. Do not commit, push, deploy, migrate D1, or activate a ruleset in this task.
