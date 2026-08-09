# Observer Bot and Record Archive Repair Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore the password-gated Ranked Observer Bot with a fail-closed production build, then replace the broken Ranked/Practice record presentation with one truthful, Gothic archive renderer and a release-blocking visual review receipt.

**Architecture:** Deliver the Observer Bot correction first as an isolated hotfix commit and optional separately authorized Pages release. Keep the existing Ranked API, Practice local storage, navigation contract, Worker, D1, score rules, and rulesets unchanged; normalize those two existing data sources through separate adapters into one DOM-safe renderer. Isolate the new archive styles and real podium assets, then bind persistent screenshot hashes and the relevant source fingerprint to an explicit human-review receipt required by the production build.

**Tech Stack:** Vanilla JavaScript UMD modules, DOM APIs, CSS, localStorage, Node test runner, existing Playwright-based headed QA, SHA-256 release receipts, Cloudflare Pages builder.

---

## Execution constraints

- Start implementation in a dedicated worktree and branch such as
  `codex/observer-bot-record-archive-repair`, based on the current local
  `main`. Use one agent only, as required by `AGENTS.md`.
- Re-read `AGENTS.md`, `docs/tasks/CURRENT.md`, and `ONLINE_V3_HANDOFF.md`, then
  run `npm.cmd run status:compact` before editing.
- Treat `docs/plans/2026-08-02-unified-leaderboard-and-records-design.md` as the
  approved product contract. Preserve its routing and data-ownership rules.
- Do not modify Worker endpoints, D1 schema/data, public leaderboard payloads,
  score calculation, active ruleset hashes, combat, rewards, mutator rules, or
  unrelated baseline presentation.
- Do not store or print the real Observer Bot password. Tests use an ephemeral
  test value and assert that only its SHA-256 hash reaches the bundle.
- Do not push, deploy, migrate, backfill, roll out a Worker, or activate a
  ruleset without a new explicit authorization.
- Use `@superpowers:systematic-debugging` if any RED test fails for a reason
  different from the intended missing behavior. Use
  `@game-studio:game-playtest` for the final headed screenshot inspection.

## Phase A: isolated Observer Bot hotfix

### Task 1: Make release builds fail before output mutation when the bot secret is missing

**Files:**
- Create: `scripts/pages-release-preflight.mjs`
- Modify: `scripts/build-pages-v3.mjs:8-63`
- Create: `tests/pages-release-preflight.test.mjs`
- Modify: `cloudflare/leaderboard-v3/test/online-ranked-boundary-repair.test.js:220-229`

**Step 1: Write the failing preflight test**

Add a pure preflight test with this contract:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { observerBotReleaseConfig } from "../scripts/pages-release-preflight.mjs";

test("release build rejects a missing Observer Bot password", () => {
  assert.throws(
    () => observerBotReleaseConfig({}, "release"),
    /DUNGEON_ONLINE_TEST_BOT_PASSWORD is required for release builds/u
  );
});

test("release config contains only an enabled flag and SHA-256 hash", () => {
  const result = observerBotReleaseConfig({
    DUNGEON_ONLINE_TEST_BOT_PASSWORD: "ephemeral-observer-password"
  }, "release");
  assert.equal(result.enabled, true);
  assert.match(result.passwordHash, /^sha256:[a-f0-9]{64}$/u);
  assert.doesNotMatch(JSON.stringify(result), /ephemeral-observer-password/u);
});
```

**Step 2: Run the test to verify it fails**

Run:

```powershell
node --test tests/pages-release-preflight.test.mjs
```

Expected: FAIL because `pages-release-preflight.mjs` does not exist and the
builder currently accepts an empty password.

**Step 3: Implement the pure fail-closed preflight**

Implement and export exactly one production decision:

```js
import { createHash } from "node:crypto";

export function observerBotReleaseConfig(env = {}, target = "release") {
  const password = String(env.DUNGEON_ONLINE_TEST_BOT_PASSWORD || "");
  if (target === "release" && !password) {
    throw new Error(
      "DUNGEON_ONLINE_TEST_BOT_PASSWORD is required for release builds."
    );
  }
  return Object.freeze({
    enabled: Boolean(password),
    passwordHash: password
      ? "sha256:" + createHash("sha256").update(password, "utf8").digest("hex")
      : ""
  });
}
```

Call this function in `build-pages-v3.mjs` before `rm(output, ...)`. A missing
release secret must not delete or partially regenerate `output/pages-dist`.
Use the returned fields when appending
`DUNGEON_ONLINE_TEST_BOT_ENABLED` and
`DUNGEON_ONLINE_TEST_BOT_PASSWORD_HASH`.

**Step 4: Replace the source-marker regression with behavioral assertions**

Keep the existing runtime gating assertions, but change the builder portion of
`online-ranked-boundary-repair.test.js` to import and exercise the preflight
function. Do not consider a regex match for a variable name sufficient.

**Step 5: Run focused tests and syntax checks**

Run:

```powershell
node --test tests/pages-release-preflight.test.mjs cloudflare/leaderboard-v3/test/online-ranked-boundary-repair.test.js
node --check scripts/pages-release-preflight.mjs
node --check scripts/build-pages-v3.mjs
git diff --check
```

Expected: all PASS.

**Step 6: Commit the isolated hotfix**

```powershell
git add -- scripts/pages-release-preflight.mjs scripts/build-pages-v3.mjs tests/pages-release-preflight.test.mjs cloudflare/leaderboard-v3/test/online-ranked-boundary-repair.test.js
git commit -m "fix: fail closed when Observer Bot release secret is missing"
```

### Task 2: Verify the actual hotfix bundle and Observer Bot lifecycle

**Files:**
- Create: `scripts/verify-pages-production-bundle.mjs`
- Create: `tests/pages-production-bundle.test.mjs`
- Modify only if an assertion requires it: `scripts/online-v3-ranked-headed.mjs:920-1045`

**Step 1: Add the final-package assertions**

Spawn `scripts/build-pages-v3.mjs --target release` with the ephemeral test
password and assert against `output/pages-dist/config.js`:

```js
assert.match(config, /DUNGEON_ONLINE_TEST_BOT_ENABLED = true/u);
assert.match(config, /DUNGEON_ONLINE_TEST_BOT_PASSWORD_HASH = "sha256:[a-f0-9]{64}"/u);
assert.doesNotMatch(config, /ephemeral-observer-password/u);
```

Also spawn the release builder without the environment variable and assert a
non-zero exit plus the exact preflight error.

Put the reusable output inspection in
`scripts/verify-pages-production-bundle.mjs`. It reads the existing bundle,
requires the enabled flag and non-empty SHA-256 hash, rejects the current
plaintext environment secret if one is present, and never rebuilds the bundle.
The integration test may build with the ephemeral secret, then call this
verifier.

**Step 2: Run the final-package test**

Run:

```powershell
node --test tests/pages-production-bundle.test.mjs
node --check scripts/verify-pages-production-bundle.mjs
```

Expected: PASS and no plaintext password in `output/pages-dist`.

**Step 3: Run the existing visible Observer Bot boundary scenario**

Run:

```powershell
npm.cmd run verify:ranked-headed -- --scenario lifecycle --force
```

Expected: PASS, including password unlock, Forge choice/checkpoint completion,
portal transition, and absence of
`Online v3 is still resolving the next room.`.

**Step 4: Commit the final-package verification**

```powershell
git add -- scripts/verify-pages-production-bundle.mjs tests/pages-production-bundle.test.mjs
git commit -m "test: verify Observer Bot production bundle"
```

If `scripts/online-v3-ranked-headed.mjs` required a real assertion change,
stage it explicitly in this commit after inspecting its diff.

**Step 5: Record the hotfix checkpoint**

Do not add UI repair files to the hotfix commit. Report the commit and checks.
If the user authorizes an immediate hotfix release, push/deploy exactly this
hotfix boundary from a clean worktree with the secret supplied only in the
release shell. Otherwise continue locally without production actions.

## Phase B: one renderer, two adapters, unchanged data ownership

### Task 3: Define the shared archive model and DOM-safe renderer

**Files:**
- Create: `record-archive-ui.js`
- Create: `tests/record-archive-ui.test.js`
- Modify: `index.html:168-184`
- Modify: `online-v3/ranked-v3-leaderboard-ui.js:1-129`
- Modify: `tests/ranked-v3-leaderboard-ui.test.js`
- Modify: `cloudflare/leaderboard-v3/test/m4-client-leaderboard.test.js`

**Step 1: Write the shared-renderer RED tests**

Test a mode-neutral model shaped like this:

```js
const archive = {
  context: "ranked",
  rows: [
    { runId: "run_1", rank: 1, playerName: "Ada", score: 400, depth: 9, gold: 80 },
    { runId: "run_2", rank: 2, playerName: "Bryn", score: 300, depth: 8, gold: 60 },
    { runId: "run_3", rank: 3, playerName: "Cato", score: 200, depth: 7, gold: 40 },
    { runId: "run_4", rank: 4, playerName: "Dara", score: 100, depth: 6, gold: 20 }
  ]
};
```

Assert that:

- one renderer produces three podium cards and one ordinary ledger row;
- every row exposes exactly Rank, Name, Score, Depth, and Gold;
- both Name and Inspect controls call `onInspect(row)` with the full immutable
  row, not only `runId`;
- record text is assigned through `textContent`, never `innerHTML`;
- a missing optional fact is omitted, while a present numeric zero remains
  visible;
- the renderer contains no API, localStorage, Ranked, or Practice data lookup.

**Step 2: Run the renderer test to verify it fails**

Run:

```powershell
node --test tests/record-archive-ui.test.js
```

Expected: FAIL because the common module does not exist.

**Step 3: Implement the shared API**

Expose a UMD API as `window.DungeonRecordArchiveUi` and CommonJS export:

```js
Object.freeze({
  SELECTORS,
  renderList,
  renderDetail,
  presentFact,
  formatDuration
});
```

Use one fact contract everywhere:

```js
function presentFact(source, key, label, format = String) {
  if (!source || !Object.prototype.hasOwnProperty.call(source, key)) return null;
  if (source[key] === null || source[key] === undefined) return null;
  return Object.freeze({ key, label, value: format(source[key]) });
}
```

Filter only `null` facts. Do not filter zero, empty arrays with explicit meaning,
or `false`.

**Step 4: Load the shared module before both consumers**

Add:

```html
<script src="record-archive-ui.js"></script>
```

before `online-v3/ranked-v3-leaderboard-ui.js` and `game.js`. Keep the existing
Ranked module name as the compatibility adapter consumed by
`ranked-v3-runtime.js`.

**Step 5: Convert the Ranked module into an adapter**

`ranked-v3-leaderboard-ui.js` must normalize API payloads and delegate all DOM
construction to `DungeonRecordArchiveUi`. It must not contain podium/ledger
markup of its own. Preserve the existing text-safety and private-field
exclusion guarantees.

**Step 6: Run focused tests**

Run:

```powershell
node --test tests/record-archive-ui.test.js tests/ranked-v3-leaderboard-ui.test.js cloudflare/leaderboard-v3/test/m4-client-leaderboard.test.js
node --check record-archive-ui.js
node --check online-v3/ranked-v3-leaderboard-ui.js
git diff --check
```

Expected: all PASS.

**Step 7: Commit the shared renderer and Ranked adapter**

```powershell
git add -- record-archive-ui.js index.html online-v3/ranked-v3-leaderboard-ui.js tests/record-archive-ui.test.js tests/ranked-v3-leaderboard-ui.test.js cloudflare/leaderboard-v3/test/m4-client-leaderboard.test.js
git commit -m "refactor: introduce shared record archive renderer"
```

### Task 4: Add the Practice adapter without changing routing or storage ownership

**Files:**
- Create: `practice-records-adapter.js`
- Modify: `index.html:178-184`
- Modify: `game.js:3952-3985`
- Modify: `game.js:4495-4595`
- Modify: `game.js:22640-22820`
- Modify: `game.js:23050-23060`
- Modify: `game.js:31852-31860`
- Modify: `game.js:32803-32872`
- Modify: `tests/practice-records.test.js`

**Step 1: Write routing and adapter RED tests**

Require these invariants:

```js
assert.match(gameSource, /state\.onlineV3Ranked[\s\S]*DungeonOnlineV3\?\.openLeaderboard/u);
assert.match(gameSource, /Practice Records/u);
assert.doesNotMatch(practiceAdapterSource, /fetch\(|\/api\/v3\/leaderboard/u);
```

Add behavioral adapter fixtures for:

- four local terminal records sorted by the existing Practice sort policy;
- a detailed current record with build and summary snapshots;
- a legacy record without `build`/`summary` that yields an explicit
  unavailable-detail notice;
- exact active mutator IDs and tooltip content.

**Step 2: Run the Practice tests to verify they fail**

Run:

```powershell
node tests/practice-records.test.js
```

Expected: FAIL because Practice still builds a separate HTML renderer in
`game.js`.

**Step 3: Implement the local adapter**

Expose `window.DungeonPracticeRecordsAdapter` with:

```js
Object.freeze({
  createListModel(entries, options),
  createDetailModel(entry, context),
  findRankedEntry(entries, runId, options)
});
```

The adapter may accept catalogue callbacks for relic and mutator labels, but it
must not read Online v3 state or make network requests.

Load it with:

```html
<script src="practice-records-adapter.js"></script>
```

after `record-archive-ui.js` and before `game.js`.

**Step 4: Replace only the Practice presentation functions**

Retain `recordRunOnLeaderboard()`, `buildPracticeRecordBuild()`,
`buildPracticeTerminalSummary()`, `openTerminalRecords()`, and all eligibility
rules. Replace `buildPracticeRecordDetail()`, `buildPracticeRecordsRows()`, and
dynamic string interpolation with:

1. a static overlay shell containing a record-archive mount;
2. `DungeonPracticeRecordsAdapter` model creation;
3. `DungeonRecordArchiveUi.renderList()` or `renderDetail()`;
4. `replaceChildren()` into the mount;
5. direct callbacks that update `state.practiceRecordDetailRunId`.

Keep the approved navigation unchanged:

- main Online menu → Ranked Leaderboard only;
- Ranked Game Over → Ranked Leaderboard;
- Practice Game Over → Practice Records;
- no Practice Records main-menu button;
- Practice Records → zero `/api` requests.

**Step 5: Remove obsolete delegated Practice record handlers**

Delete only handlers made redundant by direct renderer callbacks. Preserve
Escape/Enter back behavior and all unrelated overlay input handling.

**Step 6: Run focused tests and syntax checks**

Run:

```powershell
node tests/practice-records.test.js
node --test tests/record-archive-ui.test.js tests/ranked-v3-leaderboard-ui.test.js
node --check practice-records-adapter.js
node --check game.js
git diff --check
```

Expected: all PASS.

**Step 7: Commit the Practice adapter migration**

```powershell
git add -- practice-records-adapter.js index.html game.js tests/practice-records.test.js
git commit -m "refactor: render Practice records through shared archive"
```

### Task 5: Preserve real rank and render only fields present in each source

**Files:**
- Modify: `online-v3/ranked-v3-runtime.js:189-263`
- Modify: `online-v3/ranked-v3-leaderboard-ui.js:10-129`
- Modify: `practice-records-adapter.js`
- Modify: `record-archive-ui.js`
- Modify: `tests/ranked-v3-leaderboard-ui.test.js`
- Modify: `tests/practice-records.test.js`
- Modify: `cloudflare/leaderboard-v3/test/m4-client-leaderboard.test.js`

**Step 1: Write the rank regression test**

Render rows 1–4, activate the fourth row, and require:

```js
assert.equal(openedRow.rank, 4);
assert.match(detailText, /Rank #4/u);
assert.doesNotMatch(detailText, /Rank #1/u);
```

Also test an independently loaded detail with no list context. It must omit the
rank label instead of inventing `#1`.

**Step 2: Write the truthful-statistics regression**

Use the current Ranked public summary shape only:

```js
summary: {
  outcome: "defeat",
  finalDepth: 19,
  score: 30056,
  goldEarned: 1778,
  durationMs: 80000,
  livesRemaining: 0,
  roomsCompleted: 19,
  bossesCompleted: 3,
  rulesetId: "v08-meta-1",
  rulesetHash: "sha256:fixture",
  verificationLevel: "checkpoint_verified_v3"
}
```

Assert that Ranked shows time, rooms, bosses, depth, gold, score, and lives only
when present. Assert that it does not render Damage Done, Damage Taken, Kills,
Potions, Elixirs, Gold Collected, or Deaths because the public API does not
provide those fields.

For Practice, assert that stored Game Over fields are rendered, including
legitimate zero values, and absent legacy fields are omitted rather than
converted to zero.

**Step 3: Run the tests to verify they fail**

Run:

```powershell
node --test tests/ranked-v3-leaderboard-ui.test.js cloudflare/leaderboard-v3/test/m4-client-leaderboard.test.js
node tests/practice-records.test.js
```

Expected: FAIL on fourth-place detail rank and fabricated Ranked statistics.

**Step 4: Pass the selected row through the Ranked detail flow**

Change the list callback to receive the row. In
`openLeaderboardDetail(selectedRow)`, fetch by `selectedRow.runId` and call:

```js
leaderboardUi.createDetailViewModel(payload, {
  rank: selectedRow.rank,
  listedRow: selectedRow
});
```

The adapter must use only a positive explicit rank. Never default a detail to
rank one.

**Step 5: Map optional facts with own-property checks**

Both adapters must create arrays of facts from fields actually owned by their
source objects. Do not use `Number(value) || 0` to establish availability.
Formatting happens only after availability is known.

**Step 6: Run focused tests and syntax checks**

Run:

```powershell
node --test tests/record-archive-ui.test.js tests/ranked-v3-leaderboard-ui.test.js cloudflare/leaderboard-v3/test/m4-client-leaderboard.test.js
node tests/practice-records.test.js
node --check online-v3/ranked-v3-runtime.js
git diff --check
```

Expected: all PASS.

**Step 7: Commit the rank and truthfulness repair**

```powershell
git add -- online-v3/ranked-v3-runtime.js online-v3/ranked-v3-leaderboard-ui.js practice-records-adapter.js record-archive-ui.js tests/ranked-v3-leaderboard-ui.test.js tests/practice-records.test.js cloudflare/leaderboard-v3/test/m4-client-leaderboard.test.js
git commit -m "fix: preserve record rank and omit unavailable statistics"
```

## Phase C: isolated Gothic presentation and real podium art

### Task 6: Move the archive into a collision-free stylesheet

**Files:**
- Create: `style-record-archive.css`
- Modify: `index.html:1-30`
- Modify: `record-archive-ui.js`
- Modify: `style.css:4770-5156`
- Modify: `tests/record-archive-style.test.js`

**Step 1: Write the CSS isolation RED test**

Require that:

- `style-record-archive.css` exists and is loaded after `style.css`;
- every new component selector starts with `.record-archive-v2`;
- the new renderer emits no `.ranked-v3-leaderboard-details-button` class;
- the new stylesheet contains no `.ranked-v3-*` selector;
- obsolete `.record-archive-*` blocks are removed from `style.css` after the
  renderer no longer consumes them;
- desktop ledger columns are Rank, Name, Score, Depth, Gold, Action;
- focus-visible, narrow-screen, and reduced-motion rules exist.

**Step 2: Run the style test to verify it fails**

Run:

```powershell
node --test tests/record-archive-style.test.js
```

Expected: FAIL because old and new layout classes currently overlap in
`style.css`.

**Step 3: Implement the isolated namespace**

Use BEM-like selectors rooted at `.record-archive-v2`, for example:

```css
.record-archive-v2__ledger-row {
  display: grid;
  grid-template-columns: 72px minmax(11rem, 1fr) 110px 88px 88px 150px;
  grid-template-areas: "rank name score depth gold action";
  align-items: center;
}
```

Assign each child an explicit grid area. The action must remain last at desktop
width. At narrow width, use labelled facts and a full-width action without
changing the semantic row order.

**Step 4: Implement podium hierarchy without duplicate labels**

Keep semantic DOM order 1, 2, 3. At desktop place cards visually as
`2 | 1 | 3` with grid areas, so Champion is central and raised. Rank one uses
a larger medallion/card/title; ranks two and three remain clearly subordinate.
Do not render both `Champion`, `Rank`, and `#1` as three repeated labels.

**Step 5: Delete only obsolete archive rules**

Remove the old shared archive blocks and the obsolete Ranked button grid
placement after source search proves no consumer remains. Preserve generic
Ranked overlay chrome and unrelated game styles.

**Step 6: Run tests and syntax checks**

Run:

```powershell
node --test tests/record-archive-style.test.js tests/record-archive-ui.test.js tests/ranked-v3-leaderboard-ui.test.js
node --check record-archive-ui.js
git diff --check
```

Expected: all PASS and no selector collision.

**Step 7: Commit the isolated visual layer**

```powershell
git add -- style-record-archive.css style.css index.html record-archive-ui.js tests/record-archive-style.test.js
git commit -m "style: isolate the Gothic record archive"
```

### Task 7: Create three genuine skull medallion assets

**Files:**
- Create: `assets/hd/ui/leaderboard/skull-medallion-gold.png`
- Create: `assets/hd/ui/leaderboard/skull-medallion-silver.png`
- Create: `assets/hd/ui/leaderboard/skull-medallion-bronze.png`
- Create: `assets/hd/ui/leaderboard/medallions-manifest.json`
- Create: `tests/record-archive-assets.test.js`
- Modify: `record-archive-ui.js`
- Modify: `style-record-archive.css`
- Modify: `tests/record-archive-style.test.js`

**Step 1: Write the asset contract test**

Use the existing PNG IHDR inspection pattern from
`tests/hd-environment.test.js`. Require all three files to be:

- 256×256 RGBA PNGs with transparency;
- distinct byte hashes;
- listed in `medallions-manifest.json` with role, path, dimensions, and SHA-256;
- referenced by exact rank in the shared renderer;
- free of any `floor-skull.png` fallback.

**Step 2: Run the asset test to verify it fails**

Run:

```powershell
node --test tests/record-archive-assets.test.js
```

Expected: FAIL because the medallions do not exist.

**Step 3: Generate the coherent asset set with `@imagegen`**

Use one visual family and this production brief:

> Three separate transparent-background Gothic leaderboard medallions, each a
> centered sculpted human skull inside an ornate circular dark-metal frame,
> high-relief game UI icon, readable at 80–110 px, no text, no square tile, no
> floor texture, no cropped ornament. Rank 1: luminous antique gold, crown-like
> upper ornament and strongest silhouette. Rank 2: cold engraved silver,
> slightly restrained. Rank 3: aged bronze, restrained but still prestigious.
> Identical camera, scale, skull pose, lighting direction, and frame geometry
> across the set; only material and rank ornament change.

Reject outputs with opaque square backgrounds, embedded numbers/text, mismatched
camera angles, or inconsistent skull geometry. Save only the approved final
three images at the exact paths above.

**Step 4: Write the manifest from final bytes**

Record SHA-256, `width: 256`, `height: 256`, `colorType: "rgba"`, and semantic
rank for each final file. Do not claim deterministic regeneration from a prompt;
the committed final bytes and hashes are the release identity.

**Step 5: Wire exact rank assets**

Use an immutable map:

```js
const PODIUM_MEDALLIONS = Object.freeze({
  1: "assets/hd/ui/leaderboard/skull-medallion-gold.png",
  2: "assets/hd/ui/leaderboard/skull-medallion-silver.png",
  3: "assets/hd/ui/leaderboard/skull-medallion-bronze.png"
});
```

Do not recolor one source image with CSS filters. CSS may add material-matching
glow, but the actual artwork must be distinct.

**Step 6: Run asset and renderer tests**

Run:

```powershell
node --test tests/record-archive-assets.test.js tests/record-archive-style.test.js tests/record-archive-ui.test.js
git diff --check
```

Expected: all PASS.

**Step 7: Commit the real podium art**

```powershell
git add -- assets/hd/ui/leaderboard/skull-medallion-gold.png assets/hd/ui/leaderboard/skull-medallion-silver.png assets/hd/ui/leaderboard/skull-medallion-bronze.png assets/hd/ui/leaderboard/medallions-manifest.json record-archive-ui.js style-record-archive.css tests/record-archive-assets.test.js tests/record-archive-style.test.js
git commit -m "feat: add Gothic leaderboard skull medallions"
```

## Phase D: player-visible regression coverage and release gate

### Task 8: Cover ranks 1–4 and both Game Over entry points in headed QA

**Files:**
- Modify: `scripts/online-v3-ranked-headed.mjs:1300-1435`
- Modify: `scripts/online-v3-baseline-smoke.mjs:610-690`
- Modify: `tests/ranked-v3-leaderboard-ui.test.js`
- Modify: `tests/practice-records.test.js`

**Step 1: Seed four canonical Ranked rows in the local Worker fixture**

Before opening the Ranked Leaderboard in the lifecycle scenario, create four
terminal local D1 entries with deterministic names and strictly descending
scores. Use Worker/D1 fixture setup only; do not inject DOM nodes or replace the
client response in page context.

**Step 2: Add visible Ranked list assertions**

After navigating from the native menu, require:

- exactly three podium cards and at least one ledger row;
- visible ranks, names, scores, depths, and gold for rows 1–4;
- Champion card centered between ranks 2 and 3 at desktop width;
- ledger horizontal bounds ordered Name < Score < Depth < Gold < Inspect;
- no Outcome or Time column in the list;
- exact gold/silver/bronze image paths loaded successfully.

Capture:

- `ranked-records-list-desktop.png`;
- `ranked-records-list-narrow.png`.

**Step 3: Inspect the fourth Ranked record visibly**

Click the fourth row's player name or Inspect control. Require `Rank #4`, the
correct player/score/depth/gold, the current public summary facts, and absence
of fabricated combat statistics. Focus and hover the mutator chip and assert
the exact tooltip text.

Capture `ranked-records-detail-rank4.png`.

**Step 4: Seed three historical Practice records before final defeat**

In the existing save/final-defeat scenario, seed three valid local terminal
Practice records through localStorage fixture setup. Let the visible final
defeat flow write the fourth record naturally.

**Step 5: Enter Practice Records from Game Over**

Use the visible Game Over control/key labelled `Practice Records`; do not open
the modal through an internal function. Assert zero `/api` requests, three
podium cards, at least one ledger row, and the five-column list contract.

Capture:

- `practice-records-list-desktop.png`;
- `practice-records-list-narrow.png`.

**Step 6: Inspect the fourth Practice record visibly**

Open rank four and require the correct rank plus only the locally stored build,
mutators, time, and Game Over statistics. Capture
`practice-records-detail-rank4.png`.

**Step 7: Run the two affected headed scenarios**

Run:

```powershell
npm.cmd run verify:ranked-headed -- --scenario lifecycle --force
npm.cmd run verify:ui-current -- --scenario save --force
```

Expected: both PASS, all six screenshots retained, zero unexpected console/page
errors, and Practice emits zero API calls.

**Step 8: Commit headed regression coverage**

```powershell
git add -- scripts/online-v3-ranked-headed.mjs scripts/online-v3-baseline-smoke.mjs tests/ranked-v3-leaderboard-ui.test.js tests/practice-records.test.js
git commit -m "test: cover Ranked and Practice record archives"
```

### Task 9: Require an explicit, hash-bound visual review receipt

**Files:**
- Create: `scripts/record-archive-visual-receipt.mjs`
- Create: `scripts/approve-record-archive-visuals.mjs`
- Create: `scripts/verify-record-archive-visuals.mjs`
- Create: `tests/record-archive-visual-gate.test.mjs`
- Modify: `scripts/verify-pages-production-bundle.mjs`
- Modify: `scripts/build-pages-v3.mjs:8-30`
- Modify: `scripts/verify-online-v3.mjs:350-430`
- Modify: `package.json`

**Step 1: Write RED tests for missing and stale review receipts**

Test these cases in a temporary directory:

1. no receipt → FAIL;
2. one required screenshot missing → FAIL;
3. screenshot bytes changed after approval → FAIL;
4. relevant source/CSS/asset fingerprint changed → FAIL;
5. all six screenshot hashes, source fingerprint, and confirmations match → PASS.

**Step 2: Run the gate test to verify it fails**

Run:

```powershell
node --test tests/record-archive-visual-gate.test.mjs
```

Expected: FAIL because the receipt tools do not exist.

**Step 3: Define the required evidence schema**

The ignored receipt at
`output/verification/record-archive-visual-approval.json` must contain:

```json
{
  "schema": 1,
  "reviewer": "non-empty",
  "reviewedAt": "ISO-8601",
  "sourceFingerprint": "sha256:...",
  "screenshots": [
    { "id": "ranked-list-desktop", "sha256": "sha256:..." },
    { "id": "ranked-list-narrow", "sha256": "sha256:..." },
    { "id": "ranked-detail-rank4", "sha256": "sha256:..." },
    { "id": "practice-list-desktop", "sha256": "sha256:..." },
    { "id": "practice-list-narrow", "sha256": "sha256:..." },
    { "id": "practice-detail-rank4", "sha256": "sha256:..." }
  ]
}
```

Fingerprint at least:

- `record-archive-ui.js`;
- `practice-records-adapter.js`;
- `online-v3/ranked-v3-leaderboard-ui.js`;
- `online-v3/ranked-v3-runtime.js`;
- `game.js`;
- `style-record-archive.css`;
- `index.html`;
- the three medallion PNGs.

**Step 4: Implement explicit approval**

`approve-record-archive-visuals.mjs` must print all six absolute screenshot
paths and require both `--reviewer <name>` and six explicit confirmation IDs.
It then hashes current files and writes the receipt. It must never auto-approve
or create a receipt merely because screenshots exist.

**Step 5: Implement verification with no bypass flag**

`verify-record-archive-visuals.mjs` recomputes every screenshot hash and the
source fingerprint, validates the exact required ID set, and exits non-zero on
any mismatch. Do not add `--skip`, `CI=true`, or environment bypass behavior.

**Step 6: Connect the gate to release workflows**

Add scripts:

```json
"approve:record-archive-visuals": "node scripts/approve-record-archive-visuals.mjs",
"verify:record-archive-visuals": "node scripts/verify-record-archive-visuals.mjs"
```

Make `build-pages-v3.mjs --target release` run the Observer secret preflight and
visual receipt verification before deleting `output/pages-dist`. Test builds
remain independent and cannot produce a production approval receipt.

After a successful release build, copy a sanitized receipt containing the
source fingerprint and six screenshot hashes to
`output/pages-dist/record-archive-release-receipt.json`. Do not include local
absolute paths or the Observer Bot password. Extend
`verify-pages-production-bundle.mjs` to require this receipt and re-check its
source fingerprint, so a stale pre-gate bundle is not deployable.

Add the visual verifier as the first `full` action in
`verify-online-v3.mjs`. A milestone/release verification must fail quickly if
human review is absent or stale.

**Step 7: Run gate tests and syntax checks**

Run:

```powershell
node --test tests/record-archive-visual-gate.test.mjs
node --check scripts/record-archive-visual-receipt.mjs
node --check scripts/approve-record-archive-visuals.mjs
node --check scripts/verify-record-archive-visuals.mjs
node --check scripts/build-pages-v3.mjs
node --check scripts/verify-online-v3.mjs
git diff --check
```

Expected: all PASS.

**Step 8: Commit the release-blocking visual gate**

```powershell
git add -- scripts/record-archive-visual-receipt.mjs scripts/approve-record-archive-visuals.mjs scripts/verify-record-archive-visuals.mjs scripts/verify-pages-production-bundle.mjs tests/record-archive-visual-gate.test.mjs scripts/build-pages-v3.mjs scripts/verify-online-v3.mjs package.json
git commit -m "build: require reviewed record archive screenshots"
```

### Task 10: Perform milestone verification and prepare a release handoff

**Files:**
- Modify after all checks pass: `ONLINE_V3_HANDOFF.md`

**Step 1: Run all focused regressions**

Run:

```powershell
node --test tests/pages-release-preflight.test.mjs tests/record-archive-ui.test.js tests/ranked-v3-leaderboard-ui.test.js tests/record-archive-style.test.js tests/record-archive-assets.test.js tests/record-archive-visual-gate.test.mjs cloudflare/leaderboard-v3/test/m4-client-leaderboard.test.js cloudflare/leaderboard-v3/test/online-ranked-boundary-repair.test.js cloudflare/leaderboard-v3/test/production-release.test.js
node tests/practice-records.test.js
```

Expected: all PASS.

**Step 2: Run changed-JavaScript syntax checks**

Run:

```powershell
node --check record-archive-ui.js
node --check practice-records-adapter.js
node --check online-v3/ranked-v3-leaderboard-ui.js
node --check online-v3/ranked-v3-runtime.js
node --check game.js
node --check scripts/build-pages-v3.mjs
node --check scripts/online-v3-baseline-smoke.mjs
node --check scripts/online-v3-ranked-headed.mjs
```

Expected: all PASS.

**Step 3: Generate fresh player-visible evidence**

Run:

```powershell
npm.cmd run verify:ranked-headed -- --scenario lifecycle --force
npm.cmd run verify:ui-current -- --scenario save --force
```

Expected: both PASS and all six required screenshots regenerated.

**Step 4: Inspect every screenshot manually**

Open each file with the local image viewer. Confirm:

- no square floor tiles or CSS-tinted placeholder skulls;
- Champion centered, raised, and visually strongest;
- rank 2 silver and rank 3 bronze are distinct and subordinate;
- no duplicated Champion/Rank/#1 labels;
- ledger action is after Gold and no element overlaps;
- rank four detail says `Rank #4`;
- Ranked does not display invented zero statistics;
- Practice displays its stored Game Over statistics;
- desktop and narrow layouts remain legible;
- focus and mutator tooltip remain visible.

Do not continue if any screenshot is merely generated but not inspected.

**Step 5: Create the explicit approval receipt**

Run with the actual reviewer name and all required IDs:

```powershell
npm.cmd run approve:record-archive-visuals -- --reviewer "Kamil" --confirm ranked-list-desktop,ranked-list-narrow,ranked-detail-rank4,practice-list-desktop,practice-list-narrow,practice-detail-rank4
npm.cmd run verify:record-archive-visuals
```

Expected: PASS with a receipt bound to the current screenshot and source
hashes.

**Step 6: Commit all product/test work before committed release verification**

Inspect full status and staged diff, then create only the already planned
logical commits. Do not use `git add .` or `git add -A`.

**Step 7: Run the milestone release suite**

Run:

```powershell
npm.cmd run verify:full -- --force
git diff --check
```

Expected: PASS, including the visual approval gate, complete committed
baseline, complete committed Ranked lifecycle, Worker suite, and Wrangler/D1
checks.

**Step 8: Build and test the real release bundle with the secret present**

Set the real password only in the current release shell through the approved
secret-entry method. Do not paste it into this plan or a committed script. Then
run:

```powershell
if (-not $env:DUNGEON_ONLINE_TEST_BOT_PASSWORD) { throw "Release secret is not set" }
npm.cmd run pages:build
node scripts/verify-pages-production-bundle.mjs
Remove-Item Env:DUNGEON_ONLINE_TEST_BOT_PASSWORD
```

Expected: build PASS; Observer Bot enabled; non-empty SHA-256 hash; plaintext
password absent; visual approval fingerprint embedded/verified; no QA-only
marker in `output/pages-dist`.

**Step 9: Update and commit the handoff**

Record exact commits, focused checks, headed artifact paths, visual receipt
fingerprint, and the fact that Worker/D1/ruleset stayed unchanged.

```powershell
git add -- ONLINE_V3_HANDOFF.md
git commit -m "docs: record archive repair verification"
```

**Step 10: Stop at the release boundary**

Report commits, changed-file count, tests, screenshot receipt, and remaining
production action. Do not push or deploy until explicitly authorized. A later
Pages release uses `@cloudflare-deploy` and must not perform D1 migration,
backfill, Worker rollout, or ruleset activation for this change.
