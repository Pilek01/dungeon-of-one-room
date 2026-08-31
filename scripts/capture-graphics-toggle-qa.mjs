import { launchMutedBrowser } from "./playwright-muted-launch.mjs";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const codexHome = process.env.CODEX_HOME || path.join(process.env.USERPROFILE || "", ".codex");
const playwrightPath = path.join(codexHome, "skills", "develop-web-game", "node_modules", "playwright", "index.js");
const playwright = await import(pathToFileURL(playwrightPath).href);
const { chromium } = playwright.default;

const baseUrl = process.argv[2] || "http://127.0.0.1:8765/index.html";
const outputRoot = path.resolve(process.argv[3] || "output/graphics-toggle-qa");
const scenarioUrl = `${baseUrl}?scenario=status_emblems_hd`;
const consoleErrors = [];
const forbiddenRequests = [];
const checkpoints = [];

function writeJson(target, value) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

async function readState(page) {
  return JSON.parse(await page.evaluate(() => window.render_game_to_text()));
}

function runSignature(state) {
  return {
    depth: state.depth,
    roomType: state.roomType,
    roomCleared: state.roomCleared,
    player: state.player,
    enemies: state.enemies.map((enemy) => ({
      type: enemy.type,
      name: enemy.name,
      x: enemy.x,
      y: enemy.y,
      hp: enemy.hp,
      maxHp: enemy.maxHp,
      elite: enemy.elite
    }))
  };
}

function sameRunState(before, after) {
  return JSON.stringify(runSignature(before)) === JSON.stringify(runSignature(after));
}

async function readMetrics(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("#game");
    const rect = canvas?.getBoundingClientRect();
    const style = canvas ? getComputedStyle(canvas) : null;
    return {
      gameVersion: window.DUNGEON_GAME_VERSION || window.GAME_VERSION || "",
      graphicsMode: canvas?.dataset.graphicsMode || "",
      canvasWidth: canvas?.width || 0,
      canvasDisplay: style?.display || "",
      canvasVisibility: style?.visibility || "",
      canvasRect: rect ? { width: rect.width, height: rect.height } : null,
      appHidden: document.querySelector("#gameApp")?.classList.contains("app-hidden") || false,
      bootClass: document.querySelector("#bootScreen")?.className || "",
      bodyClass: document.body.className,
      canvasHeight: canvas?.height || 0,
      canvasVisible: Boolean(rect && rect.width > 0 && rect.height > 0 && style?.display !== "none" && style?.visibility !== "hidden"),
      hdUi: document.body.classList.contains("graphics-hd-ui"),
      phase: (() => {
        try { return JSON.parse(window.render_game_to_text?.() || "{}").phase || ""; } catch { return ""; }
      })()
    };
  });
}

async function waitForRenderer(page) {
  await page.waitForFunction(() => {
    const canvas = document.querySelector("#game");
    return canvas?.dataset.graphicsMode === "hd" && canvas.width === 576 && canvas.height === 576;
  }, null, { timeout: 120000 });
}

async function waitForPlaying(page) {
  await page.waitForFunction(() => {
    if (typeof window.render_game_to_text !== "function") return false;
    return JSON.parse(window.render_game_to_text()).phase === "playing";
  }, null, { timeout: 120000 });
}

async function assertHd(page, label) {
  await waitForRenderer(page);
  const metrics = await readMetrics(page);
  if (metrics.gameVersion !== "v0.8.2" || metrics.graphicsMode !== "hd" || metrics.canvasWidth !== 576 || metrics.canvasHeight !== 576 || !metrics.hdUi) {
    throw new Error(`${label}: HD contract failed: ${JSON.stringify(metrics)}`);
  }
  return metrics;
}

async function capture(page, name) {
  const target = path.join(outputRoot, name);
  fs.mkdirSync(target, { recursive: true });
  await page.waitForFunction(() => typeof window.render_game_to_text === "function", null, { timeout: 120000 });
  const state = await readState(page);
  const metrics = await assertHd(page, name);
  if (state.phase === "playing" && !metrics.canvasVisible) {
    throw new Error(name + ": active HD canvas is not visible: " + JSON.stringify({ statePhase: state.phase, metrics }));
  }
  await page.screenshot({ path: path.join(target, "viewport.png"), fullPage: false });
  if (metrics.canvasVisible) await page.locator("#game").screenshot({ path: path.join(target, "canvas.png") });
  writeJson(path.join(target, "state.json"), state);
  writeJson(path.join(target, "metrics.json"), metrics);
  checkpoints.push({ name, state, metrics });
  return { state, metrics };
}

fs.mkdirSync(outputRoot, { recursive: true });
const browser = await launchMutedBrowser(chromium, {
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"]
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.on("console", (message) => {
  if (!["error", "warning"].includes(message.type())) return;
  if (/AudioContext was not allowed to start/.test(message.text())) return;
  consoleErrors.push({ type: message.type(), text: message.text() });
});
page.on("pageerror", (error) => consoleErrors.push({ type: "pageerror", text: String(error) }));
page.on("request", (request) => {
  const pathname = new URL(request.url()).pathname;
  if (pathname === "/assets/logo.png" || pathname.startsWith("/assets/sprite/")) forbiddenRequests.push(pathname);
});

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await assertHd(page, "HD startup");
  const startup = await capture(page, "01-startup-hd");
  await page.goto(scenarioUrl, { waitUntil: "domcontentloaded" });
  await waitForPlaying(page);
  const playing = await capture(page, "02-playing-hd");
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForPlaying(page);
  const reload = await capture(page, "03-reload-hd");
  if (!sameRunState(playing.state, reload.state)) throw new Error("HD reload changed the deterministic run state");
  if (forbiddenRequests.length > 0) throw new Error(`Forbidden asset requests detected: ${JSON.stringify(forbiddenRequests)}`);
  if (consoleErrors.length > 0) throw new Error(`Browser diagnostics during HD QA: ${JSON.stringify(consoleErrors)}`);
  writeJson(path.join(outputRoot, "summary.json"), {
    sameRunState: sameRunState(playing.state, reload.state),
    startup: startup.metrics,
    reload: reload.metrics,
    forbiddenRequests,
    consoleErrors,
    checkpoints
  });
  console.info("HD startup/reload QA passed: v0.8.2, 576x576 canvas, zero forbidden asset requests");
} finally {
  await page.close();
  await context.close();
  await browser.close();
}
