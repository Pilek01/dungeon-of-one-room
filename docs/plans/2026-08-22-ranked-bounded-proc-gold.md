# Ranked Bounded Proc Gold Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Award honest Void Reaper and Chaos Orb proc gold in Ranked through explicit server-bounded claims without accepting arbitrary gold.

**Architecture:** Extend the existing room reward recorder with two named `proc` claims. A new versioned ruleset validates canonical relic ownership and source-specific count bounds, calculates the amount server-side, and leaves the existing exact gold-integrity comparison unchanged. A protocol capability prevents historical pinned rulesets from receiving claims they do not understand.

**Tech Stack:** Browser JavaScript, Node test runner, Cloudflare Worker/D1 ruleset registry, generated Pages bundle, Playwright headed verification.

---

### Task 1: Add failing server contract tests

**Files:**
- Create: `cloudflare/leaderboard-v3/test/ranked-proc-gold.test.js`
- Reference: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/reward-policy.js`
- Reference: `cloudflare/leaderboard-v3/src/domain/rank-eligibility.js`

**Step 1: Write failing tests**

Create room states with canonical builds containing `voidreaper` or `chaosorb`. Submit claims shaped as:

```js
{ claimType: "proc", claimId: "void-reaper-crit-kill", count: 3 }
{ claimType: "proc", claimId: "chaos-orb-gold-roll", count: 1 }
```

Assert:

- zero, one, and maximum valid Void Reaper counts settle;
- Void Reaper count cannot exceed accepted enemy plus elite kill claims;
- missing Void Reaper rejects the claim;
- Void Reaper uses base `10` with the canonical global multiplier but not Bounty Contract;
- zero, one, and maximum turn-derived Chaos Orb counts settle;
- Chaos Orb count cannot exceed `Math.floor(turnCount / 10)`;
- missing Chaos Orb rejects the claim;
- Chaos Orb stays flat `20` with `applyMultiplier: false`;
- unknown proc IDs and duplicate proc IDs reject;
- valid proc settlement makes exact `reportedGoldDelta` and `reportedGoldTotal` remain official;
- any extra unexplained gold still makes the run provisional.

**Step 2: Run tests and verify RED**

Run:

```powershell
node --test cloudflare/leaderboard-v3/test/ranked-proc-gold.test.js
```

Expected: failures because the reward envelope has no `proc` definitions and settlement rejects the claim type.

**Step 3: Commit RED tests**

Commit only the new test file with message `test(ranked): reproduce bounded proc gold mismatch`.

### Task 2: Implement bounded server settlement

**Files:**
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/reward-policy.js`
- Modify if a shared constant is required: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/gold-policy.js`
- Test: `cloudflare/leaderboard-v3/test/ranked-proc-gold.test.js`

**Step 1: Add proc definitions to reward envelopes**

Issue only named definitions whose required relic exists in the canonical room-entry build. Use `claimType: "proc"`, duplicate policy `REJECT`, and source-specific policy references.

**Step 2: Calculate server amounts**

For Void Reaper, calculate each unit with:

```js
calculateMultipliedGoldV08({
  canonicalBuild: state.build,
  canonicalRunModifiers: state.runModifiers,
  sourceId: "void-reaper-crit-kill",
  baseAmount: 10
})
```

For Chaos Orb, use the same canonical calculator with base `20` and `applyMultiplier: false`.

**Step 3: Enforce evidence bounds**

Track accepted enemy/elite counts and proc counts during settlement. Reject Void Reaper count above accepted enemy plus elite kills. Reject Chaos Orb count above `Math.floor(request.turnCount / 10)`. Relic absence, invalid integer counts, unknown IDs, duplicates, and over-cap counts must throw before state mutation is committed.

**Step 4: Verify GREEN**

Run the focused proc test plus existing reward and integrity suites. Expected: all pass and exact integrity comparison remains unchanged.

**Step 5: Commit**

Commit server policy and tests with message `feat(ranked): settle bounded relic proc gold`.

### Task 3: Add failing recorder and Pages wiring tests

**Files:**
- Modify: `cloudflare/leaderboard-v3/test/m4-ranked-gold-parity.test.js`
- Modify or create focused runtime coverage under: `cloudflare/leaderboard-v3/test/`
- Reference: `online-v3/ranked-v3-recorder.js`
- Reference: `scripts/build-pages-v3.mjs`

**Step 1: Write failing recorder tests**

Assert the wished-for API:

```js
recorder.recordVoidReaperCritKill();
recorder.recordVoidReaperCritKill();
recorder.recordChaosOrbGoldRoll();
```

The snapshot must aggregate counts into exactly two `proc` claims. After snapshot sealing, both methods return `false`; a fresh recorder starts empty.

**Step 2: Write failing generated-wiring tests**

Assert the generated Pages code records Void Reaper immediately after its successful local `grantGold(10)` and Chaos Orb immediately after its flat `grantGold(20, { applyMultiplier: false })`. Assert capability gating and exactly one hook per source.

**Step 3: Run tests and verify RED**

Run the focused parity/runtime tests. Expected: failures for missing recorder methods and missing generated hooks.

**Step 4: Commit RED tests**

Commit only tests with message `test(client): require ranked relic proc claims`.

### Task 4: Implement recorder, capability gate, and game hooks

**Files:**
- Modify: `online-v3/ranked-v3-recorder.js`
- Modify: `online-v3/ranked-v3-protocol.js`
- Modify: `online-v3/ranked-v3-runtime.js`
- Modify: `scripts/build-pages-v3.mjs`
- Test: focused files from Task 3

**Step 1: Extend the recorder**

Add `recordVoidReaperCritKill()` and `recordChaosOrbGoldRoll()` using the existing aggregate path. Do not accept local amounts or arbitrary IDs.

**Step 2: Add a versioned capability**

Expose `supportsBoundedProcClaims(rulesetHash)` in the protocol and runtime. Only the new production ruleset hash returns true. Historical hashes continue to omit proc claims.

**Step 3: Inject hooks**

After each successful local proc grant, record the matching claim only when the new capability is active. Practice has no Ranked recorder and remains unchanged. Boundary settlement captures after the room and naturally includes the claims; do not enable these claims for eager legacy hashes whose recorder may already be sealed.

**Step 4: Verify GREEN**

Run focused recorder, protocol, runtime, builder, and parity tests. Build the test Pages bundle and verify the injected game parses.

**Step 5: Commit**

Commit with message `feat(client): report bounded Ranked proc gold`.

### Task 5: Version the ruleset without changing historical runs

**Files:**
- Modify generated ruleset data/manifests under: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/data/`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/releases.js`
- Modify: `cloudflare/leaderboard-v3/src/local-ruleset-entry.js`
- Modify: `cloudflare/leaderboard-v3/src/production-ruleset-entry.js`
- Modify: `online-v3/ranked-v3-protocol.js`
- Modify: `cloudflare/leaderboard-v3/test/production-release.test.js`

**Step 1: Add failing release tests**

Require a new active production hash, retain `sha256:76514cf9...` as the exact previous descriptor, and assert old hashes do not advertise bounded proc claims.

**Step 2: Regenerate canonical artifacts and hash**

Use the repository generator; never hand-edit hash-bearing generated JSON. Register both the new descriptor and every historical descriptor.

**Step 3: Update protocol constants and capability set**

Make the new hash current, add the old current hash to supported/previous sets, and put only the new hash into the bounded-proc capability set.

**Step 4: Verify release compatibility**

Run production release, ruleset isolation, manifest, golden, and old-hash replay tests.

**Step 5: Commit**

Commit with message `chore(ranked): release bounded proc ruleset`.

### Task 6: Integrate existing Ranked HUD status work

**Files:**
- Preserve the existing uncommitted HUD/status files and tests.
- Test: `cloudflare/leaderboard-v3/test/ranked-hud-status.test.js`
- Test: `cloudflare/leaderboard-v3/test/m4-client-bootstrap.test.js`

**Step 1: Rebase capability changes onto the existing status diff carefully**

Do not overwrite the already verified official/observer/invalid/syncing state flow. Confirm assistance class survives execute/resume and Practice still renders no indicator.

**Step 2: Run focused combined tests**

Run proc, HUD, bootstrap, runtime, protocol, and generated Pages suites together. Expected: no test depends on the order of the two features.

**Step 3: Commit the status feature separately**

Commit with message `feat(ranked): show run integrity beside player name`.

### Task 7: Full verification and documentation

**Files:**
- Modify: `progress.md`
- Modify release/headed assertions as required: `scripts/online-v3-ranked-headed.mjs`

**Step 1: Run syntax and focused suites**

Run `node --check` for changed browser scripts and all focused tests.

**Step 2: Run repository gates**

Run guard, full phase, release bundle verification, generated-diff checks, and the complete Worker test suite.

**Step 3: Run headed/browser verification**

Exercise a Ranked run with Void Reaper at zero, one, and maximum proc count; exercise Chaos Orb gold roll; verify canonical wallet persistence, no integrity popup, correct HUD color/syncing, and no new console errors. Run a negative case above the bound and confirm it becomes provisional. Run Practice and confirm unchanged local effects and no Ranked dot.

**Step 4: Update progress**

Record root cause, accepted security trade-off, new hash, test counts, release artifacts, and rollback targets.

### Task 8: Deploy Worker and Pages with canaries

**Step 1: Confirm clean intended diff and main branch**

Review every staged file, ensure unrelated user work is absent, and ensure all required commits are on `main`.

**Step 2: Deploy Worker candidate**

Deploy the new Worker version with no D1 migration. Verify availability and a disposable start/claim/abandon flow on the new hash.

**Step 3: Canary Worker traffic**

Promote through the repository's established 5% and 25% read-only canaries, then 100% only if all checks remain green.

**Step 4: Deploy Pages from repository root**

Upload the verified release bundle with Functions and `_routes.json`. Verify stable and immutable URLs, asset build identity, JSON POST proxy behavior, and Ranked availability compatibility.

**Step 5: Production smoke and rollback record**

Confirm a fresh Ranked run can emit bounded proc claims and preserve official/observer-valid status. Record Worker and Pages rollback targets in `progress.md`.

