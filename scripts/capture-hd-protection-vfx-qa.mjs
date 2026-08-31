import { launchMutedBrowser } from "./playwright-muted-launch.mjs";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const codexHome = process.env.CODEX_HOME || path.join(process.env.USERPROFILE || "", ".codex");
const playwright = await import(pathToFileURL(path.join(codexHome, "skills", "develop-web-game", "node_modules", "playwright", "index.js")).href);
const { chromium } = playwright.default;
const baseUrl = process.argv[2] || "http://127.0.0.1:8772/index.html";
const outputRoot = path.resolve(process.argv[3] || "output/hd-protection-vfx-qa");
const scenarios = ["player_shield_hd", "player_barrier_hd", "blacksmith_guardian_hd", "warden_phase2_aegis_hd"];
const viewports = { desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 } };
const summary = [];

fs.mkdirSync(outputRoot, { recursive: true });
try {
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    for (const scenario of scenarios) {
      const browser = await launchMutedBrowser(chromium, { headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader"] });
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      try {
        const consoleErrors = [];
        page.on("console", (message) => {
          if (["error", "warning"].includes(message.type()) && !/AudioContext was not allowed to start/.test(message.text())) {
            consoleErrors.push({ type: message.type(), text: message.text() });
          }
        });
        page.on("pageerror", (error) => consoleErrors.push({ type: "pageerror", text: String(error) }));
        await page.goto(`${baseUrl}?scenario=${scenario}`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => {
          const canvas = document.querySelector("#game");
          return canvas?.dataset.graphicsMode === "hd" && canvas.width === 576 && canvas.height === 576;
        }, null, { timeout: 240000 });
        await page.waitForFunction((expected) => {
          if (typeof window.render_game_to_text !== "function") return false;
          const state = JSON.parse(window.render_game_to_text());
          return state.phase === "playing" && state.scenario === expected;
        }, scenario, { timeout: 10000 });
        await page.waitForTimeout(350);
        await page.evaluate(() => window.scrollTo(0, 0));
        const target = path.join(outputRoot, viewportName, scenario);
        fs.mkdirSync(target, { recursive: true });
        const canvas = page.locator("#game");
        for (let phase = 1; phase <= 3; phase += 1) {
          if (phase > 1) await page.waitForTimeout(180);
          const dataUrl = await canvas.evaluate((element) => element.toDataURL("image/png"));
          const pngPrefix = "data:image/png;base64,";
          if (!dataUrl.startsWith(pngPrefix)) throw new Error("canvas capture did not return PNG data");
          fs.writeFileSync(
            path.join(target, `canvas-${String(phase).padStart(2, "0")}.png`),
            Buffer.from(dataUrl.slice(pngPrefix.length), "base64")
          );
        }
        await page.screenshot({ path: path.join(target, "viewport.png") });
        const state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
        const layout = await page.evaluate(() => {
          const canvas = document.querySelector("#game");
          const rect = canvas.getBoundingClientRect();
          return {
            graphicsMode: canvas.dataset.graphicsMode,
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            cssWidth: rect.width,
            cssHeight: rect.height,
            scrollY: window.scrollY,
            horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
          };
        });
        fs.writeFileSync(path.join(target, "state.json"), JSON.stringify(state, null, 2) + "\n");
        fs.writeFileSync(path.join(target, "diagnostics.json"), JSON.stringify({ consoleErrors }, null, 2) + "\n");
        const result = { viewport: viewportName, scenario, ...layout, consoleErrors };
        summary.push(result);
        if (layout.graphicsMode !== "hd" || layout.canvasWidth !== 576 || layout.canvasHeight !== 576 || layout.scrollY !== 0 || layout.horizontalOverflow || consoleErrors.length) {
          throw new Error(`protection VFX QA failed: ${JSON.stringify(result)}`);
        }
      } finally {
        await context.close();
        await browser.close();
      }
    }
  }
} finally {
  fs.writeFileSync(path.join(outputRoot, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
}

console.log(`Captured ${summary.length} protection VFX scenarios under ${outputRoot}`);
