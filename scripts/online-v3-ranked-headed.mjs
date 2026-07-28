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
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-boot-loading.png"),
      fullPage: true
    });
    await page.keyboard.press("Enter");
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

async function sessionState(page, expected) {
  await page.waitForFunction(
    (value) => window.DungeonOnlineV3?.getSessionState?.() === value,
    expected,
    { timeout: 15_000 }
  );
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
  await runDebugAction(page, "F10", "b", "Toggle Observer Bot");
  await page.waitForFunction(
    (depth) => {
      const game = JSON.parse(window.render_game_to_text());
      return game.depth >= depth && window.DungeonOnlineV3?.getSessionState?.() === "ROOM_ACTIVE";
    },
    expectedDepth,
    { timeout: 30_000 }
  );
  await runDebugAction(page, "F10", "b", "Toggle Observer Bot");
  const state = await visibleGameState(page);
  assert.equal(state.depth, expectedDepth);
  assert.notEqual(state.latestLog, "Online v3 is still resolving the next room.");
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
  const secret = randomBytes(48).toString("base64url");
  const worker = await startWorker(await acquirePort(), secret);
  const proxy = await startGameProxy(worker.baseUrl);
  const diagnostics = {
    apiRequests: [],
    apiErrors: [],
    debugMessages: [],
    consoleErrors: [],
    pageErrors: [],
    finalizeOperationIds: []
  };
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: HEADLESS });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript((season) => {
      window.DUNGEON_ONLINE_V3_SEASON = season;
      window.DUNGEON_ONLINE_V3_DEBUG = true;
      localStorage.setItem("dungeonOneRoomPlayerName", "M4Headed");
      localStorage.setItem("dungeonOneRoomGraphicsMode", "hd");
      localStorage.setItem("dungeonOneRoomTutorialRunSeenV1", "1");
    }, SEASON);
    let page = await context.newPage();
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/api/v3/")) {
        diagnostics.apiRequests.push({ method: request.method(), path: url.pathname });
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
    assert.match(nativeMenuText, /Practice \(Offline\)[\s\S]*Ranked \(Online\)[\s\S]*Continue[\s\S]*Ranked Leaderboard/u);
    assert.equal(await page.locator(".ranked-v3-entry:visible").count(), 0);
    assert.equal(await page.locator(".ranked-v3-leaderboard-entry:visible").count(), 0);
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-native-menu.png"),
      fullPage: true
    });
    await openNativeMenuOption(page, "Ranked (Online)");

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
    await openNativeMenuOption(observerPage, "Ranked (Online)");

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
    await openNativeMenuOption(page, "Ranked (Online)");

    await sessionState(page, "ROOM_ACTIVE");
    assert.equal(
      await page.evaluate(() => window.DungeonOnlineV3.getSnapshot().runId),
      runId
    );

    const firstRoom = await visibleGameState(page);
    await clearVisibleRoom(page);
    await sessionState(page, "ENTERING_NEXT_ROOM");
    await crossVisiblePortal(page, firstRoom.depth + 1);

    await clearVisibleRoom(page);
    await sessionState(page, "ENTERING_NEXT_ROOM");
    await crossVisiblePortal(page, firstRoom.depth + 2);
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-two-player-portals.png"),
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
      await page.evaluate(() => window.DungeonOnlineV3.onFatalEvent());
    }
    const terminalAudit = await page.evaluate(() => ({
      status: window.DungeonOnlineV3.getSnapshot()?.publicState?.status || "",
      session: window.DungeonOnlineV3.getSessionState(),
      overlay: document.querySelector(".ranked-v3-overlay")?.textContent || ""
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
    await openNativeMenuOption(page, "Ranked (Online)");

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
    await page.evaluate(() => window.DungeonOnlineV3.onExtraction("emergency"));
    await sessionState(page, "FINALIZED");
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
    await page.getByRole("button", { name: /Start Next Run/u }).click();
    await sessionState(page, "ROOM_ACTIVE");

    await page.waitForTimeout(1_000);
    const nextRunAudit = await page.evaluate(() => ({
      session: window.DungeonOnlineV3.getSessionState(),
      snapshot: window.DungeonOnlineV3.getSnapshot(),
      overlay: document.querySelector(".ranked-v3-overlay")?.textContent || ""
    }));
    assert.equal(nextRunAudit.session, "ROOM_ACTIVE", JSON.stringify(nextRunAudit));
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
    await openNativeMenuOption(recoveryPage, "Ranked (Online)");
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
    await recoveryPage.getByRole("button", { name: "Return to Practice" }).click();
    await recoveryPage.locator(".ranked-v3-overlay").waitFor({ state: "hidden" });
    await openNativeMenuOption(recoveryPage, "Ranked (Online)");
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

    const expectedDroppedResponseErrors = diagnostics.consoleErrors.filter(
      (message) => message === "Failed to load resource: net::ERR_FAILED"
    );
    const expectedEndedRecoveryErrors = diagnostics.consoleErrors.filter(
      (message) => message === "Failed to load resource: the server responded with a status of 410 (Gone)"
    );
    const unexpectedConsoleErrors = diagnostics.consoleErrors.filter(
      (message) => ![
        "Failed to load resource: net::ERR_FAILED",
        "Failed to load resource: the server responded with a status of 410 (Gone)"
      ].includes(message)
    );
    assert.equal(expectedDroppedResponseErrors.length, 4);
    assert.equal(expectedEndedRecoveryErrors.length, 1);
    assert.deepEqual(unexpectedConsoleErrors, []);
    assert.deepEqual(diagnostics.pageErrors, []);
    const summary = {
      mode: HEADLESS ? "headless" : "headed",
      runId,
      rankedLifecycleScenarios: 1,
      networkLossScenarios: 1,
      reloadRecoveryScenarios: 1,
      multiTabTakeoverScenarios: 1,
      campLifecycleScenarios: 1,
      nextRunProfileScenarios: 1,
      endedRecoveryRestartScenarios: 1,
      activeCombatApiRequests: 0,
      finalizeAttempts: diagnostics.finalizeOperationIds.length,
      uniqueFinalizeOperationIds: new Set(diagnostics.finalizeOperationIds).size,
      leaderboardRowsForRun: await d1Count(runId),
      apiRequests: diagnostics.apiRequests,
      consoleErrors: unexpectedConsoleErrors.length,
      expectedDroppedResponseConsoleErrors: expectedDroppedResponseErrors.length,
      expectedEndedRecoveryConsoleErrors: expectedEndedRecoveryErrors.length,
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
      `${summary.multiTabTakeoverScenarios} multi-tab, ${summary.campLifecycleScenarios} Camp)\n`
    );
    await context.close();
  } finally {
    await browser.close();
    await closeServer(proxy.server);
    worker.child.kill();
    await waitForExit(worker.child);
    if (worker.child.exitCode === null) {
      worker.child.kill("SIGKILL");
      await waitForExit(worker.child);
    }
    assert.equal(worker.getLogs().includes(secret), false);
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
