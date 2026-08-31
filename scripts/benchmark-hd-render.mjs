import { launchMutedBrowser } from "./playwright-muted-launch.mjs";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const codexHome = process.env.CODEX_HOME || path.join(process.env.USERPROFILE || "", ".codex");
const playwrightPath = path.join(codexHome, "skills", "develop-web-game", "node_modules", "playwright", "index.js");
const playwright = await import(pathToFileURL(playwrightPath).href);
const { chromium } = playwright.default;
const baseUrl = process.argv[2] || "http://127.0.0.1:8769/index.html";
const outputPath = path.resolve(process.argv[3] || "output/final-hd-audit/performance.json");
const profiles = [
  { name: "desktop", viewport: { width: 1280, height: 800 } },
  { name: "mobile", viewport: { width: 390, height: 844 } }
];
const results = [];
const consoleErrors = [];

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
const browser = await launchMutedBrowser(chromium, { headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader"] });
const context = await browser.newContext({ viewport: profiles[0].viewport });
const page = await context.newPage();
page.on("console", (message) => {
  if (["error", "warning"].includes(message.type()) && !/AudioContext was not allowed to start/.test(message.text())) {
    consoleErrors.push({ type: message.type(), text: message.text() });
  }
});
page.on("pageerror", (error) => consoleErrors.push({ type: "pageerror", text: String(error) }));

try {
  await page.goto(`${baseUrl}?scenario=vfx_showcase_hd`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const canvas = document.querySelector("#game");
    return canvas?.dataset.graphicsMode === "hd" && canvas.width === 576 && canvas.height === 576;
  }, null, { timeout: 240000 });
  await page.waitForFunction(() => {
    if (typeof window.render_game_to_text !== "function") return false;
    const state = JSON.parse(window.render_game_to_text());
    return state.phase === "playing" && state.scenario === "vfx_showcase_hd";
  }, null, { timeout: 10000 });

  for (const profile of profiles) {
    await page.setViewportSize(profile.viewport);
    await page.waitForTimeout(500);
    const sample = await page.evaluate(async () => {
      const timestamps = [];
      await new Promise((resolve) => {
        const tick = (now) => {
          timestamps.push(now);
          if (timestamps.length >= 185) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      const deltas = timestamps.slice(1).map((value, index) => value - timestamps[index]).slice(5);
      deltas.sort((left, right) => left - right);
      const meanFrameMs = deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
      const p95FrameMs = deltas[Math.min(deltas.length - 1, Math.floor(deltas.length * 0.95))];
      return {
        sampleCount: deltas.length,
        meanFrameMs,
        p95FrameMs,
        maxFrameMs: deltas[deltas.length - 1],
        estimatedFps: 1000 / meanFrameMs,
        graphicsMode: document.querySelector("#game")?.dataset.graphicsMode
      };
    });
    results.push({ profile: profile.name, viewport: profile.viewport, ...sample });
    if (sample.graphicsMode !== "hd" || sample.meanFrameMs > 24 || sample.p95FrameMs > 40) {
      throw new Error(`HD frame pacing failed: ${JSON.stringify(results.at(-1))}`);
    }
  }
  if (consoleErrors.length) throw new Error(`browser diagnostics during benchmark: ${JSON.stringify(consoleErrors)}`);
} finally {
  await browser.close();
  fs.writeFileSync(outputPath, JSON.stringify({ results, consoleErrors }, null, 2) + "\n");
}

console.log(`HD performance gate passed: ${results.map((item) => `${item.profile} ${item.estimatedFps.toFixed(1)} fps`).join(", ")}`);
