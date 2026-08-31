import { launchMutedBrowser } from "./playwright-muted-launch.mjs";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const codexHome = process.env.CODEX_HOME || path.join(process.env.USERPROFILE || "", ".codex");
const playwrightPath = path.join(codexHome, "skills", "develop-web-game", "node_modules", "playwright", "index.js");
const playwright = await import(pathToFileURL(playwrightPath).href);
const { chromium } = playwright.default;

const baseUrl = process.argv[2] || "http://127.0.0.1:8765/index.html";
const outputRoot = path.resolve(process.argv[3] || "output/hd-actor-proportions-qa");
const scenario = "actor_proportions_hd";
const viewports = {
  desktop: { width: 1440, height: 1000 },
  responsive: { width: 390, height: 844 }
};
const expectedPositions = Object.freeze({
  player: Object.freeze({ x: 4, y: 5 }),
  merchant: Object.freeze({ x: 7, y: 7 }),
  brute: Object.freeze({ x: 7, y: 2 }),
  totem: Object.freeze({ x: 1, y: 7 }),
  skeleton: Object.freeze({ x: 1, y: 2 })
});
const summary = [];

function writeJson(target, value) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

async function captureCanvas(page, target) {
  const dataUrl = await page.locator("#game").evaluate((canvas) => canvas.toDataURL("image/png"));
  if (!dataUrl.startsWith("data:image/png;base64,")) throw new Error("canvas capture did not return PNG data");
  fs.writeFileSync(target, Buffer.from(dataUrl.split(",")[1], "base64"));
}

async function inspectPage(page) {
  return page.evaluate((expected) => {
    const canvas = document.querySelector("#game");
    const state = JSON.parse(window.render_game_to_text());
    const savedRun = JSON.parse(localStorage.getItem("dungeonOneRoomRunSave") || "null");
    const enemies = Object.fromEntries((state.enemies || []).map((enemy) => [enemy.type, { x: enemy.x, y: enemy.y }]));
    const observedPositions = {
      player: { x: state.player?.x, y: state.player?.y },
      merchant: { x: savedRun?.merchant?.x, y: savedRun?.merchant?.y },
      brute: enemies.brute,
      totem: enemies.totem,
      skeleton: enemies.skeleton
    };
    const logicalPositionsUnchanged = Object.entries(expected).every(([key, position]) => (
      observedPositions[key]?.x === position.x && observedPositions[key]?.y === position.y
    ));
    const canvasRect = canvas.getBoundingClientRect();
    return {
      graphicsMode: canvas.dataset.graphicsMode,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      canvasRect: {
        left: canvasRect.left,
        top: canvasRect.top,
        right: canvasRect.right,
        bottom: canvasRect.bottom,
        width: canvasRect.width,
        height: canvasRect.height
      },
      canvasInsideViewport: canvasRect.left >= -1 && canvasRect.right <= innerWidth + 1
        && canvasRect.top >= -1 && canvasRect.bottom <= innerHeight + 1,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      verticalOverflow: document.documentElement.scrollHeight > document.documentElement.clientHeight,
      logicalPositionsUnchanged,
      observedPositions,
      renderState: state
    };
  }, expectedPositions);
}

async function captureCase(browser, viewportName, viewport) {
  console.info(`[actor-proportions-qa] starting ${viewportName}`);
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type()) && !/AudioContext was not allowed to start/.test(message.text())) {
      consoleErrors.push({ type: message.type(), text: message.text() });
    }
  });
  page.on("pageerror", (error) => consoleErrors.push({ type: "pageerror", text: String(error) }));
  const target = path.join(outputRoot, viewportName);
  fs.mkdirSync(target, { recursive: true });
  try {
    await page.goto(`${baseUrl}?scenario=${scenario}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction((expectedScenario) => {
      const canvas = document.querySelector("#game");
      if (canvas?.dataset.graphicsMode !== "hd" || canvas.width !== 576 || canvas.height !== 576) return false;
      if (typeof window.render_game_to_text !== "function") return false;
      const state = JSON.parse(window.render_game_to_text());
      return state.phase === "playing" && state.scenario === expectedScenario
        && state.roomType === "merchant" && state.enemies.length === 3;
    }, scenario, { timeout: 240000 });
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, 0));
    const metrics = await inspectPage(page);
    const state = {
      renderState: metrics.renderState,
      expectedPositions,
      observedPositions: metrics.observedPositions
    };
    delete metrics.renderState;
    await captureCanvas(page, path.join(target, "canvas.png"));
    await page.screenshot({ path: path.join(target, "viewport.png"), fullPage: false });
    writeJson(path.join(target, "state.json"), state);
    writeJson(path.join(target, "metrics.json"), metrics);
    writeJson(path.join(target, "diagnostics.json"), { consoleErrors });
    const result = { viewport: viewportName, ...metrics, consoleErrors };
    summary.push(result);
    if (
      metrics.graphicsMode !== "hd" || metrics.canvasWidth !== 576 || metrics.canvasHeight !== 576
      || metrics.scrollX !== 0 || metrics.scrollY !== 0 || metrics.horizontalOverflow || metrics.verticalOverflow
      || !metrics.canvasInsideViewport || !metrics.logicalPositionsUnchanged || consoleErrors.length > 0
    ) {
      throw new Error(`HD actor-proportion QA failed: ${JSON.stringify(result)}`);
    }
    console.info(`[actor-proportions-qa] ${viewportName} captured`);
  } finally {
    await page.close();
    await context.close();
  }
}

fs.mkdirSync(outputRoot, { recursive: true });
const browser = await launchMutedBrowser(chromium, {
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--autoplay-policy=no-user-gesture-required"]
});
try {
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    await captureCase(browser, viewportName, viewport);
  }
  writeJson(path.join(outputRoot, "summary.json"), summary);
} finally {
  await browser.close();
}
