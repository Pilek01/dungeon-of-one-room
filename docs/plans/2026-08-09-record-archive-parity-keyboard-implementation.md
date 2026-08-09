# Record Archive Parity and Keyboard Navigation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Practice use the canonical Ranked reference plates, correct the requested leaderboard/Inspect visual defects, and provide complete shared keyboard navigation.

**Architecture:** Keep the existing Ranked renderer as the single visual source of truth. Add a presentation-only Practice projection, attach a scoped keyboard controller to the canonical plate roots, and let the Online runtime and local Practice shell provide lifecycle callbacks and focus restoration. Keep storage, scoring, Worker behavior, and the legacy archive renderer unchanged.

**Tech Stack:** Browser DOM, UMD-style JavaScript, CSS reference-plate layouts, Node.js `node:test`, Playwright headed verification, existing Online v3 verification scripts.

---

## Preconditions and execution rules

- Base design commit: `0610913`.
- Preserve the user-owned unstaged `AGENTS.md` change. Never stage it.
- Use `@superpowers:test-driven-development` for every behavior change.
- Use a fresh `gpt-5.6-luna` implementer for each task and a separate Luna reviewer; Sol owns integration and final verification.
- Stage only the explicit files named by each task. Never use `git add .` or `git add -A`.
- Do not change Worker, D1, protocol, ruleset, scoring, stored Practice records, game version, or generated build metadata.
- Do not push or deploy.

### Task 1: Add the canonical Practice projection

**Files:**

- Modify: `practice-records-adapter.js:21-119`
- Modify: `tests/practice-records.test.js:37-104`

**Step 1: Write failing projection tests**

Extend the adapter test with a complete local record and assert that the new
`createReferencePlatePayload(entry, context)` API produces a canonical payload:

```js
const payload = adapter.createReferencePlatePayload(complete, {
  rank: 4,
  describeMutator: () => ({ key: "G", name: "Greed" })
});

assert.equal(payload.entry.rank, 4);
assert.equal(payload.entry.detailsAvailable, true);
assert.deepEqual(payload.entry.build.relics, [{ relicId: "fang", stacks: 2 }]);
assert.deepEqual(payload.entry.build.runModifiers.active, [
  { modifierId: "greed", stacks: 1 }
]);
assert.equal(payload.entry.summary.durationMs, 125000);
assert.equal(payload.entry.summary.gold.earned, complete.gold);
```

Add a legacy case that asserts:

```js
const legacy = adapter.createReferencePlatePayload({
  runId: "legacy",
  playerName: "Legacy",
  score: 200,
  depth: 6
}, { rank: 4 });

assert.equal(legacy.entry.detailsAvailable, false);
assert.match(legacy.entry.detailsUnavailableNotice, /unavailable/iu);
assert.equal(Object.hasOwn(legacy.entry, "gold"), false);
assert.equal(Object.hasOwn(legacy.entry, "build"), false);
assert.equal(Object.hasOwn(legacy.entry, "summary"), false);
```

Retain the existing list sorting/limit checks and assert rows preserve
`durationMs` and `outcome` so they can be consumed directly by
`createLeaderboardPresentation`.

**Step 2: Run the focused test and confirm RED**

Run:

```powershell
node --test tests/practice-records.test.js
```

Expected: FAIL because `createReferencePlatePayload` does not exist.

**Step 3: Implement the narrow projection**

Keep `createListModel`, `findRankedEntry`, and the legacy `createDetailModel`
API compatible. Add a new pure projection:

```js
function createReferencePlatePayload(entry, context = {}) {
  const source = entry && typeof entry === "object" ? entry : {};
  const base = {
    runId: String(source.runId || source.id || ""),
    rank: Number.isInteger(context.rank) && context.rank > 0 ? context.rank : 1,
    playerName: String(source.playerName || "Anonymous"),
    score: integer(source.score),
    depth: integer(source.depth),
    durationMs: integer(source.durationMs),
    outcome: String(source.outcome || "")
  };
  if (hasOwn(source, "gold")) base.gold = integer(source.gold);

  const build = source.build && typeof source.build === "object" ? source.build : null;
  const summary = source.summary && typeof source.summary === "object" ? source.summary : null;
  if (!build || !summary) {
    return Object.freeze({ entry: Object.freeze({
      ...base,
      detailsAvailable: false,
      detailsUnavailableNotice: "Build Chronicle unavailable for this legacy Practice record."
    }) });
  }

  return Object.freeze({ entry: Object.freeze({
    ...base,
    detailsAvailable: true,
    build: {
      relics: Array.isArray(build.relics) ? build.relics.map(/* preserve id and stacks */) : [],
      pacts: Array.isArray(build.pacts) ? [...build.pacts] : [],
      skillTiers: { ...(build.skillTiers || {}) },
      campUpgrades: { ...(build.campUpgrades || {}) },
      elixirs: build.elixir ? [{ ...build.elixir }] : [],
      runModifiers: {
        active: (Array.isArray(source.mutatorIds) ? source.mutatorIds : [])
          .map((id) => ({ modifierId: String(id), stacks: 1 }))
      }
    },
    summary: {
      ...summary,
      durationMs: integer(source.durationMs),
      gold: { earned: integer(source.gold) }
    }
  }) });
}
```

Do not add fetch/API code and do not mutate the source record.

**Step 4: Run GREEN checks**

Run:

```powershell
node --test tests/practice-records.test.js
node --check practice-records-adapter.js
git diff --check
```

Expected: all PASS.

**Step 5: Commit the task**

```powershell
git add -- practice-records-adapter.js tests/practice-records.test.js
git commit -m "feat: project Practice records onto reference plates"
```

### Task 2: Extend the canonical renderer for parity and unavailable details

**Files:**

- Modify: `online-v3/ranked-v3-leaderboard-ui.js:18-303`
- Modify: `tests/ranked-v3-leaderboard-ui.test.js:5-315`

**Step 1: Write failing canonical-renderer tests**

Enhance the local fake DOM only as much as required for the new assertions.
Add tests that:

- pass `adapter.createListModel(...).rows` through
  `createLeaderboardPresentation` and `renderList`;
- confirm a 20-record Practice list still renders Top 3 plus seven ledger rows
  per page, with page 2 showing ranks 11-17;
- pass `adapter.createReferencePlatePayload` through `createDetailViewModel` and
  assert the same canonical Inspect root and ten equipment slots as Online;
- render a legacy payload and assert one
  `.ranked-v3-inspect-unavailable` message plus a working Back action, with no
  fabricated `0`, `Cause not recorded`, equipment, or chronicle values;
- render ranks `1`, `9`, `10`, and `73` and assert
  `data-rank-digits="single"` for 1/9 and `"double"` for 10/73.

**Step 2: Run the tests and confirm RED**

```powershell
node --test tests/ranked-v3-leaderboard-ui.test.js tests/practice-records.test.js
```

Expected: FAIL on missing availability propagation, unavailable state, and rank
metadata.

**Step 3: Implement minimal renderer support**

Update `createDetailViewModel` to preserve only the explicit presentation flags:

```js
detailsAvailable: entry.detailsAvailable !== false,
detailsUnavailableNotice: String(entry.detailsUnavailableNotice || "")
```

In `renderDetail`:

- set `data-record-rank` and `data-rank-digits` on
  `.ranked-v3-inspect-rank`;
- when details are unavailable, render the normal plate/header and one neutral
  unavailable message in the loadout area;
- omit equipment, chronicle metrics, and terminal facts that are not present;
- always render Back to Leaderboard.

Do not make the renderer branch on Online versus Practice. The canonical detail
model alone controls the output.

**Step 4: Run GREEN checks**

```powershell
node --test tests/ranked-v3-leaderboard-ui.test.js tests/practice-records.test.js
node --check online-v3/ranked-v3-leaderboard-ui.js
git diff --check
```

Expected: all PASS.

**Step 5: Commit the task**

```powershell
git add -- online-v3/ranked-v3-leaderboard-ui.js tests/ranked-v3-leaderboard-ui.test.js
git commit -m "feat: support canonical Practice archive details"
```

### Task 3: Add the shared scoped keyboard controller

**Files:**

- Modify: `online-v3/ranked-v3-leaderboard-ui.js:58-303`
- Modify: `tests/ranked-v3-leaderboard-ui.test.js:5-315`

**Step 1: Upgrade the fake DOM and write RED keyboard tests**

Add only the fake capabilities the controller uses: parent links,
`ownerDocument.activeElement`, `focus()`, `disabled`, `querySelectorAll`,
`closest`, and keyboard event dispatch.

Give rendered actions stable metadata:

```text
data-record-nav-region=row|footer|equipment|detail-action
data-record-run-id=<run id>
data-record-action=name|inspect|previous|next|close|mutators|back
data-record-row-index=<visual row>
```

Test the approved matrix:

- Up/Down and W/S move between record rows;
- Left/Right and A/D switch Name/Inspect;
- Down from the last populated row enters the footer;
- footer Left/Right visits enabled Previous, Next, Close and skips disabled
  controls;
- Up from the footer returns to the last record action;
- PageUp/PageDown invoke only an available page callback;
- Enter/Space activate exactly once;
- Escape invokes list Close or detail Back;
- Tab/Shift+Tab are not prevented but do not bubble past the plate;
- an empty list can focus Close;
- Inspect arrows follow the 5x2 equipment grid, skip empty slots, then reach
  Mutators and Back.

**Step 2: Run tests and confirm RED**

```powershell
node --test tests/ranked-v3-leaderboard-ui.test.js
```

Expected: FAIL because the renderer has no navigation metadata or controller.

**Step 3: Implement the controller next to the renderer**

Keep the controller in `ranked-v3-leaderboard-ui.js` to avoid a new script and
load-order dependency. Export small focus helpers for the outer lifecycles:

```js
focusReferencePlateAction(rootNode, token, fallback = true)
createReferencePlateFocusToken(runId, action)
```

Attach one `keydown` listener to each rendered plate root. It must:

- call `stopPropagation()` for every plate key, including Tab;
- never call `preventDefault()` for Tab/Shift+Tab;
- call `preventDefault()` only for handled arrows, WASD, PageUp/PageDown,
  Enter/Space, and Escape;
- activate native buttons through `.click()` exactly once;
- use enabled, populated DOM actions as the navigation graph;
- pass `(runId, action)` to `onOpen` so the outer runtime can restore the exact
  opener.

Keep sorting out of this controller. Practice `T` may continue bubbling to its
local lifecycle handler.

**Step 4: Run GREEN checks**

```powershell
node --test tests/ranked-v3-leaderboard-ui.test.js tests/practice-records.test.js
node --check online-v3/ranked-v3-leaderboard-ui.js
git diff --check
```

Expected: all PASS.

**Step 5: Commit the task**

```powershell
git add -- online-v3/ranked-v3-leaderboard-ui.js tests/ranked-v3-leaderboard-ui.test.js
git commit -m "feat: add shared archive keyboard navigation"
```

### Task 4: Wire Online and Practice to the canonical lifecycle

**Files:**

- Modify: `game.js:2020-2023,3983-4010,22656-22715,31759-31783`
- Modify: `online-v3/ranked-v3-runtime.js:203-265`
- Modify: `online-v3/ranked-v3-ui.js:68-75,282-308` only if a minimal focus hook is required
- Modify: `tests/practice-records.test.js:37-104`
- Modify: `tests/ranked-v3-reference-plate-style.test.js:7-21`

**Step 1: Write failing integration guards**

Add source-level guards that the active Practice mount:

- uses `DungeonRankedV3LeaderboardUi`, `createLeaderboardPresentation`,
  `renderList`, and `renderDetail`;
- does not use `DungeonRecordArchiveUi` inside `renderPracticeRecordsMount`;
- includes canonical card/body/plate shell classes and no active
  `.record-archive-v2` ancestor;
- stores `practiceRecordPage` and an opener focus token;
- keeps `T` as the only sort shortcut and removes `Tab` from the Practice sort
  branch;
- remains local and performs no API request.

Add a focused runtime assertion or harness for list page preservation and
detail focus-token restoration.

**Step 2: Run guards and confirm RED**

```powershell
node --test tests/practice-records.test.js tests/ranked-v3-reference-plate-style.test.js
```

Expected: FAIL because Practice still mounts the legacy renderer and Tab still
toggles sorting.

**Step 3: Integrate Practice**

Add local UI state:

```js
practiceRecordPage: 1,
practiceRecordFocusToken: null,
practiceRecordReturnFocus: null
```

Reset page/focus on open and sort. In `renderPracticeRecordsMount`:

1. build sorted local rows with the existing adapter;
2. create the canonical presentation using `practiceRecordPage`;
3. render the canonical list or projected canonical detail;
4. provide `onOpen`, `onPage`, `onClose`, and `onBack` callbacks;
5. after mounting, focus the saved action token or the first sensible action.

Mirror the Ranked reference-plate shell in `buildPracticeRecordsModalHtml` and
remove the active legacy archive wrapper. Preserve the `T` sort hint/behavior,
but remove `Tab`, ArrowLeft, ArrowRight, and Enter from the old global Practice
branch because the plate controller owns them. Do not remove Tab from unrelated
global gameplay controls; the plate root stops its propagation locally.

**Step 4: Integrate Online focus lifecycle**

In `ranked-v3-runtime.js`:

- capture the external opener before loading the leaderboard;
- render the canonical empty list instead of a separate message view;
- store `(runId, action)` when opening detail;
- restore that exact action after Back/Escape, falling back to the first list
  action and then Close;
- close through one wrapper that hides the UI and restores the original opener
  when it is still connected.

Keep the outer `ranked-v3-ui.js` Escape listener as a fallback only; the plate
controller must consume list/detail Escape first.

**Step 5: Run GREEN checks**

```powershell
node --test tests/practice-records.test.js tests/ranked-v3-leaderboard-ui.test.js tests/ranked-v3-reference-plate-style.test.js tests/record-archive-ui.test.js
node --check game.js
node --check online-v3/ranked-v3-runtime.js
node --check online-v3/ranked-v3-ui.js
git diff --check
```

Expected: all PASS. The legacy renderer tests remain as compatibility coverage.

**Step 6: Commit the task**

```powershell
git add -- game.js online-v3/ranked-v3-runtime.js online-v3/ranked-v3-ui.js tests/practice-records.test.js tests/ranked-v3-reference-plate-style.test.js
git commit -m "feat: share archive lifecycle across Online and Practice"
```

Omit `online-v3/ranked-v3-ui.js` from staging if it did not require a change.

### Task 5: Correct headings, rank placement, and tooltip readability

**Files:**

- Modify: `online-v3/ranked-v3-leaderboard-ui.js:193-301`
- Modify: `style.css:5139-5153,5608-5622,5718-5728,5818-5826,5890-5898,6027-6031,6246-6251`
- Modify: `tests/ranked-v3-leaderboard-ui.test.js`
- Modify: `tests/ranked-v3-reference-plate-style.test.js`
- Modify: `tests/record-archive-style.test.js`

**Step 1: Write failing DOM/style contracts**

Assert that Inspect contains exactly one `.ranked-v3-inspect-tooltip` element
with `role="tooltip"`; equipment/mutator controls reference it with
`aria-describedby`; and no canonical per-slot pseudo tooltip remains active.

Add CSS source assertions for shared offsets:

```css
--ranked-ledger-name-shift: 2.1cqw;
--ranked-ledger-depth-shift: -2.1cqw;
```

Both the Name heading/value and Depth heading/value must consume the same
variable. Add rank selectors that shift only `[data-rank-digits="single"]`.

**Step 2: Run focused tests and confirm RED**

```powershell
node --test tests/ranked-v3-leaderboard-ui.test.js tests/ranked-v3-reference-plate-style.test.js tests/record-archive-style.test.js
```

Expected: FAIL on missing shared tooltip panel, shared offsets, and single-digit
selector.

**Step 3: Implement the shared tooltip panel**

Append one tooltip panel to the Inspect overlay. On `pointerover`/`focusin`, copy
the active target's `data-record-tooltip` into the panel and set a placement
token (`below` for the first equipment row, `above` for the second row and
mutators). On matching `pointerout`/`focusout`, hide it without stealing focus.

Style the panel at the 1536x1080 reference size with approximately:

```css
width: min(48cqw, 740px);
font-size: clamp(1rem, 2cqw, 1.95rem);
line-height: 1.35;
padding: clamp(.75rem, 1.2cqw, 1.25rem);
```

Calibrate placement so the panel stays inside the reference plate and viewport,
does not clip the Chronicle or Back control, and chooses opposite placement for
the two equipment rows. Disable the old equipment/mutator `::after` output.

**Step 4: Align headings and rank**

Apply the same CSS custom property to each affected heading and value. Do not
insert literal spaces.

Start the single-digit rank correction at `translateX(.35cqw)` and leave double
digits neutral. The headed calibration in Task 6 owns the final small adjustment;
do not move the two-digit anchor.

**Step 5: Run GREEN checks**

```powershell
node --test tests/ranked-v3-leaderboard-ui.test.js tests/ranked-v3-reference-plate-style.test.js tests/record-archive-style.test.js
node --check online-v3/ranked-v3-leaderboard-ui.js
git diff --check
```

Expected: all PASS.

**Step 6: Commit the task**

```powershell
git add -- online-v3/ranked-v3-leaderboard-ui.js style.css tests/ranked-v3-leaderboard-ui.test.js tests/ranked-v3-reference-plate-style.test.js tests/record-archive-style.test.js
git commit -m "fix: align archive headings ranks and tooltips"
```

### Task 6: Update headed QA, Practice screenshots, and visual receipt inputs

**Files:**

- Modify: `scripts/online-v3-ranked-headed.mjs:1641-2101`
- Modify: `scripts/online-v3-baseline-smoke.mjs:715-780`
- Modify: `scripts/record-archive-visual-receipt.mjs:10-31`
- Modify: `tests/record-archive-visual-gate.test.mjs`
- Generated ignored evidence: `output/online-v3-ranked-headed/lifecycle/*.png`
- Generated ignored evidence: `output/online-v3-baseline/save/practice-records-*.png`
- Generated ignored evidence: `output/verification/record-archive-visual-approval.json`

**Step 1: Write RED headed geometry and keyboard assertions**

In the Ranked lifecycle script:

- replace `nameLeft` +24..38 and Depth -24..38 expectations with heading/value
  anchor deltas of at most 3px;
- measure the shared tooltip DOM panel instead of `::after`;
- require reference-size tooltip font >=28px and padding >=16px;
- verify first-row/second-row opposite placement, content equality for hover and
  focus, plate/viewport containment, and no Chronicle/Back clipping;
- render or mutate detail ranks 1, 9, 10, and 73, verify metadata, containment,
  a positive single-digit offset, and neutral two-digit offset;
- drive Online entirely by keyboard: initial action -> Inspect -> Escape back
  with exact focus restoration -> PageDown/PageUp -> footer Previous/Next/Close.

Run once and confirm the new assertions are RED before the visual code is fully
calibrated.

**Step 2: Update the Practice save scenario**

Replace old `.record-archive-v2` list/detail selectors with canonical
`.ranked-v3-reference-plate` selectors. Assert:

- three podium slots and up to seven ledger slots;
- canonical list/detail class structure;
- keyboard-only list -> Inspect -> Back -> Close;
- native Tab changes focus and never changes sort or closes the modal;
- no Online API requests occur;
- the existing three Practice screenshot paths remain unchanged.

**Step 3: Update the visual fingerprint**

Keep all six required screenshot IDs. Remove legacy renderer/style sources from
`REQUIRED_SOURCE_PATHS` only after confirming they are inactive, and include the
actual canonical lifecycle sources (`online-v3/ranked-v3-ui.js` if changed).
Update the visual-gate test to assert the exact active source set.

**Step 4: Run syntax and focused gate checks**

```powershell
node --check scripts/online-v3-ranked-headed.mjs
node --check scripts/online-v3-baseline-smoke.mjs
node --check scripts/record-archive-visual-receipt.mjs
node --test tests/record-archive-visual-gate.test.mjs
git diff --check
```

Expected: all PASS. `verify:record-archive-visuals` may remain RED until fresh
screenshots are visually inspected and the approval receipt is regenerated.

**Step 5: Run the two affected current-tree browser scenarios**

```powershell
npm run verify:ui-current -- --scenario save
npm run verify:ranked-headed -- --scenario lifecycle
```

Expected: both PASS and refresh the six screenshot artifacts.

Use `@game-studio:game-playtest` to inspect every refreshed screenshot. Confirm
Practice/Online plate parity, Name/Depth alignment, tooltip readability,
single-/double-digit rank placement, focus visibility, and no clipping.

**Step 6: Refresh and verify the visual approval receipt**

After visual inspection, run the repository approval command with the exact six
IDs shown by `npm run approve:record-archive-visuals -- --help`, then:

```powershell
npm run verify:record-archive-visuals
```

Expected: PASS with a source fingerprint matching the current code and all six
screenshot hashes.

**Step 7: Commit the task**

```powershell
git add -- scripts/online-v3-ranked-headed.mjs scripts/online-v3-baseline-smoke.mjs scripts/record-archive-visual-receipt.mjs tests/record-archive-visual-gate.test.mjs
git commit -m "test: cover canonical archive visuals and keyboard flow"
```

Ignored screenshots and approval receipts are evidence, not staged files.

### Task 7: Sol integration review and final verification

**Files:**

- Review every commit created by Tasks 1-6
- Do not modify `AGENTS.md`

**Step 1: Review scope and exact diff**

```powershell
git status --short
git diff 0610913..HEAD --stat
git diff 0610913..HEAD --check
git diff 0610913..HEAD --name-status
```

Expected: only the design/plan plus authorized adapter, renderer, lifecycle,
CSS, test, and QA paths. The user's `AGENTS.md` remains unstaged.

**Step 2: Run focused test and syntax set once**

```powershell
node --test tests/practice-records.test.js tests/ranked-v3-leaderboard-ui.test.js tests/ranked-v3-reference-plate-style.test.js tests/record-archive-style.test.js tests/record-archive-ui.test.js tests/record-archive-visual-gate.test.mjs
node --check practice-records-adapter.js
node --check online-v3/ranked-v3-leaderboard-ui.js
node --check online-v3/ranked-v3-runtime.js
node --check online-v3/ranked-v3-ui.js
node --check game.js
node --check scripts/online-v3-ranked-headed.mjs
node --check scripts/online-v3-baseline-smoke.mjs
```

Expected: all PASS.

**Step 3: Run required project gates**

Use `@superpowers:verification-before-completion` and run each relevant command
once, reusing a valid identical PASS where repository tooling permits:

```powershell
npm run verify:phase
npm run verify:guard
npm run verify:baseline
git diff --check
```

The affected current-tree save and Ranked lifecycle scenarios already ran in
Task 6 and must not be repeated unless relevant files changed afterward.

Expected: all PASS. Do not run `verify:full`, push, or deploy.

**Step 4: Final Sol review**

Confirm manually that:

- no missing Practice value was fabricated;
- no gameplay/global input behavior changed outside the active archive plate;
- Tab remains native inside both archives;
- disabled paging controls are skipped;
- footer navigation includes Previous, Next, and Close;
- exact focus restoration works after Inspect and final Close;
- build metadata remains automatically generated and visible;
- no Worker/ruleset/production file changed.

If a final integration fix is necessary, write a failing focused regression,
apply the smallest fix, rerun only affected checks, and commit explicit paths as:

```powershell
git commit -m "fix: integrate canonical archive parity"
```

## Completion report

Report implemented scope, unresolved items, changed-file count, exact checks,
commit hashes, visual evidence reviewed, and the fact that push/deployment were
not in scope. Briefly summarize the useful Luna work without exposing internal
transcripts.
