# Local Bot Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve launcher bot telemetry and provide a durable, launcher-only local leaderboard with final relic builds.

**Architecture:** A focused Node module owns normalization, merge semantics, atomic result persistence, and history aggregation. The existing multi-bot controller feeds it canonical browser samples and emits stable live events. The PowerShell launcher renders the live fields and a separate leaderboard window using a read-only Node CLI query.

**Tech Stack:** Node.js ESM, `node:test`, Playwright browser adapter, PowerShell Windows Forms.

**Spec:** `docs/superpowers/specs/2026-09-01-local-bot-leaderboard-design.md`

## Global Constraints

- Launcher-only local feature; no gameplay, Worker, D1, production leaderboard, protocol, or ruleset changes.
- Preserve unrelated working-tree changes.
- Do not create a commit, push, or deploy without a separate explicit user request.
- Result history starts with this feature; malformed or legacy session files are ignored.

---

### Task 1: Result domain and durable history

**Files:**
- Create: `scripts/local-ranked-bot-results.mjs`
- Create: `tests/local-ranked-bot-results.test.mjs`
- Modify: `scripts/local-ranked-multi-bot-domain.mjs`
- Modify: `tests/local-ranked-multi-bot-domain.test.mjs`

**Interfaces:**
- Produces: `mergeBotResult(previous, update)`, `writeBotResult(path, result, options)`, `listBotLeaderboard(outputRoot, options)`, and `botResultPath(sessionRoot, botId)`.
- Consumes: canonical `sample.snapshot.publicState`, bot/session metadata, and terminal status updates.

- [ ] **Step 1: Write failing result-domain tests**

Cover monotonic score/depth highscore, latest valid current fields, starting relic immutability, canonical relic stacks, terminal labels, safe owned paths, atomic writes, malformed-file rejection, Today filtering, and score/depth/time ordering.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `node --test tests/local-ranked-bot-results.test.mjs tests/local-ranked-multi-bot-domain.test.mjs`

Expected: FAIL because the result module and owned result path do not exist.

- [ ] **Step 3: Implement the minimal result module**

Use schema version `1`; accept only non-negative finite integers; normalize relics to `{ relicId, stacks }`; write `bot-result.json.tmp` then rename to `bot-result.json`; recursively inspect only `session-*\\bot-0[1-8]\\bot-result.json`; ignore invalid JSON and invalid schemas; return frozen records ordered by score, depth highscore, and timestamp.

- [ ] **Step 4: Run the focused tests and confirm GREEN**

Run: `node --test tests/local-ranked-bot-results.test.mjs tests/local-ranked-multi-bot-domain.test.mjs`

Expected: PASS.

### Task 2: Browser and controller telemetry integration

**Files:**
- Modify: `scripts/local-ranked-multi-bot-browser.mjs`
- Modify: `scripts/local-ranked-multi-bot-controller.mjs`
- Modify: `tests/local-ranked-multi-bot-browser.test.mjs`
- Modify: `tests/local-ranked-multi-bot-controller.test.mjs`

**Interfaces:**
- Consumes: Task 1's result merge and write functions.
- Produces: `bot_status.startingRelic`, `bot_status.relics`, and durable per-bot terminal records.

- [ ] **Step 1: Write failing browser/controller tests**

Assert that the browser returns the selected `data-relic-id` and accessible name; a snapshot-less terminal sample preserves prior metrics/build; a failed or stopped bot persists immediately; normal samples are throttled; Stop All finalizes running records as stopped.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `node --test tests/local-ranked-multi-bot-browser.test.mjs tests/local-ranked-multi-bot-controller.test.mjs`

Expected: FAIL on missing relic and persistence behavior.

- [ ] **Step 3: Integrate stable telemetry and persistence**

Read `data-relic-id` and the first `<strong>` label before clicking. Keep an accumulated result on each controller entry, merge every sample, emit from the accumulator, persist at most once per 10 seconds during play, and force an awaited write for completed/failed/blocked/stopped states and graceful Stop All.

- [ ] **Step 4: Run the focused tests and confirm GREEN**

Run: `node --test tests/local-ranked-multi-bot-browser.test.mjs tests/local-ranked-multi-bot-controller.test.mjs`

Expected: PASS.

### Task 3: Read-only leaderboard CLI

**Files:**
- Modify: `scripts/local-ranked-test-launcher-core.mjs`
- Modify: `tests/local-ranked-test-launcher-core.test.mjs`

**Interfaces:**
- Consumes: `listBotLeaderboard(outputRoot, { scope, now })`.
- Produces: `leaderboard --json --scope today|all` returning `{ records: [...] }`.

- [ ] **Step 1: Write failing CLI tests**

Assert supported scopes, repo-owned output root selection, JSON-ready records, and rejection of unsupported leaderboard arguments.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `node --test tests/local-ranked-test-launcher-core.test.mjs`

Expected: FAIL because the leaderboard command is unavailable.

- [ ] **Step 3: Add the read-only command**

Route `leaderboard --json --scope <value>` before the start command, pass `path.join(repoRoot, "output", "multi-bot-runs")` to the result module, and print one JSON document without starting a Worker or Chrome.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run: `node --test tests/local-ranked-test-launcher-core.test.mjs`

Expected: PASS.

### Task 4: Windows Forms live table and leaderboard window

**Files:**
- Modify: `scripts/local-ranked-test-launcher.ps1`
- Modify: `tests/local-ranked-test-launcher-ui.test.mjs`

**Interfaces:**
- Consumes: live `bot_status` fields and Task 3's JSON response.
- Produces: a `Starting Relic` live column and the `Bot Leaderboard` read-only window.

- [ ] **Step 1: Write failing UI contract tests**

Assert the new live-column mapping, leaderboard button, Today/All Time controls, status filter, default score sort, result columns, relic detail panel, and read-only CLI invocation.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `node --test tests/local-ranked-test-launcher-ui.test.mjs`

Expected: FAIL because the new controls are absent.

- [ ] **Step 3: Implement the Windows Forms UI**

Insert `Starting Relic` after Bot and shift live mappings. Add a button beside diagnostics. Build a separate fixed-size form whose scope/filter changes reload records, render ranks and compact metadata, and populate a multiline read-only details box with `Relic Name/ID ×stacks` from the selected record.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run: `node --test tests/local-ranked-test-launcher-ui.test.mjs`

Expected: PASS.

### Task 5: Integrated verification

**Files:**
- Verify only; no planned product edits.

**Interfaces:**
- Consumes: all preceding tasks.
- Produces: verification evidence for the completed local launcher feature.

- [ ] **Step 1: Run all launcher and multi-bot tests**

Run: `node --test tests/local-ranked-bot-results.test.mjs tests/local-ranked-multi-bot-domain.test.mjs tests/local-ranked-multi-bot-browser.test.mjs tests/local-ranked-multi-bot-controller.test.mjs tests/local-ranked-test-launcher-core.test.mjs tests/local-ranked-test-launcher-ui.test.mjs`

Expected: PASS.

- [ ] **Step 2: Run changed JavaScript syntax checks**

Run `node --check` for each changed `.mjs` file.

Expected: PASS.

- [ ] **Step 3: Run repository guard once**

Run: `npm run verify:guard`

Expected: PASS.

- [ ] **Step 4: Check whitespace and exact scope**

Run: `git diff --check` and `git status --short`.

Expected: no whitespace errors; only approved launcher files, the approved result module/tests, the approved design/plan documents, the prior Merchant Favor work, and pre-existing user files are changed.
