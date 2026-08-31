import assert from "node:assert/strict";
import test from "node:test";

import {
  launchBotWindow,
  resolveChromeExecutable,
  startBotRun
} from "../scripts/local-ranked-multi-bot-browser.mjs";

const X86_CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";

test("discovers the installed x86 Chrome without downloading a browser", async () => {
  const checked = [];
  const executable = await resolveChromeExecutable({
    access: async (candidate) => {
      checked.push(candidate);
      if (candidate !== X86_CHROME) throw Object.assign(new Error("missing"), { code: "ENOENT" });
    }
  });
  assert.equal(executable, X86_CHROME);
  assert.deepEqual(checked, [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    X86_CHROME
  ]);
});

function createLaunchHarness() {
  const calls = { launches: [], initScripts: [], cdp: [], events: [] };
  const page = {
    on(name) { calls.events.push(name); },
    async bringToFront() { calls.focused = true; },
    async evaluate() { return true; }
  };
  const cdp = {
    async send(method, value) {
      calls.cdp.push([method, value]);
      if (method === "Browser.getWindowForTarget") return { windowId: 71 };
      if (method === "SystemInfo.getProcessInfo") {
        return { processInfo: [{ type: "browser", id: 42764 }] };
      }
      return {};
    }
  };
  const context = {
    addInitScript(fn, value) { calls.initScripts.push([fn, value]); },
    pages() { return [page]; },
    async newPage() { throw new Error("existing app page should be reused"); },
    async newCDPSession(receivedPage) {
      assert.equal(receivedPage, page);
      return cdp;
    },
    async close() { calls.closed = (calls.closed || 0) + 1; }
  };
  const chromium = {
    async launchPersistentContext(profileDir, options) {
      calls.launches.push([profileDir, options]);
      return context;
    }
  };
  return { calls, chromium, context, page };
}

test("launches a visible isolated HD app window at the exact portrait tile", async () => {
  const harness = createLaunchHarness();
  const bot = { id: "bot-01", name: "bot 1", profileDir: "D:/runs/session/profiles/bot-01" };
  const bounds = { x: 3440, y: 0, width: 540, height: 468 };
  const nativePlacements = [];
  const runtime = await launchBotWindow({
    bot,
    bounds,
    chromeExecutable: X86_CHROME,
    chromium: harness.chromium,
    nativeWindowPlacer: async (request) => {
      nativePlacements.push(request);
      return { left: 3440, top: 0, width: 540, height: 468 };
    },
    secrets: ["observer-secret"]
  });

  assert.equal(harness.calls.launches[0][0], bot.profileDir);
  const launchOptions = harness.calls.launches[0][1];
  assert.equal(launchOptions.headless, false);
  assert.equal(launchOptions.viewport, null);
  assert.equal(launchOptions.executablePath, X86_CHROME);
  assert.deepEqual(launchOptions.ignoreDefaultArgs, ["about:blank"],
    "Playwright's positional blank page must not turn the app window into a full browser window");
  assert.ok(launchOptions.args.includes("--disable-background-timer-throttling"));
  assert.ok(launchOptions.args.includes("--disable-renderer-backgrounding"));
  assert.ok(launchOptions.args.includes("--disable-backgrounding-occluded-windows"));
  assert.ok(launchOptions.args.includes("--force-device-scale-factor=1"));
  assert.ok(launchOptions.args.includes("--mute-audio"));
  assert.ok(launchOptions.args.includes("--window-position=3440,0"));
  assert.ok(launchOptions.args.includes("--window-size=540,468"));
  assert.deepEqual(harness.calls.cdp.at(-1), ["Browser.setWindowBounds", {
    windowId: 71,
    bounds: { left: 3440, top: 0, width: 540, height: 468, windowState: "normal" }
  }]);
  assert.equal(nativePlacements.length, 1,
    "the real Windows window must be corrected after Chrome applies its own coordinate transform");
  assert.equal(nativePlacements[0].bot, bot);
  assert.equal(nativePlacements[0].bounds, bounds);
  assert.equal(nativePlacements[0].windowId, 71);

  const stored = new Map();
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = { setItem: (key, value) => stored.set(key, value) };
  try {
    const [init, payload] = harness.calls.initScripts[0];
    init(payload);
  } finally {
    globalThis.localStorage = previousStorage;
  }
  assert.deepEqual(Object.fromEntries(stored), {
    dungeonOneRoomPlayerName: "bot 1",
    dungeonOneRoomGraphicsMode: "hd",
    dungeonOneRoomAudioMuted: "1",
    dungeonOneRoomTutorialRunSeenV1: "1",
    dungeonOneRoomTutorialCampSeenV1: "1",
    dungeonOneRoomTutorialMerchantSeenV1: "1",
    dungeonOneRoomTutorialPortalSeenV1: "1"
  });

  await runtime.stop();
  await runtime.stop();
  assert.equal(harness.calls.closed, 1, "runtime must close only its owned context once");
});

test("rejects the observed 130 percent Windows transform instead of declaring the tile ready", async () => {
  const harness = createLaunchHarness();
  const bot = { id: "bot-02", name: "bot 2", profileDir: "D:/runs/session/profiles/bot-02" };
  const bounds = { x: 3980, y: 468, width: 540, height: 468 };

  await assert.rejects(launchBotWindow({
    bot,
    bounds,
    chromeExecutable: X86_CHROME,
    chromium: harness.chromium,
    nativeWindowExecFile: async () => ({
      stdout: JSON.stringify({ left: 5173, top: 608, width: 702, height: 609 }),
      stderr: ""
    }),
    secrets: ["observer-secret"]
  }), /Native window placement mismatch.*expected 3980,468 540x468.*received 5173,608 702x609/u);
});

test("starts fresh Ranked, selects the bot-assigned relic, and enables Observer Bot", async () => {
  const actions = [];
  let startingRelicsVisible = false;
  const locator = (selector) => ({
    count: async () => selector === ".ranked-v3-choice-relic"
      ? (startingRelicsVisible ? 3 : 0)
      : 1,
    first: () => ({
      waitFor: async ({ state }) => {
        actions.push(`wait:${selector}:${state}`);
        if (selector === ".ranked-v3-choice-relic" && state === "visible") {
          startingRelicsVisible = true;
        }
      }
    }),
    nth: (index) => ({ click: async () => actions.push(`click:${selector}:nth:${index}`) }),
    waitFor: async ({ state }) => actions.push(`wait:${selector}:${state}`)
  });
  const page = {
    async goto(url, options) { actions.push(`goto:${url}:${options.waitUntil}`); },
    async waitForFunction() { actions.push("waitForFunction"); },
    locator(selector) { return locator(selector); },
    getByRole(role, options) {
      return {
        async isVisible() { actions.push(`visible:${role}:${options.name}`); return true; },
        async click() { actions.push(`click:${role}:${options.name}`); }
      };
    },
    async evaluate(_fn, password) {
      actions.push(password === undefined ? "openRanked" : `password:${password}`);
    },
    keyboard: { async press(key) { actions.push(`press:${key}`); } }
  };

  const status = await startBotRun({ bot: { id: "bot-05", index: 5, name: "bot 5" }, page }, {
    url: "http://127.0.0.1:8787",
    password: "observer-secret"
  });

  assert.equal(status.status, "running");
  assert.deepEqual(actions, [
    "goto:http://127.0.0.1:8787:domcontentloaded",
    "waitForFunction",
    "press:Enter",
    "waitForFunction",
    "waitForFunction",
    "waitForFunction",
    "openRanked",
    "visible:button:Start New Ranked",
    "click:button:Start New Ranked",
    "wait:.ranked-v3-choice-relic:visible",
    "click:.ranked-v3-choice-relic:nth:1",
    "waitForFunction",
    "password:observer-secret",
    "press:F9",
    "wait:.overlay-card-debug-cheats:visible",
    "press:b",
    "waitForFunction",
    "press:F9",
    "waitForFunction"
  ]);
});
