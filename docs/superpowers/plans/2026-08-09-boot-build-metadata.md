# Boot Build Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Local Ranked Test select consolidated `main` and show `v0.8.0 · <short commit> · <commit date>` below the author credit on every built boot screen.

**Architecture:** Keep branch selection in the launcher core and cover the `main` host case with a focused regression. During Pages builds, read the checked-out commit identity from Git and append it to the built `config.js`; `game.js` renders those values into a dedicated boot-screen element, while unbuilt development runs show an explicit non-release fallback.

**Tech Stack:** Node.js ESM build scripts, browser globals in `config.js`/`game.js`, HTML/CSS boot UI, Node test runner, existing browser verification commands.

## Global Constraints

- Render exactly `v0.8.0 · caf92d2 · 2026-08-09` in shape: version, seven-character commit hash, ISO `YYYY-MM-DD` commit date.
- Derive commit hash and date automatically from the Git checkout being built; never maintain either value manually.
- Keep the metadata visually secondary to `Made by Kamil Matysek`.
- Fail the build clearly when Git does not provide either required value.
- Do not alter gameplay, Ranked rules, leaderboard data, deployment state, or production configuration.
- Preserve the user's pre-existing `AGENTS.md` edits and never stage that file implicitly.

---

### Task 1: Make `main` the launcher's authoritative local selection

**Files:**
- Modify: `scripts/local-ranked-test-launcher-core.mjs:451-458`
- Test: `tests/local-ranked-test-launcher-core.test.mjs:5-61`

**Interfaces:**
- Consumes: `listLocalCandidates({ repoRoot, execFile })` and parsed branch records `{ name, hash, date }`.
- Produces: when the launcher host branch is `main`, `listLocalCandidates()` returns the exact `main` candidate even if another branch has a later committer timestamp.

- [ ] **Step 1: Keep the failing regression fixture**

```js
test("launcher running from main selects main even when a safety branch is newer", async () => {
  const result = await listLocalCandidates({
    repoRoot: path.resolve("D:/repo"),
    async execFile(_command, args) {
      if (args[0] === "branch") return { stdout: "main\n" };
      if (args[0] === "for-each-ref") {
        return {
          stdout: [
            "main", HASH_A, "2026-08-03T12:00:00Z",
            "codex/safety-pre-consolidation", HASH_B, "2026-08-04T12:00:00Z"
          ].join("\0")
        };
      }
      if (args[0] === "log") {
        assert.equal(args[1], "main");
        return { stdout: [HASH_A, "2026-08-03T12:00:00Z", "main commit"].join("\0") };
      }
      throw new Error(`Unexpected git command: ${args.join(" ")}`);
    }
  });
  assert.equal(result.branch.name, "main");
});
```

- [ ] **Step 2: Verify the regression would fail without the fix**

Run: `node --test tests/local-ranked-test-launcher-core.test.mjs`

Expected before implementation: FAIL because `codex/safety-pre-consolidation` is selected instead of `main`.

- [ ] **Step 3: Preserve the minimal `main` preference**

```js
const branches = parseBranchTips(branchResult?.stdout);
const branch = excludedBranchName === "main"
  ? branches.find((candidate) => candidate.name === "main") || chooseNewestBranch(branches)
  : chooseNewestBranch(branches, { excludedBranchName });
```

- [ ] **Step 4: Verify selection and syntax**

Run: `node --test tests/local-ranked-test-launcher-core.test.mjs`

Expected: 8 tests PASS.

Run: `node --check scripts/local-ranked-test-launcher-core.mjs`

Expected: exit code 0.

Run: `node scripts/local-ranked-test-launcher-core.mjs list --json`

Expected: `branch.name` is `main` and `commits[0].hash` is the current `main` commit.

- [ ] **Step 5: Commit only the launcher regression**

```powershell
git add -- scripts/local-ranked-test-launcher-core.mjs tests/local-ranked-test-launcher-core.test.mjs
git commit -m "fix: keep local Ranked launcher on main"
```

---

### Task 2: Render boot build identity with a safe development fallback

**Files:**
- Modify: `index.html:28-31,129-150`
- Modify: `style.css:103-111`
- Modify: `style-hd-boot.css:151-164`
- Modify: `game.js:70-74,996-1055`
- Test: `tests/ui-polish.test.js:5-16`

**Interfaces:**
- Consumes: `window.GAME_VERSION`, `window.DUNGEON_BUILD_COMMIT`, and `window.DUNGEON_BUILD_COMMIT_DATE`.
- Produces: `#bootBuildMetadata` text in `version · commit · date` format.

- [ ] **Step 1: Write the failing source-level UI assertions**

```js
const game = fs.readFileSync(path.join(root, "game.js"), "utf8");

test("boot screen exposes version, commit, and commit date below the author credit", () => {
  assert.match(html, /Made by Kamil Matysek[\s\S]*id="bootBuildMetadata"/u);
  assert.match(css, /\.boot-build-metadata\s*\{/u);
  assert.match(game, /DUNGEON_BUILD_COMMIT/u);
  assert.match(game, /DUNGEON_BUILD_COMMIT_DATE/u);
  assert.match(game, /`\$\{GAME_VERSION\} · \$\{GAME_BUILD_COMMIT\} · \$\{GAME_BUILD_COMMIT_DATE\}`/u);
});
```

- [ ] **Step 2: Run the UI test to verify it fails**

Run: `node --test tests/ui-polish.test.js`

Expected: FAIL because `bootBuildMetadata` and its binding do not exist.

- [ ] **Step 3: Add the boot metadata element**

Add directly after `.boot-credits` in `index.html`:

```html
<p class="boot-build-metadata" id="bootBuildMetadata" aria-live="polite"></p>
```

- [ ] **Step 4: Bind normalized runtime values in `game.js`**

Add next to the existing `GAME_VERSION` normalization:

```js
const GAME_BUILD_COMMIT = (() => {
  const raw = typeof window !== "undefined" ? window.DUNGEON_BUILD_COMMIT : "";
  const normalized = typeof raw === "string" ? raw.trim() : "";
  return normalized || "dev";
})();
const GAME_BUILD_COMMIT_DATE = (() => {
  const raw = typeof window !== "undefined" ? window.DUNGEON_BUILD_COMMIT_DATE : "";
  const normalized = typeof raw === "string" ? raw.trim() : "";
  return normalized || "working tree";
})();
```

Resolve and render the element next to `appVersionEl`:

```js
const bootBuildMetadataEl = document.getElementById("bootBuildMetadata");

if (bootBuildMetadataEl) {
  bootBuildMetadataEl.textContent = `${GAME_VERSION} · ${GAME_BUILD_COMMIT} · ${GAME_BUILD_COMMIT_DATE}`;
}
```

- [ ] **Step 5: Style classic and HD layouts without competing with the credit**

Add to `style.css`:

```css
.boot-build-metadata {
  margin: -4px 0 0;
  color: #454b58;
  font-family: "Courier Prime", "Cascadia Mono", "IBM Plex Mono", monospace;
  font-size: clamp(9px, 1vw, 11px);
  letter-spacing: 0.35px;
}
```

Add to `style-hd-boot.css` after the HD `.boot-credits` rule:

```css
body.graphics-hd-ui .boot-build-metadata {
  position: absolute;
  bottom: clamp(15px, 1.6vh, 19px);
  left: 50%;
  margin: 0;
  color: #484540;
  font: 400 clamp(0.48rem, 0.62vw, 0.56rem)/1.2 "Courier Prime", "Cascadia Mono", monospace;
  letter-spacing: 0.8px;
  text-shadow: 0 1px #000;
  transform: translateX(-50%);
  white-space: nowrap;
}
```

- [ ] **Step 6: Run the focused UI test and syntax check**

Run: `node --test tests/ui-polish.test.js`

Expected: all tests PASS.

Run: `node --check game.js`

Expected: exit code 0.

- [ ] **Step 7: Commit only the boot rendering slice**

```powershell
git add -- index.html style.css style-hd-boot.css game.js tests/ui-polish.test.js
git commit -m "feat: render build identity on boot screen"
```

---

### Task 3: Inject the checked-out commit identity during Pages builds

**Files:**
- Modify: `scripts/build-pages-v3.mjs:51-64`
- Create: `tests/pages-test-build-metadata.test.mjs`

**Interfaces:**
- Consumes: Git `HEAD` in the worktree where `scripts/build-pages-v3.mjs` executes.
- Produces: `window.DUNGEON_BUILD_COMMIT` containing seven lowercase hexadecimal characters and `window.DUNGEON_BUILD_COMMIT_DATE` containing an ISO calendar date in the built `config.js`.

- [ ] **Step 1: Write the failing test-build regression**

```js
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builder = path.join(root, "scripts", "build-pages-v3.mjs");

test("test Pages build embeds the checked-out commit hash and date", async () => {
  const built = spawnSync(process.execPath, [builder, "--target", "test"], {
    cwd: root,
    env: process.env,
    encoding: "utf8"
  });
  assert.equal(built.status, 0, `${built.stdout}\n${built.stderr}`);

  const expectedCommit = execFileSync("git", ["rev-parse", "--short=7", "HEAD"], {
    cwd: root,
    encoding: "utf8"
  }).trim();
  const expectedDate = execFileSync("git", ["show", "-s", "--format=%cs", "HEAD"], {
    cwd: root,
    encoding: "utf8"
  }).trim();
  const config = await readFile(path.join(root, "output", "pages-test-dist", "config.js"), "utf8");

  assert.match(config, new RegExp(`window\\.DUNGEON_BUILD_COMMIT = ${JSON.stringify(expectedCommit)}`));
  assert.match(config, new RegExp(`window\\.DUNGEON_BUILD_COMMIT_DATE = ${JSON.stringify(expectedDate)}`));
});
```

- [ ] **Step 2: Run the build regression to verify it fails**

Run: `node --test tests/pages-test-build-metadata.test.mjs`

Expected: FAIL because the built `config.js` has no build identity globals.

- [ ] **Step 3: Read and validate Git metadata in the builder**

Add a focused helper near the output safety checks:

```js
function readGitBuildValue(args, label) {
  let value = "";
  try {
    value = execFileSync(
      "git",
      ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, ...args],
      { cwd: root, encoding: "utf8" }
    ).trim();
  } catch (error) {
    throw new Error(`Unable to read ${label} for the Pages build.`, { cause: error });
  }
  if (!value) throw new Error(`Git returned an empty ${label} for the Pages build.`);
  return value;
}

const buildCommit = readGitBuildValue(["rev-parse", "--short=7", "HEAD"], "commit hash");
const buildCommitDate = readGitBuildValue(["show", "-s", "--format=%cs", "HEAD"], "commit date");
```

- [ ] **Step 4: Append metadata only to the copied build configuration**

Before writing `configPath`, append:

```js
config += "window.DUNGEON_BUILD_COMMIT = " + JSON.stringify(buildCommit) + ";\n";
config += "window.DUNGEON_BUILD_COMMIT_DATE = " + JSON.stringify(buildCommitDate) + ";\n";
```

- [ ] **Step 5: Verify build injection and builder syntax**

Run: `node --test tests/pages-test-build-metadata.test.mjs`

Expected: 1 test PASS.

Run: `node --check scripts/build-pages-v3.mjs`

Expected: exit code 0.

- [ ] **Step 6: Commit only build injection and its regression**

```powershell
git add -- scripts/build-pages-v3.mjs tests/pages-test-build-metadata.test.mjs
git commit -m "feat: inject git identity into game builds"
```

---

### Task 4: Add the durable repository rule and complete browser verification

**Files:**
- Modify but do not implicitly stage: `AGENTS.md` under `## Verification` or `## Reporting`
- Verify: all files changed by Tasks 1-3

**Interfaces:**
- Consumes: the build-time globals and boot element from Tasks 2-3.
- Produces: a repository rule requiring future game changes to preserve accurate build identity.

- [ ] **Step 1: Add the exact repository instruction**

```markdown
- After every game code, content, or UI change, keep the boot-screen build identity visible and accurate in the form `GAME_VERSION · short commit · commit date`. The commit hash and date must come from the build checkout automatically; never hardcode or maintain them manually. Update `window.GAME_VERSION` only when the intended game version changes.
```

Keep all existing user edits in `AGENTS.md`. Do not stage the file unless the user explicitly confirms that its full current diff should be committed.

- [ ] **Step 2: Run focused checks once**

Run: `node --test tests/local-ranked-test-launcher-core.test.mjs tests/ui-polish.test.js tests/pages-test-build-metadata.test.mjs`

Expected: all tests PASS.

Run: `node --check scripts/local-ranked-test-launcher-core.mjs`

Expected: exit code 0.

Run: `node --check scripts/build-pages-v3.mjs`

Expected: exit code 0.

Run: `node --check game.js`

Expected: exit code 0.

- [ ] **Step 3: Run the exact affected browser scenario**

Run: `npm run verify:ui-current -- --scenario boot`

Expected: PASS with the boot screen visible and its layout intact.

- [ ] **Step 4: Verify the Local Ranked Test integration path**

Run: `node scripts/local-ranked-test-launcher-core.mjs list --json`

Expected: selects `main` and lists its current tip first.

Start the listed commit through the launcher core and inspect the served built `config.js`:

```powershell
$rankedSelection = node scripts/local-ranked-test-launcher-core.mjs list --json | ConvertFrom-Json
$rankedCommit = $rankedSelection.commits[0].hash
node scripts/local-ranked-test-launcher-core.mjs start --commit $rankedCommit --json-events
```

Expected: the `ready` event reports the selected full hash, and the served `config.js` contains the matching seven-character hash and its Git commit date.

- [ ] **Step 5: Check the complete diff and whitespace**

Run: `git status --short`

Expected: only the planned implementation files plus the pre-existing `AGENTS.md` modification.

Run: `git diff --check`

Expected: exit code 0.

- [ ] **Step 6: Commit only the new `AGENTS.md` instruction hunk**

First inspect `git diff -- AGENTS.md`, then create an index-only patch containing only the newly added build-identity instruction. Apply that patch to the index and verify the cached diff before committing:

```powershell
git diff --cached -- AGENTS.md
git commit -m "docs: require current boot build identity"
```

The cached diff must contain exactly the new build-identity instruction. The user's earlier `AGENTS.md` changes must remain unstaged in the working tree.
