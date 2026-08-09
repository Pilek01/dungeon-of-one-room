# Ranked Reference Plate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the generic Ranked leaderboard and Build Chronicle with the approved desktop reference plates, ten-page ledger, and a truthful stored terminal defeat cause.

**Architecture:** The two supplied images become cleaned, decorative 1536 x 1080 plate assets. New Ranked-only DOM layers place all live data, controls, and tooltips over those plates, while Practice Records retain their existing archive markup and CSS. The client follows the existing opaque leaderboard cursor until it has at most 73 rows, then paginates the already-authoritative order locally into a persistent Top 3 and ten seven-row ledger pages. A bounded, display-only local defeat reason travels through the existing fatal-event path into the existing `summary_json`; it never changes score, outcome, lives, or any other competitive rule.

**Tech Stack:** Vanilla browser JavaScript (UMD), CSS, Node `node:test`, Cloudflare Worker/D1 JSON storage, existing ruleset-manifest generator, and `@imagegen` for cleanup of supplied plate references.

**Design:** `docs/superpowers/specs/2026-08-06-ranked-reference-plate-design.md`

**Execution boundary:** Work in an isolated `codex/` worktree. Do not deploy, activate a ruleset, merge, push, change D1 schema/migrations, alter Practice Records, or modify `game.js`. A generated ruleset hash is for local/test use only until a separate release task explicitly authorizes activation.

---

### Task 1: Create clean desktop plate assets and a narrow asset contract

**Files:**
- Create: `assets/hd/ui/ranked-reference-plates/ranked-leaderboard-desktop-plate.png`
- Create: `assets/hd/ui/ranked-reference-plates/ranked-build-inspect-desktop-plate.png`
- Create: `tests/ranked-v3-reference-plate-assets.test.js`

**Step 1: Write the failing asset contract test**

Create `tests/ranked-v3-reference-plate-assets.test.js`. Read each new PNG as bytes, assert the PNG signature and its IHDR width/height are exactly `1536` and `1080`, and assert both expected relative paths exist. The test must not inspect or alter existing assets.

```js
assert.deepEqual(readPngDimensions(leaderboardPlate), { width: 1536, height: 1080 });
assert.deepEqual(readPngDimensions(inspectPlate), { width: 1536, height: 1080 });
```

**Step 2: Run the test to verify it fails**

Run: `node --test tests/ranked-v3-reference-plate-assets.test.js`

Expected: FAIL because the two assets do not exist yet.

**Step 3: Generate the cleaned plates with `@imagegen`**

First inspect the supplied source images. Then use `@imagegen` image editing, with these two source files as the referenced images:

- `C:\Users\Kamil\.codex\generated_images\019fbd02-789b-75b0-a741-d3e80ca2eedc\exec-0243c83e-6db0-445c-afeb-7d7f6b7b154d.png`
- `C:\Users\Kamil\.codex\generated_images\019fbd02-789b-75b0-a741-d3e80ca2eedc\exec-ba4d184b-18fa-43a1-9f46-34a5e2d330e6.png`

For each image, keep the full 1536 x 1080 stone frame, candles, skull ornaments, panel geometry, medal mounts, empty equipment frames, and decorative linework. Remove every word, number, player name, rank, score, example stat, column label, action label, example item image, and example result. Do not crop, tile, recolor, redraw into a generic panel, or add a logo. Save the outputs at the exact asset paths above.

**Step 4: Perform visual acceptance before code uses the art**

Open both generated files at original resolution. Confirm that their live-text regions are blank and that the frame geometry still matches the supplied references. If any original text or item art remains, regenerate that plate before continuing.

**Step 5: Run the asset contract test**

Run: `node --test tests/ranked-v3-reference-plate-assets.test.js`

Expected: PASS.

**Step 6: Commit**

```powershell
git add assets/hd/ui/ranked-reference-plates/ranked-leaderboard-desktop-plate.png assets/hd/ui/ranked-reference-plates/ranked-build-inspect-desktop-plate.png tests/ranked-v3-reference-plate-assets.test.js
git commit -m "feat: add ranked reference plate assets"
```

### Task 2: Add a tested, page-aware leaderboard presentation model

**Files:**
- Modify: `online-v3/ranked-v3-leaderboard-ui.js:8-22`
- Modify: `tests/ranked-v3-leaderboard-ui.test.js:52-105`
- Modify: `cloudflare/leaderboard-v3/test/m4-client-leaderboard.test.js:31-61`

**Step 1: Write failing pagination-model tests**

In `tests/ranked-v3-leaderboard-ui.test.js`, add deterministic input for 73 ranked rows. Assert that the new exported presentation helper:

- preserves server order and caps at 73 rows;
- puts global ranks 1-3 in `podium` on every requested ledger page;
- maps page 1 to ranks 4-10, page 2 to 11-17, and page 10 to 67-73;
- clamps an invalid page to the available range;
- returns no fabricated rows and disables a next page when no received rows remain.

Use explicit constants in the module: `MAX_ROWS = 73`, `PODIUM_SIZE = 3`, `LEDGER_ROWS_PER_PAGE = 7`, and `MAX_LEDGER_PAGES = 10`.

```js
const pageTwo = ui.createLeaderboardPresentation(rows, 2);
assert.deepEqual(pageTwo.podium.map((row) => row.rank), [1, 2, 3]);
assert.deepEqual(pageTwo.ledger.map((row) => row.rank), [11, 12, 13, 14, 15, 16, 17]);
assert.equal(pageTwo.pageLabel, "Page 2 / 10");
```

Update the M4 client test so its rank-offset assertion still proves opaque cursor order is preserved, without asserting the obsolete 20-row render limit.

**Step 2: Run the focused tests to verify they fail**

Run: `node --test tests/ranked-v3-leaderboard-ui.test.js`

Expected: FAIL because `createLeaderboardPresentation` and its page metadata do not exist.

**Step 3: Implement the pure model only**

In `online-v3/ranked-v3-leaderboard-ui.js`:

- change `createLeaderboardViewModel` from the hard-coded 20-row slice to a bounded 73-row normalization;
- add and export `createLeaderboardPresentation(rows, requestedPage)`;
- calculate ranks only from the server sequence / existing offset and never re-sort in the browser;
- return immutable `podium`, `ledger`, `page`, `pageCount`, `pageLabel`, `rangeLabel`, `canGoPrevious`, and `canGoNext` fields.

Do not render DOM or fetch data in this task.

**Step 4: Run focused tests to verify they pass**

Run: `node --test tests/ranked-v3-leaderboard-ui.test.js`

Expected: PASS.

**Step 5: Commit**

```powershell
git add online-v3/ranked-v3-leaderboard-ui.js tests/ranked-v3-leaderboard-ui.test.js cloudflare/leaderboard-v3/test/m4-client-leaderboard.test.js
git commit -m "feat: model ranked leaderboard pages"
```

### Task 3: Render the live leaderboard on the cleaned plate

**Files:**
- Modify: `online-v3/ranked-v3-leaderboard-ui.js:22-82`
- Modify: `tests/ranked-v3-leaderboard-ui.test.js:1-105`
- Modify: `cloudflare/leaderboard-v3/test/m4-client-leaderboard.test.js:112-136`

**Step 1: Write failing DOM-renderer tests**

Extend the fake DOM only as needed for `hidden`, `disabled`, `dataset`, and event handlers. Add tests for `renderList(document, presentation, handlers)` that assert:

- the root has `ranked-v3-reference-plate`, `ranked-v3-reference-plate--leaderboard`, and `ranked-v3-leaderboard-list` classes;
- the decorative art layer is `aria-hidden="true"` and all dynamic copy is in ordinary DOM nodes;
- exactly three top-rank slots exist even while page 2 is rendered;
- exactly seven ledger slot nodes exist, with only received rows populated;
- clicking a player name or Inspect Build opens its actual run ID;
- Previous and Next controls call the supplied page handler and correctly expose their disabled state;
- player names stay text-only, including an HTML-looking name.

**Step 2: Run the focused renderer tests to verify they fail**

Run: `node --test tests/ranked-v3-leaderboard-ui.test.js cloudflare/leaderboard-v3/test/m4-client-leaderboard.test.js`

Expected: FAIL because the current renderer builds generic podium cards and a generic ledger.

**Step 3: Replace only Ranked list markup**

Replace `renderList` with a semantic plate root containing:

- a visually-hidden `h2` for the surface name;
- a decorative art element that CSS binds to `ranked-leaderboard-desktop-plate.png`;
- normalized overlay regions for title/subtitle, the three rank mounts, table headings, seven ledger rows, page/range labels, pager controls, and a close control;
- separate `button` elements for each populated player name and Inspect Build affordance.

Use `textContent` through the existing element helper. Keep a compatible `ranked-v3-leaderboard-list` marker so the overlay shell can recognize the surface. Do not change Practice markup, and do not use `innerHTML`.

**Step 4: Run the focused renderer tests to verify they pass**

Run: `node --test tests/ranked-v3-leaderboard-ui.test.js cloudflare/leaderboard-v3/test/m4-client-leaderboard.test.js`

Expected: PASS.

**Step 5: Commit**

```powershell
git add online-v3/ranked-v3-leaderboard-ui.js tests/ranked-v3-leaderboard-ui.test.js cloudflare/leaderboard-v3/test/m4-client-leaderboard.test.js
git commit -m "feat: render ranked leaderboard reference plate"
```

### Task 4: Render the approved Inspect Build content and omit unused categories

**Files:**
- Modify: `online-v3/ranked-v3-leaderboard-ui.js:83-129`
- Modify: `tests/ranked-v3-leaderboard-ui.test.js:107-149`
- Modify: `cloudflare/leaderboard-v3/test/m4-client-leaderboard.test.js:137-170`

**Step 1: Write failing Inspect Build tests**

Add a detail fixture with relics, pacts, skills, camp upgrades, elixirs, mutators, a terminal defeat cause, and all Chronicle metrics. Assert that the result:

- has `ranked-v3-reference-plate--inspect` and an `aria-hidden` decorative art layer;
- renders exactly ten equipment slot nodes, preserving the stored relic order and leaving surplus slots empty;
- renders only `Time Played`, `Rooms Cleared`, `Bosses Defeated`, `Mutators`, `Highest Depth`, `Gold Earned`, and `Final Score` in the Chronicle;
- formats scores and gold with locale grouping, and formats duration as `HH:MM:SS`;
- exposes mutator name, key, bonus, and drawback through the same hover/focus tooltip contract;
- renders `Game Over` plus the stored cause for a defeat and a truthful victory equivalent for victory;
- does not render Pacts, Skill Tiers, Camp Upgrades, Elixirs, Final Chronicle, protocol hash, ruleset ID, or other omitted fields.

Add a legacy fixture with no stored cause and assert the UI says that the cause was not recorded instead of inventing one.

**Step 2: Run the focused tests to verify they fail**

Run: `node --test tests/ranked-v3-leaderboard-ui.test.js cloudflare/leaderboard-v3/test/m4-client-leaderboard.test.js`

Expected: FAIL because the current detail page renders generic sections and damage-stat data.

**Step 3: Implement the minimal Inspect Build renderer**

Refactor `renderDetail` into the approved plate composition:

- player header with rank, name, score, depth, and gold;
- a two-by-five equipment grid fed only by `detail.build.relics.slice(0, 10)`;
- the seven exact Chronicle fields, reading existing canonical names `summary.roomsCompleted`, `summary.bossesCompleted`, `summary.gold.earned`, and `summary.durationMs` with safe legacy fallbacks;
- locale-grouped score/gold values and an `HH:MM:SS` duration formatter so the live copy follows the reference hierarchy;
- a focusable Mutators trigger using `data-record-tooltip` and the existing client mutator catalogue;
- terminal copy from `detail.outcome` and `summary.presentationCause` when available;
- DOM Back and Close controls whose callbacks are supplied by the Runtime.

Retain `normalizeBuild` so the omitted canonical data remains preserved, but do not call section builders for pacts, skills, camp upgrades, elixirs, or the old damage-stat grid. Remove now-dead renderer-only helpers instead of leaving parallel generic UI paths.

**Step 4: Run the focused tests to verify they pass**

Run: `node --test tests/ranked-v3-leaderboard-ui.test.js cloudflare/leaderboard-v3/test/m4-client-leaderboard.test.js`

Expected: PASS.

**Step 5: Commit**

```powershell
git add online-v3/ranked-v3-leaderboard-ui.js tests/ranked-v3-leaderboard-ui.test.js cloudflare/leaderboard-v3/test/m4-client-leaderboard.test.js
git commit -m "feat: render ranked inspect reference plate"
```

### Task 5: Give the reference plates their own overlay shell and desktop CSS

**Files:**
- Modify: `online-v3/ranked-v3-ui.js:58-77, 274-289`
- Modify: `style.css:4618-5008, 5015-5100`
- Modify: `tests/record-archive-style.test.js`
- Create: `tests/ranked-v3-reference-plate-style.test.js`
- Modify: `cloudflare/leaderboard-v3/test/production-release.test.js:270-307`

**Step 1: Write failing shell/style tests**

Create `tests/ranked-v3-reference-plate-style.test.js`. It must assert that CSS references both new plate asset paths, has a desktop aspect ratio of `1536 / 1080`, defines separate leaderboard and inspect selectors, contains focus-visible and reduced-motion handling, and gates the coordinate layout to desktop widths. It must also assert that the generic `.record-archive-*` selectors still exist for Practice Records.

Update `tests/record-archive-style.test.js` to keep its Practice archive assertions but remove the assertion that Ranked uses `floor-skull.png`. Update `production-release.test.js` to assert the new Ranked plate markers rather than obsolete generic podium/relic-grid implementation details.

**Step 2: Run the style tests to verify they fail**

Run: `node --test tests/record-archive-style.test.js tests/ranked-v3-reference-plate-style.test.js cloudflare/leaderboard-v3/test/production-release.test.js`

Expected: FAIL because plate-specific CSS and its asset URLs do not exist.

**Step 3: Implement the isolated shell and CSS**

In `online-v3/ranked-v3-ui.js`, add a dedicated reference-plate branch to `showContent` (or an equally small named method) that:

- marks the card/view as a reference plate;
- keeps the old generic eyebrow/title/status/actions out of the visual composition;
- preserves modal safety and a keyboard Escape close path;
- places focus on the first enabled plate control.

In `style.css`, keep existing generic archive rules unchanged. Add `ranked-v3-reference-plate*` rules that:

- render a single, scaled desktop composition with `aspect-ratio: 1536 / 1080` and no tiled/cropped background;
- use one relative plate root, an `aria-hidden` art layer, and percentage/grid-based live overlay regions instead of hard-coded screen pixels;
- precisely position the podium, seven table rows, pager, ten inspect slots, seven Chronicle rows, terminal panel, Back, and Close controls;
- expose a strong visible focus style and support the existing tooltip's hover and focus behaviour;
- use only a minimal readable narrow-screen fallback, without designing a separate mobile layout;
- leave Practice Record selectors and all non-Ranked card variants untouched.

**Step 4: Run the style tests to verify they pass**

Run: `node --test tests/record-archive-style.test.js tests/ranked-v3-reference-plate-style.test.js cloudflare/leaderboard-v3/test/production-release.test.js`

Expected: PASS.

**Step 5: Commit**

```powershell
git add online-v3/ranked-v3-ui.js style.css tests/record-archive-style.test.js tests/ranked-v3-reference-plate-style.test.js cloudflare/leaderboard-v3/test/production-release.test.js
git commit -m "feat: style ranked reference plates"
```

### Task 6: Fetch up to 73 ordered rows through existing cursors and retain page state

**Files:**
- Modify: `online-v3/ranked-v3-runtime.js:184-261`
- Modify: `tests/ranked-v3-leaderboard-ui.test.js`
- Modify: `cloudflare/leaderboard-v3/test/m4-client-leaderboard.test.js`

**Step 1: Write failing collection and callback tests**

Add tests for a stubbed list function that returns two opaque cursor pages: 50 entries followed by 23 entries. Assert that the collection stops at 73, sends the cursor unchanged, makes no third request, and does not re-sort rows. Add renderer callback assertions that page changes do not trigger another list request and that returning from detail uses the page that opened it.

If the runtime orchestration cannot be tested directly without DOM-heavy setup, extract only the cursor collection loop into a small pure exported helper in `ranked-v3-leaderboard-ui.js`; keep all overlay calls in the Runtime. Do not introduce a second API client or a new endpoint.

**Step 2: Run the focused tests to verify they fail**

Run: `node --test tests/ranked-v3-leaderboard-ui.test.js cloudflare/leaderboard-v3/test/m4-client-leaderboard.test.js`

Expected: FAIL because the Runtime exposes an API-level `Load next page` control and fetches only 20 rows per action.

**Step 3: Implement cursor collection and local page state**

In `online-v3/ranked-v3-runtime.js`:

- replace the visible API `Load next page` action with a one-time collection loop that requests the existing endpoint with `limit: 50`, follows `cursor`, and stops at 73 rows, null cursor, or a non-progressing cursor;
- retain `leaderboardRows` in received authoritative order and introduce a bounded `leaderboardPage` state for the plate's pager;
- reset both only when opening the leaderboard fresh;
- pass `createLeaderboardPresentation(leaderboardRows, leaderboardPage)` and page/open/back/close handlers into the renderer;
- preserve `leaderboardPage` when returning from Inspect Build;
- continue to show the existing safe loading and retry messages if a request fails.

Do not modify `parseLeaderboardQuery`, D1 queries, endpoint response shape, schema, migrations, or the Worker leaderboard read path: it already supports opaque cursors and an upper limit of 50.

**Step 4: Run focused tests to verify they pass**

Run: `node --test tests/ranked-v3-leaderboard-ui.test.js cloudflare/leaderboard-v3/test/m4-client-leaderboard.test.js`

Expected: PASS.

**Step 5: Commit**

```powershell
git add online-v3/ranked-v3-runtime.js online-v3/ranked-v3-leaderboard-ui.js tests/ranked-v3-leaderboard-ui.test.js cloudflare/leaderboard-v3/test/m4-client-leaderboard.test.js
git commit -m "feat: paginate ranked leaderboard locally"
```

### Task 7: Persist a bounded display-only terminal defeat cause without a D1 migration

**Files:**
- Modify: `online-v3/ranked-v3-runtime.js:1151-1178`
- Modify: `cloudflare/leaderboard-v3/src/domain/ruleset-runtime.js:333-348`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/life-policy.js:25-36, 170-242`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/leaderboard-summary.js:68-127`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/data/ruleset-manifest.json` (generated)
- Modify: `online-v3/ranked-v3-protocol.js:10-23`
- Modify: `cloudflare/leaderboard-v3/test/m3-lives-outcome.test.js`
- Modify: `cloudflare/leaderboard-v3/test/m3-finalization.test.js`
- Modify: `cloudflare/leaderboard-v3/test/ruleset-manifest.test.js` only if a new invariant needs coverage

**Step 1: Write failing Worker-domain tests**

Add tests that prove all of the following:

- `report_fatal_event` accepts an optional `presentationCause` only with `classification` and optional existing `elixirUsage`;
- an empty, control-character, overlong, or unexpected-field payload fails closed;
- a valid reason is normalized to a bounded plain-text string and stored only in the fatal-event receipt;
- the reason changes neither life resolution, lost relic selection, score inputs, outcome, nor terminal eligibility;
- a terminal defeat's finalized `summary` contains the stored `presentationCause`;
- victory and legacy/no-cause records omit the field instead of synthesizing a reason.

Add one end-to-end Worker event/finalize test proving that `summary_json` is returned by the existing detail endpoint with the cause. Keep its assertion explicit that no SQL migration or new D1 column is used.

**Step 2: Run the failing Worker tests**

Run from `cloudflare/leaderboard-v3`:

```powershell
node --test --test-concurrency=1 test/m3-lives-outcome.test.js test/m3-finalization.test.js test/ruleset-manifest.test.js
```

Expected: FAIL because `presentationCause` is currently rejected and cannot reach the final summary.

**Step 3: Implement the bounded presentation-only flow**

Use the field name `presentationCause` throughout this path:

1. In `ranked-v3-runtime.js`, take the already-supplied `context.reason`, normalize it to bounded plain text, and add it to `fatalPayload` only when non-empty.
2. In `ruleset-runtime.js` and `life-policy.js`, allow exactly the four key sets: `classification`; `classification,elixirUsage`; `classification,presentationCause`; and `classification,elixirUsage,presentationCause`.
3. In `life-policy.js`, validate, normalize, and store the value as presentation-only receipt data. It must never participate in RNG, score, outcome, life counts, room state, or reward logic.
4. In `leaderboard-summary.js`, project the final terminal receipt's cause to `summary.presentationCause` only for a defeat. Existing `summary_json` serialization then persists it without a schema change or migration.

Document this field in the local policy metadata as `CLIENT_REPORTED_DISPLAY_ONLY`; never label it server-derived or use it as competitive evidence.

**Step 4: Regenerate and wire the local ruleset hash**

Run from the repository root:

```powershell
node scripts/generate-online-v3-meta-rules.mjs
node scripts/generate-online-v3-meta-rules.mjs --check
```

Copy the newly generated manifest hash into `online-v3/ranked-v3-protocol.js` as the current `RULESET_HASH` and include it in `SUPPORTED_RULESET_HASHES`, retaining all existing legacy hashes. Do not change `cloudflare/leaderboard-v3/src/rulesets/releases.js`, activate a release descriptor, or deploy; the new hash remains eligible only for local/test binding.

**Step 5: Run the Worker tests to verify they pass**

Run from `cloudflare/leaderboard-v3`:

```powershell
npm.cmd run check
node --test --test-concurrency=1 test/m3-lives-outcome.test.js test/m3-finalization.test.js test/ruleset-manifest.test.js
```

Expected: PASS.

**Step 6: Commit**

```powershell
git add online-v3/ranked-v3-runtime.js online-v3/ranked-v3-protocol.js cloudflare/leaderboard-v3/src/domain/ruleset-runtime.js cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/life-policy.js cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/leaderboard-summary.js cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/data/ruleset-manifest.json cloudflare/leaderboard-v3/test/m3-lives-outcome.test.js cloudflare/leaderboard-v3/test/m3-finalization.test.js cloudflare/leaderboard-v3/test/ruleset-manifest.test.js
git commit -m "feat: retain ranked terminal defeat cause"
```

### Task 8: Run cross-surface verification and visually inspect the current tree

**Files:**
- Modify only if verification exposes a scoped defect: files already listed in Tasks 1-7

**Step 1: Run focused regression tests**

Run from the repository root:

```powershell
node --test tests/ranked-v3-leaderboard-ui.test.js tests/ranked-v3-reference-plate-assets.test.js tests/ranked-v3-reference-plate-style.test.js tests/record-archive-style.test.js
```

Run from `cloudflare/leaderboard-v3`:

```powershell
node --test --test-concurrency=1 test/m3-lives-outcome.test.js test/m3-finalization.test.js test/m4-client-leaderboard.test.js test/ruleset-manifest.test.js test/production-release.test.js
```

Expected: PASS.

**Step 2: Run syntax and generator checks**

Run from the repository root:

```powershell
node --check online-v3/ranked-v3-leaderboard-ui.js
node --check online-v3/ranked-v3-runtime.js
node --check online-v3/ranked-v3-ui.js
node --check online-v3/ranked-v3-protocol.js
node scripts/generate-online-v3-meta-rules.mjs --check
git diff --check
```

Expected: all commands exit successfully.

**Step 3: Run the required integration gates once**

Run from the repository root:

```powershell
npm.cmd run verify:phase
npm.cmd run verify:baseline
npm.cmd run verify:ranked-headed -- --scenario lifecycle
```

Expected: PASS. `verify:phase` covers Worker/ruleset/protocol integration; `verify:baseline` protects the unchanged non-Ranked game path; the headed lifecycle check covers visible Ranked runtime behaviour. Do not run `verify:full` because there is no D1 migration, Wrangler change, staging, or release in this task.

**Step 4: Perform a headed visual check at desktop size**

Using the local Ranked test environment with a local fixture containing at least 73 ordered leaderboard records, inspect both surfaces at a 1536 x 1080 browser viewport:

- page 1 and page 2 show the same live Top 3 and page 2 starts at rank 11;
- page 10 ends at rank 73 or disables navigation if no received rows exist;
- name/Inspect, pager, Back, Close, Escape, and mutator hover/focus work;
- Inspect Build shows no Pacts, skills, camp upgrades, elixirs, or damage-stat sections;
- a terminal defeat with a stored cause shows it, while an older record honestly says it was not recorded;
- Practice Records retain their generic archive UI.

Save screenshots only under ignored `output/verification/` if an issue needs evidence; do not add test screenshots to source control.

**Step 5: Review the exact final diff and commit only scoped fixes**

Run:

```powershell
git status --short
git diff --check
```

Confirm that every changed path belongs to Tasks 1-7, that the pre-existing `docs/plans/2026-08-03-observer-bot-and-record-archive-repair.md` remains untouched, and that no deployment/release file was modified. If the verification steps required a scoped repair, add and commit only those explicit paths with a focused message; otherwise do not create an extra empty commit.
