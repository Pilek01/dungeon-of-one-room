import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const codexHome = process.env.CODEX_HOME || path.join(process.env.USERPROFILE || "", ".codex");
const playwrightPath = path.join(codexHome, "skills", "develop-web-game", "node_modules", "playwright", "index.js");
const playwright = await import(pathToFileURL(playwrightPath).href);
const { chromium } = playwright.default;

const resume = process.argv.includes("--resume");
const positionalArgs = process.argv.slice(2).filter((argument) => argument !== "--resume");
const baseUrl = positionalArgs[0] || "http://127.0.0.1:8765/index.html";
const outputRoot = path.resolve(positionalArgs[1] || "output/task8-hd-room-qa/matrix");
const themes = ["corruption", "abyss"];
const rooms = ["combat", "cursed", "merchant", "forge", "pact", "vault", "otter", "boss"];
const viewports = {
  desktop: { width: 1440, height: 1000 },
  mobile: { width: 390, height: 844 }
};

fs.mkdirSync(outputRoot, { recursive: true });
const summaryPath = path.join(outputRoot, "summary.json");
const priorSummary = resume && fs.existsSync(summaryPath)
  ? JSON.parse(fs.readFileSync(summaryPath, "utf8"))
  : [];
const priorByKey = new Map(priorSummary.map((entry) => [`${entry.viewport}/${entry.scenario}`, entry]));
const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--autoplay-policy=no-user-gesture-required"]
});
const summary = [];

try {
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    const context = await browser.newContext({ viewport });

    for (const theme of themes) {
      for (const room of rooms) {
        const scenario = `${theme}_${room}_hd`;
        const scenarioRoot = path.join(outputRoot, viewportName, scenario);
        fs.mkdirSync(scenarioRoot, { recursive: true });
        const prior = priorByKey.get(`${viewportName}/${scenario}`);
        if (
          resume
          && prior
          && prior.graphicsMode === "hd"
          && prior.canvasWidth === 576
          && prior.canvasHeight === 576
          && prior.horizontalOverflow === false
          && prior.scrollY === 0
          && Array.isArray(prior.consoleErrors)
          && prior.consoleErrors.length === 0
          && fs.existsSync(path.join(scenarioRoot, "viewport.png"))
          && fs.existsSync(path.join(scenarioRoot, "canvas.png"))
        ) {
          summary.push(prior);
          continue;
        }
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
        page.on("pageerror", (error) => {
          consoleErrors.push({ type: "pageerror", text: String(error) });
        });
        const url = `${baseUrl}?scenario=${scenario}`;
        await page.goto(url, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(
          () => {
            const canvas = document.querySelector("#game");
            return canvas && canvas.dataset.graphicsMode === "hd" && canvas.width === 576 && canvas.height === 576;
          },
          null,
          { timeout: 30000 }
        );
        await page.waitForFunction(() => {
          const boot = document.querySelector("#bootScreen");
          return !boot || boot.classList.contains("hidden") || getComputedStyle(boot).display === "none";
        }, null, { timeout: 5000 });
        await page.waitForFunction(
          (expected) => {
            if (typeof window.render_game_to_text !== "function") return false;
            const state = JSON.parse(window.render_game_to_text());
            return state.phase === "playing" && state.scenario === expected;
          },
          scenario,
          { timeout: 10000 }
        );
        await page.waitForTimeout(400);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForFunction(() => window.scrollY === 0, null, { timeout: 2000 });

        const state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
        const layout = await page.evaluate(() => {
          const canvas = document.querySelector("#game");
          return {
            graphicsMode: canvas && canvas.dataset.graphicsMode,
            canvasWidth: canvas && canvas.width,
            canvasHeight: canvas && canvas.height,
            scrollY: window.scrollY,
            horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
          };
        });
        await page.screenshot({ path: path.join(scenarioRoot, "viewport.png"), fullPage: false });
        await page.locator("#game").screenshot({ path: path.join(scenarioRoot, "canvas.png") });
        fs.writeFileSync(path.join(scenarioRoot, "state.json"), JSON.stringify(state, null, 2) + "\n");
        fs.writeFileSync(
          path.join(scenarioRoot, "diagnostics.json"),
          JSON.stringify({ consoleErrors, expectedWarnings }, null, 2) + "\n"
        );

        const result = {
          viewport: viewportName,
          scenario,
          ...layout,
          consoleErrors: [...consoleErrors],
          expectedWarnings: [...expectedWarnings]
        };
        summary.push(result);
        if (layout.graphicsMode !== "hd" || layout.canvasWidth !== 576 || layout.canvasHeight !== 576) {
          throw new Error(`HD canvas contract failed: ${JSON.stringify(result)}`);
        }
        if (layout.horizontalOverflow) throw new Error(`horizontal overflow in ${viewportName}/${scenario}`);
        if (layout.scrollY !== 0) throw new Error(`non-zero scrollY in ${viewportName}/${scenario}: ${layout.scrollY}`);
        if (consoleErrors.length) throw new Error(`browser diagnostics in ${viewportName}/${scenario}: ${JSON.stringify(consoleErrors)}`);
        await page.close();
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + "\n");
}

console.log(`Captured ${summary.length} HD room scenarios under ${outputRoot}`);
