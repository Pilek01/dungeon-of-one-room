import { launchMutedBrowser } from "./playwright-muted-launch.mjs";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const codexHome = process.env.CODEX_HOME || path.join(process.env.USERPROFILE || "", ".codex");
const playwright = await import(pathToFileURL(path.join(codexHome, "skills", "develop-web-game", "node_modules", "playwright", "index.js")).href);
const { chromium } = playwright.default;
const baseUrl = process.argv[2] || "http://127.0.0.1:8776/index.html";
const outputRoot = path.resolve(process.argv[3] || "output/beyond-qa");

fs.mkdirSync(outputRoot, { recursive: true });
const diagnostics = [];
const states = {};
let failure = null;
const browser = await launchMutedBrowser(chromium, { headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => localStorage.setItem("dungeonOneRoomGraphicsMode", "hd"));

async function loadScenario(page, scenario) {
  await page.goto(`${baseUrl}?scenario=${scenario}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction((expected) => {
    const canvas = document.querySelector("#game");
    if (canvas?.dataset.graphicsMode !== "hd" || typeof window.render_game_to_text !== "function") return false;
    const state = JSON.parse(window.render_game_to_text());
    return state.phase === "playing" && state.scenario === expected;
  }, scenario, { timeout: 60000 });
  await page.waitForTimeout(800);
}

try {
  const page = await context.newPage();
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type()) && !/AudioContext was not allowed to start/.test(message.text())) {
      diagnostics.push({ type: message.type(), text: message.text() });
    }
  });
  page.on("pageerror", (error) => diagnostics.push({ type: "pageerror", text: String(error) }));

  await loadScenario(page, "beyond_pit_hd");
  states.initial = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  if (states.initial.pits.length !== 5 || states.initial.player.chronoUsedThisRun) {
    throw new Error(`invalid initial Beyond pit state: ${JSON.stringify(states.initial)}`);
  }
  await page.locator("#game").screenshot({ path: path.join(outputRoot, "beyond-pit-room.png") });
  await page.keyboard.press("ArrowUp");
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).player.y === 5, { timeout: 10000 });
  await page.waitForTimeout(900);
  await page.keyboard.press("ArrowUp");
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text());
    return state.phase === "playing" && state.player.chronoUsedThisRun === true && !state.pits.some((pit) => pit.x === state.player.x && pit.y === state.player.y);
  }, { timeout: 10000 });
  states.afterChrono = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  await page.locator("#game").screenshot({ path: path.join(outputRoot, "beyond-chrono-rescue.png") });

  await loadScenario(page, "beyond_warden_hd");
  states.boss = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  if (!states.boss.bossRoom || states.boss.pits.length !== 0) {
    throw new Error(`Beyond boss room must not contain pits: ${JSON.stringify(states.boss)}`);
  }
  await page.locator("#game").screenshot({ path: path.join(outputRoot, "beyond-boss-room.png") });
  await page.close();
} catch (error) {
  failure = error;
  diagnostics.push({ type: "runner", text: String(error?.stack || error) });
} finally {
  await context.close();
  await browser.close();
}

fs.writeFileSync(path.join(outputRoot, "states.json"), `${JSON.stringify(states, null, 2)}\n`);
fs.writeFileSync(path.join(outputRoot, "diagnostics.json"), `${JSON.stringify(diagnostics, null, 2)}\n`);
if (diagnostics.length > 0 || failure) throw new Error(`Beyond QA diagnostics: ${JSON.stringify(diagnostics)}`);
console.log(`Captured Beyond room, Chrono rescue and boss-room exclusion under ${outputRoot}`);
