import { launchMutedBrowser } from "./playwright-muted-launch.mjs";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const codexHome = process.env.CODEX_HOME || path.join(process.env.USERPROFILE || "", ".codex");
const playwright = await import(pathToFileURL(path.join(codexHome, "skills", "develop-web-game", "node_modules", "playwright", "index.js")).href);
const { chromium } = playwright.default;
const baseUrl = process.argv[2] || "http://127.0.0.1:8766/index.html";
const outputRoot = path.resolve(process.argv[3] || "output/task9-hd-boss-qa/matrix");
const scenarios = ["vault_guardian_hd", "blacksmith_guardian_hd", "warden_phase1_hd", "warden_phase2_aegis_hd"];
const viewports = { desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 } };
const summary = [];
fs.mkdirSync(outputRoot, { recursive: true });
const browser = await launchMutedBrowser(chromium, { headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader"] });
try {
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    const context = await browser.newContext({ viewport });
    for (const scenario of scenarios) {
      const page = await context.newPage();
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
      await page.waitForTimeout(500);
      await page.evaluate(() => window.scrollTo(0, 0));
      const state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
      const layout = await page.evaluate(() => {
        const isVisibleInViewport = (element) => {
          if (!element) return false;
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0
            && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
        };
        const skillsBar = document.querySelector("#skillsBar");
        const mobileControls = document.querySelector("#mobileControls");
        return {
          graphicsMode: document.querySelector("#game")?.dataset.graphicsMode,
          canvasWidth: document.querySelector("#game")?.width,
          canvasHeight: document.querySelector("#game")?.height,
          scrollY: window.scrollY,
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          skillsBarVisible: isVisibleInViewport(skillsBar) && skillsBar.childElementCount > 0,
          mobileControlsVisible: isVisibleInViewport(mobileControls) && mobileControls.querySelectorAll("button").length > 0
        };
      });
      const target = path.join(outputRoot, viewportName, scenario);
      fs.mkdirSync(target, { recursive: true });
      await page.screenshot({ path: path.join(target, "viewport.png") });
      await page.locator("#game").screenshot({ path: path.join(target, "canvas.png") });
      fs.writeFileSync(path.join(target, "state.json"), JSON.stringify(state, null, 2) + "\n");
      fs.writeFileSync(path.join(target, "diagnostics.json"), JSON.stringify({ consoleErrors }, null, 2) + "\n");
      const result = { viewport: viewportName, scenario, ...layout, consoleErrors };
      summary.push(result);
      const mobileChromeMissing = viewportName === "mobile" && (!layout.skillsBarVisible || !layout.mobileControlsVisible);
      if (layout.graphicsMode !== "hd" || layout.canvasWidth !== 576 || layout.canvasHeight !== 576 || layout.scrollY !== 0 || layout.horizontalOverflow || mobileChromeMissing || consoleErrors.length) {
        throw new Error(`boss QA failed: ${JSON.stringify(result)}`);
      }
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(outputRoot, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
}
console.log(`Captured ${summary.length} HD boss scenarios under ${outputRoot}`);
