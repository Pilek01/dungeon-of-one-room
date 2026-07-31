import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import { promises as fsPromises } from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKER_ROOT = path.join(ROOT, "cloudflare", "leaderboard-v3");
const OUTPUT_ROOT = path.join(ROOT, "output");
const GAME_ROOT = path.join(OUTPUT_ROOT, "pages-dist");
const ARTIFACT_ROOT = path.join(OUTPUT_ROOT, "online-v3-m4-ranked-headed");
const PERSIST_ROOT = path.join(ARTIFACT_ROOT, "state");
const XDG_ROOT = path.join(ARTIFACT_ROOT, "xdg");
const CONFIG = path.join(WORKER_ROOT, "wrangler.local.jsonc");
const WORKER_NODE_MODULES = process.env.DUNGEON_ONLINE_V3_WORKER_NODE_MODULES ||
  path.join(WORKER_ROOT, "node_modules");
const WRANGLER = path.join(WORKER_NODE_MODULES, "wrangler", "bin", "wrangler.js");
const DATABASE = "dungeon-online-v3-local";
const SEASON = "m4-headed";
const HEADLESS = process.argv.includes("--headless");
const execFileAsync = promisify(execFile);

function assertOutputPath(candidate) {
  const output = path.resolve(OUTPUT_ROOT);
  const resolved = path.resolve(candidate);
  assert(resolved.startsWith(`${output}${path.sep}`));
}

function loadPlaywright() {
  const roots = [
    process.env.DUNGEON_PLAYWRIGHT_NODE_MODULES,
    path.join(process.env.USERPROFILE || "", ".codex", "skills", "develop-web-game", "node_modules"),
    path.join(ROOT, "node_modules")
  ].filter(Boolean);
  for (const searchRoot of roots) {
    try {
      return require(require.resolve("playwright", { paths: [searchRoot] }));
    } catch {
      // Try the next repository-scoped or skill-scoped dependency root.
    }
  }
  throw new Error("Playwright is unavailable for the M4 headed Ranked lifecycle.");
}

function environment(extra = {}) {
  return {
    ...process.env,
    CI: "1",
    NO_COLOR: "1",
    WRANGLER_SEND_METRICS: "false",
    XDG_CONFIG_HOME: XDG_ROOT,
    ...extra
  };
}

async function acquirePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address === "object");
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

async function runWrangler(args) {
  return execFileAsync(process.execPath, [WRANGLER, ...args], {
    cwd: WORKER_ROOT,
    env: environment(),
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true
  });
}

async function waitForExit(child, timeoutMs = 5_000) {
  if (child.exitCode !== null) return;
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, timeoutMs))
  ]);
}

async function startWorker(port, secret) {
  const child = spawn(process.execPath, [
    WRANGLER,
    "dev",
    "--local",
    "--config",
    CONFIG,
    "--persist-to",
    PERSIST_ROOT,
    "--ip",
    "127.0.0.1",
    "--port",
    String(port),
    "--log-level",
    "error"
  ], {
    cwd: WORKER_ROOT,
    env: environment({
      CLOUDFLARE_INCLUDE_PROCESS_ENV: "true",
      RANKED_V3_HMAC_SECRET: secret
    }),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  let logs = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { logs += chunk; });
  child.stderr.on("data", (chunk) => { logs += chunk; });
  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Wrangler exited early: ${logs}`);
    try {
      const response = await fetch(`${baseUrl}/api/v3/leaderboard?season=${SEASON}&limit=1`);
      if (response.ok) return { child, baseUrl, getLogs: () => logs };
    } catch {
      // Readiness polling is bounded by the deadline.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Wrangler did not become ready: ${logs}`);
}

function mimeType(filePath) {
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg"
  }[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

async function requestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

async function startGameProxy(workerBaseUrl) {
  const rootPrefix = `${GAME_ROOT}${path.sep}`;
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      if (url.pathname.startsWith("/api/v3/")) {
        const upstream = await fetch(`${workerBaseUrl}${url.pathname}${url.search}`, {
          method: request.method,
          headers: request.headers,
          body: ["GET", "HEAD"].includes(request.method || "GET")
            ? undefined
            : await requestBody(request)
        });
        const bytes = Buffer.from(await upstream.arrayBuffer());
        response.writeHead(upstream.status, {
          "content-type": upstream.headers.get("content-type") || "application/json",
          ...(upstream.headers.get("x-idempotent-replay")
            ? { "x-idempotent-replay": upstream.headers.get("x-idempotent-replay") }
            : {})
        });
        response.end(bytes);
        return;
      }
      const relative = decodeURIComponent(url.pathname) === "/"
        ? "index.html"
        : decodeURIComponent(url.pathname).replace(/^\/+/u, "");
      const candidate = path.resolve(GAME_ROOT, relative);
      if (candidate !== GAME_ROOT && !candidate.startsWith(rootPrefix)) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      const stat = await fsPromises.stat(candidate);
      const filePath = stat.isDirectory() ? path.join(candidate, "index.html") : candidate;
      response.writeHead(200, {
        "content-type": mimeType(filePath),
        "cache-control": "no-store"
      });
      fs.createReadStream(filePath).pipe(response);
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
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function closeServer(server) {
  await new Promise((resolve) => server.close(resolve));
}

async function dismissBoot(page) {
  const boot = page.locator("#bootScreen");
  if (!await boot.evaluate((element) => element.classList.contains("hidden"))) {
    await page.keyboard.press("Enter");
    await page.locator(".boot-loading").waitFor({ state: "visible" });
    await page.keyboard.press("Enter");
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-boot-loading.png"),
      fullPage: true
    });
  }
  await page.waitForFunction(() => document.querySelector("#bootScreen")?.classList.contains("hidden"));
  await page.waitForTimeout(300);
  const readiness = await page.evaluate(() => ({
    phase: (() => {
      try { return JSON.parse(window.render_game_to_text?.() || "{}").phase || ""; }
      catch { return ""; }
    })(),
    bodyClass: document.body.className,
    bootClass: document.querySelector("#bootScreen")?.className || "",
    appClass: document.querySelector("#gameApp")?.className || "",
    overlayClass: document.querySelector("#screenOverlay")?.className || "",
    overlayText: document.querySelector("#screenOverlay")?.textContent?.slice(0, 300) || "",
    mainMenuPresent: Boolean(document.querySelector(".overlay-card-main-menu")),
    mainMenuVisible: Boolean(document.querySelector(".overlay-card-main-menu")?.getClientRects().length)
  }));
  assert.equal(readiness.mainMenuVisible, true, JSON.stringify(readiness));
}

async function openNativeMenuOption(page, title) {
  const option = page.locator(".overlay-menu-row", { hasText: title }).first();
  await option.waitFor({ state: "visible" });
  await option.click();
}

async function openRankedChoice(page, choice) {
  await openNativeMenuOption(page, "Ranked (Online)");
  if (choice === "Start New Ranked") {
    const savedRunChoice = page.getByRole("button", { name: choice, exact: true });
    if (await savedRunChoice.isVisible().catch(() => false)) {
      await savedRunChoice.click();
    }
    return;
  }
  await page.getByRole("heading", { name: "Ranked (Online)", exact: true }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: choice, exact: true }).click();
}

async function seedStaleRankedProfile(page) {
  return page.evaluate(async (season) => {
    const protocol = window.DungeonRankedV3Protocol;
    const storage = window.DungeonRankedV3Storage;
    const credential = (fill) => {
      const bytes = new Uint8Array(32);
      bytes.fill(fill);
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
    };
    const profileId = `profile_${crypto.randomUUID().replaceAll("-", "")}`;
    const profileCredential = credential(8);
    const staleCredential = credential(9);
    const recoveryCredential = credential(10);
    const startOperationId = `op_${crypto.randomUUID().replaceAll("-", "")}`;
    const startBody = {
      playerName: "StaleProfile",
      season,
      gameVersion: String(window.DUNGEON_GAME_VERSION || window.GAME_VERSION || "v0.8.0"),
      rulesetId: protocol.RULESET_ID,
      rulesetHash: protocol.RULESET_HASH,
      clientInstallIdHash: "a".repeat(64),
      profileId,
      profileCredential,
      recoveryCredential,
      clientProtocolVersion: protocol.PROTOCOL_VERSION
    };
    const startedResponse = await fetch(protocol.ENDPOINTS.start.path, {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": startOperationId },
      body: JSON.stringify(startBody)
    });
    const started = await startedResponse.json();
    if (!startedResponse.ok) throw new Error(`STALE_PROFILE_SEED_START:${JSON.stringify(started)}`);
    const abandonOperationId = `op_${crypto.randomUUID().replaceAll("-", "")}`;
    const abandonResponse = await fetch(protocol.ENDPOINTS.abandon.path, {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": abandonOperationId },
      body: JSON.stringify({
        operationId: abandonOperationId,
        runId: started.runId,
        recoveryCredential,
        clientProtocolVersion: protocol.PROTOCOL_VERSION,
        lastKnownRevision: started.revision
      })
    });
    if (!abandonResponse.ok) throw new Error(`STALE_PROFILE_SEED_ABANDON:${await abandonResponse.text()}`);
    localStorage.setItem(storage.STORAGE_KEYS.profile, storage.serialize({
      profileId,
      profileCredential: staleCredential
    }));
    localStorage.removeItem(storage.STORAGE_KEYS.session);
    localStorage.removeItem(storage.STORAGE_KEYS.recovery);
    localStorage.removeItem(storage.STORAGE_KEYS.writerLease);
    return { profileId, seedRunId: started.runId };
  }, SEASON);
}

async function seedRankedStoragePressure(page) {
  return page.evaluate(() => {
    const storage = window.DungeonRankedV3Storage;
    localStorage.setItem("dungeonRankedV2Active", "v".repeat(1024 * 1024));
    localStorage.setItem(storage.STORAGE_KEYS.leaderboardCache, "c".repeat(256 * 1024));
    localStorage.setItem("dungeonOneRoomRunSave", "practice-sentinel-v3");
    localStorage.setItem("dungeonPracticeV2Active", "practice-sentinel-v2");
    let blocks = 0;
    let quotaError = null;
    for (const size of [256 * 1024, 64 * 1024, 16 * 1024, 4 * 1024, 1024, 256, 64, 16, 4, 1]) {
      const block = "x".repeat(size);
      for (;;) {
        try {
          localStorage.setItem(`rankedStorageQuotaHeaded:${blocks}`, block);
          blocks += 1;
        } catch (error) {
          quotaError = error;
          break;
        }
      }
    }
    return {
      blocks,
      errorName: String(quotaError?.name || ""),
      errorCode: Number(quotaError?.code || 0)
    };
  });
}

async function auditAndClearRankedStoragePressure(page) {
  return page.evaluate(() => {
    const storage = window.DungeonRankedV3Storage;
    const audit = {
      legacyRankedV2: localStorage.getItem("dungeonRankedV2Active"),
      leaderboardCache: localStorage.getItem(storage.STORAGE_KEYS.leaderboardCache),
      practice: localStorage.getItem("dungeonOneRoomRunSave"),
      practiceV2: localStorage.getItem("dungeonPracticeV2Active"),
      fillerCount: Object.keys(localStorage)
        .filter((key) => key.startsWith("rankedStorageQuotaHeaded:"))
        .length
    };
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("rankedStorageQuotaHeaded:")) localStorage.removeItem(key);
    }
    localStorage.removeItem("dungeonOneRoomRunSave");
    localStorage.removeItem("dungeonPracticeV2Active");
    return audit;
  });
}

async function abandonCurrentRankedAndClearLocal(page) {
  return page.evaluate(async () => {
    const protocol = window.DungeonRankedV3Protocol;
    const storageApi = window.DungeonRankedV3Storage;
    const store = storageApi.createStore(localStorage);
    const recovery = store.loadRecovery();
    const snapshot = store.loadSession();
    if (!recovery?.runId || !snapshot?.runId) throw new Error("RANKED_CLEANUP_STATE_MISSING");
    const operationId = `op_${crypto.randomUUID().replaceAll("-", "")}`;
    const response = await fetch(protocol.ENDPOINTS.abandon.path, {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": operationId },
      body: JSON.stringify({
        operationId,
        runId: recovery.runId,
        recoveryCredential: recovery.recoveryCredential,
        clientProtocolVersion: protocol.PROTOCOL_VERSION,
        lastKnownRevision: snapshot.revision
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(`RANKED_CLEANUP_ABANDON:${JSON.stringify(payload)}`);
    window.dispatchEvent(new Event("beforeunload"));
    for (const key of Object.keys(localStorage)) {
      if (storageApi.isOwnedKey(key)) localStorage.removeItem(key);
    }
    return { runId: recovery.runId, status: payload.metaState?.status };
  });
}

async function chooseRelicWithoutFatalPrevention(page) {
  const choiceIndex = await page.evaluate(() => {
    const state = window.DungeonOnlineV3?.getSnapshot?.()?.publicState;
    const choices = state?.startingRelicOffer?.publicChoices || state?.relicOffer?.publicChoices || [];
    const safeIndex = choices.findIndex((choice) => choice?.relicId !== "chronoloop");
    return safeIndex >= 0 ? safeIndex : 0;
  });
  await page.locator(".ranked-v3-choice-relic").nth(choiceIndex).click();
}

async function sessionState(page, expected, diagnostics = null) {
  try {
    await page.waitForFunction(
      (value) => window.DungeonOnlineV3?.getSessionState?.() === value,
      expected,
      { timeout: 15_000 }
    );
  } catch (error) {
    const actual = await page.evaluate(() => ({
      sessionState: window.DungeonOnlineV3?.getSessionState?.() || null,
      snapshot: window.DungeonOnlineV3?.getSnapshot?.() || null,
      overlayText: document.querySelector(".ranked-v3-overlay:not(.hidden)")?.innerText || "",
      game: JSON.parse(window.render_game_to_text())
    }));
    throw new Error(`Expected Ranked session ${expected}: ${JSON.stringify({
      ...actual,
      network: diagnostics
    })}`, { cause: error });
  }
}

async function visibleGameState(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
}

async function runDebugAction(page, menuKey, actionKey, actionName) {
  await page.keyboard.press(menuKey);
  const menu = page.locator(".overlay-card-debug-cheats");
  await menu.waitFor({ state: "visible" });
  await menu.getByText(actionName, { exact: true }).waitFor({ state: "visible" });
  await page.keyboard.press(actionKey);
  await page.keyboard.press(menuKey);
  await menu.waitFor({ state: "hidden" });
}

async function clearVisibleRoom(page) {
  await runDebugAction(page, "F9", "5", "Clear Room");
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).roomCleared === true);
}

async function crossVisiblePortal(page, expectedDepth) {
  assert.equal(await page.evaluate(() => window.__DUNGEON_TEST_CROSS_PORTAL?.()), true);
  await page.waitForFunction(
    (depth) => {
      const game = JSON.parse(window.render_game_to_text());
      return game.depth >= depth && window.DungeonOnlineV3?.getSessionState?.() === "ROOM_ACTIVE";
    },
    expectedDepth,
    { timeout: 30_000 }
  );
  const state = await visibleGameState(page);
  assert.equal(state.depth, expectedDepth);
  assert.notEqual(state.latestLog, "Online v3 is still resolving the next room.");
}

async function advanceVisibleRoom(page, expectedDepth) {
  const sourceRoom = await visibleGameState(page);
  await clearVisibleRoom(page);
  if (sourceRoom.roomType !== "merchant") {
    await sessionState(page, "ENTERING_NEXT_ROOM");
  }
  await crossVisiblePortal(page, expectedDepth);
  return sourceRoom;
}

async function d1Count(runId) {
  const sql = `SELECT COUNT(*) AS count FROM leaderboard_entries WHERE run_id = '${runId}'`;
  const { stdout } = await runWrangler([
    "d1",
    "execute",
    DATABASE,
    "--local",
    "--config",
    CONFIG,
    "--persist-to",
    PERSIST_ROOT,
    "--command",
    sql,
    "--json"
  ]);
  return Number(JSON.parse(stdout)[0].results[0].count);
}

async function main() {
  assertOutputPath(ARTIFACT_ROOT);
  await fsPromises.rm(ARTIFACT_ROOT, { recursive: true, force: true });
  await fsPromises.mkdir(PERSIST_ROOT, { recursive: true });
  await fsPromises.mkdir(XDG_ROOT, { recursive: true });
  const version = await runWrangler(["--version"]);
  assert.equal(version.stdout.trim(), "4.114.0");
  await runWrangler([
    "d1",
    "migrations",
    "apply",
    DATABASE,
    "--local",
    "--config",
    CONFIG,
    "--persist-to",
    PERSIST_ROOT
  ]);

  await execFileAsync(process.execPath, [path.join(ROOT, "scripts", "build-pages-v3.mjs")], {
    cwd: ROOT,
    env: environment(),
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true
  });
  const headedConfigPath = path.join(GAME_ROOT, "config.js");
  const headedConfig = await fsPromises.readFile(headedConfigPath, "utf8");
  const debugDisabled = "window.DUNGEON_DEBUG_CHEATS_ENABLED = false;";
  assert(headedConfig.includes(debugDisabled));
  await fsPromises.writeFile(
    headedConfigPath,
    headedConfig.replace(debugDisabled, "window.DUNGEON_DEBUG_CHEATS_ENABLED = true;"),
    "utf8"
  );
  const headedGamePath = path.join(GAME_ROOT, "game.js");
  const headedGame = await fsPromises.readFile(headedGamePath, "utf8");
  const fatalTestHookAnchor = "  window.render_game_to_text = renderGameToText;";
  assert(headedGame.includes(fatalTestHookAnchor));
  const fatalTestHook = `  window.__DUNGEON_TEST_TRIGGER_FATAL = (reason = "Headed fatal event") => {
    if (!canUseDebugCheats() || state.phase !== "playing") return false;
    state.player.hp = 0;
    gameOver(String(reason || "Headed fatal event"));
    return true;
  };
  window.__DUNGEON_TEST_CROSS_PORTAL = () => {
    if (!canUseDebugCheats() || state.phase !== "playing" || !state.roomCleared || !state.portal) return false;
    state.player.x = state.portal.x;
    state.player.y = state.portal.y;
    attemptDescend();
    return true;
  };
  window.__DUNGEON_TEST_USE_POTION = () => {
    if (!canUseDebugCheats() || state.phase !== "playing" || state.player.potions <= 0) return false;
    const before = state.player.potions;
    state.player.hp = Math.max(1, state.player.maxHp - 1);
    drinkPotion();
    return state.player.potions === before - 1;
  };

${fatalTestHookAnchor}`;
  await fsPromises.writeFile(
    headedGamePath,
    headedGame.replace(fatalTestHookAnchor, fatalTestHook),
    "utf8"
  );
  const secret = randomBytes(48).toString("base64url");
  const worker = await startWorker(await acquirePort(), secret);
  const proxy = await startGameProxy(worker.baseUrl);
  const diagnostics = {
    apiRequests: [],
    apiErrors: [],
    debugMessages: [],
    consoleErrors: [],
    pageErrors: [],
    finalizeOperationIds: [],
    checkpointBodies: []
  };
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: HEADLESS });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript((season) => {
      window.DUNGEON_ONLINE_V3_SEASON = season;
      window.DUNGEON_ONLINE_V3_DEBUG = true;
      window.__dungeonPlayedAudio = [];
      const originalAudioPlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function trackDungeonAudio(...args) {
        window.__dungeonPlayedAudio.push(new URL(this.currentSrc || this.src, location.href).pathname);
        return originalAudioPlay.apply(this, args);
      };
      localStorage.setItem("dungeonOneRoomPlayerName", "M4Headed");
      localStorage.setItem("dungeonOneRoomGraphicsMode", "hd");
      localStorage.setItem("dungeonOneRoomTutorialRunSeenV1", "1");
    }, SEASON);
    let page = await context.newPage();
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/api/v3/")) {
        diagnostics.apiRequests.push({ method: request.method(), path: url.pathname });
        if (url.pathname === "/api/v3/runs/checkpoint") {
          diagnostics.checkpointBodies.push(JSON.parse(request.postData() || "{}"));
        }
        if (url.pathname === "/api/v3/runs/finalize") {
          diagnostics.finalizeOperationIds.push(request.headers()["idempotency-key"] || "");
        }
      }
    });
    page.on("response", async (response) => {
      const url = new URL(response.url());
      if (url.pathname.startsWith("/api/v3/") && !response.ok()) {
        diagnostics.apiErrors.push({
          status: response.status(),
          path: url.pathname,
          body: await response.text().catch(() => "")
        });
      }
    });
    page.on("console", (message) => {
      if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
      if (message.type() === "debug") diagnostics.debugMessages.push(message.text());
    });
    page.on("pageerror", (error) => diagnostics.pageErrors.push(String(error?.stack || error)));

    await page.goto(`${proxy.baseUrl}/`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof window.render_game_to_text === "function");
    await dismissBoot(page);
    const nativeMenuText = await page.locator(".overlay-menu").innerText();
    assert.match(nativeMenuText, /Practice \(Offline\)[\s\S]*Ranked \(Online\)[\s\S]*Ranked Leaderboard/u);
    assert.equal(await page.locator(".overlay-menu-row", { hasText: /^Continue$/u }).count(), 0);
    assert.equal(await page.locator(".ranked-v3-entry:visible").count(), 0);
    assert.equal(await page.locator(".ranked-v3-leaderboard-entry:visible").count(), 0);
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-native-menu.png"),
      fullPage: true
    });

    const storagePressure = await seedRankedStoragePressure(page);
    assert.equal(storagePressure.errorName, "QuotaExceededError", JSON.stringify(storagePressure));
    assert.equal(storagePressure.errorCode, 22, JSON.stringify(storagePressure));
    const quotaApiBefore = diagnostics.apiRequests.length;
    await openRankedChoice(page, "Start New Ranked");
    await page.locator(".ranked-v3-choice-relic").first().waitFor({ state: "visible" });
    assert.equal(
      diagnostics.apiRequests.slice(quotaApiBefore)
        .some((entry) => entry.path === "/api/v3/runs/start"),
      true
    );
    assert.equal(await page.getByRole("heading", { name: "Ranked Unavailable" }).count(), 0);
    const quotaAudit = await auditAndClearRankedStoragePressure(page);
    assert.equal(quotaAudit.legacyRankedV2, null);
    assert.equal(quotaAudit.leaderboardCache, null);
    assert.equal(quotaAudit.practice, "practice-sentinel-v3");
    assert.equal(quotaAudit.practiceV2, "practice-sentinel-v2");
    assert(quotaAudit.fillerCount > 0);
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-storage-quota-recovered.png"),
      fullPage: true
    });
    const quotaCleanup = await abandonCurrentRankedAndClearLocal(page);
    assert.equal(quotaCleanup.status, "abandoned");
    await page.reload({ waitUntil: "domcontentloaded" });
    await dismissBoot(page);

    const staleProfile = await seedStaleRankedProfile(page);
    const staleErrorsBefore = diagnostics.apiErrors.length;
    await openRankedChoice(page, "Start New Ranked");
    await page.locator(".ranked-v3-choice-relic").first().waitFor({ state: "visible" });
    const repairedProfile = await page.evaluate(() => (
      window.DungeonRankedV3Storage.createStore(localStorage).loadProfile()
    ));
    const repairedRunId = await page.evaluate(() => window.DungeonOnlineV3.getSnapshot().runId);
    assert.notEqual(repairedProfile.profileId, staleProfile.profileId);
    assert.notEqual(repairedRunId, staleProfile.seedRunId);
    assert.equal(
      diagnostics.apiErrors.slice(staleErrorsBefore).some((entry) => /PROFILE_UNAUTHORIZED/u.test(entry.body)),
      false,
      JSON.stringify(diagnostics.apiErrors.slice(staleErrorsBefore))
    );
    assert.equal(await page.getByRole("heading", { name: "Ranked reconnect required" }).count(), 0);
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-stale-profile-repaired.png"),
      fullPage: true
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await dismissBoot(page);
    await openNativeMenuOption(page, "Ranked (Online)");
    await page.getByRole("heading", { name: "Ranked (Online)", exact: true }).waitFor({ state: "visible" });
    const savedMenuBox = await page.locator(".ranked-v3-card-menu").boundingBox();
    const savedActionsBox = await page.locator(".ranked-v3-card-menu .ranked-v3-actions").boundingBox();
    assert(savedMenuBox && savedMenuBox.width <= 500, JSON.stringify(savedMenuBox));
    assert(savedActionsBox && savedActionsBox.width <= 360, JSON.stringify(savedActionsBox));
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-saved-run-menu.png"),
      fullPage: true
    });
    await page.keyboard.press("ArrowDown");
    assert.equal(
      await page.evaluate(() => document.activeElement?.textContent?.trim()),
      "Continue Ranked",
      "ArrowDown did not move focus through the saved Ranked menu"
    );
    await page.keyboard.press("ArrowUp");
    assert.equal(
      await page.evaluate(() => document.activeElement?.textContent?.trim()),
      "Start New Ranked",
      "ArrowUp did not move focus back through the saved Ranked menu"
    );
    let savedRunRestartAbandonAttempts = 0;
    await page.route("**/api/v3/runs/abandon", async (route) => {
      savedRunRestartAbandonAttempts += 1;
      await route.abort("failed");
    });
    await page.getByRole("button", { name: "Start New Ranked", exact: true }).click();
    await page.getByRole("heading", { name: "Ranked reconnect required" }).waitFor({
      state: "visible",
      timeout: 20_000
    });
    await sessionState(page, "RECONNECT_REQUIRED");
    assert.equal(savedRunRestartAbandonAttempts, 3, "Saved-run restart did not exhaust the exact retry policy");
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-saved-run-restart-recovery.png"),
      fullPage: true
    });
    await page.unroute("**/api/v3/runs/abandon");
    await page.getByRole("button", { name: "Resync Ranked Run" }).click();
    await page.locator(".ranked-v3-choice-relic").first().waitFor({ state: "visible" });
    await sessionState(page, "AWAITING_STARTING_RELIC");
    const savedRunId = await page.evaluate(() => window.DungeonOnlineV3.getSnapshot().runId);
    await page.reload({ waitUntil: "domcontentloaded" });
    await dismissBoot(page);
    await openNativeMenuOption(page, "Ranked (Online)");
    await page.getByRole("heading", { name: "Ranked (Online)", exact: true }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Start New Ranked", exact: true }).click();
    await page.locator(".ranked-v3-choice-relic").first().waitFor({ state: "visible" });
    await sessionState(page, "AWAITING_STARTING_RELIC");
    const freshRestartRunId = await page.evaluate(() => window.DungeonOnlineV3.getSnapshot().runId);
    assert.notEqual(freshRestartRunId, savedRunId, "Start New Ranked reused the saved run");
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-saved-run-restart-success.png"),
      fullPage: true
    });
    const staleCleanup = await abandonCurrentRankedAndClearLocal(page);
    assert.equal(staleCleanup.status, "abandoned");
    await page.reload({ waitUntil: "domcontentloaded" });
    await dismissBoot(page);

    const practiceApiBefore = diagnostics.apiRequests.length;
    await openNativeMenuOption(page, "Practice (Offline)");
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === "relic");
    await page.keyboard.press("1");
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === "playing");
    await page.keyboard.press("Escape");
    const pauseMenuText = await page.locator(".overlay-menu").innerText();
    assert.match(pauseMenuText, /Main Menu[\s\S]*Continue/u);
    assert.doesNotMatch(pauseMenuText, /Practice \(Offline\)/u);
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "practice-pause-main-menu.png"),
      fullPage: true
    });
    await openNativeMenuOption(page, "Main Menu");
    await openNativeMenuOption(page, "Practice (Offline)");
    await page.locator(".overlay-menu-row", { hasText: "Load Continue" }).waitFor({ state: "visible" });
    await openNativeMenuOption(page, "Load Continue");
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === "playing");
    assert.equal(diagnostics.apiRequests.length, practiceApiBefore, "Practice emitted an Online v3 API request");
    await page.keyboard.press("Escape");
    await openNativeMenuOption(page, "Main Menu");

    await openRankedChoice(page, "Start New Ranked");
    await page.locator(".ranked-v3-choice-relic").first().waitFor({ state: "visible" });
    assert.equal(await page.locator(".ranked-v3-entry:visible").count(), 0);
    assert.equal(await page.locator(".ranked-v3-leaderboard-entry:visible").count(), 0);
    assert.equal(await page.getByText("fang", { exact: true }).count(), 0);
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-starting-relic.png"),
      fullPage: true
    });
    await chooseRelicWithoutFatalPrevention(page);
    await sessionState(page, "ROOM_ACTIVE", diagnostics);
    const runId = await page.evaluate(() => window.DungeonOnlineV3.getSnapshot().runId);
    assert.match(runId, /^run_[a-f0-9]+$/u);

    const requestsBeforeCombatWait = diagnostics.apiRequests.length;
    await page.waitForTimeout(500);
    assert.equal(
      diagnostics.apiRequests.length,
      requestsBeforeCombatWait,
      "Active local combat emitted a network request"
    );

    const ownerPage = page;
    const observerPage = await context.newPage();
    observerPage.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/api/v3/")) {
        diagnostics.apiRequests.push({ method: request.method(), path: url.pathname });
        if (url.pathname === "/api/v3/runs/checkpoint") {
          diagnostics.checkpointBodies.push(JSON.parse(request.postData() || "{}"));
        }
        if (url.pathname === "/api/v3/runs/finalize") {
          diagnostics.finalizeOperationIds.push(request.headers()["idempotency-key"] || "");
        }
      }
    });
    observerPage.on("response", async (response) => {
      const url = new URL(response.url());
      if (url.pathname.startsWith("/api/v3/") && !response.ok()) {
        diagnostics.apiErrors.push({
          status: response.status(),
          path: url.pathname,
          body: await response.text().catch(() => "")
        });
      }
    });
    observerPage.on("console", (message) => {
      if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
      if (message.type() === "debug") diagnostics.debugMessages.push(message.text());
    });
    observerPage.on("pageerror", (error) => diagnostics.pageErrors.push(String(error?.stack || error)));
    await observerPage.goto(`${proxy.baseUrl}/`, { waitUntil: "domcontentloaded" });
    await observerPage.waitForFunction(() => typeof window.render_game_to_text === "function");
    await dismissBoot(observerPage);
    await openRankedChoice(observerPage, "Continue Ranked");

    await sessionState(observerPage, "RECONNECT_REQUIRED");
    await observerPage.getByRole("button", { name: "Request control" }).waitFor({ state: "visible" });
    assert.equal(await ownerPage.evaluate(() => window.DungeonOnlineV3.getSessionState()), "ROOM_ACTIVE");
    await ownerPage.evaluate(() => window.dispatchEvent(new Event("beforeunload")));
    await ownerPage.close();
    await observerPage.getByRole("button", { name: "Request control" }).click();
    await sessionState(observerPage, "ROOM_ACTIVE");
    assert.equal(
      await observerPage.evaluate(() => window.DungeonOnlineV3.getSnapshot().runId),
      runId
    );
    page = observerPage;

    await page.reload({ waitUntil: "domcontentloaded" });
    await dismissBoot(page);
    await openRankedChoice(page, "Continue Ranked");

    await sessionState(page, "ROOM_ACTIVE");
    assert.equal(
      await page.evaluate(() => window.DungeonOnlineV3.getSnapshot().runId),
      runId
    );

    const firstRoom = await visibleGameState(page);
    const firstCanonicalGold = await page.evaluate(() => (
      window.DungeonOnlineV3.getSnapshot()?.publicState?.gold || 0
    ));
    await clearVisibleRoom(page);
    await sessionState(page, "ENTERING_NEXT_ROOM");
    const firstGoldAudit = await page.evaluate(() => ({
      game: JSON.parse(window.render_game_to_text()),
      canonicalGold: window.DungeonOnlineV3.getSnapshot()?.publicState?.gold || 0,
      logText: document.getElementById("log")?.innerText || ""
    }));
    const firstCheckpoint = diagnostics.checkpointBodies.at(-1);
    assert(firstCheckpoint, "First Ranked clear did not send a checkpoint body");
    assert.equal(
      firstCheckpoint.rewardClaims
        .filter((claim) => ["enemy", "elite", "hazard"].includes(claim.claimType))
        .reduce((sum, claim) => sum + claim.count, 0),
      firstRoom.enemies.length
    );
    assert(firstGoldAudit.canonicalGold > firstCanonicalGold);
    assert.equal(firstGoldAudit.game.player.gold, firstGoldAudit.canonicalGold);
    assert.match(firstGoldAudit.logText, /Room clear bonus: \+\d+ gold\./u);
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-room-clear-gold-parity.png"),
      fullPage: true
    });
    await crossVisiblePortal(page, firstRoom.depth + 1);

    await advanceVisibleRoom(page, firstRoom.depth + 2);
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-two-player-portals.png"),
      fullPage: true
    });

    await advanceVisibleRoom(page, firstRoom.depth + 3);

    const requestsBeforePreWardenClear = diagnostics.apiRequests.length;
    const preWardenSourceRoom = await visibleGameState(page);
    await clearVisibleRoom(page);
    const merchantBoundary = preWardenSourceRoom.roomType === "merchant";
    if (merchantBoundary) {
      await crossVisiblePortal(page, firstRoom.depth + 4);
    } else {
      await sessionState(page, "ENTERING_NEXT_ROOM");
    }
    const preWardenAudit = await page.evaluate(() => {
      const snapshot = window.DungeonOnlineV3.getSnapshot();
      return {
        game: JSON.parse(window.render_game_to_text()),
        session: window.DungeonOnlineV3.getSessionState(),
        directive: snapshot?.publicState?.currentRoomDirective || null,
        rewardSlots: snapshot?.publicState?.currentRewardEnvelope?.rewardSlots || [],
        visibleRelicChoices: [...document.querySelectorAll(".ranked-v3-choice-relic")]
          .filter((element) => element.getClientRects().length).length,
        visibleOnlineOverlay: [...document.querySelectorAll(".ranked-v3-overlay")]
          .filter((element) => element.getClientRects().length).length
      };
    });
    assert.equal(preWardenAudit.directive?.depth, firstRoom.depth + 4, JSON.stringify(preWardenAudit));
    assert.equal(preWardenAudit.directive?.roomType, "boss", JSON.stringify(preWardenAudit));
    assert(
      preWardenAudit.rewardSlots.some((slot) => String(slot?.sourceId || "").includes("warden")),
      JSON.stringify(preWardenAudit)
    );
    assert.equal(preWardenAudit.visibleRelicChoices, 0, JSON.stringify(preWardenAudit));
    assert.equal(preWardenAudit.visibleOnlineOverlay, 0, JSON.stringify(preWardenAudit));
    assert.equal(
      diagnostics.apiRequests.length - requestsBeforePreWardenClear,
      1,
      "Ordinary room clear issued a next-room Warden relic before entering or clearing the boss"
    );
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-ordinary-clear-before-warden.png"),
      fullPage: true
    });

    if (!merchantBoundary) {
      await crossVisiblePortal(page, firstRoom.depth + 4);
    }
    assert.equal(await page.locator(".ranked-v3-choice-relic:visible").count(), 0);
    const wardenPotionsBefore = await page.evaluate(() => (
      window.DungeonOnlineV3.getSnapshot()?.publicState?.build?.resources?.potions || 0
    ));
    assert(wardenPotionsBefore > 0, "Warden potion regression requires a canonical potion");
    assert.equal(await page.evaluate(() => window.__DUNGEON_TEST_USE_POTION?.()), true);
    await clearVisibleRoom(page);
    await page.waitForFunction(() => [
      "AWAITING_REWARD_OR_TRANSACTION",
      "ENTERING_NEXT_ROOM"
    ].includes(window.DungeonOnlineV3?.getSessionState?.()), null, { timeout: 15_000 });
    if (await page.locator(".ranked-v3-choice-relic:visible").count() > 0) {
      await page.screenshot({
        path: path.join(ARTIFACT_ROOT, "ranked-warden-relic-after-clear.png"),
        fullPage: true
      });
      await chooseRelicWithoutFatalPrevention(page);
      await sessionState(page, "ENTERING_NEXT_ROOM");
    } else {
      await sessionState(page, "ENTERING_NEXT_ROOM");
    }
    const wardenCheckpoint = diagnostics.checkpointBodies.at(-1);
    assert(wardenCheckpoint, "Warden clear did not send a checkpoint body");
    assert.deepEqual(
      wardenCheckpoint.rewardClaims.filter((claim) => claim.claimType === "resource"),
      [{ claimType: "resource", claimId: "potion-use", count: 1 }]
    );
    const postWardenAudit = await page.evaluate(() => ({
      session: window.DungeonOnlineV3.getSessionState(),
      potions: window.DungeonOnlineV3.getSnapshot()?.publicState?.build?.resources?.potions || 0,
      reconnectVisible: [...document.querySelectorAll(".ranked-v3-overlay h1, .ranked-v3-overlay h2")]
        .some((element) => element.getClientRects().length && /reconnect required/iu.test(element.textContent || "")),
      game: JSON.parse(window.render_game_to_text())
    }));
    assert.equal(postWardenAudit.potions, wardenPotionsBefore - 1, JSON.stringify(postWardenAudit));
    assert.equal(postWardenAudit.reconnectVisible, false, JSON.stringify(postWardenAudit));
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-warden-potion-checkpoint.png"),
      fullPage: true
    });
    await crossVisiblePortal(page, firstRoom.depth + 5);

    const livesBeforeDeath = await page.evaluate(() => (
      window.DungeonOnlineV3.getSnapshot()?.publicState?.lives || 0
    ));
    const audioBeforeDeath = await page.evaluate(() => window.__dungeonPlayedAudio.length);
    assert(livesBeforeDeath > 1, "Headed death check requires a nonterminal life");
    assert.equal(
      await page.evaluate(() => window.__DUNGEON_TEST_TRIGGER_FATAL("Headed nonterminal fatal event")),
      true
    );
    await page.waitForFunction(() => {
      const game = JSON.parse(window.render_game_to_text());
      return game.phase === "dead" && window.DungeonOnlineV3?.getSessionState?.() === "ENTERING_NEXT_ROOM";
    }, null, { timeout: 15_000 });
    const deathAudit = await page.evaluate((audioStart) => {
      const snapshot = window.DungeonOnlineV3.getSnapshot();
      const game = JSON.parse(window.render_game_to_text());
      return {
        game,
        session: window.DungeonOnlineV3.getSessionState(),
        lives: snapshot?.publicState?.lives || 0,
        nextDepth: snapshot?.publicState?.currentRoomDirective?.depth || 0,
        nativeDeathVisible: Boolean(document.querySelector(".death-requiem")?.getClientRects().length),
        onlineOverlayVisible: Boolean(document.querySelector(".ranked-v3-overlay")?.getClientRects().length),
        playedAudio: window.__dungeonPlayedAudio.slice(audioStart)
      };
    }, audioBeforeDeath);
    assert.equal(deathAudit.lives, livesBeforeDeath - 1, JSON.stringify(deathAudit));
    assert.equal(deathAudit.nativeDeathVisible, true, JSON.stringify(deathAudit));
    assert.equal(deathAudit.onlineOverlayVisible, false, JSON.stringify(deathAudit));
    assert.match(deathAudit.game.overlayText, /You Died[\s\S]*Rise Again/u);
    assert(
      deathAudit.playedAudio.some((audioPath) => audioPath.endsWith("/assets/death.mp3")),
      JSON.stringify(deathAudit)
    );
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-nonterminal-death.png"),
      fullPage: true
    });
    await page.keyboard.press("r");
    await sessionState(page, "ROOM_ACTIVE");
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === "playing");
    const resumedAfterDeath = await visibleGameState(page);
    assert.equal(resumedAfterDeath.depth, deathAudit.nextDepth, JSON.stringify({ deathAudit, resumedAfterDeath }));
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-after-death-continue.png"),
      fullPage: true
    });

    let droppedFinalizeResponse = false;
    await page.route("**/api/v3/runs/finalize", async (route) => {
      if (!droppedFinalizeResponse) {
        droppedFinalizeResponse = true;
        await route.fetch();
        await route.abort("failed");
        return;
      }
      await route.continue();
    });

    for (let index = 0; index < 8; index += 1) {
      const status = await page.evaluate(() => window.DungeonOnlineV3.getSnapshot()?.publicState?.status);
      if (["victory", "defeat", "extraction"].includes(status)) break;
      assert.equal(
        await page.evaluate(() => window.__DUNGEON_TEST_TRIGGER_FATAL("Headed terminal fatal event")),
        true
      );
      await page.waitForFunction(() => {
        const nextStatus = window.DungeonOnlineV3.getSnapshot()?.publicState?.status;
        const nextSession = window.DungeonOnlineV3.getSessionState();
        return ["victory", "defeat", "extraction"].includes(nextStatus) ||
          ["ROOM_ACTIVE", "ENTERING_NEXT_ROOM"].includes(nextSession);
      }, null, { timeout: 15_000 });
      const afterFatal = await page.evaluate(() => ({
        status: window.DungeonOnlineV3.getSnapshot()?.publicState?.status || "",
        session: window.DungeonOnlineV3.getSessionState(),
        phase: JSON.parse(window.render_game_to_text()).phase
      }));
      if (["victory", "defeat", "extraction"].includes(afterFatal.status)) break;
      if (afterFatal.session === "ENTERING_NEXT_ROOM" && afterFatal.phase === "dead") {
        await page.keyboard.press("Enter");
        await sessionState(page, "ROOM_ACTIVE");
        await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === "playing");
      } else {
        assert.equal(afterFatal.session, "ROOM_ACTIVE", JSON.stringify(afterFatal));
      }
    }
    const terminalAudit = await page.evaluate(() => ({
      status: window.DungeonOnlineV3.getSnapshot()?.publicState?.status || "",
      session: window.DungeonOnlineV3.getSessionState(),
      game: JSON.parse(window.render_game_to_text()),
      overlay: document.querySelector(".ranked-v3-overlay")?.textContent || "",
      nativeFinalVisible: Boolean(
        document.querySelector(".overlay-card-gameover, .gameover-requiem")?.getClientRects().length
      )
    }));
    assert(
      ["victory", "defeat", "extraction"].includes(terminalAudit.status),
      `Fatal-event loop did not reach terminal state: ${JSON.stringify({
        ...terminalAudit,
        apiErrors: diagnostics.apiErrors,
        debugMessages: diagnostics.debugMessages
      })}`
    );
    assert.equal(
      await page.evaluate(() => window.DungeonOnlineV3.getSnapshot().publicState.status),
      "defeat"
    );
    assert.equal(terminalAudit.game.phase, "dead", JSON.stringify(terminalAudit));
    assert.equal(terminalAudit.game.prompts.finalGameOver, true, JSON.stringify(terminalAudit));
    assert.equal(terminalAudit.nativeFinalVisible, true, JSON.stringify(terminalAudit));
    assert.match(terminalAudit.game.overlayText, /Game Over[\s\S]*Lives Spent5[\s\S]*Main Menu/iu);
    assert.doesNotMatch(terminalAudit.overlay, /reconnect|required|unavailable/iu);
    await sessionState(page, "FINALIZED");
    assert.equal(droppedFinalizeResponse, true);
    assert.equal(diagnostics.finalizeOperationIds.length, 2);
    assert.equal(
      new Set(diagnostics.finalizeOperationIds).size,
      1,
      "Lost finalize response changed the logical operation ID"
    );
    assert.equal(await d1Count(runId), 1);

    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-finalized.png"),
      fullPage: true
    });
    await page.keyboard.press("r");
    await page.waitForTimeout(250);
    assert.equal(
      await page.evaluate(() => JSON.parse(window.render_game_to_text()).prompts.finalGameOver),
      true,
      "Terminal Ranked defeat allowed Rise Again"
    );
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === "menu");
    const postTerminalPracticeApiBefore = diagnostics.apiRequests.length;
    await openNativeMenuOption(page, "Practice (Offline)");
    await page.locator(".overlay-menu-row", { hasText: "Start New Game" }).click();
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === "relic");
    await page.keyboard.press("1");
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === "playing");
    assert.equal(
      diagnostics.apiRequests.length,
      postTerminalPracticeApiBefore,
      "Practice after terminal Ranked emitted an Online v3 API request"
    );
    await page.keyboard.press("Escape");
    await openNativeMenuOption(page, "Main Menu");
    await page.reload({ waitUntil: "domcontentloaded" });
    await dismissBoot(page);
    await openNativeMenuOption(page, "Ranked Leaderboard");

    await page.locator(".ranked-v3-leaderboard-row").waitFor({ state: "visible" });
    assert.match(
      await page.locator(".ranked-v3-leaderboard-row").first().textContent(),
      /M4Headed/u
    );
    await page.getByRole("button", { name: "Build details" }).first().click();
    await page.locator(".ranked-v3-leaderboard-detail").waitFor({ state: "visible" });
    assert.match(
      await page.locator(".ranked-v3-leaderboard-detail").textContent(),
      /Relics/u
    );
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-leaderboard-detail.png"),
      fullPage: true
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await dismissBoot(page);
    await openRankedChoice(page, "Start New Ranked");

    await page.locator(".ranked-v3-choice-relic").first().waitFor({ state: "visible" });
    assert.equal(await page.locator(".ranked-v3-entry:visible").count(), 0);
    assert.equal(await page.locator(".ranked-v3-leaderboard-entry:visible").count(), 0);
    assert.equal(await page.getByText("fang", { exact: true }).count(), 0);
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-starting-relic.png"),
      fullPage: true
    });
    await page.locator(".ranked-v3-choice-relic").first().click();
    await sessionState(page, "ROOM_ACTIVE");
    const extractionCampaignProfile = await page.evaluate(() => (
      window.DungeonRankedV3Storage.createStore(localStorage).loadProfile()
    ));
    const extractionStart = await visibleGameState(page);
    for (let step = 1; step <= 3; step += 1) {
      await advanceVisibleRoom(page, extractionStart.depth + step);
    }
    let extractionRoom = await visibleGameState(page);
    while (extractionRoom.roomType === "merchant") {
      await advanceVisibleRoom(page, extractionRoom.depth + 1);
      extractionRoom = await visibleGameState(page);
    }
    let releaseCheckpoint;
    let markCheckpointStarted;
    const checkpointStarted = new Promise((resolve) => { markCheckpointStarted = resolve; });
    const checkpointGate = new Promise((resolve) => { releaseCheckpoint = resolve; });
    let delayedCheckpoint = false;
    await page.route("**/api/v3/runs/checkpoint", async (route) => {
      if (!delayedCheckpoint) {
        delayedCheckpoint = true;
        markCheckpointStarted();
        await checkpointGate;
      }
      await route.continue();
    });
    await clearVisibleRoom(page);
    await checkpointStarted;
    await page.keyboard.press("q");
    assert.equal(
      await page.evaluate(() => window.DungeonOnlineV3.getSessionState()),
      "RESOLVING_ROOM"
    );
    assert.equal(await page.getByRole("heading", { name: "Ranked reconnect required" }).count(), 0);
    releaseCheckpoint();
    await sessionState(page, "FINALIZED");
    await page.unroute("**/api/v3/runs/checkpoint");
    await page.waitForTimeout(3_000);
    const campAudit = await page.evaluate(() => ({
      game: JSON.parse(window.render_game_to_text()),
      session: window.DungeonOnlineV3.getSessionState(),
      snapshot: window.DungeonOnlineV3.getSnapshot(),
      onlineOverlay: document.querySelector(".ranked-v3-overlay")?.textContent || "",
      nativeCamp: Boolean(document.querySelector(".camp-revamp"))
    }));
    assert.equal(campAudit.game.phase, "camp", JSON.stringify(campAudit));
    if (!campAudit.nativeCamp && /Camp Guide/u.test(campAudit.game.overlayText)) {
      await page.keyboard.press("h");
    }
    await page.locator(".camp-revamp").waitFor({ state: "visible" });
    assert.equal(await page.locator(".ranked-v3-overlay:visible").count(), 0);
    assert.equal(await page.getByRole("button", { name: "Finalize" }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Open Camp" }).count(), 0);
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-camp.png"),
      fullPage: true
    });
    const affordableUpgrade = page.locator(
      '.camp-revamp-upgrade[aria-disabled="false"]'
    ).first();
    await affordableUpgrade.waitFor({ state: "visible" });
    const upgradeBefore = await affordableUpgrade.innerText();
    const upgradeRequestsBefore = diagnostics.apiRequests.length;
    await affordableUpgrade.click();
    await page.waitForTimeout(2_500);
    const upgradeAudit = await page.evaluate(() => {
      const row = [...document.querySelectorAll('.camp-revamp-upgrade[aria-disabled="false"]')]
        .find((candidate) => candidate.getClientRects().length > 0);
      return {
        game: JSON.parse(window.render_game_to_text()),
        rowText: row?.innerText || "",
        overlay: document.querySelector(".ranked-v3-overlay")?.textContent || ""
      };
    });
    assert.notEqual(upgradeAudit.rowText, upgradeBefore, JSON.stringify({
      upgradeAudit,
      apiRequests: diagnostics.apiRequests.slice(upgradeRequestsBefore),
      apiErrors: diagnostics.apiErrors,
      debugMessages: diagnostics.debugMessages
    }));
    assert.equal(await page.getByRole("heading", { name: "Camp unavailable" }).count(), 0);
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-camp-upgrade.png"),
      fullPage: true
    });
    const nextRunRequestsBefore = diagnostics.apiRequests.length;
    const nextRunDebugBefore = diagnostics.debugMessages.length;
    await page.getByRole("button", { name: /Start Next Run/u }).click();
    await page.waitForFunction(() => (
      window.DungeonOnlineV3?.getSessionState?.() === "ROOM_ACTIVE" ||
      Boolean(document.querySelector(".ranked-v3-choice-relic")) ||
      /Ranked Unavailable/u.test(document.querySelector(".ranked-v3-overlay")?.textContent || "")
    ), null, { timeout: 15_000 });
    if (await page.locator(".ranked-v3-choice-relic").count() > 0) {
      await page.locator(".ranked-v3-choice-relic").first().click();
    }
    const nextRunFailureAudit = await page.evaluate(() => ({
      session: window.DungeonOnlineV3?.getSessionState?.(),
      snapshot: window.DungeonOnlineV3?.getSnapshot?.(),
      overlay: document.querySelector(".ranked-v3-overlay")?.textContent || "",
      rankedStorage: Object.fromEntries(
        Object.keys(localStorage)
          .filter((key) => key.startsWith("dungeonRankedV3"))
          .map((key) => [key, localStorage.getItem(key)])
      )
    }));
    assert.equal(
      nextRunFailureAudit.session,
      "ROOM_ACTIVE",
      JSON.stringify({
        nextRunFailureAudit,
        apiRequests: diagnostics.apiRequests.slice(nextRunRequestsBefore),
        debugMessages: diagnostics.debugMessages.slice(nextRunDebugBefore),
        apiErrors: diagnostics.apiErrors
      })
    );

    await page.waitForTimeout(1_000);
    const nextRunAudit = await page.evaluate(() => ({
      session: window.DungeonOnlineV3.getSessionState(),
      snapshot: window.DungeonOnlineV3.getSnapshot(),
      overlay: document.querySelector(".ranked-v3-overlay")?.textContent || ""
    }));
    assert.equal(nextRunAudit.session, "ROOM_ACTIVE", JSON.stringify(nextRunAudit));
    const nextRunCampaignProfile = await page.evaluate(() => (
      window.DungeonRankedV3Storage.createStore(localStorage).loadProfile()
    ));
    assert.equal(
      nextRunCampaignProfile.profileId,
      extractionCampaignProfile.profileId,
      "Starting the next descent from Camp rotated the five-life campaign profile"
    );
    assert(
      await page.evaluate(() => window.DungeonOnlineV3.getSnapshot().publicState.build.relics.length > 0),
      "Next Ranked run did not apply canonical extracted profile build"
    );

    const abandonedRunId = nextRunAudit.snapshot.runId;
    const ownerForAbandon = page;
    const recoveryPage = await context.newPage();
    recoveryPage.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/api/v3/")) {
        diagnostics.apiRequests.push({ method: request.method(), path: url.pathname });
      }
    });
    recoveryPage.on("response", async (response) => {
      const url = new URL(response.url());
      if (url.pathname.startsWith("/api/v3/") && !response.ok()) {
        diagnostics.apiErrors.push({
          status: response.status(),
          path: url.pathname,
          body: await response.text().catch(() => "")
        });
      }
    });
    recoveryPage.on("console", (message) => {
      if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
      if (message.type() === "debug") diagnostics.debugMessages.push(message.text());
    });
    recoveryPage.on("pageerror", (error) => diagnostics.pageErrors.push(String(error?.stack || error)));
    await recoveryPage.goto(`${proxy.baseUrl}/`, { waitUntil: "domcontentloaded" });
    await recoveryPage.waitForFunction(() => typeof window.render_game_to_text === "function");
    await dismissBoot(recoveryPage);
    await openRankedChoice(recoveryPage, "Continue Ranked");
    await sessionState(recoveryPage, "RECONNECT_REQUIRED");
    await recoveryPage.getByRole("button", { name: "Request control" }).waitFor({ state: "visible" });

    let abandonAttempts = 0;
    await recoveryPage.route("**/api/v3/runs/abandon", async (route) => {
      abandonAttempts += 1;
      if (abandonAttempts === 1) {
        await route.fetch();
      }
      await route.abort("failed");
    });
    await ownerForAbandon.evaluate(() => window.dispatchEvent(new Event("beforeunload")));
    await ownerForAbandon.close();
    await recoveryPage.getByRole("button", { name: "Abandon Ranked Run" }).click();
    await recoveryPage.getByRole("button", { name: "Confirm abandonment" }).click();
    await recoveryPage.getByRole("heading", { name: "Ranked reconnect required" }).waitFor({
      state: "visible",
      timeout: 20_000
    });
    assert.equal(abandonAttempts, 3, "Abandon did not exhaust the exact retry policy");
    await recoveryPage.unroute("**/api/v3/runs/abandon");
    await recoveryPage.getByRole("button", { name: "Main Menu" }).click();
    await recoveryPage.locator(".ranked-v3-overlay").waitFor({ state: "hidden" });
    await openRankedChoice(recoveryPage, "Continue Ranked");
    await recoveryPage.getByRole("heading", { name: "Ranked Run Ended" }).waitFor({ state: "visible" });
    assert.equal(await recoveryPage.getByRole("button", { name: "Resync Ranked Run" }).count(), 0);
    assert.equal(await recoveryPage.getByRole("button", { name: "Abandon Ranked Run" }).count(), 0);
    await recoveryPage.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-ended-recovery.png"),
      fullPage: true
    });
    await recoveryPage.getByRole("button", { name: "Start New Ranked Run" }).click();
    await recoveryPage.waitForFunction(() => (
      window.DungeonOnlineV3?.getSessionState?.() === "ROOM_ACTIVE" ||
      Boolean(document.querySelector(".ranked-v3-choice-relic"))
    ));
    if (await recoveryPage.locator(".ranked-v3-choice-relic").count() > 0) {
      await recoveryPage.locator(".ranked-v3-choice-relic").first().click();
    }
    await sessionState(recoveryPage, "ROOM_ACTIVE");
    const restartedRunId = await recoveryPage.evaluate(() => window.DungeonOnlineV3.getSnapshot().runId);
    assert.notEqual(restartedRunId, abandonedRunId, "Ended recovery reused the abandoned run");
    page = recoveryPage;

    await page.evaluate(() => window.DungeonOnlineV3.onExtraction("emergency"));
    await sessionState(page, "FINALIZED");
    await page.locator(".camp-revamp").waitFor({ state: "visible", timeout: 15_000 });
    await page.route("**/api/v3/runs/start", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: { code: "TEST_START_BLOCKED", message: "Headed Main Menu regression." }
        })
      });
    });
    await page.getByRole("button", { name: /Start Next Run/u }).click();
    await page.getByRole("heading", { name: "Ranked Unavailable" }).waitFor({ state: "visible" });
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-camp-next-run-error.png"),
      fullPage: true
    });
    await page.getByRole("button", { name: "Main Menu" }).click();
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === "menu");
    await page.locator(".camp-revamp").waitFor({ state: "hidden" });
    assert.equal(await page.locator(".camp-revamp:visible").count(), 0);
    await page.unroute("**/api/v3/runs/start");
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-camp-error-main-menu.png"),
      fullPage: true
    });

    const expectedDroppedResponseErrors = diagnostics.consoleErrors.filter(
      (message) => message === "Failed to load resource: net::ERR_FAILED"
    );
    const expectedEndedRecoveryErrors = diagnostics.consoleErrors.filter(
      (message) => message === "Failed to load resource: the server responded with a status of 410 (Gone)"
    );
    const expectedStaleProfileErrors = diagnostics.consoleErrors.filter(
      (message) => message === "Failed to load resource: the server responded with a status of 401 (Unauthorized)"
    );
    const expectedCampStartErrors = diagnostics.consoleErrors.filter(
      (message) => message === "Failed to load resource: the server responded with a status of 400 (Bad Request)"
    );
    const unexpectedConsoleErrors = diagnostics.consoleErrors.filter(
      (message) => ![
        "Failed to load resource: net::ERR_FAILED",
        "Failed to load resource: the server responded with a status of 410 (Gone)",
        "Failed to load resource: the server responded with a status of 401 (Unauthorized)",
        "Failed to load resource: the server responded with a status of 400 (Bad Request)"
      ].includes(message)
    );
    assert.equal(expectedDroppedResponseErrors.length, 7);
    assert.equal(expectedEndedRecoveryErrors.length, 1);
    assert.equal(expectedStaleProfileErrors.length, 0);
    assert.equal(expectedCampStartErrors.length, 1);
    assert.deepEqual(unexpectedConsoleErrors, []);
    assert.deepEqual(diagnostics.pageErrors, []);
    const summary = {
      mode: HEADLESS ? "headless" : "headed",
      runId,
      rankedLifecycleScenarios: 1,
      rewardBoundaryScenarios: 1,
      wardenPotionCheckpointScenarios: 1,
      deathPresentationScenarios: 1,
      networkLossScenarios: 1,
      reloadRecoveryScenarios: 1,
      multiTabTakeoverScenarios: 1,
      campLifecycleScenarios: 1,
      nextRunProfileScenarios: 1,
      checkpointExtractionScenarios: 1,
      campErrorMainMenuScenarios: 1,
      endedRecoveryRestartScenarios: 1,
      staleProfileRepairScenarios: 1,
      storageQuotaRecoveryScenarios: 1,
      activeCombatApiRequests: 0,
      finalizeAttempts: diagnostics.finalizeOperationIds.length,
      uniqueFinalizeOperationIds: new Set(diagnostics.finalizeOperationIds).size,
      leaderboardRowsForRun: await d1Count(runId),
      apiRequests: diagnostics.apiRequests,
      consoleErrors: unexpectedConsoleErrors.length,
      expectedDroppedResponseConsoleErrors: expectedDroppedResponseErrors.length,
      expectedEndedRecoveryConsoleErrors: expectedEndedRecoveryErrors.length,
      expectedStaleProfileConsoleErrors: expectedStaleProfileErrors.length,
      expectedCampStartConsoleErrors: expectedCampStartErrors.length,
      pageErrors: diagnostics.pageErrors.length
    };
    await fsPromises.writeFile(
      path.join(ARTIFACT_ROOT, "ranked-headed-summary.json"),
      `${JSON.stringify(summary, null, 2)}\n`,
      "utf8"
    );
    process.stdout.write(
      `Online v3 Ranked headed lifecycle PASS (${summary.rankedLifecycleScenarios} lifecycle, ` +
      `${summary.networkLossScenarios} network-loss, ${summary.reloadRecoveryScenarios} reload, ` +
      `${summary.multiTabTakeoverScenarios} multi-tab, ${summary.rewardBoundaryScenarios} reward-boundary, ` +
      `${summary.deathPresentationScenarios} death-presentation, ${summary.campLifecycleScenarios} Camp)\n`
    );
    await context.close();
    await browser.close();
    await closeServer(proxy.server);
    worker.child.kill();
    await waitForExit(worker.child);
    if (worker.child.exitCode === null) {
      worker.child.kill("SIGKILL");
      await waitForExit(worker.child);
    }
    assert.equal(worker.getLogs().includes(secret), false);
  } catch (error) {
    const workerLogs = worker.getLogs().replaceAll(secret, "[redacted]").trim();
    await browser.close();
    await closeServer(proxy.server);
    worker.child.kill();
    await waitForExit(worker.child);
    if (worker.child.exitCode === null) {
      worker.child.kill("SIGKILL");
      await waitForExit(worker.child);
    }
    assert.equal(worker.getLogs().includes(secret), false);
    throw new Error(
      workerLogs ? `${error.stack}\nWorker logs:\n${workerLogs}` : error.stack,
      { cause: error }
    );
  }
}

main().catch(async (error) => {
  await fsPromises.mkdir(ARTIFACT_ROOT, { recursive: true });
  await fsPromises.writeFile(
    path.join(ARTIFACT_ROOT, "ranked-headed-failure.json"),
    `${JSON.stringify({
      message: String(error?.message || error),
      stack: String(error?.stack || "")
    }, null, 2)}\n`,
    "utf8"
  );
  console.error(error);
  process.exitCode = 1;
});
