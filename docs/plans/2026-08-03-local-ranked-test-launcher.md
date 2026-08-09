# Local Ranked Test Launcher Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Provide a double-click Windows launcher that runs one of the five newest commits on the newest eligible local branch as an isolated local Ranked test, with an optional local-only Observer Bot.

**Architecture:** Keep the native Windows UI thin in PowerShell and put all Git selection, cache-path validation, bundle preparation, Worker launch, and log redaction in a testable Node ESM core. The core creates launcher-owned detached worktrees under ignored `output/`, runs only `wrangler dev --local` on a loopback port, and has no deployment or remote-preview path.

**Tech Stack:** Windows `.cmd` + PowerShell WinForms, Node.js ESM, Git linked worktrees, Wrangler/Miniflare local D1, Node test runner.

---

## Scope and safety rules

- Work only in the dedicated `codex/local-test-launcher` worktree.
- Never check out, merge, reset, commit to, or edit the user's `main` checkout or existing feature worktrees.
- Do not use `wrangler deploy`, Pages deploy, `--remote`, `tunnel`, a production config, or public leaderboard endpoints.
- The launcher owns only `output/local-ranked-test-launcher/`; do not add cache cleanup in this feature.
- Determine the launcher host branch with `git branch --show-current` and exclude it from automatic candidate selection.
- The Observer Bot password is a throwaway local test value. Pass it via child-process environment only; do not place it in source, CLI arguments, logs, committed configuration, or test fixtures.
- Use the selected revision's Worker and assets together. Do not serve old Pages assets through a newer Worker.
- Reuse the proven local-worker pattern from `scripts/online-v3-ranked-headed.mjs:85-151` and its ruleset-hash patch at `scripts/online-v3-ranked-headed.mjs:623-633`.

## Task 1: Add a testable commit-selection and safety core

**Files:**
- Create: `scripts/local-ranked-test-launcher-core.mjs`
- Create: `tests/local-ranked-test-launcher-core.test.mjs`

**Step 1: Write failing pure-domain tests**

Cover the parser and selectors without invoking Git:

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseNewestBranch,
  parseBranchTips,
  parseCommitHistory,
  selectListedCommit,
  launcherPaths
} from "../scripts/local-ranked-test-launcher-core.mjs";

test("chooses the newest branch after excluding the launcher host branch", () => {
  const branches = parseBranchTips(
    "main\u00008e770f5\u00002026-08-01T10:00:00Z\n" +
    "codex/record-repair\u0000e50a432\u00002026-08-03T12:00:00Z\n" +
    "codex/local-test-launcher\u000075047f3\u00002026-08-03T20:10:00Z\n"
  );
  assert.equal(chooseNewestBranch(branches, { excludedBranchName: "codex/local-test-launcher" }).name, "codex/record-repair");
});

test("shows exactly the newest five commits and rejects every other hash", () => {
  const commits = parseCommitHistory(/* six NUL-delimited fixture rows */);
  assert.equal(commits.length, 5);
  assert.throws(() => selectListedCommit(commits, "f".repeat(40)), /not one of the displayed commits/u);
});

test("derives cache paths only below the launcher output root", () => {
  const paths = launcherPaths("D:/repo", "a".repeat(40));
  assert.match(paths.worktree, /output[\\/]local-ranked-test-launcher[\\/]worktrees/u);
  assert.throws(() => launcherPaths("D:/repo", "../main"), /full commit hash/u);
});
```

Add fixtures for tied timestamps (tie-break by full branch name), malformed rows, duplicate commit lines, and a short hash passed where a full hash is required.

**Step 2: Run the test to verify it fails**

Run:

```powershell
node --test tests/local-ranked-test-launcher-core.test.mjs
```

Expected: FAIL because the core module does not exist.

**Step 3: Implement pure parsing and path helpers**

In `local-ranked-test-launcher-core.mjs`:

- use `git branch --show-current` to identify the launcher host branch, then use `git for-each-ref refs/heads --format=%(refname:short)%00%(objectname)%00%(committerdate:iso-strict)` as the only branch discovery input;
- use `git log <branch> -5 --format=%H%x00%cI%x00%s%x00` for the displayed list;
- reject the launcher host branch before timestamp ordering, then represent branch and commit fields as frozen objects;
- require `/^[0-9a-f]{40}$/u` before deriving a launcher-owned path;
- resolve and assert every generated path remains below the resolved launcher cache root.

Do not run Git or touch disk from these exported pure helpers.

**Step 4: Run focused tests and syntax checks**

```powershell
node --test tests/local-ranked-test-launcher-core.test.mjs
node --check scripts/local-ranked-test-launcher-core.mjs
git diff --check
```

Expected: PASS.

**Step 5: Commit the selection core**

```powershell
git add -- scripts/local-ranked-test-launcher-core.mjs tests/local-ranked-test-launcher-core.test.mjs
git commit -m "feat: select local Ranked test revisions"
```

## Task 2: Prepare selected revisions without touching user worktrees

**Files:**
- Modify: `scripts/local-ranked-test-launcher-core.mjs`
- Modify: `tests/local-ranked-test-launcher-core.test.mjs`

**Step 1: Add failing command-construction tests**

Inject an `execFile`-compatible dependency and require these command contracts:

```js
assert.deepEqual(calls[0], [
  "git", ["worktree", "add", "--detach", expectedWorktree, selected.hash]
]);
assert.equal(calls.some(([, args]) => args.includes("checkout") || args.includes("merge")), false);
assert.deepEqual(calls.at(-1), ["npm.cmd", ["ci"]]);
```

Assert that `npm.cmd ci` is skipped only when
`cloudflare/leaderboard-v3/node_modules/wrangler/bin/wrangler.js` exists in the
launcher-owned selected worktree. Assert a worktree already at another commit
is rejected instead of reused.

**Step 2: Run the test to verify it fails**

```powershell
node --test tests/local-ranked-test-launcher-core.test.mjs
```

Expected: FAIL because preparation and dependency checks do not exist.

**Step 3: Implement revision preparation**

Add an async `prepareRevision(selectedCommit, options)` which:

1. creates `output/local-ranked-test-launcher/worktrees/<hash>` with
   `git worktree add --detach` when it does not exist;
2. verifies `git rev-parse HEAD` in a cached worktree equals the selected full
   hash before reuse;
3. checks for Wrangler only at the selected revision's Worker path;
4. runs `npm.cmd ci` with `cwd` set to that selected Worker directory when
   Wrangler is absent;
5. returns immutable resolved paths for the selected root, Worker root, bundle,
   manifest, D1 state root, and Wrangler executable.

Capture subprocess output with a fixed bounded buffer and turn a failure into
a redacted user-facing error. Never call `git worktree remove` or any deletion
command.

**Step 4: Run focused tests and checks**

```powershell
node --test tests/local-ranked-test-launcher-core.test.mjs
node --check scripts/local-ranked-test-launcher-core.mjs
git diff --check
```

Expected: PASS.

**Step 5: Commit the isolated preparation flow**

```powershell
git add -- scripts/local-ranked-test-launcher-core.mjs tests/local-ranked-test-launcher-core.test.mjs
git commit -m "feat: prepare isolated local test revisions"
```

## Task 3: Build the selected test bundle and run its local Worker

**Files:**
- Modify: `scripts/local-ranked-test-launcher-core.mjs`
- Modify: `tests/local-ranked-test-launcher-core.test.mjs`

**Step 1: Write failing build, Worker-argument, and secret tests**

Require the launch plan to:

```js
assert.match(patchedProtocol, /^  const RULESET_HASH = "sha256:fixture";$/mu);
assert.equal(buildEnv.DUNGEON_ONLINE_TEST_BOT_PASSWORD, undefined);
assert.equal(botBuildEnv.DUNGEON_ONLINE_TEST_BOT_PASSWORD, "local-bot-test");
assert.deepEqual(workerArgs.slice(0, 4), ["dev", "--local", "--config", localConfig]);
assert.equal(workerArgs.includes("--remote"), false);
assert.equal(workerArgs.includes("tunnel"), false);
assert.equal(workerEnv.CLOUDFLARE_INCLUDE_PROCESS_ENV, "true");
assert.match(workerEnv.RANKED_V3_HMAC_SECRET, /^.{32,}$/u);
```

Also test that log redaction replaces both the HMAC value and local Observer
password, and that an unsupported protocol source without the unique
`RULESET_HASH` line fails before Worker startup.

**Step 2: Run the test to verify it fails**

```powershell
node --test tests/local-ranked-test-launcher-core.test.mjs
```

Expected: FAIL because build/launch helpers are absent.

**Step 3: Implement the local-only launch controller**

Add the following bounded operations:

1. run `node scripts/build-pages-v3.mjs --target test` with the Observer
   password only in that child environment when the mode is enabled;
2. read `src/rulesets/v08-meta-1/data/ruleset-manifest.json`, replace exactly
   one `RULESET_HASH` declaration in the selected bundle's
   `online-v3/ranked-v3-protocol.js`, and write UTF-8 without BOM;
3. allocate a free loopback port with `net.createServer()`;
4. spawn the selected revision's Wrangler executable with `dev --local`, its
   `wrangler.local.jsonc`, absolute isolated `--persist-to`, `--ip 127.0.0.1`,
   selected port, and selected test bundle via `--assets`;
5. inherit the normal process environment and add only these launcher-specific
   child fields: `CLOUDFLARE_INCLUDE_PROCESS_ENV=true` and a freshly generated
   48-byte-base64 `RANKED_V3_HMAC_SECRET`;
6. poll only the loopback availability/leaderboard endpoint for at most 20
   seconds, then emit a structured ready event with the browser URL;
7. on Node process exit, terminate only its tracked Worker child.

Do not create `.dev.vars`, invoke the npm `dev` script, or expose an interactive
Wrangler terminal. The launcher controls the raw Wrangler process itself.

**Step 4: Run focused tests and checks**

```powershell
node --test tests/local-ranked-test-launcher-core.test.mjs
node --check scripts/local-ranked-test-launcher-core.mjs
git diff --check
```

Expected: PASS.

**Step 5: Commit the local launch controller**

```powershell
git add -- scripts/local-ranked-test-launcher-core.mjs tests/local-ranked-test-launcher-core.test.mjs
git commit -m "feat: launch isolated local Ranked Worker"
```

## Task 4: Add the double-click Windows launcher

**Files:**
- Create: `Launch-Local-Ranked-Test.cmd`
- Create: `scripts/local-ranked-test-launcher.ps1`
- Create: `tests/local-ranked-test-launcher-ui.test.mjs`

**Step 1: Write failing static UI-contract tests**

Test the entry point and PowerShell source as user-facing contracts:

```js
assert.match(cmdSource, /local-ranked-test-launcher\.ps1/u);
assert.match(psSource, /System\.Windows\.Forms/u);
assert.match(psSource, /Start \+ Observer Bot/u);
assert.doesNotMatch(psSource, /wrangler\s+deploy|pages\s+deploy|--remote|\btunnel\b/u);
assert.doesNotMatch(psSource, /DUNGEON_ONLINE_TEST_BOT_PASSWORD\s*=/u);
```

Require the UI to request JSON candidates from the Node core, display the
branch name and exactly five commit rows, disable Start until a row is chosen,
and render explicit Ready/Failed/Stopped states.

**Step 2: Run the test to verify it fails**

```powershell
node --test tests/local-ranked-test-launcher-ui.test.mjs
```

Expected: FAIL because the launcher files do not exist.

**Step 3: Implement the `.cmd` wrapper and PowerShell UI**

Create a wrapper that resolves its own repository root and invokes PowerShell
with `-NoProfile` and the launcher script. In the PowerShell script:

- create a WinForms dialog with a branch/status label, five-row commit list,
  `Observer Bot (local test)` checkbox, editable `local-bot-test` field, Start,
  Open Game, and Stop controls;
- call the Node core `list --json` at startup and render date, short hash, and
  subject through UI controls rather than string-evaluated commands;
- start the Node core with `start --commit <full-hash> --json-events`, passing
  the optional bot password through that child process environment only;
- consume newline-delimited JSON status events, redact any unexpected secret
  text before appending to the read-only status box, and open only the
  loopback URL emitted by a ready event;
- store the `System.Diagnostics.Process` object for the launch session and
  make Stop terminate its process tree only after the user clicks Stop;
- re-enable Start after terminal failure or stop.

The browser still prompts for the displayed local bot password after the user
selects `Start + Observer Bot`; after successful unlock, the game uses F10 to
toggle the bot.

**Step 4: Run focused tests and syntax checks**

```powershell
node --test tests/local-ranked-test-launcher-ui.test.mjs tests/local-ranked-test-launcher-core.test.mjs
node --check scripts/local-ranked-test-launcher-core.mjs
git diff --check
```

Expected: PASS.

**Step 5: Commit the Windows entry point**

```powershell
git add -- Launch-Local-Ranked-Test.cmd scripts/local-ranked-test-launcher.ps1 tests/local-ranked-test-launcher-ui.test.mjs
git commit -m "feat: add local Ranked test launcher window"
```

## Task 5: Verify a real local launch lifecycle and document use

**Files:**
- Create: `tests/local-ranked-test-launcher-smoke.test.mjs`
- Create: `README.md`
- Modify: `scripts/local-ranked-test-launcher-core.mjs` only if smoke coverage exposes a real lifecycle defect

**Step 1: Write the real-runtime smoke test**

Use a temporary launcher cache root and the current committed revision. The
test must:

1. call the same `prepareRevision` and `startLocalRankedTest` public API used
   by the UI;
2. wait for its emitted loopback ready URL;
3. request `/` and assert the selected bundle serves `index.html`;
4. request `/api/v3/leaderboard?season=local-m4&limit=1` and assert HTTP 200;
5. stop the returned controller and assert the Worker child exits;
6. assert that neither production URLs nor a deploy command appeared in the
   captured command log.

The test must clean up only the temporary directory it created, after resolving
and asserting that directory is below the OS temporary root.

**Step 2: Run the smoke test to verify it fails**

```powershell
node --test tests/local-ranked-test-launcher-smoke.test.mjs
```

Expected: FAIL until the public lifecycle API works end to end.

**Step 3: Implement only defects exposed by the smoke test**

Keep lifecycle cleanup in the controller. Do not add cache-reset UI, remote
fallbacks, production flags, record deletion, or unrelated game changes.

**Step 4: Document the launcher**

Add a concise README section covering:

- double-click `Launch-Local-Ranked-Test.cmd` from a Windows checkout;
- newest local branch and five-commit selection rule;
- initial Worker dependency installation may take time;
- `Start + Observer Bot` uses the displayed local password and F10;
- each session is local-only and cannot publish a public leaderboard result;
- Stop ends the selected launcher session but intentionally retains local
  test cache/state.

**Step 5: Run all focused checks**

```powershell
node --test tests/local-ranked-test-launcher-core.test.mjs tests/local-ranked-test-launcher-ui.test.mjs tests/local-ranked-test-launcher-smoke.test.mjs
node --check scripts/local-ranked-test-launcher-core.mjs
git diff --check
```

Expected: PASS. Do not run `verify:full`, deploy, push, or alter Worker/D1
production state for this local-tool feature.

**Step 6: Perform manual Windows acceptance**

1. Double-click `Launch-Local-Ranked-Test.cmd`.
2. Confirm the dialog names the newest local branch and exactly five commits.
3. Launch a normal selected commit and confirm the browser URL is loopback.
4. Stop it from the dialog.
5. Launch a different displayed commit with Observer Bot checked, enter the
   displayed throwaway password after choosing `Start + Observer Bot`, then
   press F10 in-game.
6. Confirm neither run opens a tunnel, a remote preview, or a production URL.

**Step 7: Commit the verification and documentation**

```powershell
git add -- README.md scripts/local-ranked-test-launcher-core.mjs tests/local-ranked-test-launcher-smoke.test.mjs
git commit -m "test: verify local Ranked test launcher"
```

## Completion boundary

Report the local branch/commit, changed-file count, focused test totals, smoke
result, and manual Windows acceptance result. Do not merge this launcher into
`main`, push it, deploy it, change a ruleset, or publish/delete leaderboard
records unless a later prompt explicitly authorizes that action.

