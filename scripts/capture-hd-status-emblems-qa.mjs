import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const codexHome = process.env.CODEX_HOME || path.join(process.env.USERPROFILE || "", ".codex");
const playwrightPath = path.join(codexHome, "skills", "develop-web-game", "node_modules", "playwright", "index.js");
const playwright = await import(pathToFileURL(playwrightPath).href);
const { chromium } = playwright.default;

const baseUrl = process.argv[2] || "http://127.0.0.1:8765/index.html";
const outputRoot = path.resolve(process.argv[3] || "output/hd-status-emblems-qa");
const scenario = "status_emblems_hd";
const viewports = {
  desktop: { width: 1440, height: 1000 },
  // Use the narrow responsive layout without a mobile UA. Real mobile devices
  // intentionally show the product's existing "not supported" guard screen.
  mobile: { width: 390, height: 844 }
};
const summary = [];

function writeJson(target, value) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(value, null, 2) + "\n");
}

async function captureCanvas(page, target) {
  const dataUrl = await page.locator("#game").evaluate((canvas) => canvas.toDataURL("image/png"));
  if (!dataUrl.startsWith("data:image/png;base64,")) throw new Error("canvas capture did not return PNG data");
  fs.writeFileSync(target, Buffer.from(dataUrl.split(",")[1], "base64"));
}

async function inspectPage(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("#game");
    const context = canvas.getContext("2d");
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparentPixels = 0;
    let nearMagentaPixels = 0;
    let luminance = 0;
    let luminanceSquared = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const alpha = pixels[index + 3];
      const value = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      luminance += value;
      luminanceSquared += value * value;
      if (alpha === 0) transparentPixels += 1;
      if (red >= 235 && green <= 25 && blue >= 235) nearMagentaPixels += 1;
    }
    const pixelCount = pixels.length / 4;
    const meanLuminance = luminance / pixelCount;
    const luminanceVariance = Math.max(0, luminanceSquared / pixelCount - meanLuminance * meanLuminance);
    const visible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const state = JSON.parse(window.render_game_to_text());
    const activeEffects = document.querySelector("#activeEffects");
    const panelRect = activeEffects?.getBoundingClientRect();
    const statusRows = [...document.querySelectorAll("#activeEffects .status-emblem-row")];
    const activeEffectsInsidePanel = Boolean(panelRect) && statusRows.length > 0 && statusRows.every((row) => {
      const rect = row.getBoundingClientRect();
      return rect.left >= panelRect.left - 1 && rect.right <= panelRect.right + 1
        && rect.top >= panelRect.top - 1 && rect.bottom <= panelRect.bottom + 1;
    });
    const statusIcons = [...document.querySelectorAll("img.status-emblem")];
    const statusIconsLoaded = statusIcons.length > 0
      && statusIcons.every((icon) => icon.complete && icon.naturalWidth > 0 && icon.naturalHeight > 0);
    const actors = [state.player, ...state.enemies];
    const actorRailsInsideCanvas = actors.every((actor, index) => {
      const centerX = Number(actor.x) * 64 + 32;
      const centerY = Number(actor.y) * 64 + 32;
      const worstHalfHeight = index === 0 ? 40 : 64;
      const top = centerY - worstHalfHeight - 22;
      return centerX - 42 >= 0 && centerX + 42 <= 576 && top >= 0 && top + 20 <= 576;
    });
    const skillsBarVisible = visible(document.querySelector("#skillsBar"))
      && document.querySelector("#skillsBar").childElementCount > 0;
    const mobileControlsVisible = visible(document.querySelector("#mobileControls"))
      && !document.querySelector("#mobileControls").classList.contains("hidden")
      && document.querySelectorAll("#mobileControls button").length > 0;
    return {
      graphicsMode: canvas.dataset.graphicsMode,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      scrollY: window.scrollY,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      transparentPixels,
      nearMagentaPixels,
      meanLuminance,
      luminanceStandardDeviation: Math.sqrt(luminanceVariance),
      activeEffectsInsidePanel,
      actorRailsInsideCanvas,
      statusRowCount: statusRows.length,
      statusIconCount: statusIcons.length,
      statusIconsLoaded,
      skillsBarVisible,
      mobileControlsVisible
    };
  });
}

async function swipeToEffectsPane(page) {
  await page.locator("#layoutTrack").evaluate((element) => {
    const dispatch = (type, x) => element.dispatchEvent(new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 77,
      pointerType: "touch",
      clientX: x,
      clientY: 300
    }));
    dispatch("pointerdown", 330);
    dispatch("pointermove", 70);
    dispatch("pointerup", 70);
  });
  await page.waitForFunction(() => document.querySelector("#layout")?.style.getPropertyValue("--mobile-pane-index") === "2");
  await page.waitForTimeout(300);
}

async function captureHdCase(browser, viewportName, viewport) {
  console.info(`[status-emblems-qa] starting ${viewportName} HD`);
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type()) && !/AudioContext was not allowed to start/.test(message.text())) {
      consoleErrors.push({ type: message.type(), text: message.text() });
    }
  });
  page.on("pageerror", (error) => consoleErrors.push({ type: "pageerror", text: String(error) }));
  const target = path.join(outputRoot, viewportName, "hd");
  fs.mkdirSync(target, { recursive: true });
  try {
    await page.goto(`${baseUrl}?scenario=${scenario}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction((expected) => {
      const canvas = document.querySelector("#game");
      if (canvas?.dataset.graphicsMode !== "hd" || canvas.width !== 576 || canvas.height !== 576) return false;
      if (typeof window.render_game_to_text !== "function") return false;
      const state = JSON.parse(window.render_game_to_text());
      return state.phase === "playing" && state.scenario === expected && state.enemies.length === 5;
    }, scenario, { timeout: 240000 });
    console.info(`[status-emblems-qa] ${viewportName} HD ready`);
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, 0));
    const state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    const metrics = await inspectPage(page);
    console.info(`[status-emblems-qa] ${viewportName} HD inspected`);
    await captureCanvas(page, path.join(target, "canvas.png"));
    await page.screenshot({ path: path.join(target, "viewport.png"), fullPage: false });
    if (viewportName === "mobile") {
      await swipeToEffectsPane(page);
      await page.screenshot({ path: path.join(target, "effects-viewport.png"), fullPage: false });
    }
    writeJson(path.join(target, "state.json"), state);
    writeJson(path.join(target, "metrics.json"), metrics);
    writeJson(path.join(target, "diagnostics.json"), { consoleErrors });
    const result = { viewport: viewportName, mode: "hd", ...metrics, consoleErrors };
    summary.push(result);
    console.info(`[status-emblems-qa] ${viewportName} HD captured`);

    const mobileChromeMissing = viewportName === "mobile" && (!metrics.mobileControlsVisible || !metrics.skillsBarVisible);
    if (
      metrics.graphicsMode !== "hd" || metrics.canvasWidth !== 576 || metrics.canvasHeight !== 576
      || metrics.scrollY !== 0 || metrics.horizontalOverflow || mobileChromeMissing
      || metrics.transparentPixels > 0 || metrics.nearMagentaPixels > 0
      || metrics.luminanceStandardDeviation < 5 || consoleErrors.length > 0
      || !metrics.activeEffectsInsidePanel || !metrics.actorRailsInsideCanvas
      // Four HP pills plus the two Active Effects rows are the six DOM emblems;
      // the remaining showcase statuses live on the canvas actor rails.
      || !metrics.statusIconsLoaded || metrics.statusIconCount < 6
    ) {
      throw new Error(`HD status-emblem QA failed: ${JSON.stringify(result)}`);
    }
  } finally {
    await page.close();
    await context.close();
  }
}

async function captureClassicCase(browser) {
  console.info("[status-emblems-qa] starting desktop Classic");
  const context = await browser.newContext({ viewport: viewports.desktop });
  await context.route("**/config.js", async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      "window.DUNGEON_HD_GRAPHICS_ENABLED = true;",
      "window.DUNGEON_HD_GRAPHICS_ENABLED = false;"
    );
    await route.fulfill({ response, body, contentType: "text/javascript" });
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type()) && !/AudioContext was not allowed to start/.test(message.text())) {
      consoleErrors.push({ type: message.type(), text: message.text() });
    }
  });
  page.on("pageerror", (error) => consoleErrors.push({ type: "pageerror", text: String(error) }));
  const target = path.join(outputRoot, "desktop", "classic");
  fs.mkdirSync(target, { recursive: true });
  try {
    await page.goto(`${baseUrl}?scenario=${scenario}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction((expected) => {
      const canvas = document.querySelector("#game");
      if (canvas?.dataset.graphicsMode !== "legacy" || canvas.width !== 144 || canvas.height !== 144) return false;
      const state = JSON.parse(window.render_game_to_text());
      return state.phase === "playing" && state.scenario === expected;
    }, scenario, { timeout: 30000 });
    console.info("[status-emblems-qa] desktop Classic ready");
    await page.waitForTimeout(300);
    const state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    const metrics = await inspectPage(page);
    console.info("[status-emblems-qa] desktop Classic inspected");
    await captureCanvas(page, path.join(target, "canvas.png"));
    await page.screenshot({ path: path.join(target, "viewport.png"), fullPage: false });
    writeJson(path.join(target, "state.json"), state);
    writeJson(path.join(target, "metrics.json"), metrics);
    writeJson(path.join(target, "diagnostics.json"), { consoleErrors });
    const result = { viewport: "desktop", mode: "classic", ...metrics, consoleErrors };
    summary.push(result);
    console.info("[status-emblems-qa] desktop Classic captured");
    if (
      metrics.graphicsMode !== "legacy" || metrics.canvasWidth !== 144 || metrics.canvasHeight !== 144
      || metrics.statusIconCount !== 0 || consoleErrors.length > 0
    ) {
      throw new Error(`Classic status fallback QA failed: ${JSON.stringify(result)}`);
    }
  } finally {
    await page.close();
    await context.close();
  }
}

fs.mkdirSync(outputRoot, { recursive: true });
fs.copyFileSync(
  path.resolve("art/source/status-emblems-hd/status-emblems-contact-sheet.png"),
  path.join(outputRoot, "status-emblems-contact-sheet.png")
);

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--autoplay-policy=no-user-gesture-required"]
});
try {
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    await captureHdCase(browser, viewportName, viewport);
  }
  await captureClassicCase(browser);
  writeJson(path.join(outputRoot, "summary.json"), summary);
} finally {
  await browser.close();
}
