import { launchMutedBrowser } from "./playwright-muted-launch.mjs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  injectCheckoutBuildIdentity,
  readCurrentCheckoutBuildIdentity
} from "./current-checkout-build-metadata.mjs";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_ROOT = path.join(ROOT, "output", "mobile-v1");
const PROFILE_ARG = process.argv.includes("--profile")
  ? process.argv[process.argv.indexOf("--profile") + 1]
  : "iphone";

const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";
const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/145.0.0.0 Mobile Safari/537.36";
const PORTRAIT_VIEWPORTS = Object.freeze([
  Object.freeze({ width: 360, height: 640, name: "small" }),
  Object.freeze({ width: 390, height: 844, name: "typical" }),
  Object.freeze({ width: 430, height: 932, name: "large" })
]);

const PROFILES = Object.freeze({
  iphone: {
    name: "iphone",
    touch: true,
    userAgent: IPHONE_UA,
    portrait: { width: 390, height: 844 },
    landscape: { width: 844, height: 390 }
  },
  android: {
    name: "android",
    touch: true,
    userAgent: ANDROID_UA,
    portrait: { width: 360, height: 800 },
    landscape: { width: 800, height: 360 }
  },
  chrome: {
    name: "iphone-browser-chrome",
    touch: true,
    userAgent: IPHONE_UA,
    portrait: { width: 390, height: 742 },
    landscape: { width: 844, height: 288 }
  },
  tablet: {
    name: "tablet",
    touch: true,
    userAgent: ANDROID_UA,
    portrait: { width: 800, height: 1280 },
    landscape: { width: 1280, height: 800 }
  },
  ipad: {
    name: "ipad",
    touch: true,
    userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
    portrait: { width: 768, height: 1024 },
    landscape: { width: 1024, height: 768 }
  },
  narrow: {
    name: "narrow-no-touch",
    touch: false,
    userAgent: "",
    portrait: { width: 390, height: 844 },
    landscape: { width: 844, height: 390 }
  },
  desktop: {
    name: "desktop",
    touch: false,
    userAgent: "",
    portrait: { width: 1440, height: 900 },
    landscape: { width: 1920, height: 1080 }
  },
  hybrid: {
    name: "hybrid-touch-laptop",
    touch: false,
    hasTouch: true,
    userAgent: "",
    portrait: { width: 1440, height: 900 },
    landscape: { width: 1920, height: 1080 }
  },
  hybridBoundary: {
    name: "hybrid-touch-laptop-1280",
    touch: false,
    hasTouch: true,
    userAgent: "",
    portrait: { width: 1280, height: 800 },
    landscape: { width: 1280, height: 800 }
  },
  uaOnly: {
    name: "mobile-ua-without-touch",
    touch: false,
    hasTouch: false,
    userAgent: ANDROID_UA,
    portrait: { width: 1920, height: 1080 },
    landscape: { width: 1920, height: 1080 }
  }
});

function selectedProfiles() {
  if (PROFILE_ARG === "all") return Object.values(PROFILES);
  const profile = PROFILES[PROFILE_ARG];
  if (!profile) {
    throw new Error("Unknown profile. Use iphone|android|chrome|tablet|ipad|narrow|desktop|hybrid|hybridBoundary|uaOnly|all.");
  }
  return [profile];
}

function mimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg"
  }[extension] || "application/octet-stream";
}

async function startStaticServer() {
  const rootWithSeparator = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  const buildIdentity = readCurrentCheckoutBuildIdentity(ROOT);
  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
      let relative = decodeURIComponent(requestUrl.pathname);
      while (relative.startsWith("/")) relative = relative.slice(1);
      if (!relative) relative = "index.html";
      const filePath = path.resolve(ROOT, relative);
      if (filePath !== ROOT && !filePath.startsWith(rootWithSeparator)) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      const stat = await fs.stat(filePath);
      const resolved = stat.isDirectory() ? path.join(filePath, "index.html") : filePath;
      const source = await fs.readFile(resolved);
      const body = relative === "config.js"
        ? injectCheckoutBuildIdentity(source, buildIdentity)
        : source;
      response.writeHead(200, {
        "content-type": mimeType(resolved),
        "cache-control": "no-store"
      });
      response.end(body);
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
    baseUrl: "http://127.0.0.1:" + address.port
  };
}

function loadPlaywright() {
  const roots = [
    process.env.DUNGEON_PLAYWRIGHT_NODE_MODULES,
    path.join(process.env.USERPROFILE || "", ".codex", "skills", "develop-web-game", "node_modules"),
    path.join(ROOT, "node_modules")
  ].filter(Boolean);
  for (const root of roots) {
    try {
      return require(require.resolve("playwright", { paths: [root] }));
    } catch {
      // Try the next explicitly scoped runtime.
    }
  }
  throw new Error("Playwright runtime not found.");
}

function attachDiagnostics(page, diagnostics, label) {
  page.on("console", (message) => {
    if (message.type() === "warning" && /AudioContext was not allowed to start/iu.test(message.text())) return;
    if (message.type() === "error" || message.type() === "warning") {
      diagnostics.consoleErrors.push({ label, type: message.type(), text: message.text() });
    }
  });
  page.on("pageerror", (error) => {
    diagnostics.pageErrors.push({ label, text: String(error?.stack || error) });
  });
  page.on("requestfailed", (request) => {
    diagnostics.requestFailures.push({
      label,
      url: request.url(),
      error: request.failure()?.errorText || "unknown"
    });
  });
  page.on("request", (request) => {
    const requestUrl = new URL(request.url());
    if (requestUrl.pathname.startsWith("/api/")) {
      diagnostics.apiRequests.push({ label, method: request.method(), url: request.url() });
    }
  });
}

function isVisible(element) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return rect.width > 0 && rect.height > 0
    && style.display !== "none"
    && style.visibility !== "hidden"
    && Number(style.opacity || 1) > 0;
}

async function readState(page) {
  return page.evaluate(() => {
    if (typeof window.render_game_to_text !== "function") return null;
    return JSON.parse(window.render_game_to_text());
  });
}

async function waitForState(page, predicate, label, timeout = 120000) {
  const deadline = Date.now() + timeout;
  let last = null;
  while (Date.now() < deadline) {
    last = await readState(page);
    if (last && predicate(last)) return last;
    await page.waitForTimeout(80);
  }
  throw new Error("Timed out waiting for " + label + ". Last state: " + JSON.stringify(last));
}

async function waitForScenario(page) {
  return waitForState(
    page,
    (state) => state.phase === "playing" && state.scenario === "descent_hd",
    "descent_hd playing"
  );
}

async function revealScenario(page) {
  await page.evaluate(() => {
    document.getElementById("bootScreen")?.classList.add("hidden");
    document.getElementById("gameApp")?.classList.remove("app-hidden");
  });
}

async function pageMetrics(page) {
  return page.evaluate(() => {
    const visible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0
        && style.display !== "none"
        && style.visibility !== "hidden"
        && Number(style.opacity || 1) > 0;
    };
    const box = (element) => {
      const rect = element?.getBoundingClientRect();
      return rect ? {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom
      } : null;
    };
    const unionBox = (boxes) => {
      const valid = boxes.filter(Boolean);
      if (!valid.length) return null;
      const x = Math.min(...valid.map((rect) => rect.x));
      const y = Math.min(...valid.map((rect) => rect.y));
      const right = Math.max(...valid.map((rect) => rect.right));
      const bottom = Math.max(...valid.map((rect) => rect.bottom));
      return { x, y, width: right - x, height: bottom - y, right, bottom };
    };
    const actionButtons = [
      ...document.querySelectorAll("#mobileActionDock [data-mobile-action], #mobileActionDock button")
    ].map((element) => {
      const label = element.querySelector(".mobile-action-copy strong");
      return {
        id: element.id,
        label: element.getAttribute("aria-label") || "",
        box: box(element),
        iconBox: box(element.querySelector("img, .mobile-action-key")),
        textClipped: Boolean(label && (
          label.scrollWidth > label.clientWidth + 1
          || label.scrollHeight > label.clientHeight + 1
        ))
      };
    });
    const overlay = document.getElementById("screenOverlay");
    const rotate = document.getElementById("mobileRotateOverlay");
    const legacy = document.getElementById("mobileControls");
    const skillsBar = document.getElementById("skillsBar");
    const layout = document.querySelector(".layout");
    const layoutTrack = document.querySelector(".layout-track");
    const board = document.querySelector(".board");
    const commandDeck = document.getElementById("mobileCommandDeck");
    const mobileHud = document.getElementById("mobileHud");
    const dpad = document.querySelector(".mobile-dpad");
    const detailsPanel = document.querySelector(".panel-left");
    const detailsButton = document.getElementById("mobileDetailsButton");
    const dpadButtons = [...document.querySelectorAll(".mobile-dpad .dpad-btn")].map((element) => ({
      id: element.id,
      box: box(element)
    }));
    const dpadBox = unionBox(dpadButtons.map((button) => button.box));
    const depthBadge = document.getElementById("depthBadge");
    return {
      viewport: { width: innerWidth, height: innerHeight },
      bodyClass: document.body.className,
      gameClass: document.getElementById("game")?.className || "",
      boardGridRows: board ? getComputedStyle(board).gridTemplateRows : "",
      boardGridColumns: board ? getComputedStyle(board).gridTemplateColumns : "",
      layout: box(layout),
      layoutTrack: box(layoutTrack),
      layoutTrackStyle: layoutTrack ? {
        display: getComputedStyle(layoutTrack).display,
        width: getComputedStyle(layoutTrack).width,
        transform: getComputedStyle(layoutTrack).transform
      } : null,
      board: box(board),
      roomStage: box(document.querySelector(".room-stage")),
      mobileControls: box(legacy),
      depthGridRow: depthBadge ? getComputedStyle(depthBadge).gridRow : "",
      state: typeof window.render_game_to_text === "function"
        ? JSON.parse(window.render_game_to_text())
        : null,
      activeElementId: document.activeElement?.id || "",
      gameAppInert: Boolean(document.getElementById("gameApp")?.inert),
      bootScreenInert: Boolean(document.getElementById("bootScreen")?.inert),
      rotateVisible: visible(rotate),
      rotateText: rotate?.textContent?.replace(/\\s+/gu, " ").trim() || "",
      lockText: document.body.textContent?.match(/Mobile Not Supported Yet/iu)?.[0] || "",
      actionDockVisible: visible(document.getElementById("mobileActionDock")),
      actionDock: box(document.getElementById("mobileActionDock")),
      actionDockStyle: document.getElementById("mobileActionDock") ? {
        display: getComputedStyle(document.getElementById("mobileActionDock")).display,
        gridColumns: getComputedStyle(document.getElementById("mobileActionDock")).gridTemplateColumns,
        gridRows: getComputedStyle(document.getElementById("mobileActionDock")).gridTemplateRows,
        alignContent: getComputedStyle(document.getElementById("mobileActionDock")).alignContent
      } : null,
      actionButtons,
      legacyControlsVisible: visible(legacy) || visible(document.querySelector(".mobile-dpad")),
      commandDeckVisible: visible(commandDeck),
      commandDeck: box(commandDeck),
      mobileHud: box(mobileHud),
      detailsVisible: visible(detailsPanel),
      detailsPanel: box(detailsPanel),
      detailsExpanded: detailsButton?.getAttribute("aria-expanded") || "false",
      dpadVisible: visible(dpad),
      dpadBox,
      dpadButtons,
      dpadStyle: dpad ? {
        display: getComputedStyle(dpad).display,
        width: getComputedStyle(dpad).width,
        height: getComputedStyle(dpad).height
      } : null,
      mobileCssLoaded: [...document.styleSheets].some((sheet) => /style-mobile-hd\.css$/u.test(sheet.href || "")),
      commandDeckDisplay: commandDeck ? getComputedStyle(commandDeck).display : "",
      swipeHintVisible: visible(document.getElementById("mobileSwipeHint")),
      dpadRules: [...document.styleSheets].flatMap((sheet) => {
        try {
          return [...sheet.cssRules]
            .filter((rule) => rule.selectorText?.includes(".mobile-dpad"))
            .map((rule) => ({
              href: sheet.href?.split("/").pop() || "inline",
              selector: rule.selectorText,
              display: rule.style?.display || "",
              important: rule.style?.getPropertyPriority("display") || ""
            }));
        } catch {
          return [];
        }
      }),
      skillsBar: box(skillsBar),
      depthBadge: box(depthBadge),
      depthTitle: box(depthBadge?.querySelector("strong")),
      depthMeta: box(depthBadge?.querySelector(".depth-badge-meta")),
      depthSubtitleVisible: visible(depthBadge?.querySelector(".depth-subtitle")),
      skillCards: [...document.querySelectorAll("#skillsBar .skill-card")].map((element) => {
        const style = getComputedStyle(element);
        return {
          ...box(element),
          computed: {
            height: style.height,
            minHeight: style.minHeight,
            boxSizing: style.boxSizing,
            padding: style.padding,
            transform: style.transform
          }
        };
      }),
      menuVisible: visible(document.getElementById("mobileMenuButton")),
      menuButton: box(document.getElementById("mobileMenuButton")),
      screenOverlay: box(overlay),
      screenOverlayPosition: overlay ? getComputedStyle(overlay).position : "",
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      verticalOverflow: document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
      scrollY: window.scrollY,
      canvas: box(document.getElementById("game"))
    };
  });
}

async function openScenario(browser, baseUrl, profile, diagnostics, label, viewport) {
  const context = await browser.newContext({
    viewport,
    userAgent: profile.userAgent || undefined,
    isMobile: profile.touch,
    hasTouch: profile.touch,
    deviceScaleFactor: profile.touch ? 2 : 1,
    reducedMotion: "reduce"
  });
  const page = await context.newPage();
  attachDiagnostics(page, diagnostics, label);
  const response = await page.goto(baseUrl + "/?scenario=descent_hd", { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), 200, label + " expected HTTP 200");
  await waitForScenario(page);
  await revealScenario(page);
  return { context, page };
}

async function dispatchBoardTouch(page, type, pointerId, x, y) {
  await page.locator("#game").evaluate((canvas, event) => {
    canvas.dispatchEvent(new PointerEvent(event.type, {
      bubbles: true,
      cancelable: true,
      pointerId: event.pointerId,
      pointerType: "touch",
      clientX: event.x,
      clientY: event.y,
      isPrimary: true
    }));
  }, { type, pointerId, x, y });
}

async function moveRightOnce(page, state) {
  const canvas = await page.locator("#game").boundingBox();
  assert(canvas, "game canvas must be measurable");
  const scaleX = canvas.width / 576;
  const scaleY = canvas.height / 576;
  const centerX = canvas.x + (state.player.x * 64 + 32) * scaleX;
  const centerY = canvas.y + (state.player.y * 64 + 32) * scaleY;
  await dispatchBoardTouch(page, "pointerdown", 31, centerX + 72 * scaleX, centerY);
  await dispatchBoardTouch(page, "pointerup", 31, centerX + 72 * scaleX, centerY);
}

async function holdMoveRight(page, state, durationMs = 600) {
  const canvas = await page.locator("#game").boundingBox();
  assert(canvas, "game canvas must be measurable");
  const scaleX = canvas.width / 576;
  const scaleY = canvas.height / 576;
  const centerX = canvas.x + (state.player.x * 64 + 32) * scaleX;
  const centerY = canvas.y + (state.player.y * 64 + 32) * scaleY;
  await dispatchBoardTouch(page, "pointerdown", 32, centerX + 72 * scaleX, centerY);
  await page.waitForTimeout(durationMs);
  await dispatchBoardTouch(page, "pointerup", 32, centerX + 72 * scaleX, centerY);
}

async function tapControl(page, selector) {
  const control = page.locator(selector).first();
  await control.waitFor({ state: "visible", timeout: 5000 });
  await control.tap();
}

async function dispatchControlPointer(page, selector, type, pointerId = 71) {
  await page.locator(selector).evaluate((control, event) => {
    const rect = control.getBoundingClientRect();
    control.dispatchEvent(new PointerEvent(event.type, {
      bubbles: true,
      cancelable: true,
      pointerId: event.pointerId,
      pointerType: "touch",
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      isPrimary: true
    }));
  }, { type, pointerId });
}

async function assertActionDock(page, metrics) {
  assert.equal(metrics.actionDockVisible, true, "mobile action dock must be visible: " + JSON.stringify({ bodyClass: metrics.bodyClass, state: metrics.state, overlay: metrics.screenOverlay, controls: metrics.mobileControls, deck: metrics.commandDeck, actionDock: metrics.actionDock, actionStyle: metrics.actionDockStyle, dpad: metrics.dpadStyle }));
  assert.equal(metrics.commandDeckVisible, true, "mobile command deck must be visible");
  assert.equal(metrics.dpadVisible, true, "approved mobile D-pad must be visible: " + JSON.stringify({ dpad: metrics.dpadStyle, mobileCssLoaded: metrics.mobileCssLoaded, commandDeckDisplay: metrics.commandDeckDisplay, rules: metrics.dpadRules }));
  assert.equal(metrics.dpadButtons.length, 4, "D-pad must expose four cardinal controls");
  for (const button of metrics.dpadButtons) {
    assert(button.box, button.id + " must be measurable");
    assert(button.box.width >= 48 && button.box.height >= 48, button.id + " target is below 48px");
    assert(
      button.box.x >= -1 && button.box.right <= metrics.viewport.width + 1,
      button.id + " escapes viewport horizontally: " + JSON.stringify(button.box)
    );
  }
  assert.equal(metrics.actionButtons.length, 7, "mobile action dock must expose seven actions");
  const expectedIds = ["mbtnZ", "mbtnX", "mbtnC", "mbtnF", "mbtnG", "mbtnE", "mbtnQ"];
  assert.deepEqual(metrics.actionButtons.map((button) => button.id), expectedIds);
  for (const button of metrics.actionButtons) {
    assert(button.box, button.id + " must be measurable");
    assert(button.box.width >= 48 && button.box.height >= 48, button.id + " target is below 48px");
    assert(
      button.box.x >= -1 && button.box.right <= metrics.viewport.width + 1
        && button.box.y >= -1 && button.box.bottom <= metrics.viewport.height + 1,
      button.id + " escapes viewport: " + JSON.stringify({ button: button.box, dock: metrics.actionDock, style: metrics.actionDockStyle })
    );
  }
}

function rectsOverlap(first, second, tolerance = 1) {
  return first.x < second.right - tolerance
    && first.right > second.x + tolerance
    && first.y < second.bottom - tolerance
    && first.bottom > second.y + tolerance;
}

function assertAdaptiveControlLayout(metrics, profileName) {
  assert(metrics.mobileHud, profileName + " mobile HUD must be measurable");
  assert(metrics.commandDeck, profileName + " command deck must be measurable");
  assert(metrics.actionDock, profileName + " action dock must be measurable");
  assert(metrics.dpadBox, profileName + " D-pad union must be measurable");

  const hudGap = metrics.actionDock.y - metrics.mobileHud.bottom;
  const bottomGap = metrics.commandDeck.bottom - metrics.actionDock.bottom;
  if (metrics.viewport.height <= 520) {
    assert(
      hudGap >= -1 && hudGap <= 12,
      profileName + " wastes vertical space between HUD and actions: " + JSON.stringify({
        hud: metrics.mobileHud,
        actionDock: metrics.actionDock,
        gap: hudGap
      })
    );
    assert(
      bottomGap >= -1 && bottomGap <= 10,
      profileName + " action dock must finish near the command-deck bottom: " + JSON.stringify({
        deck: metrics.commandDeck,
        actionDock: metrics.actionDock,
        gap: bottomGap
      })
    );
  } else {
    assert(
      metrics.actionDock.height <= 321,
      profileName + " must cap the tall-screen action bank: " + JSON.stringify(metrics.actionDock)
    );
    assert(
      Math.abs(hudGap - bottomGap) <= 12,
      profileName + " must center capped controls below the HUD: " + JSON.stringify({
        hud: metrics.mobileHud,
        deck: metrics.commandDeck,
        actionDock: metrics.actionDock,
        topGap: hudGap,
        bottomGap
      })
    );
  }

  const regular = metrics.actionButtons.find((button) => button.id === "mbtnZ");
  const extract = metrics.actionButtons.find((button) => button.id === "mbtnQ");
  assert(regular?.box && extract?.box, profileName + " regular and Extract actions must be measurable");
  assert(
    extract.box.width >= regular.box.width * 1.8,
    profileName + " Extract must span both action columns: " + JSON.stringify({
      regular: regular.box,
      extract: extract.box
    })
  );

  const dpadCenterY = metrics.dpadBox.y + metrics.dpadBox.height / 2;
  const actionCenterY = metrics.actionDock.y + metrics.actionDock.height / 2;
  assert(
    Math.abs(dpadCenterY - actionCenterY) <= 12,
    profileName + " D-pad and action bank must share one vertical center: " + JSON.stringify({
      dpad: metrics.dpadBox,
      actionDock: metrics.actionDock
    })
  );

  for (const button of metrics.actionButtons) {
    assert.equal(button.textClipped, false, profileName + " clips the " + button.id + " label");
  }

  const visibleControls = [
    ...metrics.dpadButtons.map((button) => ({ id: button.id, box: button.box })),
    ...metrics.actionButtons.map((button) => ({ id: button.id, box: button.box }))
  ];
  for (let firstIndex = 0; firstIndex < visibleControls.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < visibleControls.length; secondIndex += 1) {
      const first = visibleControls[firstIndex];
      const second = visibleControls[secondIndex];
      assert.equal(
        rectsOverlap(first.box, second.box),
        false,
        profileName + " overlaps " + first.id + " and " + second.id
      );
    }
  }
}

async function runTouchProfile(browser, baseUrl, profile, diagnostics, summary) {
  const current = {
    profile: profile.name,
    portrait: null,
    landscape: null,
    interactions: {}
  };
  const opened = await openScenario(browser, baseUrl, profile, diagnostics, profile.name + "-portrait", PORTRAIT_VIEWPORTS[0]);
  const { context, page } = opened;
  try {
    current.portrait = {};
    for (const viewport of PORTRAIT_VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(180);
      const portrait = await pageMetrics(page);
      current.portrait[viewport.name] = portrait;
      assert.equal(portrait.rotateVisible, false, profile.name + " " + viewport.name + " portrait must keep gameplay active");
      assert.equal(portrait.gameAppInert, false, profile.name + " " + viewport.name + " portrait must not inert the game app");
      assert.equal(portrait.bootScreenInert, false, profile.name + " " + viewport.name + " portrait must not inert the boot surface");
      assert.equal(portrait.lockText, "", profile.name + " " + viewport.name + " portrait must not show unsupported lock");
      assert.equal(portrait.horizontalOverflow, false, profile.name + " " + viewport.name + " portrait must not overflow horizontally");
      assert.equal(portrait.verticalOverflow, false, profile.name + " " + viewport.name + " portrait must not overflow vertically");
      assertActionDock(page, portrait);
      assert(portrait.canvas, profile.name + " " + viewport.name + " portrait board must be measurable");
      assert(Math.abs(portrait.canvas.width - portrait.canvas.height) <= 1, profile.name + " " + viewport.name + " portrait board must remain square");
      assert(portrait.canvas.x >= -1 && portrait.canvas.right <= viewport.width + 1, profile.name + " " + viewport.name + " portrait board must stay contained");
      assert(portrait.canvas.y >= -1 && portrait.canvas.bottom <= viewport.height + 1, profile.name + " " + viewport.name + " portrait board must stay contained");
      assert(
        portrait.roomStage && portrait.canvas.bottom <= portrait.roomStage.bottom + 1,
        profile.name + " " + viewport.name + " portrait board must not run under the controls: "
          + JSON.stringify({ canvas: portrait.canvas, roomStage: portrait.roomStage, controls: portrait.mobileControls })
      );
      assert(
        portrait.dpadBox && portrait.dpadBox.width >= 144 && portrait.dpadBox.height >= 144,
        profile.name + " " + viewport.name + " portrait D-pad must retain the full cardinal cross: "
          + JSON.stringify(portrait.dpadBox)
      );
      await page.screenshot({
        path: path.join(OUTPUT_ROOT, profile.name + "-portrait-" + viewport.name + ".png"),
        fullPage: false
      });
    }

    await page.setViewportSize(profile.landscape);
    await page.waitForTimeout(250);
    const landscape = await pageMetrics(page);
    current.landscape = landscape;
    assert.equal(
      await page.evaluate(() => document.documentElement.lang),
      "en",
      profile.name + " document language must match the English UI"
    );
    assert.equal(landscape.rotateVisible, false, profile.name + " landscape rotate prompt must hide");
    assert.equal(landscape.gameAppInert, false, profile.name + " landscape must release the game app");
    assert.equal(landscape.bootScreenInert, false, profile.name + " landscape must release the boot surface");
    assert.notEqual(landscape.activeElementId, "mobileRotateOverlay", profile.name + " hidden rotate prompt must release focus");
    assert.equal(landscape.lockText, "", "landscape must not show unsupported lock");
    assert.equal(landscape.horizontalOverflow, false, profile.name + " landscape must not overflow horizontally");
    assert.equal(landscape.verticalOverflow, false, profile.name + " landscape must not overflow vertically");
    assertActionDock(page, landscape);
    assertAdaptiveControlLayout(landscape, profile.name);
    await page.focus("#mobileMenuButton");
    await page.setViewportSize(profile.portrait);
    await page.waitForTimeout(180);
    const portraitReturn = await pageMetrics(page);
    assert.equal(portraitReturn.rotateVisible, false, profile.name + " portrait return must keep the rotate prompt hidden");
    assert.equal(portraitReturn.gameAppInert, false, profile.name + " portrait return must keep gameplay interactive");
    assert.notEqual(
      await page.evaluate(() => document.activeElement?.id || ""),
      "mobileRotateOverlay",
      profile.name + " portrait must not trap focus in a rotate prompt"
    );
    assertActionDock(page, portraitReturn);
    await page.setViewportSize(profile.landscape);
    await page.waitForTimeout(180);
    assert.equal(
      await page.evaluate(() => document.activeElement?.id || ""),
      "mobileMenuButton",
      profile.name + " landscape must restore the previously focused gameplay control"
    );
    assert.equal(landscape.swipeHintVisible, false, profile.name + " swipe hint must not cover the touch HUD");
    assert(landscape.canvas, profile.name + " canvas must be measurable");
    assert(landscape.commandDeck, profile.name + " command deck must be measurable");
    assert(landscape.menuButton, profile.name + " menu button must be measurable");
    assert(
      Math.abs(landscape.canvas.width - landscape.canvas.height) <= 1,
      profile.name + " playfield must remain square"
    );
    const minimumPlayfield = landscape.viewport.height <= 320 ? 240 : 300;
    assert(
      landscape.canvas.width >= minimumPlayfield,
      profile.name + " playfield is too small: " + landscape.canvas.width
    );
    assert(
      landscape.canvas.right <= landscape.commandDeck.x + 1,
      profile.name + " playfield overlaps command deck: " + JSON.stringify({ canvas: landscape.canvas, deck: landscape.commandDeck })
    );
    assert(
      landscape.canvas.y >= -1 && landscape.canvas.bottom <= landscape.viewport.height + 1,
      profile.name + " playfield escapes viewport: " + JSON.stringify(landscape.canvas)
    );
    for (const button of landscape.actionButtons) {
      const overlapsMenu = button.box.x < landscape.menuButton.right
        && button.box.right > landscape.menuButton.x
        && button.box.y < landscape.menuButton.bottom
        && button.box.bottom > landscape.menuButton.y;
      assert.equal(overlapsMenu, false, profile.name + " Menu overlaps " + button.id + ": " + JSON.stringify({ menu: landscape.menuButton, button: button.box, deck: landscape.commandDeck, board: landscape.board, roomStage: landscape.roomStage, controls: landscape.mobileControls, rows: landscape.boardGridRows, columns: landscape.boardGridColumns }));
    }

    await tapControl(page, "#mobileDetailsButton");
    await page.waitForFunction(() => document.body.classList.contains("mobile-details-open"));
    const detailsOpen = await pageMetrics(page);
    assert.equal(detailsOpen.detailsVisible, true, profile.name + " Stats must open the existing Player HUD");
    assert.equal(detailsOpen.detailsExpanded, "true", profile.name + " Stats must expose expanded state");
    assert(detailsOpen.detailsPanel && detailsOpen.detailsPanel.bottom <= detailsOpen.viewport.height + 1, profile.name + " Stats panel must fit the viewport: " + JSON.stringify({ panel: detailsOpen.detailsPanel, viewport: detailsOpen.viewport, bodyClass: detailsOpen.bodyClass }));
    await tapControl(page, "#mobileDetailsButton");
    await page.waitForFunction(() => !document.body.classList.contains("mobile-details-open"));
    const detailsClosed = await pageMetrics(page);
    assert.equal(detailsClosed.detailsVisible, false, profile.name + " Stats must close before play resumes");
    assert.equal(detailsClosed.detailsExpanded, "false", profile.name + " Stats must clear expanded state");

    await page.screenshot({ path: path.join(OUTPUT_ROOT, profile.name + "-gameplay.png"), fullPage: false });
    const beforeTap = await readState(page);
    await moveRightOnce(page, beforeTap);
    const afterTap = await waitForState(
      page,
      (state) => state.player.x !== beforeTap.player.x || state.player.y !== beforeTap.player.y,
      profile.name + " one-step touch movement"
    );
    current.interactions.tapMovement = {
      from: { x: beforeTap.player.x, y: beforeTap.player.y },
      to: { x: afterTap.player.x, y: afterTap.player.y }
    };

    const beforeHold = await readState(page);
    await holdMoveRight(page, beforeHold, 260);
    const afterHold = await readState(page);
    const holdDistance = Math.abs(afterHold.player.x - beforeHold.player.x)
      + Math.abs(afterHold.player.y - beforeHold.player.y);
    assert(holdDistance > 0, profile.name + " hold must repeat at least one bounded step");
    assert(holdDistance <= 8, profile.name + " hold exceeded the repeat bound");
    current.interactions.holdMovement = { distance: holdDistance };

    const postMoveMetrics = await pageMetrics(page);
    current.interactions.postMoveLayout = postMoveMetrics;
    if (postMoveMetrics.state?.overlayText) {
      assert.equal(postMoveMetrics.actionDockVisible, false, "action dock must yield to a gameplay overlay");
      assert.equal(postMoveMetrics.screenOverlayPosition, "fixed", "post-move overlay must remain viewport-fixed");
    } else {
      assertActionDock(page, postMoveMetrics);
    }

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForScenario(page);
    await revealScenario(page);
    await page.waitForTimeout(120);
    const actionMetrics = await pageMetrics(page);
    assertActionDock(page, actionMetrics);

    await page.evaluate(() => {
      window.__mobileStandardsKeyEvents = [];
      window.addEventListener("keydown", (event) => {
        window.__mobileStandardsKeyEvents.push(event.key);
      }, { capture: true });
    });
    await dispatchControlPointer(page, "#mbtnZ", "pointerdown", 71);
    await dispatchControlPointer(page, "#mbtnZ", "pointercancel", 71);
    assert.deepEqual(
      await page.evaluate(() => window.__mobileStandardsKeyEvents),
      [],
      profile.name + " cancelled command touch must not activate"
    );
    await dispatchControlPointer(page, "#mbtnZ", "pointerdown", 72);
    await dispatchControlPointer(page, "#mbtnZ", "pointerup", 72);
    assert.deepEqual(
      await page.evaluate(() => window.__mobileStandardsKeyEvents),
      ["z"],
      profile.name + " released command touch must activate exactly once"
    );
    await tapControl(page, "#mbtnZ");
    await page.waitForTimeout(70);

    for (const id of ["mbtnX", "mbtnC", "mbtnF", "mbtnG", "mbtnE", "mbtnQ"]) {
      const disabled = await page.locator("#" + id).getAttribute("aria-disabled");
      if (disabled !== "true") await tapControl(page, "#" + id);
      await page.waitForTimeout(70);
    }
    current.interactions.actionDock = true;

    const afterExtractAction = await readState(page);
    const extractOverlayText = await page.locator("#screenOverlay").textContent();
    const observedActionKeys = await page.evaluate(() => window.__mobileStandardsKeyEvents);
    assert(
      afterExtractAction.phase !== "playing" || /Emergency Extract/iu.test(extractOverlayText || ""),
      profile.name + " Q action must extract or open its canonical confirmation: " + JSON.stringify({
        keys: observedActionKeys,
        state: afterExtractAction,
        overlay: extractOverlayText
      })
    );
    current.interactions.extractAction = {
      phase: afterExtractAction.phase,
      confirmation: /Emergency Extract/iu.test(extractOverlayText || "")
    };

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForScenario(page);
    await revealScenario(page);
    await page.waitForTimeout(180);
    const resetMetrics = await pageMetrics(page);
    assertActionDock(page, resetMetrics);
    await tapControl(page, "#mobileMenuButton");
    await page.waitForFunction(() => {
      const state = JSON.parse(window.render_game_to_text?.() || "{}");
      return state.phase === "menu" && document.querySelector("#screenOverlay")?.classList.contains("visible");
    });
    const optionsRow = page.locator(".overlay-menu-row").filter({ hasText: "Options" }).first();
    await optionsRow.waitFor({ state: "visible" });
    await optionsRow.focus();
    await page.keyboard.press("Enter");
    await page.locator(".overlay-card-options [data-action-key='Escape']").waitFor({ state: "visible" });
    current.interactions.genericOverlayKeyboard = true;
    await tapControl(page, "#screenOverlay [data-action-key='Escape']");
    await page.waitForFunction(() => {
      const overlay = document.getElementById("screenOverlay");
      return /Continue/iu.test(overlay?.textContent || "") && !/Choose a category/iu.test(overlay?.textContent || "");
    });
    const optionsRowAfterKeyboard = page.locator(".overlay-menu-row").filter({ hasText: "Options" }).first();
    await optionsRowAfterKeyboard.waitFor({ state: "visible" });
    await optionsRowAfterKeyboard.tap();
    await page.locator(".overlay-card-options [data-action-key='Escape']").waitFor({ state: "visible" });
    await page.waitForFunction(() => document.getElementById("screenOverlay")?.contains(document.activeElement));
    current.interactions.genericOverlayTap = true;

    const overlayAccessibility = await page.evaluate(() => {
      const overlay = document.getElementById("screenOverlay");
      const close = overlay?.querySelector("[data-action-key='Escape']");
      const closeRect = close?.getBoundingClientRect();
      return {
        role: overlay?.getAttribute("role") || "",
        modal: overlay?.getAttribute("aria-modal") || "",
        labelledBy: overlay?.getAttribute("aria-labelledby") || "",
        appInert: Boolean(document.getElementById("gameApp")?.inert),
        focusInside: Boolean(overlay?.contains(document.activeElement)),
        closeVisible: Boolean(closeRect && closeRect.width > 0 && closeRect.height > 0),
        closeWidth: closeRect?.width || 0,
        closeHeight: closeRect?.height || 0
      };
    });
    assert.equal(overlayAccessibility.role, "dialog", "mobile overlay must expose dialog semantics");
    assert.equal(overlayAccessibility.modal, "true", "mobile overlay must be modal");
    assert(overlayAccessibility.labelledBy, "mobile overlay must reference its visible title");
    assert.equal(overlayAccessibility.appInert, true, "mobile overlay must inert the game behind it");
    assert.equal(overlayAccessibility.focusInside, true, "focus must enter the mobile overlay");
    assert.equal(overlayAccessibility.closeVisible, true, "Options must expose a touch-visible Back or Close control");
    assert(overlayAccessibility.closeWidth >= 48 && overlayAccessibility.closeHeight >= 48, "Options close target must be at least 48px");
    current.interactions.overlayAccessibility = overlayAccessibility;

    const overlayMetrics = await page.evaluate(() => {
      const overlay = document.getElementById("screenOverlay");
      const rect = overlay?.getBoundingClientRect();
      return {
        position: overlay ? getComputedStyle(overlay).position : "",
        rect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
        viewport: { width: innerWidth, height: innerHeight },
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      };
    });
    assert.equal(overlayMetrics.position, "fixed", "mobile overlays must be body-fixed");
    assert(overlayMetrics.rect, "overlay must be measurable");
    assert.equal(overlayMetrics.rect.x, 0);
    assert.equal(overlayMetrics.rect.y, 0);
    assert(overlayMetrics.rect.width <= overlayMetrics.viewport.width + 1);
    assert(overlayMetrics.rect.height <= overlayMetrics.viewport.height + 1);
    assert.equal(overlayMetrics.horizontalOverflow, false);
    current.interactions.overlayGeometry = overlayMetrics;
    await page.screenshot({ path: path.join(OUTPUT_ROOT, profile.name + "-landscape.png"), fullPage: false });

    await tapControl(page, "#screenOverlay [data-action-key='Escape']");
    await page.waitForFunction(() => {
      const overlay = document.getElementById("screenOverlay");
      return /Continue/iu.test(overlay?.textContent || "") && !/Choose a category/iu.test(overlay?.textContent || "");
    });
    const continueRow = page.locator(".overlay-menu-row", {
      has: page.locator("strong", { hasText: /^Continue$/u })
    }).first();
    await continueRow.tap();
    await page.waitForTimeout(400);
    const resumedState = await page.evaluate(() => {
      const state = JSON.parse(window.render_game_to_text?.() || "{}");
      return {
        state,
        overlayVisible: document.getElementById("screenOverlay")?.classList.contains("visible"),
        overlayText: document.getElementById("screenOverlay")?.textContent || ""
      };
    });
    assert.equal(resumedState.state.phase, "playing", "tapping Continue must resume play: " + JSON.stringify(resumedState));
    assert.equal(resumedState.overlayVisible, false, "Continue must close the overlay");
    await page.waitForTimeout(80);
    const focusRestored = await page.evaluate(() => ({
      appInert: Boolean(document.getElementById("gameApp")?.inert),
      activeElementId: document.activeElement?.id || ""
    }));
    assert.equal(focusRestored.appInert, false, "closing the mobile dialog must restore the game");
    assert.equal(focusRestored.activeElementId, "mobileMenuButton", "closing the mobile dialog must restore focus to Menu");
    current.interactions.overlayFocusReturn = focusRestored;
  } finally {
    await context.close();
  }
  summary.push(current);
}

async function runNoTouchProfile(browser, baseUrl, profile, diagnostics, summary) {
  const context = await browser.newContext({
    viewport: profile.portrait,
    hasTouch: Boolean(profile.hasTouch),
    isMobile: false,
    ...(profile.userAgent ? { userAgent: profile.userAgent } : {}),
    reducedMotion: "reduce"
  });
  const page = await context.newPage();
  attachDiagnostics(page, diagnostics, profile.name);
  try {
    const response = await page.goto(baseUrl + "/?scenario=descent_hd", { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200);
    await waitForScenario(page);
    await revealScenario(page);
    const metrics = await pageMetrics(page);
    assert.equal(metrics.rotateVisible, false, profile.name + " fine-pointer narrow viewport must not rotate-lock");
    assert.equal(metrics.lockText, "", profile.name + " fine-pointer must not show unsupported lock");
    assert.equal(metrics.actionDockVisible, false, profile.name + " must retain the desktop action layout");
    assert.equal(metrics.commandDeckVisible, false, profile.name + " must not render the touch command deck");
    summary.push({ profile: profile.name, metrics });
  } finally {
    await context.close();
  }
}

async function runDesktopProfile(browser, baseUrl, profile, diagnostics, summary) {
  const context = await browser.newContext({
    viewport: profile.portrait,
    reducedMotion: "reduce"
  });
  const page = await context.newPage();
  attachDiagnostics(page, diagnostics, profile.name);
  try {
    const response = await page.goto(baseUrl + "/?scenario=descent_hd", { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200);
    await waitForScenario(page);
    await revealScenario(page);
    const metrics = await pageMetrics(page);
    assert.equal(metrics.rotateVisible, false, "desktop must not show rotate lock");
    assert.equal(metrics.lockText, "", "desktop must not show unsupported lock");
    assert.equal(metrics.actionDockVisible, false, "desktop must not show mobile action dock");
    summary.push({ profile: profile.name, metrics });
  } finally {
    await context.close();
  }
}

async function writeJson(relative, value) {
  await fs.mkdir(OUTPUT_ROOT, { recursive: true });
  await fs.writeFile(path.join(OUTPUT_ROOT, relative), JSON.stringify(value, null, 2) + "\n", "utf8");
}

async function main() {
  const profiles = selectedProfiles();
  await fs.rm(OUTPUT_ROOT, { recursive: true, force: true });
  await fs.mkdir(OUTPUT_ROOT, { recursive: true });
  const diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    apiRequests: []
  };
  const summary = [];
  const { server, baseUrl } = await startStaticServer();
  const { chromium } = loadPlaywright();
  const browser = await launchMutedBrowser(chromium, { headless: true });
  let failure = null;
  try {
    for (const profile of profiles) {
      if (profile.touch) {
        await runTouchProfile(browser, baseUrl, profile, diagnostics, summary);
      } else if (profile.name === "desktop") {
        await runDesktopProfile(browser, baseUrl, profile, diagnostics, summary);
      } else {
        await runNoTouchProfile(browser, baseUrl, profile, diagnostics, summary);
      }
    }
    assert.deepEqual(diagnostics.apiRequests, [], "Practice mobile smoke emitted an /api request");
    assert.deepEqual(diagnostics.consoleErrors, [], "Mobile smoke found browser diagnostics");
    assert.deepEqual(diagnostics.pageErrors, [], "Mobile smoke found page errors");
    const unexpectedFailures = diagnostics.requestFailures.filter(
      (failure) => failure.error !== "net::ERR_ABORTED"
    );
    assert.deepEqual(unexpectedFailures, [], "Mobile smoke found failed requests");
  } catch (error) {
    failure = {
      message: String(error?.message || error),
      stack: String(error?.stack || error)
    };
    throw error;
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    await writeJson("summary.json", { profiles: profiles.map((profile) => profile.name), summary, diagnostics, failure });
  }
  console.log("Mobile v1 smoke PASS: " + profiles.map((profile) => profile.name).join(", "));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
