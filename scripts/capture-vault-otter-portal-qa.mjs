import { launchMutedBrowser } from "./playwright-muted-launch.mjs";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const codexHome = process.env.CODEX_HOME || path.join(process.env.USERPROFILE || "", ".codex");
const playwrightPath = path.join(codexHome, "skills", "develop-web-game", "node_modules", "playwright", "index.js");
const playwright = await import(pathToFileURL(playwrightPath).href);
const { chromium } = playwright.default;

const baseUrl = process.argv[2] || "http://127.0.0.1:4173/index.html";
const outputRoot = path.resolve(process.argv[3] || "output/vault-otter-portal-qa/hd");
fs.mkdirSync(outputRoot, { recursive: true });

function writeJson(name, value) {
  fs.writeFileSync(path.join(outputRoot, name), `${JSON.stringify(value, null, 2)}\n`);
}

async function captureCanvas(page, name) {
  await page.locator("#game").screenshot({ path: path.join(outputRoot, name) });
}

async function waitForScenario(page, scenario) {
  await page.waitForFunction((expected) => {
    const canvas = document.querySelector("#game");
    if (canvas?.dataset.graphicsMode !== "hd" || canvas.width !== 576 || canvas.height !== 576) return false;
    if (typeof window.render_game_to_text !== "function") return false;
    const state = JSON.parse(window.render_game_to_text());
    return state.phase === "playing" && state.scenario === expected;
  }, scenario, { timeout: 240000 });
  await page.waitForTimeout(1800);
}

const browser = await launchMutedBrowser(chromium, {
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--autoplay-policy=no-user-gesture-required"]
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => localStorage.setItem("dungeonOneRoomGraphicsMode", "hd"));
const diagnostics = [];

try {
  const page = await context.newPage();
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type()) && !/AudioContext was not allowed to start/.test(message.text())) {
      diagnostics.push({ type: message.type(), text: message.text() });
    }
  });
  page.on("pageerror", (error) => diagnostics.push({ type: "pageerror", text: String(error) }));

  await page.goto(`${baseUrl}?scenario=vault_guardian_hd`, { waitUntil: "domcontentloaded" });
  await waitForScenario(page, "vault_guardian_hd");
  const vaultBlocked = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  await captureCanvas(page, "vault-blocked.png");

  await page.keyboard.press("F9");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Digit5");
  await page.keyboard.press("F9");
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text());
    return state.roomCleared === true && state.enemies.length === 0;
  }, null, { timeout: 10000 });
  await page.waitForTimeout(5000);
  const vaultCleared = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  await captureCanvas(page, "vault-cleared-portal.png");

  await page.goto(`${baseUrl}?scenario=corruption_merchant_hd`, { waitUntil: "domcontentloaded" });
  await waitForScenario(page, "corruption_merchant_hd");
  const standardCleared = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  await captureCanvas(page, "standard-cleared-portal.png");

  await page.goto(`${baseUrl}?scenario=corruption_forge_hd`, { waitUntil: "domcontentloaded" });
  await waitForScenario(page, "corruption_forge_hd");
  const forgeCleared = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  await captureCanvas(page, "forge-cleared-portal.png");

  await page.goto(`${baseUrl}?scenario=corruption_otter_hd`, { waitUntil: "domcontentloaded" });
  await waitForScenario(page, "corruption_otter_hd");
  const otterCleared = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  await captureCanvas(page, "otter-cleared-portal.png");

  writeJson("state.json", { vaultBlocked, vaultCleared, standardCleared, forgeCleared, otterCleared });
  writeJson("diagnostics.json", diagnostics);
  if (vaultBlocked.roomCleared || vaultBlocked.enemies.length !== 1) throw new Error("Vault blocked setup failed");
  if (!vaultCleared.roomCleared || vaultCleared.enemies.length !== 0 || !vaultCleared.interactables.portal) {
    throw new Error("Vault clear did not reveal a portal");
  }
  if (!standardCleared.roomCleared || !standardCleared.interactables.portal) throw new Error("Standard cleared setup failed");
  if (!forgeCleared.roomCleared || !forgeCleared.interactables.portal) throw new Error("Forge cleared setup failed");
  if (!otterCleared.roomCleared || !otterCleared.interactables.portal) throw new Error("Otter cleared setup failed");
  if (diagnostics.length > 0) throw new Error(`Browser diagnostics: ${JSON.stringify(diagnostics)}`);
} finally {
  await context.close();
  await browser.close();
}

console.log(`Captured Vault/Otter portal QA under ${outputRoot}`);
