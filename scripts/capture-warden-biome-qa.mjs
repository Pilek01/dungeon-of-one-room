import { launchMutedBrowser } from "./playwright-muted-launch.mjs";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const codexHome = process.env.CODEX_HOME || path.join(process.env.USERPROFILE || "", ".codex");
const playwright = await import(pathToFileURL(path.join(codexHome, "skills", "develop-web-game", "node_modules", "playwright", "index.js")).href);
const { chromium } = playwright.default;
const baseUrl = process.argv[2] || "http://127.0.0.1:8776/index.html";
const outputRoot = path.resolve(process.argv[3] || "output/warden-biome-qa");
const scenarios = [
  "vault_guardian_hd",
  "descent_warden_hd",
  "corruption_warden_hd",
  "abyss_warden_hd",
  "beyond_warden_hd",
  "warden_phase2_aegis_hd"
];

fs.mkdirSync(outputRoot, { recursive: true });
const diagnostics = [];
const states = {};
const browser = await launchMutedBrowser(chromium, { headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => localStorage.setItem("dungeonOneRoomGraphicsMode", "hd"));

try {
  for (const scenario of scenarios) {
    const page = await context.newPage();
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type()) && !/AudioContext was not allowed to start/.test(message.text())) {
        diagnostics.push({ scenario, type: message.type(), text: message.text() });
      }
    });
    page.on("pageerror", (error) => diagnostics.push({ scenario, type: "pageerror", text: String(error) }));
    await page.goto(`${baseUrl}?scenario=${scenario}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction((expected) => {
      const canvas = document.querySelector("#game");
      if (canvas?.dataset.graphicsMode !== "hd" || canvas.width !== 576 || canvas.height !== 576) return false;
      if (typeof window.render_game_to_text !== "function") return false;
      const state = JSON.parse(window.render_game_to_text());
      return state.phase === "playing" && state.scenario === expected;
    }, scenario, { timeout: 60000 });
    await page.waitForTimeout(700);
    states[scenario] = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    await page.locator("#game").screenshot({ path: path.join(outputRoot, `${scenario}.png`) });
    await page.close();
  }
} finally {
  await context.close();
  await browser.close();
}

fs.writeFileSync(path.join(outputRoot, "states.json"), `${JSON.stringify(states, null, 2)}\n`);
fs.writeFileSync(path.join(outputRoot, "diagnostics.json"), `${JSON.stringify(diagnostics, null, 2)}\n`);
if (diagnostics.length > 0) throw new Error(`Warden biome QA diagnostics: ${JSON.stringify(diagnostics)}`);
console.log(`Captured ${scenarios.length} HD boss regression scenarios under ${outputRoot}`);
