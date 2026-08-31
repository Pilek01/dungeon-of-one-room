import { access as defaultAccess } from "node:fs/promises";
import { chromium as defaultChromium } from "playwright-core";

import { placeNativeChromeWindow } from "./local-ranked-native-window.mjs";
import { assignedStartingRelicIndex } from "./local-ranked-multi-bot-domain.mjs";
import { launchMutedPersistentContext } from "./playwright-muted-launch.mjs";

const CHROME_CANDIDATES = Object.freeze([
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
]);

const MAX_RING_ENTRIES = 200;

export async function resolveChromeExecutable(options = {}) {
  const access = options.access || defaultAccess;
  const candidates = options.candidates || CHROME_CANDIDATES;
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  throw new Error("Google Chrome was not found in a supported installation path.");
}

function createRedactor(secrets = []) {
  const values = secrets.map(String).filter(Boolean).sort((left, right) => right.length - left.length);
  return (value) => values.reduce(
    (text, secret) => text.replaceAll(secret, "[REDACTED]"),
    String(value ?? "")
  );
}

function pushRing(ring, value) {
  ring.push(value);
  if (ring.length > MAX_RING_ENTRIES) ring.splice(0, ring.length - MAX_RING_ENTRIES);
}

function createOwnedBotRuntime(options) {
  const { context, page, cdp } = options;
  const redact = createRedactor(options.secrets);
  const consoleRing = [];
  const networkErrors = [];
  const pageErrors = [];
  let stopped = false;

  page.on("console", (message) => {
    pushRing(consoleRing, `${message.type?.() || "log"}: ${redact(message.text?.() || message)}`);
  });
  page.on("pageerror", (error) => pushRing(pageErrors, redact(error?.stack || error?.message || error)));
  page.on("requestfailed", (request) => {
    pushRing(networkErrors, Object.freeze({
      method: String(request.method?.() || ""),
      url: redact(request.url?.() || ""),
      error: redact(request.failure?.()?.errorText || "request failed")
    }));
  });
  page.on("response", (response) => {
    if (response.status?.() < 400) return;
    pushRing(networkErrors, Object.freeze({
      method: String(response.request?.().method?.() || ""),
      url: redact(response.url?.() || ""),
      status: Number(response.status?.()) || 0
    }));
  });

  return Object.freeze({
    bot: options.bot,
    bounds: options.bounds,
    context,
    page,
    cdp,
    windowId: options.windowId,
    consoleRing,
    networkErrors,
    pageErrors,
    redact,
    async focus() {
      await page.bringToFront();
    },
    async stop() {
      if (stopped) return;
      stopped = true;
      await page.evaluate(() => window.__DUNGEON_MULTI_BOT_TELEMETRY__?.stopObserverBot?.()).catch(() => {});
      await context.close();
    }
  });
}

export async function launchBotWindow(options) {
  const chromium = options.chromium || defaultChromium;
  const context = await launchMutedPersistentContext(chromium, options.bot.profileDir, {
    executablePath: options.chromeExecutable,
    headless: false,
    viewport: null,
    ignoreDefaultArgs: ["about:blank"],
    acceptDownloads: true,
    args: [
      "--app=about:blank",
      "--force-device-scale-factor=1",
      `--window-position=${options.bounds.x},${options.bounds.y}`,
      `--window-size=${options.bounds.width},${options.bounds.height}`,
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
  const nativeWindowPlacer = options.nativeWindowPlacer || placeNativeChromeWindow;
  try {
    await nativeWindowPlacer({
      bot: options.bot,
      bounds: options.bounds,
      cdp,
      windowId,
      execFile: options.nativeWindowExecFile
    });
  } catch (error) {
    await context.close().catch(() => {});
    throw error;
  }
  return createOwnedBotRuntime({ context, page, cdp, windowId, ...options });
}

export async function startBotRun(runtime, options) {
  const { page } = runtime;
  await page.goto(options.url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.render_game_to_text === "function");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("#bootScreen")?.classList.contains("hidden"));
  await page.waitForFunction(() => document.querySelector("#game")?.dataset.graphicsMode === "hd");
  await page.waitForFunction(() => typeof window.DungeonOnlineV3Menu?.openRanked === "function");
  await page.evaluate(() => window.DungeonOnlineV3Menu.openRanked());

  const startNew = page.getByRole("button", { name: "Start New Ranked", exact: true });
  if (await startNew.isVisible().catch(() => false)) {
    await startNew.click();
  } else {
    await page.getByRole("button", { name: "Start Ranked", exact: true }).click();
  }
  const startingRelics = page.locator(".ranked-v3-choice-relic");
  await startingRelics.first().waitFor({ state: "visible" });
  const startingRelicCount = await startingRelics.count();
  const startingRelicIndex = assignedStartingRelicIndex(
    runtime.bot.index,
    startingRelicCount
  );
  await startingRelics.nth(startingRelicIndex).click();
  await page.waitForFunction(() => window.DungeonOnlineV3?.getSessionState?.() === "ROOM_ACTIVE");
  await page.evaluate((password) => { window.prompt = () => password; }, options.password);
  await page.keyboard.press("F9");
  await page.locator(".overlay-card-debug-cheats").waitFor({ state: "visible" });
  await page.keyboard.press("b");
  await page.waitForFunction(() => window.DungeonOnlineV3GameBridge?.isRankedTestBotActive?.() === true);
  await page.keyboard.press("F9");
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).rankedHudStatus?.kind === "observer");

  return Object.freeze({ botId: runtime.bot.id, status: "running" });
}
