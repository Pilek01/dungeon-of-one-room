# Ranked Fatal Worker Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Worker-only compatibility bridge that accepts the live f67 fatal payload while preserving exact `bc0d...` canonical semantics.

**Architecture:** Release descriptors declare whether a fatal presentation cause is stripped or retained. Existing production descriptors validate then strip it before the shared ruleset transition; only the local candidate retains it. Explicit fatal validation codes map to 422 while unknown failures stay 500.

**Tech Stack:** Node.js 24, JavaScript ESM/CommonJS browser modules, `node:test`, Cloudflare Workers/Wrangler 4.x, D1-compatible repository fixtures.

## Global Constraints

- Parent must remain exact `f67eb9554a1395d8399e23fda6094c6e22d7305d`.
- Active production ruleset remains exact `sha256:bc0d548d204557d0cc0ec7f8a358e18246778a13b27c58f5c6cdd73e73621711`.
- Do not modify Pages, browser runtime/protocol, UI, visual receipts, Wrangler configuration, migrations, or mobile-v1.
- Do not migrate, backfill, sanitize, or activate a ruleset.
- Unexpected internal failures remain HTTP 500.

---

### Task 1: Prove the mixed-client Worker contract

**Files:**
- Create: `cloudflare/leaderboard-v3/test/ranked-fatal-worker-compatibility.test.js`

**Interfaces:**
- Consumes: production release descriptors, real Worker HTTP handler, memory repositories, canonical digest/token behavior.
- Produces: failing behavioral tests for `fatalPresentationCauseMode: "strip"` and legacy dual acceptance.

- [ ] **Step 1: Add production descriptor and HTTP tests**

  Add tests that start/select/resume deterministic `bc0d...` runs and send:
  `classification`, `classification+presentationCause`,
  `classification+elixirUsage`, and
  `classification+elixirUsage+presentationCause`.

- [ ] **Step 2: Assert exact strip equivalence**

  Run cause-bearing and cause-free mutations from identical deterministic
  states. Assert equal public meta state, canonical `stateForDigest`, state
  digest, checkpoint token, lives, elixir charges, and final summary. Assert no
  `presentationCause` remains in production history or summary.

- [ ] **Step 3: Assert retention only for the local descriptor**

  Send the same request to the local descriptor and assert its normalized cause
  remains in the life receipt.

- [ ] **Step 4: Run RED**

  Run:
  `node --test --test-concurrency=1 cloudflare/leaderboard-v3/test/ranked-fatal-worker-compatibility.test.js`

  Expected: FAIL because production descriptors do not expose strip mode and
  cause-bearing/omitted transition equality is not enforced.

### Task 2: Implement the descriptor bridge and compatible hash policy

**Files:**
- Modify: `cloudflare/leaderboard-v3/src/rulesets/releases.js`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/life-policy.js`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/ruleset-hash-policy.js`
- Modify (generated): `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/data/ruleset-manifest.json`

**Interfaces:**
- Produces: `normalizeFatalPresentationCauseV08(value)`, descriptor
  `capabilities.fatalPresentationCauseMode`, and a ruleset wrapper that strips
  only for mode `"strip"`.

- [ ] **Step 1: Export the shared cause normalizer**

  Export the existing normalizer from `life-policy.js` and use it in
  `applyFatalEventV08` so validation has one implementation.

- [ ] **Step 2: Add descriptor modes**

  Create frozen `{ fatalPresentationCauseMode: "strip" }` capabilities for all
  production descriptors and frozen `{ fatalPresentationCauseMode: "retain" }`
  capabilities for the local candidate.

- [ ] **Step 3: Validate and strip at the descriptor boundary**

  When a strip-mode request owns `presentationCause`, validate it with
  `normalizeFatalPresentationCauseV08`, clone the request without that field,
  and invoke the base ruleset. Do not change the HTTP request body used for the
  operation digest.

- [ ] **Step 4: Restore every registered production hash**

  Add active `bc0d...` and retained `7027...` to
  `COMPATIBLE_RULESET_HASHES`; keep all existing hashes and the manifest hash.

- [ ] **Step 5: Regenerate the manifest**

  Run: `node scripts/generate-online-v3-meta-rules.mjs`

- [ ] **Step 6: Run GREEN**

  Re-run Task 1's test and require zero failures.

### Task 3: Preserve validation and retry semantics

**Files:**
- Modify: `cloudflare/leaderboard-v3/src/http/errors.js`
- Create: `cloudflare/leaderboard-v3/test/ranked-fatal-error-contract.test.js`

**Interfaces:**
- Produces: explicit 422 mapping for the six current fatal request validation
  codes and 500 fallback for unknown/internal codes.

- [ ] **Step 1: Write RED error tests**

  Assert explicit 422 responses for `FATAL_EVENT_PAYLOAD_INVALID`,
  `FATAL_EVENT_PAYLOAD_INVALID_FIELDS`, `FATAL_EVENT_CLASSIFICATION_INVALID`,
  `FATAL_ELIXIR_USAGE_INVALID`, `FATAL_ELIXIR_USAGE_UNAVAILABLE`, and
  `FATAL_PRESENTATION_CAUSE_INVALID`. Assert
  `FATAL_INTERNAL_STORAGE_FAILURE` maps to `500 INTERNAL_ERROR`.

- [ ] **Step 2: Characterize transport retry**

  Exercise the real browser transport: 422 performs one attempt; 500, 502, and
  503 perform three attempts with the same operation identity and request body.

- [ ] **Step 3: Run RED**

  Run the new test and confirm known fatal validation currently falls through
  to 500.

- [ ] **Step 4: Add only the six codes to the existing explicit 422 set**

  Do not add a `FATAL_*` prefix rule.

- [ ] **Step 5: Run GREEN**

  Re-run the error-contract test and require zero failures.

### Task 4: Cross-version recovery and release verification

**Files:**
- Modify tests only if a demonstrated coverage gap remains.

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: release evidence from the exact clean candidate.

- [ ] **Step 1: Add recovery/idempotency cases**

  Prove old cause-bearing run resume/death, replay of the same request, changed
  request under the same idempotency key conflicts, and a preexisting
  cause-bearing state can resume/finalize without rewriting history.

- [ ] **Step 2: Run focused suites and syntax checks**

  Run the two new test files, M3 life/finalization tests, production-release and
  manifest tests, generator `--check`, changed-JS `node --check`, and
  `git diff --check`.

- [ ] **Step 3: Run repository release verification fresh**

  Run `npm run verify:full -- --force` from the final committed SHA. Do not
  reuse a receipt from another SHA. If the unchanged visual gate needs evidence,
  use only a receipt whose source fingerprint matches the candidate exactly.

- [ ] **Step 4: Independent review and commit**

  Review the exact diff against f67, exclude all prohibited paths, then create
  the release commit and record its full SHA/tree SHA.

### Task 5: Inactive candidate and controlled rollout

**Files:**
- No source modifications.

**Interfaces:**
- Produces: Wrangler version/deployment IDs, production smoke evidence, or an
  exact rollback/NO-GO record.

- [ ] **Step 1: Reconfirm production and D1 read-only state**

  Record active Worker version, active `bc0d...` availability, migrations
  inventory, and current D1 Time Travel bookmark without executing writes.

- [ ] **Step 2: Dry-run and upload an inactive version**

  Use `wrangler versions upload --config wrangler.production.toml --dry-run
  --strict`, then upload without deployment and record the returned version ID.

- [ ] **Step 3: Candidate-only smoke**

  Add the candidate at 0% if required for a version override. Use a disposable
  run to prove cause-bearing and cause-free fatal transitions against the exact
  candidate; abandon/clean it through normal APIs. Confirm canonical `bc0d...`
  responses and no unexpected errors.

- [ ] **Step 4: GO/NO-GO**

  Report release SHA, base, exact diff, compatibility evidence, verification,
  and residual risk. Stop on any unresolved failure.

- [ ] **Step 5: Controlled rollout**

  If GO, progress candidate traffic through 5%, 25%, and 100%, recording every
  deployment ID and checking availability, error signals, and disposable-run
  behavior. Roll back only the Worker to
  `19b9174c-f720-4484-8f7b-c0918215c29b` on a release-caused regression.
