# Ranked Observer Merchant and Pact Repair Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Ranked Observer Bot Merchant purchases canonical and add a server-authoritative, post-settlement Pact flow for new ruleset runs.

**Architecture:** Merchant is fixed in the generated Ranked client bridge. Pact is gated by a new ruleset capability: a Pact checkpoint settles first, returns a revision-bound post-room offer, and defers the next directive until the canonical choice is committed or left. Old hashes retain semantics and the client skips their dormant Pact altar.

**Tech Stack:** JavaScript ES modules, Node test runner, Cloudflare Workers/Pages, D1 repositories, Playwright browser-game verification.

---

### Task 1: Lock the red regressions

**Files:**
- Test: `cloudflare/leaderboard-v3/test/observer-bot-merchant.test.js`
- Test: `cloudflare/leaderboard-v3/test/observer-bot-pact-boundary.test.js`
- Create: `cloudflare/leaderboard-v3/test/post-room-pact.test.js`

**Steps:**
1. Refine the existing source-contract tests so they inspect generated Ranked behavior rather than Practice source behavior.
2. Add domain tests proving Pact-room rewards settle with the pre-Pact build and the next directive is withheld.
3. Add apply, replace, break, leave, stale/replay, resume, and old-capability tests.
4. Run the three focused files and confirm every new behavioral assertion fails for the missing implementation.

### Task 2: Implement the capability-gated server state machine

**Files:**
- Modify: `cloudflare/leaderboard-v3/src/rulesets/releases.js`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/index.js`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/room-policy.js`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/pact-policy.js`
- Modify: `cloudflare/leaderboard-v3/src/domain/ruleset-runtime.js`
- Modify projection/assertion files only where the persisted post-room binding requires them.

**Steps:**
1. Add the smallest explicit release capability for post-room Pact settlement.
2. Settle and consume a Pact room before issuing its offer; do not issue the next directive yet.
3. Bind the offer to the completed directive, revision, ruleset hash, and canonical post-settlement build.
4. On apply/replace/break/leave, finish the meta transaction and issue exactly one next directive.
5. Keep existing hashes on the old branch and register the new active release hash.
6. Run focused server tests until green, then run historical ruleset/registry compatibility tests.

### Task 3: Implement Ranked client integration and Merchant repair

**Files:**
- Modify: `scripts/build-pages-v3.mjs`
- Modify: `online-v3/ranked-v3-runtime.js`
- Modify: `game.js` only for shared fail-closed predicates or canonical projection helpers that cannot live in the generated bridge.

**Steps:**
1. Open the canonical Merchant offer before Observer Bot purchase attempts and block repeated actions while pending.
2. Return failure when no canonical Merchant choice exists so the purchase counter cannot advance.
3. Present the post-checkpoint Pact offer, without a generic unsafe `Done` bypass.
4. Make the Observer Bot select one stable canonical Pact action and wait for the response.
5. For old/non-capable Ranked runs, prevent the bot from targeting the dormant local altar.
6. Reconcile apply/replace/break direct Pact effects from the canonical projection; Practice remains native.
7. Run focused client/runtime tests until green.

### Task 4: Regenerate and verify the release artifacts

**Files:**
- Modify generated ruleset data and `ruleset-manifest.json` through the repository generator only.
- Update: `progress.md`

**Steps:**
1. Run the repository ruleset generator and inspect the exact source/hash changes.
2. Run syntax checks and focused Merchant/Pact suites.
3. Run `npm run verify:guard`, `npm run verify:phase`, and `npm run verify:release`.
4. Build Pages and verify the production bundle, Functions discovery, and new/old ruleset availability.

### Task 5: Browser-game and security verification

**Files:**
- Test artifacts under the repository output directory only.

**Steps:**
1. Run the bundled web-game Playwright client with short action bursts and inspect `render_game_to_text`, console output, and screenshots.
2. Run headed Ranked lifecycle coverage for Merchant and Pact with fresh state.
3. Verify old pinned runs fail closed and new runs complete Pact before entering the next room.
4. Confirm ordinary human Ranked and Practice flows remain unchanged.
5. Review anti-cheat boundaries: no relaxed bounds, eligibility, token, capability, revision, or opaque-choice validation.

### Task 6: Commit and deploy

**Files:**
- Commit all verified source, tests, generated artifacts, docs, and progress notes.

**Steps:**
1. Verify a clean, intentional diff and commit to `main`.
2. Run `npx wrangler whoami`.
3. Deploy the Worker as a candidate, perform read-only canaries, and promote only after passing.
4. Deploy Pages from the repository root so the Functions proxy is included.
5. Probe stable and immutable URLs for JSON Ranked POST behavior, availability, build identity, and asset parity.
6. Record version IDs, rollback target, Pages deployment URL, and final evidence in `progress.md`.

