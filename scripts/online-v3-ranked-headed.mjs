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
const GAME_ROOT = path.join(OUTPUT_ROOT, "pages-test-dist");

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

const HAS_SCENARIO_OPTION = process.argv.includes("--scenario");
const SCENARIO = HAS_SCENARIO_OPTION ? optionValue("--scenario") : "all";
const SCENARIOS = new Set(["all", "recovery", "lifecycle", "camp"]);
if (!SCENARIOS.has(SCENARIO)) {
  throw new Error(
    "Usage: node scripts/online-v3-ranked-headed.mjs [--headless] " +
    "[--scenario all|recovery|lifecycle|camp]"
  );
}
const BASE_ARTIFACT_ROOT = path.join(OUTPUT_ROOT, "online-v3-ranked-headed");
const ARTIFACT_ROOT = SCENARIO === "all"
  ? BASE_ARTIFACT_ROOT
  : path.join(BASE_ARTIFACT_ROOT, SCENARIO);
const PERSIST_ROOT = path.join(ARTIFACT_ROOT, "state");
const XDG_ROOT = path.join(ARTIFACT_ROOT, "xdg");
const RUN_RECOVERY = SCENARIO === "all" || SCENARIO === "recovery";
const RUN_LIFECYCLE = SCENARIO === "all" || SCENARIO === "lifecycle";
const RUN_CAMP = SCENARIO === "all" || SCENARIO === "camp";
const CONFIG = path.join(WORKER_ROOT, "wrangler.local.jsonc");
const WORKER_NODE_MODULES = process.env.DUNGEON_ONLINE_V3_WORKER_NODE_MODULES ||
  path.join(WORKER_ROOT, "node_modules");
const WRANGLER = path.join(WORKER_NODE_MODULES, "wrangler", "bin", "wrangler.js");
const DATABASE = "dungeon-online-v3-local";
const SEASON = "m4-headed";
const TEST_BOT_PASSWORD = "ranked-headed-observer-bot";
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

async function waitForBootAdvance(page) {
  await page.waitForFunction(() => {
    let phase = "";
    try {
      phase = JSON.parse(window.render_game_to_text?.() || "{}").phase || "";
    } catch {
      // The render hook can be between boot states for one frame.
    }
    const boot = document.querySelector("#bootScreen");
    const loading = document.querySelector(".boot-loading");
    return phase === "menu" ||
      Boolean(boot?.classList.contains("hidden")) ||
      Boolean(loading?.getClientRects().length);
  });
}

async function waitForLeaderboardRenderFocus(page) {
  await page.waitForFunction(() => {
    const active = document.activeElement;
    return active?.isConnected === true
      && active.getAttribute("data-record-nav-region") === "row"
      && active.getAttribute("data-record-action") === "name"
      && active.closest("[data-record-rank]")?.getAttribute("data-record-rank") === "1";
  });
}

async function dismissBoot(page, diagnostics = null, hdAttempt = 1) {
  const boot = page.locator("#bootScreen");
  if (!await boot.evaluate((element) => element.classList.contains("hidden"))) {
    await page.keyboard.press("Enter");
    await waitForBootAdvance(page);
    const loading = page.locator(".boot-loading");
    if (await loading.isVisible().catch(() => false)) {
      await page.screenshot({
        path: path.join(ARTIFACT_ROOT, "ranked-boot-loading.png"),
        fullPage: true
      });
      await page.keyboard.press("Enter");
    }
  }
  await page.waitForFunction(() => document.querySelector("#bootScreen")?.classList.contains("hidden"));
  await page.waitForFunction(() => window.__DUNGEON_TEST_BOOT_INPUT_READY?.() === true);
  const graphicsReady = await page.evaluate(() => window.__DUNGEON_TEST_GRAPHICS_READY?.());
  if (
    graphicsReady?.ready !== true ||
    graphicsReady?.requested !== "hd" ||
    graphicsReady?.mode !== "hd" ||
    graphicsReady?.pending !== false
  ) {
    if (hdAttempt < 4) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => typeof window.render_game_to_text === "function");
      return dismissBoot(page, diagnostics, hdAttempt + 1);
    }
    const graphics = await page.evaluate(() => {
      const canvas = document.querySelector("#game");
      return {
        dataMode: canvas?.dataset.graphicsMode || "",
        canvasClass: canvas?.className || "",
        bodyClass: document.body.className,
        canvasSize: canvas ? `${canvas.width}x${canvas.height}` : "missing"
      };
    });
    throw new Error(`Ranked headed QA did not reach real HD mode after ${hdAttempt} attempts: ${JSON.stringify({
      graphics,
      graphicsReady,
      consoleWarnings: diagnostics?.consoleWarnings || [],
      consoleErrors: diagnostics?.consoleErrors || [],
      pageErrors: diagnostics?.pageErrors || []
    })}`);
  }
  await page.waitForFunction(() => {
    const canvas = document.querySelector("#game");
    return canvas?.dataset.graphicsMode === "hd" &&
      canvas.classList.contains("graphics-hd") &&
      document.body.classList.contains("graphics-hd-ui");
  }, null, { timeout: 5_000 });
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
    await page.waitForFunction((buttonNames) => {
      const session = window.DungeonOnlineV3?.getSessionState?.() || "IDLE";
      const relicVisible = [...document.querySelectorAll(".ranked-v3-choice-relic")]
        .some((element) => element.getClientRects().length > 0);
      const buttonVisible = [...document.querySelectorAll("button")]
        .some((element) => element.getClientRects().length > 0 &&
          buttonNames.includes(element.textContent?.trim() || ""));
      return session !== "IDLE" || relicVisible || buttonVisible;
    }, [choice, "Start Ranked"], { timeout: 15_000 });
    const savedRunChoice = page.getByRole("button", { name: choice, exact: true });
    if (await savedRunChoice.isVisible().catch(() => false)) {
      await savedRunChoice.click();
      return;
    }
    const freshStartChoice = page.getByRole("button", { name: "Start Ranked", exact: true });
    if (await freshStartChoice.isVisible().catch(() => false)) await freshStartChoice.click();
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
      gameVersion: String(window.DUNGEON_GAME_VERSION || window.GAME_VERSION || "v0.8.2"),
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
  const choice = page.locator(".ranked-v3-choice-relic:visible").nth(choiceIndex);
  const choiceId = await choice.getAttribute("data-choice-id");
  await choice.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction((selectedChoiceId) => (
    ![...document.querySelectorAll(".ranked-v3-choice-relic")]
      .some((element) => element.getClientRects().length > 0 &&
        element.getAttribute("data-choice-id") === selectedChoiceId)
  ), choiceId, { timeout: 15_000 });
}

async function chooseForgeRewardWithCanonicalReplacement(page, diagnostics) {
  await page.keyboard.press("1");
  await page.waitForFunction(() => {
    const session = window.DungeonOnlineV3?.getSessionState?.() || "";
    const replacement = [...document.querySelectorAll("#screenOverlay .relic-draft-grid-inventory [data-relic-key]")]
      .some((element) => element.getClientRects().length > 0);
    return ["ROOM_ACTIVE", "AWAITING_REWARD_OR_TRANSACTION", "ENTERING_NEXT_ROOM"].includes(session) || replacement;
  }, null, { timeout: 20_000 });

  const session = await page.evaluate(() => window.DungeonOnlineV3?.getSessionState?.() || "");
  if (!["ROOM_ACTIVE", "ENTERING_NEXT_ROOM"].includes(session)) {
    if (await page.locator(".ranked-v3-choice-relic:visible").count() > 0) {
      await chooseRelicWithoutFatalPrevention(page);
      await page.waitForFunction(() => ["ROOM_ACTIVE", "ENTERING_NEXT_ROOM"].includes(
        window.DungeonOnlineV3?.getSessionState?.() || ""
      ));
      return;
    }
    try {
      await page.waitForFunction(() => (
        ["ROOM_ACTIVE", "ENTERING_NEXT_ROOM"].includes(
          window.DungeonOnlineV3?.getSessionState?.() || ""
        ) ||
        [...document.querySelectorAll(".ranked-v3-choice-relic")]
          .some((element) => element.getClientRects().length > 0) ||
        [...document.querySelectorAll("#screenOverlay .relic-draft-grid-inventory [data-relic-key]")]
          .some((element) => element.getClientRects().length > 0)
      ), null, { timeout: 5_000 });
    } catch (error) {
      const diagnostic = await page.evaluate(() => ({
        session: window.DungeonOnlineV3?.getSessionState?.() || "",
        game: JSON.parse(window.render_game_to_text()),
        state: window.DungeonOnlineV3?.getSnapshot?.()?.publicState || null,
        nativeOverlay: document.querySelector("#screenOverlay")?.textContent || "",
        rankedOverlay: document.querySelector(".ranked-v3-overlay")?.textContent || ""
      }));
      throw new Error(`Ranked Forge replacement did not resolve: ${JSON.stringify(diagnostic)}`, { cause: error });
    }
    if (["ROOM_ACTIVE", "ENTERING_NEXT_ROOM"].includes(
      await page.evaluate(() => window.DungeonOnlineV3?.getSessionState?.() || "")
    )) return;
    if (await page.locator(".ranked-v3-choice-relic:visible").count() > 0) {
      await chooseRelicWithoutFatalPrevention(page);
      await page.waitForFunction(() => ["ROOM_ACTIVE", "ENTERING_NEXT_ROOM"].includes(
        window.DungeonOnlineV3?.getSessionState?.() || ""
      ));
      return;
    }
    const replacement = await page.evaluate(() => {
      const state = window.DungeonOnlineV3?.getSnapshot?.()?.publicState;
      const choice = state?.metaTransactionOffer?.choices?.find((candidate) =>
        Array.isArray(candidate?.removals) && candidate.removals[0]?.relicId
      );
      const relicId = choice?.removals?.[0]?.relicId || "";
      const index = state?.build?.relics?.findIndex((entry) => entry?.relicId === relicId) ?? -1;
      const key = index === 9 ? "0" : index >= 0 ? String(index + 1) : "";
      const control = key ? document.querySelector(`#screenOverlay [data-relic-key="${key}"]`) : null;
      return { relicId, key, visible: Boolean(control?.getClientRects().length) };
    });
    assert.ok(replacement.relicId, JSON.stringify(replacement));
    assert.match(replacement.key, /^(?:[1-9]|0)$/u, JSON.stringify(replacement));
    assert.equal(replacement.visible, true, JSON.stringify(replacement));
    await page.keyboard.press(replacement.key);
  }
  await page.waitForFunction(() => ["ROOM_ACTIVE", "ENTERING_NEXT_ROOM"].includes(
    window.DungeonOnlineV3?.getSessionState?.() || ""
  ));
}

async function waitForStartingRelic(page, label) {
  let timedOut = false;
  try {
    await page.waitForFunction(() => {
      const relic = [...document.querySelectorAll(".ranked-v3-choice-relic")]
        .some((element) => element.getClientRects().length > 0);
      const overlay = document.querySelector(".ranked-v3-overlay")?.textContent || "";
      return relic || /unavailable|reconnect|required|ended/iu.test(overlay);
    }, null, { timeout: 30_000 });
  } catch (error) {
    if (error?.name !== "TimeoutError") throw error;
    timedOut = true;
  }
  const audit = await page.evaluate(() => ({
    session: window.DungeonOnlineV3?.getSessionState?.() || "",
    snapshot: window.DungeonOnlineV3?.getSnapshot?.() || null,
    overlay: document.querySelector(".ranked-v3-overlay")?.textContent || "",
    relicVisible: [...document.querySelectorAll(".ranked-v3-choice-relic")]
      .some((element) => element.getClientRects().length > 0),
    game: JSON.parse(window.render_game_to_text?.() || "{}")
  }));
  if (!audit.relicVisible) {
    audit.timedOut = timedOut;
    await fsPromises.writeFile(
      path.join(ARTIFACT_ROOT, `${label}-diagnostic.json`),
      `${JSON.stringify(audit, null, 2)}\n`,
      "utf8"
    );
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, `${label}-diagnostic.png`),
      fullPage: true
    });
    throw new Error(`${label} did not reach the starting relic: ${JSON.stringify(audit)}`);
  }
  return audit;
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
  assert.equal(
    await page.evaluate(() => window.__DUNGEON_TEST_CLEAR_VISIBLE_ROOM?.()),
    true,
    "QA hook could not clear the visible Ranked room"
  );
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).roomCleared === true);
}

async function enterVisiblePortal(page) {
  assert.equal(await page.evaluate(() => window.__DUNGEON_TEST_CROSS_PORTAL?.()), true);
}

async function completeVisiblePortal(page, expectedDepth, diagnostics = null) {
  try {
    await page.waitForFunction(
      (depth) => {
        const game = JSON.parse(window.render_game_to_text());
        return (game.depth >= depth && window.DungeonOnlineV3?.getSessionState?.() === "ROOM_ACTIVE") ||
          [...document.querySelectorAll(".ranked-v3-choice-relic")]
            .some((element) => element.getClientRects().length > 0);
      },
      expectedDepth,
      { timeout: 30_000 }
    );
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({
      game: JSON.parse(window.render_game_to_text()),
      session: window.DungeonOnlineV3?.getSessionState?.() || "",
      snapshot: window.DungeonOnlineV3?.getSnapshot?.() || null,
      overlay: document.querySelector(".ranked-v3-overlay:not(.hidden)")?.innerText || ""
    }));
    if (diagnostics) {
      diagnostic.checkpointBodies = diagnostics.checkpointBodies.slice(-12);
    }
    throw new Error(`Ranked portal boundary did not resolve: ${JSON.stringify(diagnostic)}`, { cause: error });
  }
  if (await page.locator(".ranked-v3-choice-relic:visible").count() > 0) {
    await chooseRelicWithoutFatalPrevention(page);
  }
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

async function crossVisiblePortal(page, expectedDepth, diagnostics = null) {
  await enterVisiblePortal(page);
  await completeVisiblePortal(page, expectedDepth, diagnostics);
}

async function advanceVisibleRoom(page, expectedDepth) {
  const sourceRoom = await visibleGameState(page);
  await clearVisibleRoom(page);
  assert.equal(await page.evaluate(() => window.DungeonOnlineV3?.getSessionState?.()), "ROOM_ACTIVE");
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

  await execFileAsync(process.execPath, [
    path.join(ROOT, "scripts", "build-pages-v3.mjs"),
    "--target",
    "test"
  ], {
    cwd: ROOT,
    env: environment({
      DUNGEON_ONLINE_TEST_BOT_PASSWORD: TEST_BOT_PASSWORD
    }),
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true
  });
  assert.equal(
    fs.existsSync(path.join(GAME_ROOT, "QA_ONLY_BUILD.txt")),
    true,
    "Ranked headed QA must use the isolated QA-only Pages bundle"
  );
  const rulesetManifest = JSON.parse(await fsPromises.readFile(
    path.join(WORKER_ROOT, "src", "rulesets", "v08-meta-1", "data", "ruleset-manifest.json"),
    "utf8"
  ));
  const candidateRulesetHash = String(rulesetManifest.rulesetHash || "");
  assert.match(candidateRulesetHash, /^sha256:[a-f0-9]{64}$/u);
  const headedProtocolPath = path.join(GAME_ROOT, "online-v3", "ranked-v3-protocol.js");
  const headedProtocol = await fsPromises.readFile(headedProtocolPath, "utf8");
  const protocolHashPattern = /^  const RULESET_HASH = "[^"]+";$/mu;
  assert(protocolHashPattern.test(headedProtocol));
  await fsPromises.writeFile(
    headedProtocolPath,
    headedProtocol.replace(
      protocolHashPattern,
      `  const RULESET_HASH = ${JSON.stringify(candidateRulesetHash)};`
    ),
    "utf8"
  );
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
  const fatalTestHook = `  window.__DUNGEON_TEST_BOOT_INPUT_READY = () =>
    !bootInputLocked && performance.now() >= bootInputUnlockAt;
  window.__DUNGEON_TEST_GRAPHICS_READY = async () => {
    const outcome = await initialGraphicsReady;
    return {
      requested: "hd",
      mode: getRuntimeGraphicsMode(),
      pending: false,
      ready: outcome?.ready === true
    };
  };
  window.__DUNGEON_TEST_TRIGGER_FATAL = (reason = "Headed fatal event") => {
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
  window.__DUNGEON_TEST_OPEN_LATE_CHEST = () => {
    if (!canUseDebugCheats() || state.phase !== "playing" || !state.roomCleared) return null;
    let chest = state.chests.find((candidate) => candidate && !candidate.opened && !candidate.destroyed);
    if (!chest) {
      chest = {
        id: "qa-late-chest",
        type: "normal",
        x: state.player.x,
        y: state.player.y,
        opened: false,
        destroyed: false
      };
      state.chests.push(chest);
    }
    openChest(chest);
    return { opened: chest.opened === true, type: String(chest.type || "normal") };
  };
  window.__DUNGEON_TEST_TOGGLE_OBSERVER_BOT = () => {
    if (!canUseDebugCheats() || state.phase !== "playing") return false;
    if (state.onlineV3Ranked && !state.onlineV3TestBotUnlocked) return false;
    return toggleObserverBot();
  };
  window.__DUNGEON_TEST_IS_TURN_INPUT_LOCKED = () => (
    canUseDebugCheats() && isTurnInputLocked()
  );
  window.__DUNGEON_TEST_OPEN_FORGE = () => {
    if (
      !canUseDebugCheats() ||
      state.phase !== "playing" ||
      state.roomType !== "forge" ||
      !state.roomCleared ||
      !state.forge?.awakened ||
      state.forge?.used
    ) return false;
    state.player.x = Number(state.forge.interactX ?? state.forge.x);
    state.player.y = Number(state.forge.interactY ?? state.forge.y);
    return openForgeRoom();
  };
  window.__DUNGEON_TEST_CLEAR_VISIBLE_ROOM = () => {
    if (!canUseDebugCheats() || state.phase !== "playing") return false;
    if (state.roomCleared) return true;
    if (!Array.isArray(state.enemies) || state.enemies.length <= 0) return false;
    const before = state.enemies.length;
    for (const enemy of [...state.enemies]) {
      killEnemy(enemy, "headed observer clear");
    }
    checkRoomClearBonus();
    pushLog("Headed QA: room cleared (" + before + " enemies).", "warn");
    saveAfterDebugCheat();
    markUiDirty();
    return state.roomCleared;
  };

${fatalTestHookAnchor}`;
  await fsPromises.writeFile(
    headedGamePath,
    headedGame.replace(fatalTestHookAnchor, fatalTestHook),
    "utf8"
  );
  const secret = randomBytes(48).toString("base64url");
  const workerPort = await acquirePort();
  let worker = null;
  const proxy = await startGameProxy(`http://127.0.0.1:${workerPort}`);
  const diagnostics = {
    apiRequests: [],
    apiErrors: [],
    debugMessages: [],
    consoleWarnings: [],
    consoleErrors: [],
    pageErrors: [],
    finalizeOperationIds: [],
    checkpointBodies: []
  };
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: HEADLESS });
  try {
    const context = await browser.newContext({ viewport: { width: 1536, height: 1080 } });
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
      localStorage.setItem("dungeonOneRoomAudioMuted", "0");
      window.DUNGEON_ONLINE_TEST_MUSIC_OFF = true;
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
      if (message.type() === "warning") diagnostics.consoleWarnings.push(message.text());
      if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
      if (message.type() === "debug") diagnostics.debugMessages.push(message.text());
    });
    page.on("pageerror", (error) => diagnostics.pageErrors.push(String(error?.stack || error)));

    let runId = "";
    await page.goto(`${proxy.baseUrl}/`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof window.render_game_to_text === "function");
    await dismissBoot(page, diagnostics);
    assert.equal(
      diagnostics.apiRequests.length,
      0,
      "Ranked client issued API traffic before the player opened an Online screen"
    );
    worker = await startWorker(workerPort, secret);
    const nativeMenuText = await page.locator(".overlay-menu").innerText();
    assert.match(nativeMenuText, /Practice \(Offline\)[\s\S]*Ranked \(Online\)[\s\S]*Ranked Leaderboard/u);
    assert.equal(await page.locator(".overlay-menu-row", { hasText: /^Continue$/u }).count(), 0);
    assert.equal(await page.locator(".ranked-v3-entry:visible").count(), 0);
    assert.equal(await page.locator(".ranked-v3-leaderboard-entry:visible").count(), 0);
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-native-menu.png"),
      fullPage: true
    });

    if (RUN_RECOVERY) {
    const storagePressure = await seedRankedStoragePressure(page);
    assert.equal(storagePressure.errorName, "QuotaExceededError", JSON.stringify(storagePressure));
    assert.equal(storagePressure.errorCode, 22, JSON.stringify(storagePressure));
    const quotaApiBefore = diagnostics.apiRequests.length;
    await openRankedChoice(page, "Start Ranked");
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
    await dismissBoot(page, diagnostics);

    const staleProfile = await seedStaleRankedProfile(page);
    const staleErrorsBefore = diagnostics.apiErrors.length;
    await openRankedChoice(page, "Start New Ranked");
    await waitForStartingRelic(page, "stale-profile");
    const repairedProfile = await page.evaluate(() => (
      window.DungeonRankedV3Storage.createStore(localStorage).loadProfile()
    ));
    const repairedRunId = await page.evaluate(() => window.DungeonOnlineV3.getSnapshot().runId);
    assert.notEqual(repairedProfile.profileId, staleProfile.profileId);
    assert.notEqual(repairedRunId, staleProfile.seedRunId);
    const staleRepairErrors = diagnostics.apiErrors.slice(staleErrorsBefore)
      .filter((entry) => (
        entry.status === 401 &&
        entry.path === "/api/v3/runs/start" &&
        /PROFILE_UNAUTHORIZED/u.test(entry.body)
      ));
    assert.equal(
      staleRepairErrors.length,
      1,
      JSON.stringify(diagnostics.apiErrors.slice(staleErrorsBefore))
    );
    assert.equal(await page.getByRole("heading", { name: "Ranked reconnect required" }).count(), 0);
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-stale-profile-repaired.png"),
      fullPage: true
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await dismissBoot(page, diagnostics);
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
    await dismissBoot(page, diagnostics);
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
    await dismissBoot(page, diagnostics);

    const practiceApiBefore = diagnostics.apiRequests.length;
    await openNativeMenuOption(page, "Practice (Offline)");
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === "relic");
    await page.keyboard.press("1");
    await page.waitForFunction(() => {
      const game = JSON.parse(window.render_game_to_text());
      const overlay = document.querySelector("#screenOverlay");
      return game.phase === "playing" && !overlay?.getClientRects().length;
    });
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => {
      const game = JSON.parse(window.render_game_to_text());
      const menu = document.querySelector("#screenOverlay .overlay-menu");
      return game.phase === "menu" &&
        Boolean(menu?.getClientRects().length) &&
        /Main Menu[\s\S]*Continue/u.test(menu.textContent || "");
    });
    const pauseMenuText = await page.locator("#screenOverlay .overlay-menu:visible").innerText();
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
    }

    if (RUN_LIFECYCLE) {
    assert.equal(
      await page.locator(".ranked-run-player-status").count(),
      0,
      "Practice/Main Menu must not render a Ranked status dot"
    );
    assert.equal(
      await page.evaluate(() => window.DUNGEON_ONLINE_TEST_BOT_ENABLED === true),
      true,
      "Ranked lifecycle QA bundle must enable the password-gated Observer Bot"
    );
    await page.evaluate((password) => {
      window.prompt = () => password;
    }, TEST_BOT_PASSWORD);
    await openNativeMenuOption(page, "Ranked (Online)");
    await page.getByRole("button", { name: "Start Ranked", exact: true }).click();
    await page.locator(".ranked-v3-choice-relic").first().waitFor({ state: "visible" });
    await chooseRelicWithoutFatalPrevention(page);
    await sessionState(page, "ROOM_ACTIVE", diagnostics);
    await page.waitForFunction(() => (
      JSON.parse(window.render_game_to_text()).rankedHudStatus?.kind === "official"
    ));
    assert.equal(
      await page.locator('.ranked-run-player-status[data-ranked-status="official"]').count(),
      1,
      "Official Ranked should show one green status dot before the player name"
    );
    assert.equal(await page.locator(".ranked-run-player-status").getAttribute("role"), "group");
    assert.match(
      await page.locator(".ranked-run-player-status").getAttribute("aria-label"),
      /Player M4Headed.*Leaderboard eligible/iu
    );
    assert.match(
      await page.locator(".ranked-run-status-dot").getAttribute("aria-label"),
      /leaderboard eligible/iu
    );
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-status-official.png"),
      fullPage: true
    });
    const runTutorial = page.locator(".tutorial-overlay-card");
    if (await runTutorial.isVisible()) {
      await page.keyboard.press("Enter");
      await runTutorial.waitFor({ state: "hidden" });
    }
    let releaseAssistance;
    let markAssistanceStarted;
    const assistanceStarted = new Promise((resolve) => { markAssistanceStarted = resolve; });
    const assistanceGate = new Promise((resolve) => { releaseAssistance = resolve; });
    await page.route("**/api/v3/runs/event", async (route) => {
      const body = route.request().postDataJSON();
      if (body?.type === "mark_test_assistance") {
        markAssistanceStarted();
        await assistanceGate;
      }
      await route.continue();
    });
    const unlockKey = page.keyboard.press("F9");
    await Promise.race([
      assistanceStarted,
      new Promise((_, reject) => setTimeout(
        () => reject(new Error("Ranked F9 assistance request did not start within 10 seconds")),
        10_000
      ))
    ]);
    await page.waitForFunction(() => (
      JSON.parse(window.render_game_to_text()).rankedHudStatus?.syncing === true
    ));
    await page.waitForFunction(() => Boolean(
      document.querySelector(".ranked-run-player-status.is-syncing")
    ));
    assert.equal(await page.locator(".ranked-run-player-status.is-syncing").count(), 1);
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-status-syncing.png"),
      fullPage: true,
      animations: "disabled"
    });
    releaseAssistance();
    await unlockKey;
    await page.unroute("**/api/v3/runs/event");
    const testMenu = page.locator(".overlay-card-debug-cheats");
    try {
      await testMenu.waitFor({ state: "visible" });
    } catch (error) {
      const unlockState = await page.evaluate(() => ({
        sessionState: window.DungeonOnlineV3?.getSessionState?.() || null,
        snapshot: window.DungeonOnlineV3?.getSnapshot?.() || null,
        rankedOverlay: document.querySelector(".ranked-v3-overlay:not(.hidden)")?.innerText || "",
        screenOverlay: document.querySelector("#screenOverlay")?.innerText || "",
        game: JSON.parse(window.render_game_to_text())
      }));
      throw new Error(`Ranked F9 unlock did not open test controls: ${JSON.stringify({
        unlockState,
        network: diagnostics
      })}`, { cause: error });
    }
    await testMenu.getByText("Toggle Observer Bot", { exact: true }).waitFor({ state: "visible" });
    await page.waitForFunction(() => (
      JSON.parse(window.render_game_to_text()).rankedHudStatus?.kind === "observer"
    ));
    assert.equal(
      await page.locator('.ranked-run-player-status[data-ranked-status="observer"]').count(),
      1,
      "Observer Bot Ranked should show one blue status dot before the player name"
    );
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-f9-test-controls.png"),
      fullPage: true
    });
    await page.keyboard.press("b");
    const observerAfterMenuHotkey = await page.evaluate(() => ({
      active: window.DungeonOnlineV3GameBridge?.isRankedTestBotActive?.() === true,
      game: JSON.parse(window.render_game_to_text()),
      menu: document.querySelector(".overlay-card-debug-cheats")?.innerText || ""
    }));
    assert.equal(
      observerAfterMenuHotkey.active,
      true,
      `Observer Bot menu hotkey did not activate the bot: ${JSON.stringify(observerAfterMenuHotkey)}`
    );
    assert.equal(
      await page.evaluate(() => window.__DUNGEON_TEST_TOGGLE_OBSERVER_BOT?.()),
      true,
      "QA hook could not disable the Observer Bot immediately after the menu hotkey check"
    );
    await page.keyboard.press("F9");
    await testMenu.waitFor({ state: "hidden" });
    await page.waitForFunction(() => (
      window.DungeonOnlineV3GameBridge?.isRankedTestBotActive?.() === false
    ));
    let forgeRoom = await visibleGameState(page);
    for (let room = 0; room < 21 && forgeRoom.roomType !== "forge"; room += 1) {
      const sourceRoom = forgeRoom;
      if (!sourceRoom.roomCleared) {
        assert.equal(
          await page.evaluate(() => window.__DUNGEON_TEST_CLEAR_VISIBLE_ROOM?.()),
          true,
          `QA hook could not clear canonical room: ${JSON.stringify(sourceRoom)}`
        );
        await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).roomCleared === true);
      }
      assert.equal(
        await page.evaluate(() => window.DungeonOnlineV3?.getSessionState?.()),
        "ROOM_ACTIVE",
        "A cleared Ranked room must remain interactive until its portal boundary"
      );
      await crossVisiblePortal(page, sourceRoom.depth + 1, diagnostics);
      const integrityAudit = await page.evaluate(() => ({
        rankEligibility: window.DungeonOnlineV3.getSnapshot()?.publicState?.rankEligibility,
        session: window.DungeonOnlineV3.getSessionState()
      }));
      if (integrityAudit.rankEligibility === "provisional") {
        throw new Error(
          `Ranked lifecycle integrity false positive: ${JSON.stringify({
            integrityAudit,
            checkpoint: diagnostics.checkpointBodies.at(-1)
          })}`
        );
      }
      forgeRoom = await visibleGameState(page);
    }
    assert.equal(
      forgeRoom.roomType,
      "forge",
      `Canonical Ranked schedule did not issue Forge by depth 21: ${JSON.stringify(forgeRoom)}`
    );

    const forgeRequestsBefore = diagnostics.apiRequests.length;
    assert.equal(
      await page.evaluate(() => window.__DUNGEON_TEST_CLEAR_VISIBLE_ROOM?.()),
      true
    );
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).roomCleared === true);
    assert.equal(
      await page.evaluate(() => window.__DUNGEON_TEST_OPEN_FORGE?.()),
      true
    );
    await page.locator("#screenOverlay .overlay-card-forge-mode:visible").waitFor({ state: "visible" });
    const forgeModeAudit = await page.evaluate(() => ({
      phase: JSON.parse(window.render_game_to_text()).phase,
      nativeModeVisible: Boolean(document.querySelector("#screenOverlay .overlay-card-forge-mode")?.getClientRects().length),
      genericRankedVisible: Boolean(document.querySelector(".ranked-v3-overlay")?.getClientRects().length),
      hd: document.body.classList.contains("graphics-hd-ui"),
      text: document.querySelector("#screenOverlay .overlay-card-forge-mode")?.textContent || ""
    }));
    assert.equal(forgeModeAudit.phase, "playing", JSON.stringify(forgeModeAudit));
    assert.equal(forgeModeAudit.nativeModeVisible, true, JSON.stringify(forgeModeAudit));
    assert.equal(forgeModeAudit.genericRankedVisible, false, JSON.stringify(forgeModeAudit));
    assert.equal(forgeModeAudit.hd, true, JSON.stringify(forgeModeAudit));
    assert.match(forgeModeAudit.text, /Forge Chamber[\s\S]*Temper[\s\S]*Transmute[\s\S]*Leave Forge/u);
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-forge-native-mode.png"),
      fullPage: true
    });

    await page.keyboard.press("1");
    try {
      await page.locator("#screenOverlay .overlay-card-forge-reward:visible").waitFor({
        state: "visible",
        timeout: 20_000
      });
    } catch (error) {
      const diagnostic = await page.evaluate(() => ({
        game: JSON.parse(window.render_game_to_text()),
        session: window.DungeonOnlineV3?.getSessionState?.() || "",
        nativeOverlay: document.querySelector("#screenOverlay")?.textContent || "",
        rankedOverlay: document.querySelector(".ranked-v3-overlay")?.textContent || ""
      }));
      diagnostic.apiErrors = diagnostics.apiErrors.slice(-5);
      diagnostic.debugMessages = diagnostics.debugMessages.slice(-10);
      diagnostic.consoleErrors = diagnostics.consoleErrors.slice(-10);
      diagnostic.pageErrors = diagnostics.pageErrors.slice(-10);
      throw new Error(`Ranked Forge reward did not open: ${JSON.stringify(diagnostic)}`, { cause: error });
    }
    const forgeRewardAudit = await page.evaluate(() => ({
      phase: JSON.parse(window.render_game_to_text()).phase,
      nativeRewardVisible: Boolean(document.querySelector("#screenOverlay .overlay-card-forge-reward")?.getClientRects().length),
      genericRankedVisible: Boolean(document.querySelector(".ranked-v3-overlay")?.getClientRects().length),
      rewardCards: document.querySelectorAll("#screenOverlay .forge-reward-choice").length,
      text: document.querySelector("#screenOverlay .overlay-card-forge-reward")?.textContent || ""
    }));
    assert.equal(forgeRewardAudit.phase, "relic", JSON.stringify(forgeRewardAudit));
    assert.equal(forgeRewardAudit.nativeRewardVisible, true, JSON.stringify(forgeRewardAudit));
    assert.equal(forgeRewardAudit.genericRankedVisible, false, JSON.stringify(forgeRewardAudit));
    assert.equal(forgeRewardAudit.rewardCards, 1, JSON.stringify(forgeRewardAudit));
    assert.match(forgeRewardAudit.text, /Forge Temper[\s\S]*Offer[\s\S]*Leave Forged Relic/u);
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-forge-native-temper.png"),
      fullPage: true
    });

    await chooseForgeRewardWithCanonicalReplacement(page, diagnostics);
    await crossVisiblePortal(page, forgeRoom.depth + 1, diagnostics);
    assert(
      diagnostics.apiRequests.slice(forgeRequestsBefore)
        .filter((entry) => entry.path === "/api/v3/runs/checkpoint").length >= 1,
      "Native Ranked Forge lifecycle did not checkpoint its room boundary"
    );
    const assistedCleanup = await abandonCurrentRankedAndClearLocal(page);
    assert.equal(assistedCleanup.status, "abandoned");
    await page.reload({ waitUntil: "domcontentloaded" });
    await dismissBoot(page, diagnostics);

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
    runId = await page.evaluate(() => window.DungeonOnlineV3.getSnapshot().runId);
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
      if (message.type() === "warning") diagnostics.consoleWarnings.push(message.text());
      if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
      if (message.type() === "debug") diagnostics.debugMessages.push(message.text());
    });
    observerPage.on("pageerror", (error) => diagnostics.pageErrors.push(String(error?.stack || error)));
    await observerPage.goto(`${proxy.baseUrl}/`, { waitUntil: "domcontentloaded" });
    await observerPage.waitForFunction(() => typeof window.render_game_to_text === "function");
    await dismissBoot(observerPage, diagnostics);
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
    await dismissBoot(page, diagnostics);
    await openRankedChoice(page, "Continue Ranked");

    await sessionState(page, "ROOM_ACTIVE");
    assert.equal(
      await page.evaluate(() => window.DungeonOnlineV3.getSnapshot().runId),
      runId
    );
    await page.evaluate((password) => {
      window.prompt = () => password;
    }, TEST_BOT_PASSWORD);
    const resumedRunTutorial = page.locator(".tutorial-overlay-card");
    if (await resumedRunTutorial.isVisible()) {
      await page.keyboard.press("Enter");
      await resumedRunTutorial.waitFor({ state: "hidden" });
    }
    await page.keyboard.press("F9");
    const resumedTestMenu = page.locator(".overlay-card-debug-cheats");
    await resumedTestMenu.waitFor({ state: "visible" });
    await resumedTestMenu.getByText("Toggle Observer Bot", { exact: true }).waitFor({ state: "visible" });
    await page.keyboard.press("F9");
    await resumedTestMenu.waitFor({ state: "hidden" });

    const firstRoom = await visibleGameState(page);
    const firstCanonicalGold = await page.evaluate(() => (
      window.DungeonOnlineV3.getSnapshot()?.publicState?.gold || 0
    ));
    const checkpointsBeforeFirstClear = diagnostics.checkpointBodies.length;
    await clearVisibleRoom(page);
    const openRoomAudit = await page.evaluate(() => ({
      session: window.DungeonOnlineV3.getSessionState(),
      game: JSON.parse(window.render_game_to_text()),
      canonicalGold: window.DungeonOnlineV3.getSnapshot()?.publicState?.gold || 0,
      logText: document.getElementById("log")?.innerText || ""
    }));
    assert.equal(openRoomAudit.session, "ROOM_ACTIVE", JSON.stringify(openRoomAudit));
    assert.equal(openRoomAudit.canonicalGold, firstCanonicalGold, JSON.stringify(openRoomAudit));
    assert.equal(diagnostics.checkpointBodies.length, checkpointsBeforeFirstClear);
    assert.doesNotMatch(openRoomAudit.logText, /Room clear bonus: \+\d+ gold\./u);
    const lateChest = await page.evaluate(() => window.__DUNGEON_TEST_OPEN_LATE_CHEST?.());
    assert.deepEqual(lateChest, { opened: true, type: "normal" });
    assert.equal(await page.evaluate(() => window.DungeonOnlineV3.getSessionState()), "ROOM_ACTIVE");
    assert.equal(diagnostics.checkpointBodies.length, checkpointsBeforeFirstClear);
    await crossVisiblePortal(page, firstRoom.depth + 1);
    const firstGoldAudit = await page.evaluate(() => ({
      game: JSON.parse(window.render_game_to_text()),
      canonicalGold: window.DungeonOnlineV3.getSnapshot()?.publicState?.gold || 0,
      logText: document.getElementById("log")?.innerText || ""
    }));
    const firstCheckpoint = diagnostics.checkpointBodies.at(-1);
    assert(firstCheckpoint, "First Ranked portal did not send a checkpoint body");
    assert.equal(
      firstCheckpoint.rewardClaims
        .filter((claim) => ["enemy", "elite", "hazard"].includes(claim.claimType))
        .reduce((sum, claim) => sum + claim.count, 0),
      firstRoom.enemies.length
    );
    assert.equal(firstCheckpoint.rewardClaims.some((claim) => claim.claimType === "chest"), true);
    assert(firstGoldAudit.canonicalGold > firstCanonicalGold);
    assert.equal(firstGoldAudit.game.player.gold, firstGoldAudit.canonicalGold);
    assert.match(firstGoldAudit.logText, /Room clear bonus: \+\d+ gold\./u);
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-room-clear-gold-parity.png"),
      fullPage: true
    });

    await advanceVisibleRoom(page, firstRoom.depth + 2);
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-two-player-portals.png"),
      fullPage: true
    });

    await advanceVisibleRoom(page, firstRoom.depth + 3);

    const requestsBeforePreWardenClear = diagnostics.apiRequests.length;
    const preWardenSourceRoom = await visibleGameState(page);
    await clearVisibleRoom(page);
    assert.equal(await page.evaluate(() => window.DungeonOnlineV3.getSessionState()), "ROOM_ACTIVE");
    assert.equal(diagnostics.apiRequests.length, requestsBeforePreWardenClear);
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-warden-warning-before-entry.png"),
      fullPage: true
    });
    await crossVisiblePortal(page, firstRoom.depth + 4);
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
          .filter((element) => element.getClientRects().length).length,
        canvasGraphicsMode: document.querySelector("#game")?.dataset.graphicsMode || ""
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
      preWardenAudit.canvasGraphicsMode,
      "hd",
      `Ranked pre-Warden portal must render on the HD canvas: ${JSON.stringify(preWardenAudit)}`
    );
    assert.equal(
      diagnostics.apiRequests.length - requestsBeforePreWardenClear,
      1,
      "Ordinary room clear issued a next-room Warden relic before entering or clearing the boss"
    );
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-ordinary-clear-before-warden.png"),
      fullPage: true
    });

    assert.equal(await page.locator(".ranked-v3-choice-relic:visible").count(), 0);
    const wardenPotionsBefore = await page.evaluate(() => (
      window.DungeonOnlineV3.getSnapshot()?.publicState?.build?.resources?.potions || 0
    ));
    assert(wardenPotionsBefore > 0, "Warden potion regression requires a canonical potion");
    assert.equal(await page.evaluate(() => window.__DUNGEON_TEST_USE_POTION?.()), true);
    await clearVisibleRoom(page);
    assert.equal(await page.evaluate(() => window.DungeonOnlineV3.getSessionState()), "ROOM_ACTIVE");
    await enterVisiblePortal(page);
    await page.waitForFunction(() => [
      "AWAITING_REWARD_OR_TRANSACTION",
      "ENTERING_NEXT_ROOM",
      "ROOM_ACTIVE"
    ].includes(window.DungeonOnlineV3?.getSessionState?.()), null, { timeout: 15_000 });
    if (await page.locator(".ranked-v3-choice-relic:visible").count() > 0) {
      await page.screenshot({
        path: path.join(ARTIFACT_ROOT, "ranked-warden-relic-after-clear.png"),
        fullPage: true
      });
      await chooseRelicWithoutFatalPrevention(page);
    }
    await completeVisiblePortal(page, firstRoom.depth + 5);
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
    assert.equal(
      deathAudit.playedAudio.some((audioPath) => audioPath.endsWith("/assets/death.mp3")),
      false,
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
    const terminalLeaderboardAction = page.locator('.gameover-requiem-action[data-hd-key="2"]');
    assert.equal(await terminalLeaderboardAction.count(), 1, "Final Defeat Leaderboard action is missing");
    await terminalLeaderboardAction.click();
    const terminalLeaderboard = page.locator(
      ".ranked-v3-overlay:not(.hidden) .ranked-v3-reference-plate--leaderboard"
    );
    try {
      await terminalLeaderboard.waitFor({ state: "visible" });
    } catch (error) {
      const leaderboardFailure = await page.evaluate(() => ({
        phase: JSON.parse(window.render_game_to_text()).phase,
        rankedOverlay: document.querySelector(".ranked-v3-overlay:not(.hidden)")?.innerText || "",
        screenOverlay: document.querySelector("#screenOverlay")?.innerText || ""
      }));
      throw new Error(`Final Defeat leaderboard did not open: ${JSON.stringify({
        leaderboardFailure,
        network: diagnostics
      })}`, { cause: error });
    }
    assert.equal(
      await page.evaluate(() => JSON.parse(window.render_game_to_text()).phase),
      "menu",
      "Final Defeat Leaderboard action did not return the game to menu state"
    );
    const terminalTestRow = terminalLeaderboard.locator(
      '.ranked-v3-leaderboard-row.ranked-v3-test-run[data-ranked="false"]'
    ).first();
    await terminalTestRow.waitFor({ state: "visible" });
    assert.match(
      await terminalTestRow.innerText(),
      /TEST/,
      "Assisted Ranked result is not visibly marked as a non-ranked test run"
    );
    await terminalLeaderboard.locator(".ranked-v3-leaderboard-close").click();
    await page.waitForFunction(() => document.querySelector(".ranked-v3-overlay")?.hidden === true);
    const postTerminalPracticeApiBefore = diagnostics.apiRequests.length;
    await openNativeMenuOption(page, "Practice (Offline)");
    await page.waitForFunction(() => {
      const phase = JSON.parse(window.render_game_to_text()).phase;
      const overwriteContinue = document.querySelector(".overlay-card-confirm");
      return phase !== "menu" || Boolean(overwriteContinue?.getClientRects().length);
    });
    if (await page.locator(".overlay-card-confirm:visible").isVisible().catch(() => false)) {
      await page.keyboard.press("1");
    }
    await page.waitForFunction(() => ["relic", "playing"].includes(JSON.parse(window.render_game_to_text()).phase));
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
    await dismissBoot(page, diagnostics);
    const visualCatalog = await page.evaluate(() => ({
      relicIds: (Array.isArray(window.DungeonRelicData?.RELICS) ? window.DungeonRelicData.RELICS : [])
        .filter((relic) => relic?.id && (relic.icon || relic.iconSrc))
        .slice(0, 10)
        .map((relic) => relic.id),
      mutatorIds: (Array.isArray(window.DungeonMutatorData?.MUTATORS) ? window.DungeonMutatorData.MUTATORS : [])
        .filter((mutator) => mutator?.id)
        .slice(0, 3)
        .map((mutator) => mutator.id)
    }));
    assert.equal(visualCatalog.relicIds.length, 10, JSON.stringify(visualCatalog));
    assert.equal(visualCatalog.mutatorIds.length, 3, JSON.stringify(visualCatalog));
    const visualTopTen = [
      { playerName: "test", score: 43_600, depth: 19, gold: 8_550 },
      { playerName: "PortalSmoke1dc325c", score: 30_056, depth: 19, gold: 1_778 },
      { playerName: "test", score: 30_092, depth: 3, gold: 46 },
      { playerName: "CHAMPION-7f2a9b", score: 28_440, depth: 18, gold: 6_420 },
      { playerName: "MUTANT_KING", score: 25_810, depth: 17, gold: 5_310 },
      { playerName: "GrimDelver", score: 24_390, depth: 16, gold: 4_887 },
      { playerName: "AbyssWalker", score: 22_170, depth: 15, gold: 3_980 },
      { playerName: "Stonebound", score: 20_940, depth: 14, gold: 3_210 },
      { playerName: "DarkPilgrim", score: 19_305, depth: 13, gold: 2_860 },
      { playerName: "VoidReaper", score: 18_260, depth: 12, gold: 2_310 }
    ];
    const visualRows = Array.from({ length: 73 }, (_, index) => {
      const rank = index + 1;
      const fixture = visualTopTen[index] || {
        playerName: "Dreadwalker " + rank,
        score: 18_000 - (rank * 113),
        depth: Math.max(1, 19 - Math.floor(rank / 4)),
        gold: Math.max(0, 2_200 - (rank * 19))
      };
      return {
        runId: rank === 1 ? runId : "run_f" + rank.toString(16).padStart(8, "0"),
        rank,
        ...fixture,
        durationMs: 6_452_000,
        outcome: "defeat",
        verificationLevel: "checkpoint_verified_v3",
        createdAt: 1_786_000_000_000 - rank
      };
    });
    const visualDetail = {
      ...visualRows[0],
      season: SEASON,
      build: {
        relics: visualCatalog.relicIds.map((relicId, index) => ({ relicId, stacks: index === 2 ? 2 : 1 })),
        pacts: ["stored-but-hidden"],
        skillTiers: { dash: 3 },
        campUpgrades: { health: 4 },
        elixirs: [{ elixirId: "stored-but-hidden" }],
        runModifiers: {
          active: visualCatalog.mutatorIds.map((modifierId) => ({ modifierId }))
        }
      },
      summary: {
        durationMs: 6_452_000,
        roomsCompleted: 312,
        bossesCompleted: 7,
        gold: { earned: 8_550 },
        presentationCause: "Defeated by The Hollow Seraph"
      }
    };
    await page.route("**/api/v3/leaderboard**", async (route) => {
      const url = new URL(route.request().url());
      if (route.request().method() === "GET" && url.pathname === "/api/v3/leaderboard") {
        const cursor = url.searchParams.get("cursor") || "";
        const entries = cursor ? visualRows.slice(50) : visualRows.slice(0, 50);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            season: SEASON,
            status: "ready",
            entries,
            cursor: cursor ? null : "visual-cursor-50"
          })
        });
        return;
      }
      if (route.request().method() === "GET" && url.pathname === "/api/v3/leaderboard/" + runId) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, entry: visualDetail })
        });
        return;
      }
      await route.continue();
    });
    const leaderboardReturnFocus = await page.evaluateHandle(() => document.activeElement);
    await openNativeMenuOption(page, "Ranked Leaderboard");

    const leaderboardRecord = page.locator(".ranked-v3-leaderboard-row[data-record-rank]");
    await leaderboardRecord.first().waitFor({ state: "visible" });
    assert.match(
      await leaderboardRecord.first().textContent(),
      /test/u
    );

    const referencePlateAudit = await page.evaluate(async () => {
      const bounds = (selector) => {
        const box = document.querySelector(selector)?.getBoundingClientRect();
        return box ? { top: box.top, left: box.left, right: box.right, bottom: box.bottom, width: box.width, height: box.height } : null;
      };
      const plate = bounds(".ranked-v3-reference-plate");
      const title = document.querySelector(".ranked-v3-leaderboard-display-title");
      const titleRange = document.createRange();
      titleRange.selectNodeContents(title);
      const titleLines = [...titleRange.getClientRects()].filter((box) => box.width > 0 && box.height > 0).length;
      const nameBox = bounds('.ranked-v3-podium-slot[data-record-rank="1"] .record-archive-name');
      const scoreBox = bounds('.ranked-v3-podium-slot[data-record-rank="1"] .ranked-v3-leaderboard-score');
      const metaBox = bounds('.ranked-v3-podium-slot[data-record-rank="1"] .ranked-v3-podium-meta');
      const podiumInspect = document.querySelector('.ranked-v3-podium-slot[data-record-rank="1"] .ranked-v3-leaderboard-details-button');
      const centerXRatio = (selector) => {
        const box = document.querySelector(selector)?.getBoundingClientRect();
        return box ? ((box.left + box.width / 2) - plate.left) / plate.width : null;
      };
      const centerX = (selector) => {
        const box = document.querySelector(selector)?.getBoundingClientRect();
        return box ? box.left + box.width / 2 : null;
      };
      const firstLedgerRank = document.querySelector(".ranked-v3-ledger-slot[data-record-rank]")?.dataset.recordRank;
      const ledgerValueSelector = (className) => `.ranked-v3-ledger-slot[data-record-rank="${firstLedgerRank}"] .${className}`;
      const ledgerHeaderBox = (column) => document.querySelector(`.ranked-v3-leaderboard-column:nth-child(${column})`)?.getBoundingClientRect();
      const ledgerValueBox = (className) => document.querySelector(ledgerValueSelector(className))?.getBoundingClientRect();
      const signedCenterOffset = (header, value) => (
        value.left + value.width / 2 - (header.left + header.width / 2)
      );
      const nameHeaderBox = ledgerHeaderBox(2);
      const nameValueBox = ledgerValueBox("record-archive-name");
      const ledgerOffsets = {
        name: nameValueBox.left - nameHeaderBox.left,
        score: signedCenterOffset(ledgerHeaderBox(3), ledgerValueBox("ranked-v3-leaderboard-score")),
        depth: signedCenterOffset(ledgerHeaderBox(4), ledgerValueBox("ranked-v3-leaderboard-depth")),
        gold: signedCenterOffset(ledgerHeaderBox(5), ledgerValueBox("ranked-v3-leaderboard-gold")),
        inspect: signedCenterOffset(ledgerHeaderBox(6), ledgerValueBox("ranked-v3-leaderboard-details-button"))
      };
      const game = document.querySelector("#game");
      const hdMode = {
        dataMode: game?.dataset.graphicsMode || "",
        classActive: Boolean(game?.classList.contains("graphics-hd"))
      };
      game?.classList.remove("graphics-hd");
      game?.classList.add("graphics-classic");
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const classicArtDisplay = getComputedStyle(document.querySelector(".ranked-v3-reference-plate-art")).display;
      game?.classList.remove("graphics-classic");
      game?.classList.add("graphics-hd");
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return {
        plate,
        heading: bounds(".ranked-v3-leaderboard-heading"),
        podium: bounds(".ranked-v3-leaderboard-podium"),
        ledger: bounds(".ranked-v3-leaderboard-ledger"),
        nameRatio: (nameBox.top - plate.top) / plate.height,
        scoreRatio: (scoreBox.top - plate.top) / plate.height,
        metaRatio: (metaBox.top - plate.top) / plate.height,
        nameToScoreOffset: scoreBox.top - nameBox.top,
        scoreToMetaGap: metaBox.top - scoreBox.bottom,
        podiumRankDisplays: [...document.querySelectorAll(".ranked-v3-podium-slot[data-record-rank] .ranked-v3-leaderboard-rank")]
          .map((rank) => getComputedStyle(rank).display),
        accessibleRanks: [...document.querySelectorAll(".ranked-v3-podium-slot[data-record-rank] .ranked-v3-rank-label")]
          .map((rank) => rank.textContent),
        podiumInspectFontSize: getComputedStyle(podiumInspect).fontSize,
        nameFontSize: Number.parseFloat(getComputedStyle(document.querySelector('.ranked-v3-podium-slot[data-record-rank="1"] .record-archive-name')).fontSize),
        scoreFontSize: Number.parseFloat(getComputedStyle(document.querySelector('.ranked-v3-podium-slot[data-record-rank="1"] .ranked-v3-leaderboard-score')).fontSize),
        metaFontSize: Number.parseFloat(getComputedStyle(document.querySelector('.ranked-v3-podium-slot[data-record-rank="1"] .ranked-v3-podium-meta')).fontSize),
        columnFontSize: Number.parseFloat(getComputedStyle(document.querySelector(".ranked-v3-leaderboard-columns")).fontSize),
        ledgerFontSize: Number.parseFloat(getComputedStyle(document.querySelector(".ranked-v3-ledger-slot")).fontSize),
        depthFontSize: Number.parseFloat(getComputedStyle(document.querySelector(".ranked-v3-ledger-slot[data-record-rank] .ranked-v3-leaderboard-depth")).fontSize),
        goldFontSize: Number.parseFloat(getComputedStyle(document.querySelector(".ranked-v3-ledger-slot[data-record-rank] .ranked-v3-leaderboard-gold")).fontSize),
        populatedPodium: document.querySelectorAll(".ranked-v3-podium-slot[data-record-rank]").length,
        populatedLedger: document.querySelectorAll(".ranked-v3-ledger-slot[data-record-rank]").length,
        ledgerRowCenterRatios: [...document.querySelectorAll(".ranked-v3-ledger-slot[data-record-rank] .ranked-v3-leaderboard-rank")]
          .map((rank) => {
            const box = rank.getBoundingClientRect();
            return ((box.top + box.height / 2) - plate.top) / plate.height;
          }),
        ledgerRowLayout: (() => {
          const slot = document.querySelector(".ranked-v3-ledger-slot[data-record-rank]");
          const details = slot?.querySelector(".ranked-v3-leaderboard-details-button");
          return {
            rowGap: getComputedStyle(slot).rowGap,
            detailsGridRowEnd: getComputedStyle(details).gridRowEnd,
            detailsMinHeight: getComputedStyle(details).minHeight
          };
        })(),
        podiumCenters: [1, 2, 3].map((rank) => centerXRatio(`.ranked-v3-podium-slot[data-record-rank="${rank}"]`)),
        ledgerOffsets,
        titleLines,
        hdMode,
        classicArtDisplay,
        overflowX: document.documentElement.scrollWidth > innerWidth,
        overflowY: document.documentElement.scrollHeight > innerHeight
      };
    });
    assert.deepEqual(referencePlateAudit.hdMode, { dataMode: "hd", classActive: true });
    assert.equal(referencePlateAudit.classicArtDisplay, "none", "HD Ranked artwork leaked into Classic mode");
    assert.equal(referencePlateAudit.overflowX, false, JSON.stringify(referencePlateAudit));
    assert.equal(referencePlateAudit.overflowY, false, JSON.stringify(referencePlateAudit));
    assert.ok(referencePlateAudit.plate.top >= -1 && referencePlateAudit.plate.left >= -1, JSON.stringify(referencePlateAudit));
    assert.ok(referencePlateAudit.plate.right <= 1537 && referencePlateAudit.plate.bottom <= 1081, JSON.stringify(referencePlateAudit));
    assert.equal(referencePlateAudit.titleLines, 1, "Ranked Leaderboard title wrapped over the podium");
    assert.ok(referencePlateAudit.heading.bottom < referencePlateAudit.podium.top, JSON.stringify(referencePlateAudit));
    assert.ok(referencePlateAudit.podium.bottom < referencePlateAudit.ledger.top, JSON.stringify(referencePlateAudit));
    const expectedPodiumCenters = [0.5, 421 / 1536, 1115 / 1536];
    referencePlateAudit.podiumCenters.forEach((center, index) => {
      assert.ok(Math.abs(center - expectedPodiumCenters[index]) <= 0.008, JSON.stringify(referencePlateAudit));
    });
    for (const key of ["name", "score", "depth", "gold", "inspect"]) {
      assert.ok(Math.abs(referencePlateAudit.ledgerOffsets[key]) <= 3, JSON.stringify(referencePlateAudit));
    }
    const expectedLedgerRowCenters = [698.5, 743.25, 787.75, 832, 875.5, 919, 962.5]
      .map((center) => center / 1080);
    assert.equal(referencePlateAudit.ledgerRowCenterRatios.length, expectedLedgerRowCenters.length);
    referencePlateAudit.ledgerRowCenterRatios.forEach((center, index) => {
      assert.ok(
        Math.abs(center - expectedLedgerRowCenters[index]) <= 0.004,
        JSON.stringify({ expectedLedgerRowCenters, actual: referencePlateAudit.ledgerRowCenterRatios })
      );
    });
    assert.deepEqual(
      referencePlateAudit.ledgerRowLayout,
      { rowGap: "0px", detailsGridRowEnd: "auto", detailsMinHeight: "0px" },
      JSON.stringify(referencePlateAudit)
    );
    assert.deepEqual(referencePlateAudit.podiumRankDisplays, ["none", "none", "none"], JSON.stringify(referencePlateAudit));
    assert.deepEqual(referencePlateAudit.accessibleRanks, ["Rank 1", "Rank 2", "Rank 3"], JSON.stringify(referencePlateAudit));
    assert.ok(referencePlateAudit.nameRatio >= 0.445 && referencePlateAudit.nameRatio <= 0.458, JSON.stringify(referencePlateAudit));
    assert.ok(referencePlateAudit.scoreRatio >= 0.47 && referencePlateAudit.scoreRatio <= 0.52, JSON.stringify(referencePlateAudit));
    assert.ok(referencePlateAudit.metaRatio >= 0.518 && referencePlateAudit.metaRatio <= 0.535, JSON.stringify(referencePlateAudit));
    assert.ok(referencePlateAudit.nameToScoreOffset >= 17 && referencePlateAudit.nameToScoreOffset <= 24, JSON.stringify(referencePlateAudit));
    assert.ok(referencePlateAudit.scoreToMetaGap >= 8, JSON.stringify(referencePlateAudit));
    assert.equal(referencePlateAudit.podiumInspectFontSize, "0px", "Podium leaked a floating Inspect build label");
    await page.evaluate(() => document.activeElement?.blur());
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-leaderboard.png"),
      fullPage: true,
      animations: "disabled"
    });
    assert.equal(referencePlateAudit.populatedPodium, 3, JSON.stringify(referencePlateAudit));
    assert.equal(referencePlateAudit.populatedLedger, 7, JSON.stringify(referencePlateAudit));
    assert.ok(referencePlateAudit.nameFontSize >= 25, JSON.stringify(referencePlateAudit));
    assert.ok(referencePlateAudit.scoreFontSize >= 42, JSON.stringify(referencePlateAudit));
    assert.ok(referencePlateAudit.metaFontSize >= 15.5, JSON.stringify(referencePlateAudit));
    assert.ok(referencePlateAudit.columnFontSize >= 13, JSON.stringify(referencePlateAudit));
    assert.ok(referencePlateAudit.ledgerFontSize >= 17, JSON.stringify(referencePlateAudit));
    assert.ok(referencePlateAudit.depthFontSize >= 16, JSON.stringify(referencePlateAudit));
    assert.ok(referencePlateAudit.goldFontSize >= 16, JSON.stringify(referencePlateAudit));
    const baseViewport = page.viewportSize();
    const zoomViewportMatrix = [
      { zoom: 80, width: 1920, height: 1350 },
      { zoom: 90, width: 1707, height: 1200 },
      { zoom: 100, width: 1536, height: 1080 },
      { zoom: 110, width: 1396, height: 982 },
      { zoom: 125, width: 1229, height: 864 }
    ];
    for (const sample of zoomViewportMatrix) {
      await page.setViewportSize({ width: sample.width, height: sample.height });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const zoomAudit = await page.evaluate(() => {
        const plate = document.querySelector(".ranked-v3-reference-plate");
        const plateBox = plate.getBoundingClientRect();
        const rowSelectors = [
          ".ranked-v3-leaderboard-rank",
          ".record-archive-name",
          ".ranked-v3-leaderboard-score",
          ".ranked-v3-leaderboard-depth",
          ".ranked-v3-leaderboard-gold",
          ".ranked-v3-leaderboard-details-button"
        ];
        const rows = [...document.querySelectorAll(".ranked-v3-ledger-slot[data-record-rank]")].map((slot) => {
          const slotBox = slot.getBoundingClientRect();
          const rankBox = slot.querySelector(".ranked-v3-leaderboard-rank").getBoundingClientRect();
          return {
            centerRatio: ((rankBox.top + rankBox.height / 2) - plateBox.top) / plateBox.height,
            contentContained: rowSelectors.every((selector) => {
              const box = slot.querySelector(selector).getBoundingClientRect();
              return box.top >= slotBox.top - 1.5 && box.bottom <= slotBox.bottom + 1.5;
            })
          };
        });
        return {
          plate: {
            top: plateBox.top,
            left: plateBox.left,
            right: plateBox.right,
            bottom: plateBox.bottom,
            aspectRatio: plateBox.width / plateBox.height
          },
          rows,
          viewport: { width: innerWidth, height: innerHeight },
          overflowX: document.documentElement.scrollWidth > innerWidth,
          overflowY: document.documentElement.scrollHeight > innerHeight
        };
      });
      const details = JSON.stringify({ sample, zoomAudit });
      assert.equal(zoomAudit.rows.length, expectedLedgerRowCenters.length, details);
      assert.equal(zoomAudit.overflowX, false, details);
      assert.equal(zoomAudit.overflowY, false, details);
      assert.ok(zoomAudit.plate.top >= -1 && zoomAudit.plate.left >= -1, details);
      assert.ok(zoomAudit.plate.right <= zoomAudit.viewport.width + 1, details);
      assert.ok(zoomAudit.plate.bottom <= zoomAudit.viewport.height + 1, details);
      assert.ok(Math.abs(zoomAudit.plate.aspectRatio - (1536 / 1080)) <= 0.002, details);
      zoomAudit.rows.forEach((row, index) => {
        assert.ok(Math.abs(row.centerRatio - expectedLedgerRowCenters[index]) <= 0.004, details);
        assert.equal(row.contentContained, true, details);
      });
      await page.screenshot({
        path: path.join(ARTIFACT_ROOT, `ranked-leaderboard-zoom-${sample.zoom}.png`),
        fullPage: true,
        animations: "disabled"
      });
    }
    await page.setViewportSize(baseViewport);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const initialName = page.locator('.ranked-v3-podium-slot[data-record-rank="1"] .record-archive-name');
    await initialName.focus();
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-record-action")), "name");
    await page.keyboard.press("ArrowRight");
    assert.equal(
      await page.evaluate(() => document.activeElement?.getAttribute("data-record-action")),
      "inspect"
    );
    await page.keyboard.press("Enter");
    await page.locator(".ranked-v3-leaderboard-detail").waitFor({ state: "visible" });
    assert.match(
      await page.locator(".ranked-v3-leaderboard-detail").textContent(),
      /Build Loadout/u
    );
    const detailPlateAudit = await page.evaluate(() => {
      const fontSize = (selector) => Number.parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
      const equipment = [...document.querySelectorAll(".ranked-v3-inspect-equipment-slot[data-relic-index]")].map((slot) => {
        const slotBox = slot.getBoundingClientRect();
        const iconBox = slot.querySelector(".ranked-v3-inspect-equipment-icon, .ranked-v3-inspect-equipment-fallback")?.getBoundingClientRect();
        return {
          text: slot.textContent.trim(),
          tabindex: slot.getAttribute("tabindex"),
          tooltip: slot.getAttribute("data-record-tooltip") || "",
          centerDx: iconBox ? (iconBox.left + iconBox.width / 2) - (slotBox.left + slotBox.width / 2) : null,
          centerDy: iconBox ? (iconBox.top + iconBox.height / 2) - (slotBox.top + slotBox.height / 2) : null
        };
      });
      const chronicleAlignment = [...document.querySelectorAll(".ranked-v3-inspect-chronicle-row")].map((row) => {
        const rowBox = row.getBoundingClientRect();
        const labelBox = row.querySelector(".ranked-v3-inspect-chronicle-label").getBoundingClientRect();
        const valueBox = row.querySelector(".ranked-v3-inspect-chronicle-value, .ranked-v3-inspect-mutators").getBoundingClientRect();
        return {
          labelInset: labelBox.left - rowBox.left,
          valueInset: rowBox.right - valueBox.right
        };
      });
      const inspectHeader = document.querySelector(".ranked-v3-inspect-header");
      const inspectHeaderBox = inspectHeader.getBoundingClientRect();
      const headerSeparators = ["::before", "::after"].map((pseudo) => {
        const style = getComputedStyle(inspectHeader, pseudo);
        return {
          content: style.content,
          leftRatio: Number.parseFloat(style.left) / inspectHeaderBox.width,
          width: Number.parseFloat(style.width),
          height: Number.parseFloat(style.height)
        };
      });
      const terminal = document.querySelector(".ranked-v3-inspect-terminal");
      const terminalBox = terminal.getBoundingClientRect();
      const terminalTitle = terminal.querySelector(".ranked-v3-inspect-terminal-title");
      const terminalEyebrow = terminal.querySelector(".ranked-v3-inspect-terminal-eyebrow");
      const terminalCause = terminal.querySelector(".ranked-v3-inspect-terminal-cause");
      const terminalTitleBox = terminalTitle.getBoundingClientRect();
      const terminalEyebrowBox = terminalEyebrow.getBoundingClientRect();
      const terminalCauseBox = terminalCause.getBoundingClientRect();
      const inspectRank = document.querySelector(".ranked-v3-inspect-rank");
      const inspectRankBox = inspectRank.getBoundingClientRect();
      const originalRankText = inspectRank.textContent;
      inspectRank.textContent = "73";
      const twoDigitFits = inspectRank.scrollWidth <= inspectRank.clientWidth;
      inspectRank.textContent = originalRankText;
      return {
        rank: {
          text: inspectRank.textContent,
          fontSize: Number.parseFloat(getComputedStyle(inspectRank).fontSize),
          boxWidth: inspectRankBox.width,
          boxHeight: inspectRankBox.height,
          twoDigitFits
        },
        playerFontSize: fontSize(".ranked-v3-inspect-player"),
        scoreFontSize: fontSize(".ranked-v3-inspect-score"),
        statFontSize: fontSize(".ranked-v3-inspect-depth"),
        chronicleFontSize: fontSize(".ranked-v3-inspect-chronicle-row"),
        visibleEquipmentLabels: [...document.querySelectorAll(".ranked-v3-inspect-equipment-label")]
          .filter((label) => label.getClientRects().length > 0).length,
        equipment,
        chronicleAlignment,
        headerSeparators,
        inspectStats: [".ranked-v3-inspect-depth", ".ranked-v3-inspect-gold"].map((selector) => (
          [...document.querySelector(selector).children].map((node) => node.textContent)
        )),
        inspectStatMetrics: [".ranked-v3-inspect-depth", ".ranked-v3-inspect-gold"].map((selector) => {
          const stat = document.querySelector(selector);
          const label = stat.querySelector(".ranked-v3-inspect-stat-label");
          const value = stat.querySelector(".ranked-v3-inspect-stat-value");
          return {
            labelFontSize: Number.parseFloat(getComputedStyle(label).fontSize),
            valueFontSize: Number.parseFloat(getComputedStyle(value).fontSize),
            labelFontFamily: getComputedStyle(label).fontFamily,
            valueFontFamily: getComputedStyle(value).fontFamily
          };
        }),
        terminalLayout: {
          titleCenterDelta: Math.abs((terminalTitleBox.left + terminalTitleBox.width / 2) - (terminalBox.left + terminalBox.width / 2)),
          titleTopInset: terminalTitleBox.top - terminalBox.top,
          eyebrowLeftInset: terminalEyebrowBox.left - terminalBox.left,
          causeLeftInset: terminalCauseBox.left - terminalBox.left,
          eyebrowTextAlign: getComputedStyle(terminalEyebrow).textAlign,
          causeTextAlign: getComputedStyle(terminalCause).textAlign
        },
        actionLabels: [...document.querySelectorAll(".ranked-v3-inspect-actions button")].map((button) => button.textContent),
        backFontSize: fontSize(".ranked-v3-inspect-back"),
        occupiedSlots: document.querySelectorAll(".ranked-v3-inspect-equipment-slot[data-relic-index]").length,
        visibleIcons: [...document.querySelectorAll(".ranked-v3-inspect-equipment-icon")]
          .filter((icon) => icon.getClientRects().length > 0).length,
        chronicleLabels: [...document.querySelectorAll(".ranked-v3-inspect-chronicle-label")]
          .map((label) => label.textContent),
        terminalText: document.querySelector(".ranked-v3-inspect-terminal")?.textContent || "",
        tooltip: document.querySelector(".ranked-v3-inspect-mutators")?.getAttribute("data-record-tooltip") || ""
      };
    });
    const inspectTooltip = page.locator(".ranked-v3-inspect-tooltip");
    const inspectTooltipState = async (anchor) => anchor.evaluate((anchorNode) => {
      const panel = document.querySelector(".ranked-v3-inspect-tooltip");
      const plate = anchorNode.closest(".ranked-v3-reference-plate");
      const chronicle = plate?.querySelector(".ranked-v3-inspect-chronicle");
      const back = plate?.querySelector(".ranked-v3-inspect-back");
      const rect = (node) => {
        if (!node) return null;
        const box = node.getBoundingClientRect();
        return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
      };
      const overlap = (first, second) => Boolean(first && second
        && first.left < second.right
        && first.right > second.left
        && first.top < second.bottom
        && first.bottom > second.top);
      const panelBox = rect(panel);
      const plateBox = rect(plate);
      const chronicleBox = rect(chronicle);
      const backBox = rect(back);
      const style = panel ? getComputedStyle(panel) : null;
      const viewportWidth = Number(window.innerWidth || 0);
      const viewportHeight = Number(window.innerHeight || 0);
      return {
        content: panel?.textContent || "",
        anchorContent: anchorNode.getAttribute("data-record-tooltip") || "",
        anchor: rect(anchorNode),
        ariaHidden: panel?.getAttribute("aria-hidden") || "",
        hidden: Boolean(panel?.hidden),
        visible: Boolean(panel && !panel.hidden && panel.getAttribute("aria-hidden") === "false" && style?.display !== "none"),
        placement: panel?.getAttribute("data-placement") || "",
        active: document.activeElement === anchorNode,
        panel: panelBox,
        fontSize: Number.parseFloat(style?.fontSize || "0"),
        padding: {
          top: Number.parseFloat(style?.paddingTop || "0"),
          right: Number.parseFloat(style?.paddingRight || "0"),
          bottom: Number.parseFloat(style?.paddingBottom || "0"),
          left: Number.parseFloat(style?.paddingLeft || "0")
        },
        contained: Boolean(panelBox && plateBox
          && panelBox.left >= Math.max(plateBox.left, 0) - 1.5
          && panelBox.top >= Math.max(plateBox.top, 0) - 1.5
          && panelBox.right <= Math.min(plateBox.right, viewportWidth) + 1.5
          && panelBox.bottom <= Math.min(plateBox.bottom, viewportHeight) + 1.5),
        overlapsChronicle: overlap(panelBox, chronicleBox),
        overlapsBack: overlap(panelBox, backBox)
      };
    });
    const assertInspectTooltip = (state, placement, label) => {
      const details = JSON.stringify(state);
      assert.equal(state.visible, true, `${label}: tooltip hidden ${details}`);
      assert.equal(state.ariaHidden, "false", `${label}: aria-hidden ${details}`);
      assert.equal(state.content, state.anchorContent, `${label}: content mismatch ${details}`);
      assert.equal(state.placement, placement, `${label}: placement mismatch ${details}`);
      assert.ok(state.panel?.width > 0 && state.panel?.height > 0, `${label}: empty panel ${details}`);
      assert.ok(state.anchor?.width > 0 && state.anchor?.height > 0, `${label}: empty anchor ${details}`);
      if (placement === "below") {
        assert.ok(state.panel.top >= state.anchor.bottom + 4, `${label}: panel is not below anchor ${details}`);
      } else {
        assert.ok(state.panel.bottom <= state.anchor.top - 4, `${label}: panel is not above anchor ${details}`);
      }
      assert.ok(state.fontSize >= 28, `${label}: reference tooltip font too small ${details}`);
      for (const side of ["top", "right", "bottom", "left"]) {
        assert.ok(state.padding[side] >= 16, `${label}: reference tooltip padding too small ${details}`);
      }
      assert.equal(state.contained, true, `${label}: tooltip escaped plate or viewport ${details}`);
      assert.equal(state.overlapsChronicle, false, `${label}: tooltip overlaps Chronicle ${details}`);
      assert.equal(state.overlapsBack, false, `${label}: tooltip overlaps Back ${details}`);
    };
    const firstRelicSlot = page.locator(".ranked-v3-inspect-equipment-slot[data-relic-index]").first();
    await firstRelicSlot.hover();
    await inspectTooltip.waitFor({ state: "visible" });
    const firstHoverTooltip = await inspectTooltipState(firstRelicSlot);
    assertInspectTooltip(firstHoverTooltip, "below", "first-row hover");
    assert.match(firstHoverTooltip.content, /Stack x\d+/u, JSON.stringify(firstHoverTooltip));
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-leaderboard-detail-tooltip.png"),
      fullPage: true
    });
    await firstRelicSlot.focus();
    const firstFocusTooltip = await inspectTooltipState(firstRelicSlot);
    assertInspectTooltip(firstFocusTooltip, "below", "first-row focus");
    assert.equal(firstFocusTooltip.active, true, JSON.stringify(firstFocusTooltip));
    assert.equal(firstFocusTooltip.content, firstHoverTooltip.content, JSON.stringify({ firstHoverTooltip, firstFocusTooltip }));

    const secondRelicSlot = page.locator(".ranked-v3-inspect-equipment-slot[data-relic-index]").nth(5);
    await secondRelicSlot.hover();
    const secondHoverTooltip = await inspectTooltipState(secondRelicSlot);
    assertInspectTooltip(secondHoverTooltip, "above", "second-row hover");
    assert.match(secondHoverTooltip.content, /Non-stackable.*Stack x1/u, JSON.stringify(secondHoverTooltip));
    await secondRelicSlot.focus();
    const secondFocusTooltip = await inspectTooltipState(secondRelicSlot);
    assertInspectTooltip(secondFocusTooltip, "above", "second-row focus");
    assert.equal(secondFocusTooltip.active, true, JSON.stringify(secondFocusTooltip));
    assert.equal(secondFocusTooltip.content, secondHoverTooltip.content, JSON.stringify({ secondHoverTooltip, secondFocusTooltip }));
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-leaderboard-detail-long-tooltip.png"),
      fullPage: true
    });

    const mutatorsControl = page.locator(".ranked-v3-inspect-mutators");
    await mutatorsControl.hover();
    const mutatorHoverTooltip = await inspectTooltipState(mutatorsControl);
    assertInspectTooltip(mutatorHoverTooltip, "above", "mutators hover");
    assert.match(mutatorHoverTooltip.content, /Berserker.*Bulwark.*Alchemist/u, JSON.stringify(mutatorHoverTooltip));
    await mutatorsControl.focus();
    const mutatorFocusTooltip = await inspectTooltipState(mutatorsControl);
    assertInspectTooltip(mutatorFocusTooltip, "above", "mutators focus");
    assert.equal(mutatorFocusTooltip.active, true, JSON.stringify(mutatorFocusTooltip));
    assert.equal(mutatorFocusTooltip.content, mutatorHoverTooltip.content, JSON.stringify({ mutatorHoverTooltip, mutatorFocusTooltip }));
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-leaderboard-detail-mutators-tooltip.png"),
      fullPage: true
    });
    await page.evaluate(() => document.activeElement?.blur());
    await page.mouse.move(2, 2);
    await page.waitForTimeout(50);
    assert.equal(await inspectTooltip.getAttribute("aria-hidden"), "true");
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-leaderboard-detail.png"),
      fullPage: true
    });
    const rankGeometry = await page.evaluate(() => {
      const rankNode = document.querySelector(".ranked-v3-inspect-rank");
      const plateNode = rankNode?.closest(".ranked-v3-reference-plate");
      const original = {
        text: rankNode?.textContent || "",
        recordRank: rankNode?.getAttribute("data-record-rank") || "",
        digits: rankNode?.getAttribute("data-rank-digits") || ""
      };
      const samples = [1, 9, 10, 73].map((rank) => {
        rankNode.textContent = String(rank);
        rankNode.setAttribute("data-record-rank", String(rank));
        rankNode.setAttribute("data-rank-digits", rank >= 10 ? "double" : "single");
        const rankBox = rankNode.getBoundingClientRect();
        const plateBox = plateNode.getBoundingClientRect();
        const style = getComputedStyle(rankNode);
        const transformX = style.transform === "none" ? 0 : new DOMMatrixReadOnly(style.transform).m41;
        return {
          rank,
          digits: rankNode.getAttribute("data-rank-digits"),
          transformX,
          contained: rankBox.left >= plateBox.left - 1
            && rankBox.right <= plateBox.right + 1
            && rankBox.top >= plateBox.top - 1
            && rankBox.bottom <= plateBox.bottom + 1
        };
      });
      rankNode.textContent = original.text;
      rankNode.setAttribute("data-record-rank", original.recordRank);
      rankNode.setAttribute("data-rank-digits", original.digits);
      return samples;
    });
    for (const sample of rankGeometry) {
      const details = JSON.stringify(rankGeometry);
      assert.equal(sample.digits, sample.rank < 10 ? "single" : "double", details);
      assert.equal(sample.contained, true, details);
      if (sample.rank < 10) assert.ok(sample.transformX >= 3 && sample.transformX <= 8, details);
      else assert.ok(Math.abs(sample.transformX) <= 0.5, details);
    }
    const rankTransform = (rank) => rankGeometry.find((sample) => sample.rank === rank)?.transformX;
    assert.ok(Math.abs(rankTransform(1) - rankTransform(9)) <= 0.5, JSON.stringify(rankGeometry));
    assert.ok(Math.abs(rankTransform(10) - rankTransform(73)) <= 0.5, JSON.stringify(rankGeometry));
    assert.ok(rankTransform(1) - rankTransform(10) >= 3, JSON.stringify(rankGeometry));
    assert.ok(rankTransform(1) - rankTransform(10) <= 8, JSON.stringify(rankGeometry));
    assert.equal(detailPlateAudit.rank.text, "1", JSON.stringify(detailPlateAudit));
    assert.ok(detailPlateAudit.rank.fontSize >= 34, JSON.stringify(detailPlateAudit));
    assert.ok(detailPlateAudit.rank.boxHeight >= 34, JSON.stringify(detailPlateAudit));
    assert.ok(detailPlateAudit.rank.boxWidth >= 45, JSON.stringify(detailPlateAudit));
    assert.equal(detailPlateAudit.rank.twoDigitFits, true, JSON.stringify(detailPlateAudit));
    assert.ok(detailPlateAudit.playerFontSize >= 60, JSON.stringify(detailPlateAudit));
    assert.ok(detailPlateAudit.scoreFontSize >= 45, JSON.stringify(detailPlateAudit));
    assert.ok(detailPlateAudit.statFontSize >= 18.5, JSON.stringify(detailPlateAudit));
    assert.ok(detailPlateAudit.chronicleFontSize >= 17, JSON.stringify(detailPlateAudit));
    assert.ok(detailPlateAudit.backFontSize >= 20, JSON.stringify(detailPlateAudit));
    assert.deepEqual(detailPlateAudit.inspectStats, [["Depth", "19"], ["Gold", "8,550"]]);
    assert.deepEqual(detailPlateAudit.actionLabels, ["Back to Leaderboard"]);
    assert.ok(Math.abs(detailPlateAudit.headerSeparators[0].leftRatio - 0.447) <= 0.008, JSON.stringify(detailPlateAudit));
    assert.ok(Math.abs(detailPlateAudit.headerSeparators[1].leftRatio - 0.568) <= 0.008, JSON.stringify(detailPlateAudit));
    detailPlateAudit.headerSeparators.forEach((separator) => {
      assert.notEqual(separator.content, "none", JSON.stringify(detailPlateAudit));
      assert.ok(separator.width >= 0.9 && separator.width <= 2, JSON.stringify(detailPlateAudit));
      assert.ok(separator.height >= 55 && separator.height <= 80, JSON.stringify(detailPlateAudit));
    });
    detailPlateAudit.inspectStatMetrics.forEach((stat) => {
      assert.ok(stat.labelFontSize >= 11 && stat.labelFontSize <= 14, JSON.stringify(detailPlateAudit));
      assert.ok(stat.valueFontSize >= 20, JSON.stringify(detailPlateAudit));
      assert.ok(stat.valueFontSize >= stat.labelFontSize * 1.5, JSON.stringify(detailPlateAudit));
      assert.match(stat.labelFontFamily, /Courier New/iu, JSON.stringify(detailPlateAudit));
      assert.match(stat.valueFontFamily, /Georgia/iu, JSON.stringify(detailPlateAudit));
    });
    assert.ok(detailPlateAudit.terminalLayout.titleCenterDelta <= 2, JSON.stringify(detailPlateAudit));
    assert.ok(detailPlateAudit.terminalLayout.titleTopInset >= 10 && detailPlateAudit.terminalLayout.titleTopInset <= 24, JSON.stringify(detailPlateAudit));
    assert.ok(detailPlateAudit.terminalLayout.eyebrowLeftInset >= 110 && detailPlateAudit.terminalLayout.eyebrowLeftInset <= 145, JSON.stringify(detailPlateAudit));
    assert.ok(detailPlateAudit.terminalLayout.causeLeftInset >= 110 && detailPlateAudit.terminalLayout.causeLeftInset <= 145, JSON.stringify(detailPlateAudit));
    assert.equal(detailPlateAudit.terminalLayout.eyebrowTextAlign, "left", JSON.stringify(detailPlateAudit));
    assert.equal(detailPlateAudit.terminalLayout.causeTextAlign, "left", JSON.stringify(detailPlateAudit));
    assert.equal(detailPlateAudit.visibleEquipmentLabels, 0, JSON.stringify(detailPlateAudit));
    detailPlateAudit.equipment.forEach((slot) => {
      assert.equal(slot.text, "", JSON.stringify(detailPlateAudit));
      assert.equal(slot.tabindex, "0", JSON.stringify(detailPlateAudit));
      assert.match(slot.tooltip, /.+ \| .+ \| Stack x\d+/u, JSON.stringify(detailPlateAudit));
      assert.ok(Math.abs(slot.centerDx) <= 6, JSON.stringify(detailPlateAudit));
      assert.ok(Math.abs(slot.centerDy) <= 6, JSON.stringify(detailPlateAudit));
    });
    detailPlateAudit.chronicleAlignment.forEach(({ labelInset, valueInset }) => {
      assert.ok(labelInset >= 58 && labelInset <= 70, JSON.stringify(detailPlateAudit));
      assert.ok(valueInset >= 15 && valueInset <= 30, JSON.stringify(detailPlateAudit));
    });
    assert.equal(detailPlateAudit.occupiedSlots, 10, JSON.stringify(detailPlateAudit));
    assert.equal(detailPlateAudit.visibleIcons, 10, JSON.stringify(detailPlateAudit));
    assert.deepEqual(detailPlateAudit.chronicleLabels, [
      "Time Played", "Rooms Cleared", "Bosses Defeated", "Mutators",
      "Highest Depth", "Gold Earned", "Final Score"
    ]);
    assert.match(detailPlateAudit.terminalText, /Game Over.*Fell in combat.*Defeated by The Hollow Seraph/isu);
    assert.equal(detailPlateAudit.tooltip.includes(" | "), true, detailPlateAudit.tooltip);
    await firstRelicSlot.focus();
    await page.keyboard.press("Escape");
    await page.getByText("Page 1 / 10", { exact: true }).waitFor({ state: "visible" });
    await page.waitForFunction((expectedRunId) => {
      const active = document.activeElement;
      return active?.getAttribute("data-record-nav-region") === "row"
        && active?.getAttribute("data-record-action") === "inspect"
        && active?.getAttribute("data-record-run-id") === expectedRunId;
    }, runId);
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-record-action")), "inspect");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-record-run-id")), runId);

    await page.keyboard.press("PageDown");
    await page.getByText("Page 2 / 10", { exact: true }).waitFor({ state: "visible" });
    assert.deepEqual(
      await page.locator(".ranked-v3-podium-slot[data-record-rank]").evaluateAll((slots) => slots.map((slot) => Number(slot.dataset.recordRank))),
      [1, 2, 3]
    );
    assert.deepEqual(
      await page.locator(".ranked-v3-ledger-slot[data-record-rank]").evaluateAll((slots) => slots.map((slot) => Number(slot.dataset.recordRank))),
      [11, 12, 13, 14, 15, 16, 17]
    );
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-leaderboard-page-2.png"),
      fullPage: true
    });
    await page.keyboard.press("PageUp");
    await page.getByText("Page 1 / 10", { exact: true }).waitFor({ state: "visible" });
    await waitForLeaderboardRenderFocus(page);

    const pageOneLastInspect = page.locator('.ranked-v3-ledger-slot[data-record-rank="10"] .ranked-v3-leaderboard-details-button');
    await pageOneLastInspect.focus();
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-record-action")), "next");
    await page.keyboard.press("ArrowLeft");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-record-action")), "close");
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-record-action")), "next");
    await page.keyboard.press("Enter");
    await page.getByText("Page 2 / 10", { exact: true }).waitFor({ state: "visible" });
    await waitForLeaderboardRenderFocus(page);

    const pageTwoLastInspect = page.locator('.ranked-v3-ledger-slot[data-record-rank="17"] .ranked-v3-leaderboard-details-button');
    await pageTwoLastInspect.focus();
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-record-action")), "previous");
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-record-action")), "next");
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-record-action")), "close");
    await page.keyboard.press("ArrowLeft");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-record-action")), "next");
    await page.keyboard.press("Enter");
    await page.getByText("Page 3 / 10", { exact: true }).waitFor({ state: "visible" });

    for (let targetPage = 4; targetPage <= 10; targetPage += 1) {
      const previousPage = targetPage - 1;
      const previousLastRank = 3 + previousPage * 7;
      await waitForLeaderboardRenderFocus(page);
      const lastInspect = page.locator(`.ranked-v3-ledger-slot[data-record-rank="${previousLastRank}"] .ranked-v3-leaderboard-details-button`);
      await lastInspect.focus();
      await page.keyboard.press("ArrowDown");
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-record-action")), "previous");
      await page.keyboard.press("ArrowRight");
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-record-action")), "next");
      await page.keyboard.press("Enter");
      await page.getByText("Page " + targetPage + " / 10", { exact: true }).waitFor({ state: "visible" });
    }
    assert.deepEqual(
      await page.locator(".ranked-v3-ledger-slot[data-record-rank]").evaluateAll((slots) => slots.map((slot) => Number(slot.dataset.recordRank))),
      [67, 68, 69, 70, 71, 72, 73]
    );
    assert.equal(await page.getByRole("button", { name: "Next page", exact: true }).isDisabled(), true);
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-leaderboard-page-10.png"),
      fullPage: true
    });
    await waitForLeaderboardRenderFocus(page);
    const finalLastInspect = page.locator('.ranked-v3-ledger-slot[data-record-rank="73"] .ranked-v3-leaderboard-details-button');
    await finalLastInspect.focus();
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-record-action")), "previous");
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-record-action")), "close");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector(".ranked-v3-overlay")?.hidden === true);
    await page.waitForFunction((opener) => document.activeElement === opener, leaderboardReturnFocus);
    const finalCloseFocus = await page.evaluate((opener) => ({
      sameNode: document.activeElement === opener,
      insideHiddenOverlay: Boolean(document.querySelector(".ranked-v3-overlay")?.contains(document.activeElement))
    }), leaderboardReturnFocus);
    assert.equal(finalCloseFocus.sameNode, true, JSON.stringify(finalCloseFocus));
    assert.equal(finalCloseFocus.insideHiddenOverlay, false, JSON.stringify(finalCloseFocus));
    await leaderboardReturnFocus.dispose();
    }

    if (RUN_CAMP) {
    await page.evaluate(() => {
      localStorage.setItem("dungeonOneRoomTotalKills", "200");
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await dismissBoot(page, diagnostics);
    await page.evaluate((password) => {
      window.prompt = () => password;
    }, TEST_BOT_PASSWORD);
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
    assert.equal(await page.evaluate(() => window.DungeonOnlineV3.getSessionState()), "ROOM_ACTIVE");
    await page.keyboard.press("q");
    await checkpointStarted;
    await page.waitForFunction(() => (
      JSON.parse(window.render_game_to_text()).rankedHudStatus?.syncing === true
    ));
    assert.equal(
      await page.locator(".ranked-run-player-status.is-syncing").count(),
      1,
      "A pending Ranked checkpoint should add the amber synchronization ring"
    );
    assert.equal(
      await page.evaluate(() => window.DungeonOnlineV3.getSessionState()),
      "RESOLVING_ROOM"
    );
    await page.getByText("Extracting…", { exact: true }).waitFor({ state: "visible" });
    assert.equal(await page.getByRole("heading", { name: "Ranked reconnect required" }).count(), 0);
    releaseCheckpoint();
    await sessionState(page, "FINALIZED");
    await page.unroute("**/api/v3/runs/checkpoint");
    await page.waitForFunction(() => {
      const game = JSON.parse(window.render_game_to_text());
      return game.phase === "camp" || Boolean(document.querySelector(".camp-revamp"));
    }, null, { timeout: 15_000 });
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
    const extractedScore = campAudit.snapshot?.publicState?.score;
    assert(extractedScore, JSON.stringify(campAudit));
    assert(Number.isSafeInteger(extractedScore.score), JSON.stringify(campAudit));

    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-camp.png"),
      fullPage: true
    });
    await page.locator('.camp-revamp-tab[data-camp-view="mutators"]').click();
    const berserkerRow = page.locator(".camp-revamp-mutator", { hasText: "Berserker" }).first();
    await berserkerRow.waitFor({ state: "visible" });
    assert.equal(await berserkerRow.getAttribute("aria-disabled"), "true");
    assert.match(await berserkerRow.innerText(), /Berserker[\s\S]*LOCKED/u);
    const separatedMutatorAudit = await page.evaluate(() => ({
      unlocked: window.DungeonOnlineV3.getSnapshot().publicState.mutatorProgress.unlockedMutatorIds,
      active: window.DungeonOnlineV3.getSnapshot().publicState.runModifiers.active
        .map((entry) => entry.modifierId)
    }));
    assert.deepEqual(separatedMutatorAudit.unlocked, []);
    assert.deepEqual(separatedMutatorAudit.active, []);

    const mutatorRequestsBefore = diagnostics.apiRequests.length;
    await berserkerRow.dispatchEvent("click");
    assert.equal(
      diagnostics.apiRequests.slice(mutatorRequestsBefore)
        .filter((entry) => entry.path === "/api/v3/profiles/camp").length,
      0,
      "Locked Practice progress triggered a Ranked Camp mutation"
    );
    assert.equal(await berserkerRow.getAttribute("aria-disabled"), "true");
    assert.match(await berserkerRow.innerText(), /Berserker[\s\S]*LOCKED/u);
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-camp-practice-mutator-locked.png"),
      fullPage: true
    });

    await page.locator('.camp-revamp-tab[data-camp-view="shop"]').click();
    const affordableUpgrade = page.locator(
      '.camp-revamp-upgrade[aria-disabled="false"]'
    ).first();
    await affordableUpgrade.waitFor({ state: "visible" });
    const upgradeBefore = await affordableUpgrade.innerText();
    const upgradeRequestsBefore = diagnostics.apiRequests.length;
    await affordableUpgrade.click();
    let upgradeWaitTimedOut = false;
    try {
      await page.waitForFunction((before) => {
        const row = [...document.querySelectorAll(".camp-revamp-upgrade")]
          .find((candidate) => candidate.getClientRects().length > 0);
        const savingVisible = [...document.querySelectorAll(".ranked-v3-overlay")]
          .some((overlay) =>
            overlay.getClientRects().length > 0 &&
            /Saving progress/iu.test(overlay.textContent || "")
          );
        return Boolean(row && row.innerText !== before && !savingVisible);
      }, upgradeBefore, { timeout: 15_000 });
    } catch (error) {
      if (error?.name !== "TimeoutError") throw error;
      upgradeWaitTimedOut = true;
    }
    if (upgradeWaitTimedOut) {
      const diagnostic = await page.evaluate(() => ({
        game: JSON.parse(window.render_game_to_text()),
        session: window.DungeonOnlineV3?.getSessionState?.() || "",
        snapshot: window.DungeonOnlineV3?.getSnapshot?.() || null,
        overlay: document.querySelector(".ranked-v3-overlay")?.textContent || "",
        rows: [...document.querySelectorAll(".camp-revamp-upgrade")].map((row) => ({
          text: row.innerText || "",
          disabled: row.getAttribute("aria-disabled"),
          visible: Boolean(row.getClientRects().length)
        }))
      }));
      diagnostic.apiRequests = diagnostics.apiRequests.slice(upgradeRequestsBefore);
      diagnostic.apiErrors = diagnostics.apiErrors;
      diagnostic.debugMessages = diagnostics.debugMessages.slice(-20);
      await fsPromises.writeFile(
        path.join(ARTIFACT_ROOT, "camp-upgrade-diagnostic.json"),
        `${JSON.stringify(diagnostic, null, 2)}\n`,
        "utf8"
      );
      await page.screenshot({
        path: path.join(ARTIFACT_ROOT, "camp-upgrade-diagnostic.png"),
        fullPage: true
      });
      throw new Error(`Camp upgrade did not update: ${JSON.stringify(diagnostic)}`);
    }
    const upgradeAudit = await page.evaluate(() => {
      const row = [...document.querySelectorAll(".camp-revamp-upgrade")]
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
    try {
      await page.waitForFunction(() => (
        window.DungeonOnlineV3?.getSessionState?.() === "ROOM_ACTIVE" ||
        Boolean(document.querySelector(".ranked-v3-choice-relic")) ||
        /Ranked Unavailable/u.test(document.querySelector(".ranked-v3-overlay")?.textContent || "")
      ), null, { timeout: 15_000 });
    } catch (error) {
      const startAudit = await page.evaluate(() => ({
        session: window.DungeonOnlineV3?.getSessionState?.(),
        snapshot: window.DungeonOnlineV3?.getSnapshot?.(),
        overlay: document.querySelector(".ranked-v3-overlay")?.textContent || ""
      }));
      throw new Error(`NEXT_RANKED_START_TIMEOUT:${JSON.stringify({
        startAudit,
        apiRequests: diagnostics.apiRequests.slice(nextRunRequestsBefore),
        apiErrors: diagnostics.apiErrors,
        debugMessages: diagnostics.debugMessages.slice(nextRunDebugBefore)
      })}`, { cause: error });
    }
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

    await page.waitForFunction(() => {
      const game = JSON.parse(window.render_game_to_text?.() || "{}");
      const hud = document.querySelector("#hud");
      const onlineOverlayVisible = [...document.querySelectorAll(".ranked-v3-overlay")]
        .some((overlay) => overlay.getClientRects().length > 0);
      return game.phase === "playing" &&
        Boolean(hud?.getClientRects().length) &&
        !onlineOverlayVisible;
    }, null, { timeout: 15_000 });
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
    const nextRunScore = nextRunAudit.snapshot?.publicState?.score;
    assert(nextRunScore, JSON.stringify(nextRunAudit));
    assert.deepEqual(nextRunScore.inputs, extractedScore.inputs);
    assert.equal(nextRunScore.score, extractedScore.score);
    assert.deepEqual(nextRunAudit.snapshot.publicState.campaign?.scoreCarry, {
      highWaterDepth: extractedScore.inputs.acceptedMaxDepth,
      earnedGold: extractedScore.inputs.acceptedRunGoldEarned
    });
    const nextRunHud = await page.locator("#hud").innerText();
    assert.match(
      nextRunHud,
      new RegExp(`Run Score\\s+${nextRunScore.score}\\b`, "u"),
      nextRunHud
    );
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "ranked-camp-next-run-score.png"),
      fullPage: true
    });

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
      if (message.type() === "warning") diagnostics.consoleWarnings.push(message.text());
      if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
      if (message.type() === "debug") diagnostics.debugMessages.push(message.text());
    });
    recoveryPage.on("pageerror", (error) => diagnostics.pageErrors.push(String(error?.stack || error)));
    await recoveryPage.goto(`${proxy.baseUrl}/`, { waitUntil: "domcontentloaded" });
    await recoveryPage.waitForFunction(() => typeof window.render_game_to_text === "function");
    await dismissBoot(recoveryPage, diagnostics);
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
    await page.waitForFunction(() => {
      const game = JSON.parse(window.render_game_to_text());
      return game.phase === "camp" && (
        Boolean(document.querySelector(".camp-revamp")) ||
        /Camp Guide/u.test(game.overlayText)
      );
    }, null, { timeout: 15_000 });
    const restartedCampAudit = await page.evaluate(() => ({
      game: JSON.parse(window.render_game_to_text()),
      nativeCamp: Boolean(document.querySelector(".camp-revamp"))
    }));
    assert.equal(restartedCampAudit.game.phase, "camp", JSON.stringify(restartedCampAudit));
    if (!restartedCampAudit.nativeCamp && /Camp Guide/u.test(restartedCampAudit.game.overlayText)) {
      await page.keyboard.press("h");
      await page.waitForFunction(() => !/Camp Guide/u.test(JSON.parse(window.render_game_to_text()).overlayText));
    }
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
    }

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
    const expectedDroppedErrors =
      (RUN_RECOVERY ? 3 : 0) +
      (RUN_LIFECYCLE ? 1 : 0) +
      (RUN_CAMP ? 3 : 0);
    assert.equal(expectedDroppedResponseErrors.length, expectedDroppedErrors);
    assert.equal(expectedEndedRecoveryErrors.length, RUN_CAMP ? 1 : 0);
    assert.equal(expectedStaleProfileErrors.length, RUN_RECOVERY ? 1 : 0);
    assert.equal(expectedCampStartErrors.length, RUN_CAMP ? 1 : 0);
    assert.deepEqual(unexpectedConsoleErrors, []);
    assert.deepEqual(diagnostics.pageErrors, []);
    const summary = {
      mode: HEADLESS ? "headless" : "headed",
      scenario: SCENARIO,
      runId: runId || null,
      rankedLifecycleScenarios: RUN_LIFECYCLE ? 1 : 0,
      rewardBoundaryScenarios: RUN_LIFECYCLE ? 1 : 0,
      wardenPotionCheckpointScenarios: RUN_LIFECYCLE ? 1 : 0,
      deathPresentationScenarios: RUN_LIFECYCLE ? 1 : 0,
      networkLossScenarios: RUN_LIFECYCLE ? 1 : 0,
      reloadRecoveryScenarios: RUN_LIFECYCLE ? 1 : 0,
      multiTabTakeoverScenarios: RUN_LIFECYCLE ? 1 : 0,
      observerBotForgePortalScenarios: RUN_LIFECYCLE ? 1 : 0,
      campLifecycleScenarios: RUN_CAMP ? 1 : 0,
      mutatorToggleScenarios: 0,
      practiceSeparationScenarios: RUN_CAMP ? 1 : 0,
      nextRunProfileScenarios: RUN_CAMP ? 1 : 0,
      checkpointExtractionScenarios: RUN_CAMP ? 1 : 0,
      campErrorMainMenuScenarios: RUN_CAMP ? 1 : 0,
      endedRecoveryRestartScenarios: RUN_CAMP ? 1 : 0,
      staleProfileRepairScenarios: RUN_RECOVERY ? 1 : 0,
      storageQuotaRecoveryScenarios: RUN_RECOVERY ? 1 : 0,
      activeCombatApiRequests: 0,
      finalizeAttempts: diagnostics.finalizeOperationIds.length,
      uniqueFinalizeOperationIds: new Set(diagnostics.finalizeOperationIds).size,
      leaderboardRowsForRun: RUN_LIFECYCLE ? await d1Count(runId) : null,
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
      `Online v3 Ranked headed PASS (scenario ${SCENARIO}; ${summary.rankedLifecycleScenarios} lifecycle, ` +
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
    const workerLogs = worker ? worker.getLogs().replaceAll(secret, "[redacted]").trim() : "";
    await browser.close();
    await closeServer(proxy.server);
    if (worker) {
      worker.child.kill();
      await waitForExit(worker.child);
      if (worker.child.exitCode === null) {
        worker.child.kill("SIGKILL");
        await waitForExit(worker.child);
      }
      assert.equal(worker.getLogs().includes(secret), false);
    }
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
