# Local Ranked Eight-Bot Wall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Repository policy requires one agent and forbids delegation.

**Goal:** Extend the Windows Local Ranked Test launcher so one action starts, tiles, supervises, and diagnoses eight HD Observer Bot runs from the newest local commit.

**Architecture:** Reuse one prepared test bundle, one loopback Worker, and one local D1 state, then attach eight isolated persistent Chrome contexts controlled by a focused Playwright supervisor. Keep browser/session modeling, monitoring/artifact capture, Worker lifecycle, and WinForms presentation in separate modules with explicit JSON-line and stdin command interfaces.

**Tech Stack:** Node.js ESM, `playwright-core@1.62.1`, installed Google Chrome, PowerShell WinForms, local Wrangler/D1, Node's built-in test runner.

**Spec:** `docs/superpowers/specs/2026-08-30-local-ranked-eight-bot-wall-design.md`

## Global Constraints

- Run `npm run status:compact` and read the nearest relevant `AGENTS.md` before implementation.
- Use exactly one agent. Do not delegate any task in this plan.
- Use the newest eligible local commit for multi-bot mode; all eight bots use that same commit.
- Use exactly eight visible HD bots named `bot 1` through `bot 8`.
- Use one local Worker and one local D1 state; never use production D1, remote Wrangler, tunnels, push, deploy, migrations against production, or ruleset activation.
- Use eight fresh Chrome profile directories per wall session and never reuse them.
- Use the installed Chrome executable and `playwright-core`; do not download another browser.
- Keep `game.js`, Practice gameplay, Worker validation, ruleset data, protocol contracts, D1 schema, and production configuration unchanged.
- A failing bot must capture evidence and stop independently while the other seven continue.
- Store durable artifacts under `output/multi-bot-runs/<session-id>/`; never persist the Observer password or Worker signing secret.
- Resolve and validate every cleanup target below the owned session root before recursive removal.
- Update build identity only through the existing automatic commit hash/date mechanism; never hardcode it.
- Do not commit, push, or deploy unless the current execution prompt explicitly authorizes that action. Conditional commit steps below are skipped without that authority.

---

### Task 1: Add the browser dependency and pure wall model

**Files:**
- Modify: `package.json`
- Create: `package-lock.json`
- Create: `scripts/local-ranked-multi-bot-domain.mjs`
- Create: `tests/local-ranked-multi-bot-domain.test.mjs`

**Interfaces:**
- Produces `MULTI_BOT_COUNT: 8`.
- Produces `createBotDescriptors(sessionRoot: string): readonly BotDescriptor[]`.
- Produces `calculatePortraitTiles(bounds: MonitorBounds, count?: number): readonly WindowBounds[]`.
- Produces `createMultiBotSessionPaths(repoRoot: string, sessionId: string): SessionPaths`.
- Produces `assertOwnedSessionChild(sessionRoot: string, candidate: string): string`.

- [ ] **Step 1: Write the failing domain tests**

```js
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  MULTI_BOT_COUNT,
  assertOwnedSessionChild,
  calculatePortraitTiles,
  createBotDescriptors,
  createMultiBotSessionPaths
} from "../scripts/local-ranked-multi-bot-domain.mjs";

test("tiles eight windows across the portrait working area", () => {
  assert.equal(MULTI_BOT_COUNT, 8);
  assert.deepEqual(calculatePortraitTiles({ x: 3440, y: 0, width: 1080, height: 1872 }), [
    { x: 3440, y: 0, width: 540, height: 468 },
    { x: 3980, y: 0, width: 540, height: 468 },
    { x: 3440, y: 468, width: 540, height: 468 },
    { x: 3980, y: 468, width: 540, height: 468 },
    { x: 3440, y: 936, width: 540, height: 468 },
    { x: 3980, y: 936, width: 540, height: 468 },
    { x: 3440, y: 1404, width: 540, height: 468 },
    { x: 3980, y: 1404, width: 540, height: 468 }
  ]);
});

test("creates exact bot names and isolated paths", () => {
  const root = path.resolve("D:/repo/output/multi-bot-runs/session-a");
  const bots = createBotDescriptors(root);
  assert.deepEqual(bots.map((bot) => bot.name), [
    "bot 1", "bot 2", "bot 3", "bot 4",
    "bot 5", "bot 6", "bot 7", "bot 8"
  ]);
  assert.equal(new Set(bots.map((bot) => bot.profileDir)).size, 8);
  assert.equal(new Set(bots.map((bot) => bot.artifactDir)).size, 8);
});

test("rejects cleanup paths outside the owned session root", () => {
  const paths = createMultiBotSessionPaths("D:/repo", "session-a");
  assert.throws(
    () => assertOwnedSessionChild(paths.sessionRoot, "D:/repo/output"),
    /outside the owned multi-bot session/u
  );
});
```

- [ ] **Step 2: Run RED**

```powershell
node --test tests/local-ranked-multi-bot-domain.test.mjs
```

Expected: FAIL because the domain module does not exist.

- [ ] **Step 3: Install the exact dependency without browser download**

```powershell
npm install --save-dev --save-exact playwright-core@1.62.1 --ignore-scripts
```

Expected: exact dev dependency and lockfile, without a browser download.

- [ ] **Step 4: Implement the pure model**

```js
import path from "node:path";

export const MULTI_BOT_COUNT = 8;

export function assertOwnedSessionChild(sessionRoot, candidate) {
  const root = path.resolve(sessionRoot);
  const resolved = path.resolve(candidate);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new TypeError("Path is outside the owned multi-bot session.");
  }
  return resolved;
}

function ownedChild(root, ...segments) {
  return assertOwnedSessionChild(root, path.resolve(root, ...segments));
}

export function createMultiBotSessionPaths(repoRoot, sessionId) {
  if (!/^[0-9A-Za-z_-]{8,80}$/u.test(String(sessionId || ""))) {
    throw new TypeError("A safe multi-bot session ID is required.");
  }
  const outputRoot = path.resolve(repoRoot, "output", "multi-bot-runs");
  const sessionRoot = ownedChild(outputRoot, sessionId);
  return Object.freeze({
    outputRoot,
    sessionRoot,
    manifestPath: ownedChild(sessionRoot, "manifest.json"),
    workerLogPath: ownedChild(sessionRoot, "worker.log"),
    profilesRoot: ownedChild(sessionRoot, "profiles")
  });
}

export function createBotDescriptors(sessionRoot) {
  return Object.freeze(Array.from({ length: MULTI_BOT_COUNT }, (_, offset) => {
    const index = offset + 1;
    const id = `bot-${String(index).padStart(2, "0")}`;
    return Object.freeze({
      id,
      index,
      name: `bot ${index}`,
      profileDir: ownedChild(sessionRoot, "profiles", id),
      artifactDir: ownedChild(sessionRoot, id)
    });
  }));
}

export function calculatePortraitTiles(bounds, count = MULTI_BOT_COUNT) {
  const x = Number(bounds?.x);
  const y = Number(bounds?.y);
  const width = Number(bounds?.width);
  const height = Number(bounds?.height);
  if (![x, y, width, height].every(Number.isInteger) || width < 800 || height <= width || count !== 8) {
    throw new TypeError("Eight-bot mode requires an integer portrait monitor working area.");
  }
  const widths = [Math.floor(width / 2), width - Math.floor(width / 2)];
  const baseHeight = Math.floor(height / 4);
  const heights = [baseHeight, baseHeight, baseHeight, height - (baseHeight * 3)];
  const result = [];
  let top = y;
  for (const rowHeight of heights) {
    let left = x;
    for (const columnWidth of widths) {
      result.push(Object.freeze({ x: left, y: top, width: columnWidth, height: rowHeight }));
      left += columnWidth;
    }
    top += rowHeight;
  }
  return Object.freeze(result);
}
```

- [ ] **Step 5: Run GREEN and syntax**

```powershell
node --test tests/local-ranked-multi-bot-domain.test.mjs
node --check scripts/local-ranked-multi-bot-domain.mjs
```

Expected: 3 tests PASS and syntax exits 0.

- [ ] **Step 6: Commit only with current authority**

```powershell
git add -- package.json package-lock.json scripts/local-ranked-multi-bot-domain.mjs tests/local-ranked-multi-bot-domain.test.mjs
git commit -m "test(local): add eight-bot wall model"
```

Skip this step without explicit commit authority.

---

### Task 2: Add a read-only test-bundle telemetry bridge

**Files:**
- Create: `scripts/local-ranked-multi-bot-bundle.mjs`
- Modify: `scripts/build-pages-v3.mjs`
- Modify: `scripts/verify-pages-production-bundle.mjs`
- Create: `tests/local-ranked-multi-bot-bundle.test.mjs`

**Interfaces:**
- Produces `injectMultiBotTelemetry(source: string, target: string): string`.
- Test bundles expose `window.__DUNGEON_MULTI_BOT_TELEMETRY__` with `observerTrace()`, `observerState()`, and `stopObserverBot()`; release bundles never do.

- [ ] **Step 1: Write RED tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { injectMultiBotTelemetry } from "../scripts/local-ranked-multi-bot-bundle.mjs";

const marker = "  window.DungeonOnlineV3GameBridge = Object.freeze({";
const source = `(() => {
  function buildObserverBotTraceText() { return "trace"; }
  function isObserverBotActive() { return true; }
  function setObserverBotEnabled() { return true; }
  const state = { observerBot: { lastDecision: "move" } };
${marker}
  });
})();`;

test("injects only into test bundles", () => {
  assert.match(injectMultiBotTelemetry(source, "test"), /__DUNGEON_MULTI_BOT_TELEMETRY__/u);
  assert.equal(injectMultiBotTelemetry(source, "release"), source);
});

test("fails closed on marker drift", () => {
  assert.throws(() => injectMultiBotTelemetry("(() => {})();", "test"), /game bridge marker/u);
});
```

- [ ] **Step 2: Run RED**

```powershell
node --test tests/local-ranked-multi-bot-bundle.test.mjs
```

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement target-gated injection**

```js
const BRIDGE_MARKER = "  window.DungeonOnlineV3GameBridge = Object.freeze({";

export function injectMultiBotTelemetry(source, target) {
  if (target === "release") return String(source);
  if (target !== "test") throw new TypeError("Unknown Pages build target.");
  const text = String(source);
  if (text.split(BRIDGE_MARKER).length !== 2) {
    throw new Error("Expected exactly one game bridge marker for multi-bot telemetry.");
  }
  const hook = `  window.__DUNGEON_MULTI_BOT_TELEMETRY__ = Object.freeze({
    observerTrace: () => buildObserverBotTraceText(),
    observerState: () => ({
      enabled: isObserverBotActive(),
      lastDecision: String(state.observerBot?.lastDecision || "idle"),
      lastPolicy: String(state.observerBot?.lastPolicy || "default"),
      loopPingPongActive: Boolean(state.observerBot?.loopPingPongActive),
      loopPingPongTicks: Math.max(0, Number(state.observerBot?.loopPingPongTicks) || 0),
      loopAcolytePingPongTicks: Math.max(0, Number(state.observerBot?.loopAcolytePingPongTicks) || 0)
    }),
    stopObserverBot: () => setObserverBotEnabled(false, { silent: true })
  });

`;
  return text.replace(BRIDGE_MARKER, hook + BRIDGE_MARKER);
}
```

Call the helper once from `build-pages-v3.mjs` after normal Ranked game
replacements. Add the marker to forbidden production content in
`verify-pages-production-bundle.mjs`.

- [ ] **Step 4: Run GREEN and leak checks**

```powershell
node --test tests/local-ranked-multi-bot-bundle.test.mjs tests/pages-production-bundle.test.mjs
node scripts/build-pages-v3.mjs --target test
Select-String -Path output/pages-test-dist/game.js -Pattern "__DUNGEON_MULTI_BOT_TELEMETRY__"
```

Expected: tests PASS and the test bundle contains exactly one marker.

- [ ] **Step 5: Commit only with current authority**

```powershell
git add -- scripts/local-ranked-multi-bot-bundle.mjs scripts/build-pages-v3.mjs scripts/verify-pages-production-bundle.mjs tests/local-ranked-multi-bot-bundle.test.mjs
git commit -m "test(local): expose safe multi-bot telemetry"
```

Skip this step without explicit commit authority.

---

### Task 3: Launch and initialize eight isolated HD Chrome windows

**Files:**
- Create: `scripts/local-ranked-multi-bot-browser.mjs`
- Create: `tests/local-ranked-multi-bot-browser.test.mjs`

**Interfaces:**
- Produces `resolveChromeExecutable(options): Promise<string>`.
- Produces `launchBotWindow(options): Promise<BotRuntime>`.
- Produces `startBotRun(runtime, options): Promise<BotStatus>`.
- Each `BotRuntime` owns one persistent context, page, CDP session, capped console/network rings, and stop/focus methods.

- [ ] **Step 1: Write RED browser tests with a fake Playwright driver**

Verify Chrome discovery includes the installed x86 path, each unique
`profileDir` reaches `launchPersistentContext`, launch is visible with
`viewport: null`, background throttling is disabled, and CDP receives the
exact tile. Verify initialization sets only name, HD, muted audio, and
tutorial-seen preferences. Verify the UI sequence starts fresh Ranked, selects
the first relic, unlocks F9, presses B, and reaches Observer status.

- [ ] **Step 2: Run RED**

```powershell
node --test tests/local-ranked-multi-bot-browser.test.mjs
```

Expected: FAIL because the browser module does not exist.

- [ ] **Step 3: Implement owned Chrome launch**

```js
import { chromium as defaultChromium } from "playwright-core";

const CHROME_CANDIDATES = Object.freeze([
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
]);

export async function launchBotWindow(options) {
  const chromium = options.chromium || defaultChromium;
  const context = await chromium.launchPersistentContext(options.bot.profileDir, {
    executablePath: options.chromeExecutable,
    headless: false,
    viewport: null,
    acceptDownloads: true,
    args: [
      "--app=about:blank",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      "--no-first-run",
      "--no-default-browser-check"
    ]
  });
  await context.addInitScript(({ name }) => {
    localStorage.setItem("dungeonOneRoomPlayerName", name);
    localStorage.setItem("dungeonOneRoomGraphicsMode", "hd");
    localStorage.setItem("dungeonOneRoomAudioMuted", "1");
    localStorage.setItem("dungeonOneRoomTutorialRunSeenV1", "1");
    localStorage.setItem("dungeonOneRoomTutorialCampSeenV1", "1");
    localStorage.setItem("dungeonOneRoomTutorialMerchantSeenV1", "1");
    localStorage.setItem("dungeonOneRoomTutorialPortalSeenV1", "1");
  }, { name: options.bot.name });
  const page = context.pages()[0] || await context.newPage();
  const cdp = await context.newCDPSession(page);
  const { windowId } = await cdp.send("Browser.getWindowForTarget");
  await cdp.send("Browser.setWindowBounds", {
    windowId,
    bounds: {
      left: options.bounds.x,
      top: options.bounds.y,
      width: options.bounds.width,
      height: options.bounds.height,
      windowState: "normal"
    }
  });
  return createOwnedBotRuntime({ context, page, cdp, windowId, ...options });
}
```

`createOwnedBotRuntime` retains at most 200 entries per ring, redacts supplied
secrets on insertion, and closes only its own context.

- [ ] **Step 4: Implement the visible startup flow**

```js
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => typeof window.render_game_to_text === "function");
await page.keyboard.press("Enter");
await page.waitForFunction(() => document.querySelector("#bootScreen")?.classList.contains("hidden"));
await page.waitForFunction(() => document.querySelector("#game")?.dataset.graphicsMode === "hd");
await page.locator(".overlay-menu-row", { hasText: "Ranked (Online)" }).first().click();
const startNew = page.getByRole("button", { name: "Start New Ranked", exact: true });
if (await startNew.isVisible().catch(() => false)) {
  await startNew.click();
} else {
  await page.getByRole("button", { name: "Start Ranked", exact: true }).click();
}
await page.locator(".ranked-v3-choice-relic").first().click();
await page.waitForFunction(() => window.DungeonOnlineV3?.getSessionState?.() === "ROOM_ACTIVE");
await page.evaluate((password) => { window.prompt = () => password; }, password);
await page.keyboard.press("F9");
await page.locator(".overlay-card-debug-cheats").waitFor({ state: "visible" });
await page.keyboard.press("b");
await page.waitForFunction(() => window.DungeonOnlineV3GameBridge?.isRankedTestBotActive?.() === true);
await page.keyboard.press("F9");
await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).rankedHudStatus?.kind === "observer");
```

Use bounded retries only for boot readiness and F9 assistance settlement.

- [ ] **Step 5: Run GREEN and syntax**

```powershell
node --test tests/local-ranked-multi-bot-browser.test.mjs
node --check scripts/local-ranked-multi-bot-browser.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit only with current authority**

```powershell
git add -- scripts/local-ranked-multi-bot-browser.mjs tests/local-ranked-multi-bot-browser.test.mjs
git commit -m "feat(local): launch isolated Observer Bot windows"
```

Skip this step without explicit commit authority.

---

### Task 4: Detect per-bot failures and write complete artifacts

**Files:**
- Create: `scripts/local-ranked-multi-bot-monitor.mjs`
- Create: `tests/local-ranked-multi-bot-monitor.test.mjs`

**Interfaces:**
- Produces `sampleBotPage(runtime): Promise<BotSample>`.
- Produces `classifyImmediateFailure(sample): FailureIncident | null`.
- Produces `BotProgressMonitor.observe(sample, nowMs): FailureIncident | null`.
- Produces `captureBotFailure(runtime, incident, options): Promise<FailureRecord>`.

- [ ] **Step 1: Write RED classification tests**

Cover reconnect, integrity, page error, intentional stop, known boundary waits,
the exact 30-second stall threshold, a sustained A-B-A-B loop, and isolation
between two monitor instances.

```js
const monitor = new BotProgressMonitor({ stallMs: 30_000, loopMs: 30_000 });
assert.equal(monitor.observe(activeSample("A"), 0), null);
assert.equal(monitor.observe(activeSample("A"), 29_999), null);
assert.equal(monitor.observe(activeSample("A"), 30_000)?.kind, "stall");
```

- [ ] **Step 2: Write RED artifact tests**

Verify these exact files in an owned temporary directory:

```js
[
  "failure-summary.json",
  "screenshot.png",
  "ranked-diagnostics.json",
  "observer-bot-trace.txt",
  "game-state.json",
  "console.log",
  "network-errors.json"
]
```

Capture the same incident twice and prove only one screenshot/stop occurs.
Prove password and signing-secret fixtures appear in no text artifact.

- [ ] **Step 3: Run RED**

```powershell
node --test tests/local-ranked-multi-bot-monitor.test.mjs
```

Expected: FAIL because the monitor module does not exist.

- [ ] **Step 4: Implement deterministic sampling and detection**

```js
export function gameplayFingerprint(sample) {
  return JSON.stringify({
    phase: sample.game.phase || "",
    depth: Number(sample.game.depth) || 0,
    room: sample.game.roomIndex ?? sample.game.roomType ?? "",
    turn: Number(sample.game.turn) || 0,
    x: Number(sample.game.player?.x) || 0,
    y: Number(sample.game.player?.y) || 0,
    enemies: Number(sample.game.enemyCount ?? sample.game.enemies?.length) || 0,
    enemyHp: Number(sample.game.enemyHpTotal) || 0,
    portal: Boolean(sample.game.portalVisible),
    decision: String(sample.observer?.lastDecision || "")
  });
}
```

Sample game text, public Ranked session/snapshot, visible overlay, and test
telemetry in one page evaluation. Known waits reset the stall clock. Keep at
most 32 fingerprints and detect only two-, three-, or four-item cycles.

- [ ] **Step 5: Implement capture-before-stop**

Create the artifact directory, screenshot, sanitized state/buffers, trace, and
Ranked diagnostic download. If export is absent, write only public redacted
diagnostics. Then:

```js
await runtime.page.evaluate(() => {
  window.__DUNGEON_MULTI_BOT_TELEMETRY__?.stopObserverBot?.();
  document.documentElement.style.outline = "8px solid #c5162e";
  document.title = "[FAILED] " + document.title.replace(/^\[FAILED\]\s*/u, "");
});
```

Leave the page and context open.

- [ ] **Step 6: Run GREEN and syntax**

```powershell
node --test tests/local-ranked-multi-bot-monitor.test.mjs
node --check scripts/local-ranked-multi-bot-monitor.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit only with current authority**

```powershell
git add -- scripts/local-ranked-multi-bot-monitor.mjs tests/local-ranked-multi-bot-monitor.test.mjs
git commit -m "feat(local): capture per-bot Ranked failures"
```

Skip this step without explicit commit authority.

---

### Task 5: Compose one Worker with the eight-bot supervisor

**Files:**
- Create: `scripts/local-ranked-multi-bot-controller.mjs`
- Modify: `scripts/local-ranked-test-launcher-core.mjs`
- Modify: `tests/local-ranked-test-launcher-controller.test.mjs`
- Modify: `tests/local-ranked-test-launcher-launch.test.mjs`
- Create: `tests/local-ranked-multi-bot-controller.test.mjs`

**Interfaces:**
- Produces `startMultiBotWall(options): Promise<MultiBotController>`.
- Controller exposes `sessionRoot`, `bots`, `stopBot(id)`, `focusBot(id)`,
  `captureBot(id, incident)`, and idempotent `stop()`.
- CLI adds `start --multi-bot --json-events --monitor-x N --monitor-y N --monitor-width N --monitor-height N`.
- Stdin accepts `{"type":"stop"}`, `{"type":"stop_bot","botId":"bot-04"}`, and `{"type":"focus_bot","botId":"bot-04"}`.
- Stdout adds `wall_starting`, `bot_status`, `bot_failure`, `wall_ready`, `artifact_root`, and `stopped`.

- [ ] **Step 1: Write RED controller tests**

With injected dependencies, prove newest-commit selection, one Worker, eight
unique windows, shared URL/commit, descriptor-to-tile mapping, sequential
startup, isolated `stopBot`, idempotent `captureBot`, contexts-before-Worker
stop order, idempotent wall stop, Worker-exit blocking events, and rejection
of escaped cleanup paths.

- [ ] **Step 2: Run RED**

```powershell
node --test tests/local-ranked-multi-bot-controller.test.mjs tests/local-ranked-test-launcher-controller.test.mjs tests/local-ranked-test-launcher-launch.test.mjs
```

Expected: new interfaces FAIL while existing single-launcher assertions stay green.

- [ ] **Step 3: Implement wall composition**

```js
export async function startMultiBotWall(options) {
  const paths = createMultiBotSessionPaths(options.repoRoot, options.sessionId);
  const descriptors = createBotDescriptors(paths.sessionRoot);
  const tiles = calculatePortraitTiles(options.monitor);
  await options.mkdir(paths.profilesRoot, { recursive: true });
  await options.writeManifest(paths.manifestPath, buildManifest(options, descriptors));

  const runtimes = [];
  for (let index = 0; index < descriptors.length; index += 1) {
    const runtime = await options.launchBotWindow({
      bot: descriptors[index],
      bounds: tiles[index],
      url: options.worker.url,
      commit: options.commit,
      password: options.password,
      emit: options.emit
    });
    runtimes.push(runtime);
    await options.startBotRun(runtime, options);
    await options.wait(150);
  }
  return createMultiBotController({ paths, runtimes, worker: options.worker, ...options });
}
```

Start monitoring after each bot reaches assisted status. Serialize capture per
bot with one incident promise and emit redacted JSON only.

- [ ] **Step 4: Extend core CLI without regressing single mode**

Detect `--multi-bot`, reject `--commit` in that mode, select
`candidates.commits[0]`, validate four portrait monitor integers, start the
existing Worker once, start the wall, and return a composite stop controller.
Keep `list --json` and single `start --commit` unchanged. Add a line-buffered
stdin parser; invalid commands emit `command_failed` and leave the wall alive.

- [ ] **Step 5: Run GREEN and syntax**

```powershell
node --test tests/local-ranked-multi-bot-controller.test.mjs tests/local-ranked-test-launcher-core.test.mjs tests/local-ranked-test-launcher-controller.test.mjs tests/local-ranked-test-launcher-launch.test.mjs tests/local-ranked-test-launcher-preparation.test.mjs
node --check scripts/local-ranked-multi-bot-controller.mjs
node --check scripts/local-ranked-test-launcher-core.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit only with current authority**

```powershell
git add -- scripts/local-ranked-multi-bot-controller.mjs scripts/local-ranked-test-launcher-core.mjs tests/local-ranked-multi-bot-controller.test.mjs tests/local-ranked-test-launcher-controller.test.mjs tests/local-ranked-test-launcher-launch.test.mjs
git commit -m "feat(local): orchestrate eight Ranked bots"
```

Skip this step without explicit commit authority.

---

### Task 6: Add eight-bot controls and the live WinForms table

**Files:**
- Modify: `scripts/local-ranked-test-launcher.ps1`
- Modify: `tests/local-ranked-test-launcher-ui.test.mjs`

**Interfaces:**
- Consumes Task 5 events and stdin commands.
- Produces `Start 8 Observer Bots`, `Stop All`, diagnostics-folder action, and eight status rows.
- Produces monitor bounds from the first non-primary portrait screen.

- [ ] **Step 1: Extend static UI tests and observe RED**

Assert screen enumeration/filtering, all multi-bot arguments,
`RedirectStandardInput = $true`, JSON stdin writes, required button copy,
eight-row `ListView`, all new event handlers, and absence of deploy, remote
Wrangler, tunnels, password literal assignment, or broad process scanning.

```powershell
node --test tests/local-ranked-test-launcher-ui.test.mjs
```

Expected: FAIL on the new UI requirements.

- [ ] **Step 2: Implement monitor discovery**

```powershell
function Get-SecondaryPortraitScreen {
  $candidate = [System.Windows.Forms.Screen]::AllScreens |
    Where-Object { -not $_.Primary -and $_.WorkingArea.Height -gt $_.WorkingArea.Width } |
    Select-Object -First 1
  if ($null -eq $candidate) {
    throw "Eight-bot mode requires a connected secondary portrait monitor."
  }
  return $candidate
}
```

Pass `WorkingArea.X`, `Y`, `Width`, and `Height`. Multi-bot mode uses
the newest candidate's hash and ignores an older selected row.

- [ ] **Step 3: Implement the live table and graceful commands**

```text
Bot | Status | Depth | Score | HP | Last decision | Error
```

Map `bot-01` through `bot-08` to stable rows, paint failure dark red, and
open only the absolute artifact root received from Node.

```powershell
$startInfo.RedirectStandardInput = $true
$command = @{ type = "stop" } | ConvertTo-Json -Compress
$script:activeProcess.StandardInput.WriteLine($command)
$script:activeProcess.StandardInput.Flush()
```

Serialize per-row `focus_bot` and `stop_bot` with `ConvertTo-Json`.
Retain `taskkill /T /F` only after ten seconds without graceful stop.

- [ ] **Step 4: Run GREEN and PowerShell parse**

```powershell
node --test tests/local-ranked-test-launcher-ui.test.mjs
$tokens = $null
$errors = $null
[void][System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path "scripts/local-ranked-test-launcher.ps1"), [ref]$tokens, [ref]$errors)
if ($errors.Count -gt 0) { throw ($errors | Out-String) }
```

Expected: test PASS and zero parser errors.

- [ ] **Step 5: Commit only with current authority**

```powershell
git add -- scripts/local-ranked-test-launcher.ps1 tests/local-ranked-test-launcher-ui.test.mjs
git commit -m "feat(local): add eight-bot launcher controls"
```

Skip this step without explicit commit authority.

---

### Task 7: Prove real browser isolation and failure capture with two bots

**Files:**
- Create: `scripts/local-ranked-multi-bot-smoke.mjs`
- Create: `tests/local-ranked-multi-bot-smoke.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Adds `npm run verify:multi-bot-smoke -- --commit <full-hash>`.
- Smoke mode uses the real supervisor with a test-only two-bot override; the WinForms product path remains fixed at eight.
- Uses `MultiBotController.captureBot(id, incident)` to exercise the real artifact path without weakening Ranked.

- [ ] **Step 1: Write a gated real smoke test**

Skip unless `DUNGEON_RUN_MULTI_BOT_SMOKE=1`. When enabled:

1. read current full commit;
2. start the existing local Worker with Observer password `local-bot-test`;
3. launch two isolated Chrome profiles;
4. verify names `bot 1` and `bot 2`, HD canvases, distinct install hashes,
   profile IDs, run IDs, and assisted status;
5. call `captureBot` for bot 1 with kind `acceptance_capture`;
6. verify all seven bot-1 artifacts and inactive Observer state;
7. verify bot 2 remains active and advances;
8. stop both contexts and Worker in `finally`.

All recursive cleanup must pass `assertOwnedSessionChild`.

- [ ] **Step 2: Run RED**

```powershell
$env:DUNGEON_RUN_MULTI_BOT_SMOKE = "1"
node --test tests/local-ranked-multi-bot-smoke.test.mjs
Remove-Item Env:DUNGEON_RUN_MULTI_BOT_SMOKE
```

Expected: FAIL before the smoke driver exists or full lifecycle is wired.

- [ ] **Step 3: Implement the smoke entrypoint**

Export `runMultiBotSmoke(options)` and keep CLI parsing below it. Inject repo
root, commit, Chrome path, bot count, monitor bounds, and artifact root.

Add to `package.json`:

```json
"verify:multi-bot-smoke": "node scripts/local-ranked-multi-bot-smoke.mjs"
```

- [ ] **Step 4: Run the real smoke to GREEN**

This step requires the implementation to be locally committed because the
launcher prepares an exact commit worktree. Request local commit authority if
the execution prompt has not already granted it.

```powershell
$commit = git rev-parse HEAD
npm run verify:multi-bot-smoke -- --commit $commit
```

Expected: PASS with distinct run IDs, bot 1 captured/stopped, bot 2 advancing,
and all owned processes stopped at exit.

- [ ] **Step 5: Inspect evidence**

Open bot 1 screenshot and both final state JSON files. Confirm the controlled
capture, active bot 2 gameplay, exact names, HD state, and no unexpected console
or network errors.

- [ ] **Step 6: Commit only with current authority**

```powershell
git add -- package.json scripts/local-ranked-multi-bot-smoke.mjs tests/local-ranked-multi-bot-smoke.test.mjs
git commit -m "test(local): verify multi-bot isolation"
```

Skip this step without explicit commit authority.

---

### Task 8: Run the eight-window acceptance test and finish documentation

**Files:**
- Modify: `progress.md`
- Modify only if observed behavior differs: `docs/superpowers/specs/2026-08-30-local-ranked-eight-bot-wall-design.md`
- Modify only if execution details differ: `docs/superpowers/plans/2026-08-30-local-ranked-eight-bot-wall.md`

**Interfaces:**
- Produces a durable acceptance session below `output/multi-bot-runs/`.

- [ ] **Step 1: Run all focused launcher tests once**

```powershell
node --test tests/local-ranked-test-launcher-core.test.mjs tests/local-ranked-test-launcher-launch.test.mjs tests/local-ranked-test-launcher-controller.test.mjs tests/local-ranked-test-launcher-preparation.test.mjs tests/local-ranked-test-launcher-ui.test.mjs tests/local-ranked-multi-bot-domain.test.mjs tests/local-ranked-multi-bot-bundle.test.mjs tests/local-ranked-multi-bot-browser.test.mjs tests/local-ranked-multi-bot-monitor.test.mjs tests/local-ranked-multi-bot-controller.test.mjs tests/local-ranked-multi-bot-smoke.test.mjs
```

Expected: focused tests PASS; the gated real smoke may SKIP because Task 7 ran
it explicitly.

- [ ] **Step 2: Run syntax and safety verification**

```powershell
node --check scripts/local-ranked-multi-bot-domain.mjs
node --check scripts/local-ranked-multi-bot-bundle.mjs
node --check scripts/local-ranked-multi-bot-browser.mjs
node --check scripts/local-ranked-multi-bot-monitor.mjs
node --check scripts/local-ranked-multi-bot-controller.mjs
node --check scripts/local-ranked-multi-bot-smoke.mjs
node --check scripts/local-ranked-test-launcher-core.mjs
node --check scripts/build-pages-v3.mjs
npm run verify:guard
```

Expected: syntax exits 0 and guard passes.

- [ ] **Step 3: Run the affected Ranked headed scenario**

```powershell
npm run verify:ranked-headed -- --scenario lifecycle
```

Expected: current-tree lifecycle PASS without new console/page errors. Inspect
its final gameplay screenshot.

- [ ] **Step 4: Run the shared web-game observation client**

Start the owned local controller and capture its `ready` JSON event as
`$readyEvent`, then run:

```powershell
$readyUrl = [string]$readyEvent.url
node C:\Users\Kamil\.codex\skills\develop-web-game\scripts\web_game_playwright_client.js --url $readyUrl --actions-json '{"steps":[{"buttons":["ENTER"],"frames":2},{"buttons":[],"frames":10}]}' --iterations 1 --pause-ms 500
```

Inspect its screenshot, rendered state, and console output, then stop the owned
Worker.

- [ ] **Step 5: Run visible 8×HD acceptance**

Open `Launch-Local-Ranked-Test.cmd` and choose `Start 8 Observer Bots`.
Verify exactly eight application windows, 2-by-4 tiling on `DISPLAY2`, names
`bot 1` through `bot 8`, HD canvases, blue assisted status, and advancing
launcher rows.

Use the launcher's Focus action for bot 1, then press F9 and B to disable that
Observer Bot without issuing an intentional launcher stop. Verify the monitor
classifies the unexpected disable, leaves that window open and red, writes all
seven artifacts, and lets bots 2–8 continue for 30 seconds. Use `Stop All`;
verify contexts and Worker stop, profiles are removed, and diagnostics remain.

- [ ] **Step 6: Update progress**

Append implemented scope, exact verification counts, acceptance session path,
resource usage, and genuine unresolved items. Record that no push, deployment,
ruleset activation, or production migration occurred.

- [ ] **Step 7: Run final repository checks**

```powershell
git status --short
git diff --check
```

Inspect the exact intended diff. Confirm `.tmp-apply-probe.txt` and both
pre-existing untracked plan files remain untouched.

- [ ] **Step 8: Commit only with current authority**

```powershell
git add -- progress.md docs/superpowers/specs/2026-08-30-local-ranked-eight-bot-wall-design.md docs/superpowers/plans/2026-08-30-local-ranked-eight-bot-wall.md
git commit -m "docs(local): record eight-bot wall verification"
```

Stage only documentation that actually changed. Skip without explicit commit
authority.
