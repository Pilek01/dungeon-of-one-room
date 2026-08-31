import { launchMutedBrowser } from "./playwright-muted-launch.mjs";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const codexHome = process.env.CODEX_HOME || path.join(process.env.USERPROFILE || "", ".codex");
const playwrightPath = path.join(codexHome, "skills", "develop-web-game", "node_modules", "playwright", "index.js");
const playwright = await import(pathToFileURL(playwrightPath).href);
const { chromium } = playwright.default;

const baseUrl = process.argv[2] || "http://127.0.0.1:8774/index.html";
const outputRoot = path.resolve(process.argv[3] || "output/hd-dungeon-variation-qa");
const scenarios = [
  "descent_floor_variants_hd",
  "corruption_floor_variants_hd",
  "abyss_floor_variants_hd",
  "abyss_combat_hd"
];
const viewports = {
  desktop: { width: 1440, height: 1000 },
  mobile: { width: 390, height: 844 }
};
const summary = [];

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

fs.mkdirSync(outputRoot, { recursive: true });
try {
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    const browser = await launchMutedBrowser(chromium, {
      headless: true,
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--autoplay-policy=no-user-gesture-required"]
    });
    const context = await browser.newContext({ viewport });
    try {
      for (const scenario of scenarios) {
        console.log(`Capturing ${viewportName}/${scenario}`);
        const page = await context.newPage();
        const consoleErrors = [];
        const expectedWarnings = [];
        page.on("console", (message) => {
          const diagnostic = { type: message.type(), text: message.text() };
          if (message.type() === "warning" && /AudioContext was not allowed to start/.test(message.text())) {
            expectedWarnings.push(diagnostic);
          } else if (["error", "warning"].includes(message.type())) {
            consoleErrors.push(diagnostic);
          }
        });
        page.on("pageerror", (error) => consoleErrors.push({ type: "pageerror", text: String(error) }));
        try {
          await page.goto(`${baseUrl}?scenario=${scenario}`, { waitUntil: "domcontentloaded" });
          try {
            await page.waitForFunction(() => {
              const canvas = document.querySelector("#game");
              return canvas?.dataset.graphicsMode === "hd" && canvas.width === 576 && canvas.height === 576;
            }, null, { timeout: 60000 });
          } catch (error) {
            const loaderState = await page.evaluate(() => {
              const canvas = document.querySelector("#game");
              return {
                graphicsMode: canvas?.dataset.graphicsMode || "",
                width: canvas?.width || 0,
                height: canvas?.height || 0,
                bodyText: document.body?.innerText?.slice(0, 500) || ""
              };
            });
            throw new Error(
              `HD preload timeout for ${viewportName}/${scenario}: ${JSON.stringify({ loaderState, consoleErrors, cause: String(error) })}`
            );
          }
          await page.waitForFunction((expected) => {
            if (typeof window.render_game_to_text !== "function") return false;
            const state = JSON.parse(window.render_game_to_text());
            return state.phase === "playing" && state.scenario === expected;
          }, scenario, { timeout: 10000 });
          await page.waitForTimeout(500);
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForFunction(() => window.scrollY === 0, null, { timeout: 2000 });

          const state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
          const inspection = await page.evaluate((scenarioId) => {
            const canvas = document.querySelector("#game");
            const rect = canvas.getBoundingClientRect();
            const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
            let luminance = 0;
            let luminanceSquared = 0;
            let transparentPixels = 0;
            let nearMagentaPixels = 0;
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
            const variance = Math.max(0, luminanceSquared / pixelCount - meanLuminance * meanLuminance);
            const definition = window.DungeonScenarioOverrides?.parseScenarioRequest(`?scenario=${scenarioId}`);
            const semanticValues = Array.isArray(definition?.floorPattern)
              ? [...new Set(definition.floorPattern.flat())].sort((left, right) => left - right)
              : [];
            return {
              graphicsMode: canvas.dataset.graphicsMode,
              canvasWidth: canvas.width,
              canvasHeight: canvas.height,
              cssWidth: rect.width,
              cssHeight: rect.height,
              scrollY: window.scrollY,
              horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
              meanLuminance,
              luminanceStandardDeviation: Math.sqrt(variance),
              transparentPixels,
              nearMagentaPixels,
              semanticValues
            };
          }, scenario);

          const target = path.join(outputRoot, viewportName, scenario);
          fs.mkdirSync(target, { recursive: true });
          await page.screenshot({ path: path.join(target, "viewport.png"), fullPage: false });
          await page.locator("#game").screenshot({ path: path.join(target, "canvas.png") });
          writeJson(path.join(target, "state.json"), state);
          writeJson(path.join(target, "diagnostics.json"), { consoleErrors, expectedWarnings });
          writeJson(path.join(target, "metrics.json"), inspection);

          const result = { viewport: viewportName, scenario, ...inspection, consoleErrors, expectedWarnings };
          summary.push(result);
          if (inspection.graphicsMode !== "hd" || inspection.canvasWidth !== 576 || inspection.canvasHeight !== 576) {
            throw new Error(`HD canvas contract failed: ${JSON.stringify(result)}`);
          }
          if (inspection.horizontalOverflow || inspection.scrollY !== 0) {
            throw new Error(`layout gate failed: ${JSON.stringify(result)}`);
          }
          if (consoleErrors.length) throw new Error(`browser diagnostics: ${JSON.stringify(result)}`);
          if (inspection.transparentPixels > 0 || inspection.nearMagentaPixels > 0 || inspection.luminanceStandardDeviation < 5) {
            throw new Error(`pixel integrity gate failed: ${JSON.stringify(result)}`);
          }
          if (scenario.endsWith("_floor_variants_hd") && inspection.semanticValues.join(",") !== "0,1,2,3,4,5,6,7,8,9") {
            throw new Error(`semantic floor coverage failed: ${JSON.stringify(result)}`);
          }
          if (
            viewportName === "desktop"
            && scenario === "abyss_combat_hd"
            && (inspection.meanLuminance < 45 || inspection.meanLuminance > 55)
          ) {
            throw new Error(`Abyss combat luminance gate failed: ${JSON.stringify(result)}`);
          }
        } finally {
          await page.close();
        }
      }
    } finally {
      await context.close();
      await browser.close();
    }
  }
} finally {
  writeJson(path.join(outputRoot, "summary.json"), summary);
}

console.log(`Captured ${summary.length} HD dungeon variation scenarios under ${outputRoot}`);
