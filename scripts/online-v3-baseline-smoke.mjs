import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { promises as fsPromises } from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HEADLESS = process.argv.includes("--headless");
const ARTIFACT_ROOT = path.join(
  ROOT,
  "output",
  HEADLESS ? "online-v3-phase1-headless" : "online-v3-baseline"
);
const STORAGE_PREFIX = "dungeonOneRoom";
const RUN_SAVE_KEY = "dungeonOneRoomRunSave";
const GRAPHICS_KEY = "dungeonOneRoomGraphicsMode";
const PLAYER_NAME_KEY = "dungeonOneRoomPlayerName";
const LIVES_KEY = "dungeonOneRoomLives";
const TUTORIAL_KEYS = [
  "dungeonOneRoomTutorialRunSeenV1",
  "dungeonOneRoomTutorialCampSeenV1",
  "dungeonOneRoomTutorialMerchantSeenV1",
  "dungeonOneRoomTutorialPortalSeenV1",
  "dungeonOneRoomTutorialWardenDeathTipSeenV1"
];
const ONLINE_V3_FILES = [
  "online-v3/ranked-v3-checkpoints.js",
  "online-v3/ranked-v3-client.js",
  "online-v3/ranked-v3-coordination.js",
  "online-v3/ranked-v3-directives.js",
  "online-v3/ranked-v3-hooks.js",
  "online-v3/ranked-v3-leaderboard-ui.js",
  "online-v3/ranked-v3-offers.js",
  "online-v3/ranked-v3-protocol.js",
  "online-v3/ranked-v3-recorder.js",
  "online-v3/ranked-v3-runtime.js",
  "online-v3/ranked-v3-session.js",
  "online-v3/ranked-v3-storage.js",
  "online-v3/ranked-v3-transport.js",
  "online-v3/ranked-v3-ui.js"
];

function loadPlaywright() {
  const searchRoots = [
    process.env.DUNGEON_PLAYWRIGHT_NODE_MODULES,
    path.join(process.env.USERPROFILE || "", ".codex", "skills", "develop-web-game", "node_modules"),
    path.join(ROOT, "node_modules")
  ].filter(Boolean);
  for (const searchRoot of searchRoots) {
    try {
      return require(require.resolve("playwright", { paths: [searchRoot] }));
    } catch {
      // Try the next explicitly scoped module root.
    }
  }
  throw new Error(
    "Playwright was not found. Set DUNGEON_PLAYWRIGHT_NODE_MODULES to a node_modules directory containing playwright."
  );
}

function gitOutput(args) {
  return execFileSync(
    "git",
    ["-c", `safe.directory=${ROOT.replaceAll("\\", "/")}`, ...args],
    { cwd: ROOT, encoding: "utf8" }
  ).trimEnd();
}

async function verifyPhaseGuardrails() {
  const statusLines = gitOutput(["status", "--porcelain", "--untracked-files=all"])
    .split(/\r?\n/u)
    .filter(Boolean);
  const changedPaths = statusLines.map((line) => line.slice(3).replaceAll("\\", "/"));

  const endpointPaths = [];
  for (const relative of ONLINE_V3_FILES) {
    const source = await fsPromises.readFile(path.join(ROOT, relative), "utf8");
    if (relative !== "online-v3/ranked-v3-transport.js") {
      assert(!/\bfetch\s*\(/u.test(source), `${relative} bypasses the shared transport`);
      assert(!/\b(?:XMLHttpRequest|WebSocket|EventSource)\b|navigator\.sendBeacon/u.test(source), `${relative} bypasses the shared transport`);
    }
    assert(!/ranked-runtime|sim-core|presentationDirector|presentation director|\/api\/ranked\/v2/iu.test(source), `${relative} references Ranked v2 runtime`);
    endpointPaths.push(...source.match(/\/api\/[a-z0-9_./:-]+/giu) || []);
  }
  assert(endpointPaths.every((route) => route.startsWith("/api/v3")), "Online v3 route escaped /api/v3");

  const indexSource = await fsPromises.readFile(path.join(ROOT, "index.html"), "utf8");
  for (const relative of ONLINE_V3_FILES.filter((file) => ![
    "online-v3/ranked-v3-hooks.js",
    "online-v3/ranked-v3-recorder.js",
    "online-v3/ranked-v3-checkpoints.js"
  ].includes(file))) {
    assert(indexSource.includes(relative), `${relative} is not loaded by index.html`);
  }

  const clientApi = require(path.join(ROOT, "online-v3", "ranked-v3-client.js"));
  const practiceApi = clientApi.createPracticeClient();
  assert.equal(practiceApi.mode, "practice");
  assert.equal(practiceApi.emit(), undefined);
  assert.equal(practiceApi.recordCommand(), undefined);
  assert.equal(practiceApi.requestCheckpoint(), undefined);
  assert.equal(practiceApi.getRoomDirective(), null);
  assert.equal(practiceApi.openLeaderboard(), undefined);

  const protocol = require(path.join(ROOT, "online-v3", "ranked-v3-protocol.js"));
  assert.deepEqual(
    Object.values(protocol.ENDPOINTS).map(({ method, path: endpointPath }) => `${method} ${endpointPath}`),
    [
      "POST /api/v3/runs/start",
      "POST /api/v3/runs/checkpoint",
      "POST /api/v3/runs/event",
      "POST /api/v3/runs/finalize",
      "POST /api/v3/runs/resume",
      "POST /api/v3/runs/abandon",
      "POST /api/v3/profiles/camp",
      "GET /api/v3/leaderboard",
      "GET /api/v3/leaderboard/:runId"
    ]
  );

  const storage = require(path.join(ROOT, "online-v3", "ranked-v3-storage.js"));
  assert.equal(storage.STORAGE_PREFIX, "dungeonRankedV3");
  assert(Object.values(storage.STORAGE_KEYS).every((key) => key.startsWith("dungeonRankedV3")));

  const leaderboardUi = require(path.join(ROOT, "online-v3", "ranked-v3-leaderboard-ui.js"));
  assert(Object.values(leaderboardUi.SELECTORS).every((selector) => selector.startsWith("ranked-v3-")));

  return {
    changedPaths,
    onlineV3Files: ONLINE_V3_FILES.length,
    endpoints: endpointPaths,
    practiceSynchronousNoop: true,
    originalGameLoadedOnlineV3: true
  };
}

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".aseprite": "application/octet-stream"
  }[ext] || "application/octet-stream";
}

async function startStaticServer() {
  const rootWithSeparator = `${ROOT}${path.sep}`;
  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
      const decoded = decodeURIComponent(requestUrl.pathname);
      const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
      const filePath = path.resolve(ROOT, relative);
      if (filePath !== ROOT && !filePath.startsWith(rootWithSeparator)) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      const stat = await fsPromises.stat(filePath);
      const resolvedFile = stat.isDirectory() ? path.join(filePath, "index.html") : filePath;
      response.writeHead(200, {
        "content-type": mimeType(resolvedFile),
        "cache-control": "no-store"
      });
      fs.createReadStream(resolvedFile).pipe(response);
    } catch {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Not found");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address === "object");
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`
  };
}

async function writeJson(name, value) {
  await fsPromises.writeFile(
    path.join(ARTIFACT_ROOT, name),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8"
  );
}

async function readState(page) {
  const raw = await page.evaluate(() => {
    if (typeof window.render_game_to_text !== "function") return "";
    return window.render_game_to_text();
  });
  return raw ? JSON.parse(raw) : null;
}

async function waitForState(page, predicate, label, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  let lastState = null;
  while (Date.now() < deadline) {
    lastState = await readState(page);
    if (lastState && predicate(lastState)) return lastState;
    await page.waitForTimeout(80);
  }
  throw new Error(`Timed out waiting for ${label}. Last state: ${JSON.stringify(lastState)}`);
}

async function screenshot(page, name) {
  const outputPath = path.join(ARTIFACT_ROOT, name);
  await page.screenshot({ path: outputPath, fullPage: true });
  const bytes = await fsPromises.readFile(outputPath);
  return {
    file: name,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length
  };
}

function seedStorage(mode = "hd") {
  return {
    mode,
    playerName: "BaselineQA",
    tutorialKeys: TUTORIAL_KEYS
  };
}

async function createContext(browser, options = {}) {
  const context = await browser.newContext({
    viewport: options.viewport || { width: 1920, height: 1080 },
    reducedMotion: "no-preference"
  });
  if (options.seed !== false) {
    await context.addInitScript((seed) => {
      try {
        localStorage.setItem("dungeonOneRoomGraphicsMode", seed.mode);
        localStorage.setItem("dungeonOneRoomPlayerName", seed.playerName);
        for (const key of seed.tutorialKeys) localStorage.setItem(key, "1");
        localStorage.removeItem("dungeonOneRoomAudioMuted");
      } catch {
        // about:blank has no usable storage; the script runs again for the HTTP origin.
      }
    }, options.seed || seedStorage());
  }
  return context;
}

function attachDiagnostics(page, bucket, label) {
  page.on("console", (message) => {
    if (message.type() === "error") {
      bucket.consoleErrors.push({ label, text: message.text() });
    }
  });
  page.on("pageerror", (error) => {
    bucket.pageErrors.push({ label, text: String(error?.stack || error) });
  });
  page.on("requestfailed", (request) => {
    bucket.requestFailures.push({
      label,
      url: request.url(),
      failure: request.failure()?.errorText || "unknown"
    });
  });
  page.on("request", (request) => {
    const parsed = new URL(request.url());
    if (parsed.pathname.startsWith("/api/")) {
      bucket.apiRequests.push({ label, method: request.method(), url: request.url() });
    }
  });
}

async function openScenario(browser, baseUrl, diagnostics, label, scenario, mode = "hd") {
  const context = await createContext(browser, { seed: seedStorage(mode) });
  const page = await context.newPage();
  attachDiagnostics(page, diagnostics, label);
  const response = await page.goto(`${baseUrl}/?scenario=${encodeURIComponent(scenario)}`, {
    waitUntil: "domcontentloaded"
  });
  assert.equal(response?.status(), 200, `${label}: expected HTTP 200`);
  const state = await waitForState(page, (value) => value.phase === "playing", `${label} playing`);
  await page.evaluate(() => {
    // Scenario overrides start directly in gameplay while the first-launch boot
    // layer remains mounted. Reveal the already-running game for visual QA.
    document.getElementById("bootScreen")?.classList.add("hidden");
    document.getElementById("gameApp")?.classList.remove("app-hidden");
  });
  await page.waitForFunction(() => {
    const boot = document.getElementById("bootScreen");
    const app = document.getElementById("gameApp");
    return Boolean(boot?.classList.contains("hidden") && !app?.classList.contains("app-hidden"));
  });
  return { context, page, state };
}

async function dismissBootToMenu(page) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await readState(page);
    if (current?.phase === "menu") {
      await page.waitForFunction(() => document.getElementById("bootScreen")?.classList.contains("hidden"));
      return current;
    }
    await page.keyboard.press("Enter");
    await page.waitForTimeout(180);
  }
  const state = await waitForState(page, (value) => value.phase === "menu", "main menu");
  await page.waitForFunction(() => document.getElementById("bootScreen")?.classList.contains("hidden"));
  return state;
}

function extractStaticReference(gameSource, indexSource) {
  const audioFiles = [...new Set(
    [...gameSource.matchAll(/["'](assets\/[^"']+\.(?:mp3|wav|ogg))["']/giu)].map((match) => match[1])
  )].sort();
  const playSfxStart = gameSource.indexOf("function playSfx(kind)");
  const playSfxEnd = gameSource.indexOf("function toggleAudio()", playSfxStart);
  const playSfxSource = gameSource.slice(playSfxStart, playSfxEnd);
  const synthesizedSfx = [...new Set(
    [...playSfxSource.matchAll(/kind\s*===\s*["']([^"']+)["']/gu)].map((match) => match[1])
  )];
  const hudIds = [...indexSource.matchAll(/id="([^"]+)"/gu)]
    .map((match) => match[1])
    .filter((id) => [
      "hud",
      "depthBadge",
      "leftResourceRail",
      "furyIconRail",
      "elixirIconRail",
      "hpRail",
      "hpRailValue",
      "hpRailTrack",
      "protectionRail",
      "shieldRailValue",
      "shieldRailTrack",
      "barrierRailValue",
      "barrierRailTrack",
      "potionResourceRail",
      "potionIconRail",
      "skillsBar",
      "actions",
      "activeEffects",
      "mutators",
      "log"
    ].includes(id));
  return { audioFiles, synthesizedSfx, hudIds };
}

async function main() {
  await fsPromises.mkdir(ARTIFACT_ROOT, { recursive: true });
  const guardrails = await verifyPhaseGuardrails();
  const gameSource = await fsPromises.readFile(path.join(ROOT, "game.js"), "utf8");
  const indexSource = await fsPromises.readFile(path.join(ROOT, "index.html"), "utf8");
  const staticReference = extractStaticReference(gameSource, indexSource);
  for (const relativePath of staticReference.audioFiles) {
    assert.equal(
      fs.existsSync(path.join(ROOT, relativePath)),
      true,
      `Missing audio asset: ${relativePath}`
    );
  }
  await writeJson("sfx-and-audio.json", staticReference);

  const { chromium } = loadPlaywright();
  const { server, baseUrl } = await startStaticServer();
  const diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    apiRequests: []
  };
  const results = {
    runnerMode: HEADLESS ? "headless" : "headed",
    baseUrl,
    gameVersion: "",
    httpStatus: 0,
    checks: {},
    guardrails,
    screenshots: [],
    motionTimeline: []
  };

  const browser = await chromium.launch({ headless: HEADLESS });
  try {
    const bootContext = await createContext(browser, { seed: false });
    const bootPage = await bootContext.newPage();
    attachDiagnostics(bootPage, diagnostics, "boot");
    const bootResponse = await bootPage.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    results.httpStatus = bootResponse?.status() || 0;
    assert.equal(results.httpStatus, 200);
    await bootPage.waitForFunction(() => typeof window.render_game_to_text === "function");
    results.gameVersion = await bootPage.evaluate(() => window.DUNGEON_GAME_VERSION);
    assert.equal(results.gameVersion, "v0.8.0");
    assert.equal(await bootPage.locator("#bootScreen").isVisible(), true);
    results.screenshots.push(await screenshot(bootPage, "01-boot.png"));
    await bootPage.keyboard.press("Enter");
    await bootPage.waitForTimeout(120);
    const mutedBefore = await bootPage.evaluate(() => localStorage.getItem("dungeonOneRoomAudioMuted"));
    await bootPage.keyboard.press("m");
    const mutedAfter = await bootPage.evaluate(() => localStorage.getItem("dungeonOneRoomAudioMuted"));
    await bootPage.keyboard.press("m");
    assert.notEqual(mutedBefore, mutedAfter, "Audio toggle must persist a changed mute flag");
    results.checks.audioToggle = { before: mutedBefore, after: mutedAfter };
    await bootContext.close();

    const classic = await openScenario(
      browser,
      baseUrl,
      diagnostics,
      "classic-shrine",
      "descent_hd",
      "classic"
    );
    assert.equal(classic.state.roomType, "shrine");
    assert.equal(await classic.page.locator("body.graphics-hd-ui").count(), 0);
    assert.equal(await classic.page.locator("#game").getAttribute("data-graphics-mode"), "legacy");
    results.checks.classic = { phase: classic.state.phase, roomType: classic.state.roomType };
    results.screenshots.push(await screenshot(classic.page, "02-classic-shrine.png"));
    await classic.context.close();

    const hd = await openScenario(browser, baseUrl, diagnostics, "hd-shrine", "descent_hd", "hd");
    await hd.page.waitForFunction(() => document.querySelector("#game")?.dataset.graphicsMode === "hd");
    assert.equal(hd.state.roomType, "shrine");
    assert.equal(await hd.page.locator("body.graphics-hd-ui").count(), 1);
    results.checks.hd = { phase: hd.state.phase, roomType: hd.state.roomType };
    results.screenshots.push(await screenshot(hd.page, "03-hd-shrine.png"));

    const hudStructure = await hd.page.evaluate(() => {
      const ids = [
        "hud",
        "depthBadge",
        "leftResourceRail",
        "hpRail",
        "protectionRail",
        "potionResourceRail",
        "skillsBar",
        "actions",
        "activeEffects",
        "mutators",
        "log"
      ];
      return ids.map((id) => {
        const element = document.getElementById(id);
        return {
          id,
          tag: element?.tagName || "",
          classes: element ? [...element.classList] : [],
          ariaLabel: element?.getAttribute("aria-label") || "",
          text: (element?.textContent || "").replace(/\s+/gu, " ").trim().slice(0, 500)
        };
      });
    });
    await writeJson("hud-structure.json", hudStructure);

    await hd.page.keyboard.press("F9");
    await hd.page.waitForFunction(() => document.querySelector("#screenOverlay")?.textContent?.includes("Debug Cheats"));
    const cheatOptions = await hd.page.evaluate(() =>
      [...document.querySelectorAll(".debug-cheat-section")].map((section) => ({
        section: section.querySelector("h3")?.textContent?.trim() || "",
        options: [...section.querySelectorAll("[data-hd-key]")].map((row) => ({
          key: row.getAttribute("data-hd-key") || "",
          name: row.querySelector("strong")?.textContent?.trim() || "",
          description: row.querySelector("span")?.textContent?.trim() || "",
          disabled: row.getAttribute("aria-disabled") === "true"
        }))
      }))
    );
    assert(cheatOptions.flatMap((section) => section.options).length >= 20);
    await writeJson("cheat-menu-options.json", cheatOptions);
    results.screenshots.push(await screenshot(hd.page, "04-cheat-menu.png"));
    await hd.page.keyboard.press("F9");
    await hd.context.close();

    const vault = await openScenario(
      browser,
      baseUrl,
      diagnostics,
      "vault",
      "expansion_vault_guardian_hd",
      "hd"
    );
    assert.equal(vault.state.roomType, "vault");
    assert(vault.state.enemies.some((enemy) => enemy.type === "guardian"));
    results.checks.vault = {
      roomType: vault.state.roomType,
      guardianCount: vault.state.enemies.filter((enemy) => enemy.type === "guardian").length
    };
    results.screenshots.push(await screenshot(vault.page, "05-vault.png"));
    await vault.context.close();

    const motion = await openScenario(
      browser,
      baseUrl,
      diagnostics,
      "motion",
      "enemy_roster_hd",
      "hd"
    );
    for (const elapsedMs of [0, 120, 240, 360]) {
      if (elapsedMs > 0) await motion.page.waitForTimeout(120);
      const frame = await screenshot(motion.page, `motion-${String(elapsedMs).padStart(3, "0")}ms.png`);
      results.motionTimeline.push({
        elapsedMs,
        state: await readState(motion.page),
        screenshot: frame
      });
    }
    assert.equal(new Set(results.motionTimeline.map((entry) => entry.screenshot.sha256)).size > 1, true);
    await writeJson("motion-timeline.json", results.motionTimeline);
    await motion.context.close();

    const observer = await openScenario(
      browser,
      baseUrl,
      diagnostics,
      "observer",
      "enemy_roster_hd",
      "hd"
    );
    await observer.page.keyboard.press("F10");
    await observer.page.waitForFunction(() => document.querySelector("#screenOverlay")?.textContent?.includes("Observer Bot Menu"));
    await observer.page.keyboard.press("b");
    await observer.page.waitForFunction(() => document.querySelector("#screenOverlay")?.textContent?.includes("Observer Bot: ON"));
    results.screenshots.push(await screenshot(observer.page, "06-observer-bot.png"));
    results.checks.observerBot = { enabled: true };
    await observer.page.keyboard.press("F10");
    await observer.page.waitForTimeout(500);
    results.checks.observerBot.after = await readState(observer.page);
    await observer.context.close();

    const save = await openScenario(browser, baseUrl, diagnostics, "save", "descent_hd", "hd");
    const savedRaw = await save.page.evaluate((key) => localStorage.getItem(key), RUN_SAVE_KEY);
    assert(savedRaw, "Scenario start must create a Continue snapshot");
    const savedSnapshot = JSON.parse(savedRaw);
    const savedDepth = savedSnapshot.depth;
    await save.page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    await dismissBootToMenu(save.page);
    const menuText = await save.page.locator("#screenOverlay").innerText();
    assert.match(menuText, /Continue/u);
    results.screenshots.push(await screenshot(save.page, "07-save-continue-menu.png"));
    await save.page.keyboard.press("2");
    const resumed = await waitForState(save.page, (value) => value.phase === "playing", "continued run");
    assert.equal(resumed.depth, savedDepth);
    results.checks.saveContinue = { savedDepth, resumedDepth: resumed.depth };

    const defeatSnapshotRaw = await save.page.evaluate((key) => localStorage.getItem(key), RUN_SAVE_KEY);
    const defeatSnapshot = JSON.parse(defeatSnapshotRaw);
    defeatSnapshot.phase = "playing";
    defeatSnapshot.lives = 1;
    defeatSnapshot.roomType = "combat";
    defeatSnapshot.roomCleared = false;
    defeatSnapshot.relics = [];
    defeatSnapshot.player.x = 4;
    defeatSnapshot.player.y = 4;
    defeatSnapshot.player.hp = 1;
    defeatSnapshot.player.maxHp = Math.max(1, Number(defeatSnapshot.player.maxHp) || 1);
    defeatSnapshot.player.armor = 0;
    defeatSnapshot.player.hpShield = 0;
    defeatSnapshot.player.barrierShield = 0;
    defeatSnapshot.player.hasSecondChance = false;
    defeatSnapshot.player.chronoUsedThisRun = true;
    defeatSnapshot.spikes = [{ x: 5, y: 4, active: true }];
    defeatSnapshot.mines = [];
    defeatSnapshot.flameVents = [];
    defeatSnapshot.frostRunes = [];
    defeatSnapshot.enemies = [];
    await save.page.evaluate(({ runSaveKey, livesKey, snapshot }) => {
      localStorage.setItem(runSaveKey, JSON.stringify(snapshot));
      localStorage.setItem(livesKey, "1");
    }, {
      runSaveKey: RUN_SAVE_KEY,
      livesKey: LIVES_KEY,
      snapshot: defeatSnapshot
    });
    await save.page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    await dismissBootToMenu(save.page);
    await save.page.keyboard.press("2");
    await waitForState(save.page, (value) => value.phase === "playing", "final-defeat fixture loaded");
    await save.page.keyboard.press("ArrowRight");
    const defeated = await waitForState(
      save.page,
      (value) => value.phase === "dead" && value.prompts.finalGameOver === true,
      "Final Defeat"
    );
    await save.page.waitForFunction(() => {
      const text = document.querySelector("#screenOverlay")?.textContent || "";
      return /All lives lost|Last Light Extinguished|Game Over/iu.test(text);
    });
    const finalDefeatSummary = await save.page.evaluate(() => ({
      overlayText: document.querySelector("#screenOverlay")?.textContent?.replace(/\s+/gu, " ").trim() || "",
      stats: [...document.querySelectorAll("#screenOverlay dt")].map((label) => ({
        label: label.textContent?.trim() || "",
        value: label.nextElementSibling?.textContent?.trim() || ""
      }))
    }));
    assert.match(finalDefeatSummary.overlayText, /All lives lost|Last Light Extinguished|Game Over/iu);
    await writeJson("final-defeat-summary.json", finalDefeatSummary);
    results.screenshots.push(await screenshot(save.page, "08-final-defeat.png"));
    results.checks.finalDefeat = {
      phase: defeated.phase,
      prompt: defeated.prompts.finalGameOver,
      storageKeysAfterReset: await save.page.evaluate((prefix) =>
        Object.keys(localStorage).filter((key) => key.startsWith(prefix)).sort(), STORAGE_PREFIX)
    };
    await save.context.close();

    assert.deepEqual(diagnostics.apiRequests, [], "Practice emitted an /api request");
    assert.deepEqual(diagnostics.consoleErrors, [], "Browser console errors detected");
    assert.deepEqual(diagnostics.pageErrors, [], "Uncaught page errors detected");
    const unexpectedRequestFailures = diagnostics.requestFailures.filter(
      (failure) => failure.failure !== "net::ERR_ABORTED"
    );
    assert.deepEqual(unexpectedRequestFailures, [], "Unexpected HTTP request failures detected");
    results.checks.zeroApiRequestsInPractice = true;
    results.checks.consoleErrors = 0;
    results.checks.pageErrors = 0;
    results.checks.requestFailures = {
      unexpected: unexpectedRequestFailures.length,
      abortedByNavigationOrContextClose: diagnostics.requestFailures.length
    };
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  await writeJson("console-and-network.json", diagnostics);
  await writeJson("baseline-smoke-summary.json", results);
  await fsPromises.rm(path.join(ARTIFACT_ROOT, "baseline-smoke-failure.json"), { force: true });
  process.stdout.write(
    `Online v3 baseline smoke PASS (${HEADLESS ? "headless" : "headed"})\n` +
    `Artifacts: ${ARTIFACT_ROOT}\n`
  );
}

main().catch(async (error) => {
  await fsPromises.mkdir(ARTIFACT_ROOT, { recursive: true });
  await writeJson("baseline-smoke-failure.json", {
    message: String(error?.message || error),
    stack: String(error?.stack || "")
  });
  console.error(error);
  process.exitCode = 1;
});
