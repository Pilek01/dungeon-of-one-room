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
const preferenceKey = "dungeonOneRoomGraphicsMode";
const consoleErrors = [];
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

function assertPresentationConsistency(metrics, label) {
  const canvasMode = metrics.graphicsMode === "hd" ? "hd" : "classic";
  const hudMode = metrics.hdHud ? "hd" : "classic";
  if (hudMode !== canvasMode) {
    throw new Error(`${label}: HUD is ${hudMode} while canvas is ${canvasMode}: ${JSON.stringify(metrics)}`);
  }
}

async function readMetrics(page) {
  return page.evaluate((key) => {
    const canvas = document.querySelector("#game");
    const overlay = document.querySelector("#screenOverlay");
    const canvasRect = canvas?.getBoundingClientRect();
    const canvasStyle = canvas ? getComputedStyle(canvas) : null;
    return {
      graphicsMode: canvas?.dataset.graphicsMode || "",
      canvasWidth: canvas?.width || 0,
      canvasHeight: canvas?.height || 0,
      canvasVisible: Boolean(
        canvasRect &&
        canvasRect.width > 0 &&
        canvasRect.height > 0 &&
        canvasStyle?.display !== "none" &&
        canvasStyle?.visibility !== "hidden"
      ),
      mainMenuOnly: document.body.classList.contains("main-menu-only"),
      preference: localStorage.getItem(key),
      hdHud: document.body.classList.contains("graphics-hd-ui"),
      overlayVisible: overlay?.classList.contains("visible") || false,
      overlayText: overlay?.innerText || ""
    };
  }, preferenceKey);
}

async function waitForPlaying(page) {
  await page.waitForFunction(() => {
    if (typeof window.render_game_to_text !== "function") return false;
    return JSON.parse(window.render_game_to_text()).phase === "playing";
  }, { timeout: 120000 });
}

async function waitForRenderer(page, mode) {
  const expected = mode === "hd" ? { marker: "hd", size: 576 } : { marker: "legacy", size: 144 };
  await page.waitForFunction(({ marker, size }) => {
    const canvas = document.querySelector("#game");
    return canvas?.dataset.graphicsMode === marker && canvas.width === size && canvas.height === size;
  }, expected, { timeout: 120000 });
}

async function waitForOverlay(page, text) {
  await page.waitForFunction((expected) => {
    const overlay = document.querySelector("#screenOverlay");
    return overlay?.classList.contains("visible") && overlay.innerText.toLowerCase().includes(expected.toLowerCase());
  }, text, { timeout: 10000 });
}

async function waitForGraphicsChoice(page, label) {
  await page.waitForFunction((expected) => {
    const overlay = document.querySelector("#screenOverlay");
    return overlay?.classList.contains("visible") && overlay.innerText.includes(`${expected} (Active)`);
  }, label, { timeout: 120000 });
}

async function capture(page, name) {
  const target = path.join(outputRoot, name);
  fs.mkdirSync(target, { recursive: true });
  const state = await readState(page);
  const metrics = await readMetrics(page);
  assertPresentationConsistency(metrics, name);
  if (state.phase === "playing" && !metrics.canvasVisible) {
    throw new Error(`${name}: active gameplay canvas is not player-visible: ${JSON.stringify(metrics)}`);
  }
  if (!metrics.canvasVisible && !metrics.mainMenuOnly) {
    throw new Error(`${name}: canvas is hidden outside the intentional main-menu surface: ${JSON.stringify(metrics)}`);
  }
  await page.screenshot({ path: path.join(target, "viewport.png"), fullPage: false });
  if (metrics.canvasVisible) {
    await page.locator("#game").screenshot({ path: path.join(target, "canvas.png") });
  }
  writeJson(path.join(target, "state.json"), state);
  writeJson(path.join(target, "metrics.json"), metrics);
  checkpoints.push({ name, state, metrics });
  return { state, metrics };
}

async function openGraphicsOptions(page) {
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === "menu");
  await page.keyboard.press("Digit6");
  await waitForOverlay(page, "Options");
  await page.keyboard.press("Digit3");
  await waitForOverlay(page, "Graphics");
}

async function continueRun(page) {
  await page.keyboard.press("Escape");
  await waitForOverlay(page, "Options");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => {
    const overlay = document.querySelector("#screenOverlay");
    return overlay?.innerText.includes("Continue") && !overlay.innerText.includes("Choose a category");
  });
  await page.keyboard.press("Digit2");
  await waitForPlaying(page);
  await page.waitForFunction(() => !document.querySelector("#screenOverlay")?.classList.contains("visible"));
}

fs.mkdirSync(outputRoot, { recursive: true });
const browser = await chromium.launch({
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

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate((key) => localStorage.removeItem(key), preferenceKey);
  await page.goto(scenarioUrl, { waitUntil: "domcontentloaded" });
  await waitForPlaying(page);
  assertPresentationConsistency(await readMetrics(page), "HD scenario startup");
  await waitForRenderer(page, "hd");
  const before = await capture(page, "01-playing-hd");

  await openGraphicsOptions(page);
  await waitForGraphicsChoice(page, "HD");
  await capture(page, "02-menu-hd");
  await page.keyboard.press("Digit2");
  assertPresentationConsistency(await readMetrics(page), "HD to Classic transition");
  await waitForRenderer(page, "classic");
  await waitForGraphicsChoice(page, "Classic");
  const classicMenu = await capture(page, "03-menu-classic");
  if (classicMenu.metrics.preference !== "classic") throw new Error("Classic preference was not persisted");

  await continueRun(page);
  await waitForRenderer(page, "classic");
  const classicPlaying = await capture(page, "04-playing-classic");
  if (!sameRunState(before.state, classicPlaying.state)) throw new Error("Run changed during HD to Classic switch");

  await openGraphicsOptions(page);
  await page.keyboard.press("Digit1");
  assertPresentationConsistency(await readMetrics(page), "Classic to HD transition");
  await waitForRenderer(page, "hd");
  await waitForGraphicsChoice(page, "HD");
  const hdMenu = await capture(page, "05-menu-hd-restored");
  if (hdMenu.metrics.preference !== "hd") throw new Error("HD preference was not persisted");

  await continueRun(page);
  const hdPlaying = await capture(page, "06-playing-hd-restored");
  if (!sameRunState(before.state, hdPlaying.state)) throw new Error("Run changed during Classic to HD switch");

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForPlaying(page);
  assertPresentationConsistency(await readMetrics(page), "HD reload startup");
  await waitForRenderer(page, "hd");
  const hdReload = await capture(page, "07-reload-hd-persisted");
  if (hdReload.metrics.preference !== "hd") throw new Error("Reload did not retain HD preference");

  await openGraphicsOptions(page);
  await page.keyboard.press("Digit2");
  await waitForRenderer(page, "classic");
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForPlaying(page);
  assertPresentationConsistency(await readMetrics(page), "Classic reload startup");
  await waitForRenderer(page, "classic");
  const classicReload = await capture(page, "08-reload-classic-persisted");
  if (classicReload.metrics.preference !== "classic") throw new Error("Reload did not retain Classic preference");

  if (consoleErrors.length > 0) {
    throw new Error(`Browser diagnostics during graphics-toggle QA: ${JSON.stringify(consoleErrors)}`);
  }

  writeJson(path.join(outputRoot, "summary.json"), {
    sameRunState: sameRunState(before.state, classicPlaying.state) && sameRunState(before.state, hdPlaying.state),
    consoleErrors,
    checkpoints
  });
  console.info("Graphics toggle QA passed: HD -> Classic -> HD, run preserved, preferences persisted");
} finally {
  await page.close();
  await context.close();
  await browser.close();
}
