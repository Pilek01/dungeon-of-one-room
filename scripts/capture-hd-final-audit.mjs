import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const codexHome = process.env.CODEX_HOME || path.join(process.env.USERPROFILE || "", ".codex");
const playwrightPath = path.join(codexHome, "skills", "develop-web-game", "node_modules", "playwright", "index.js");
const playwright = await import(pathToFileURL(playwrightPath).href);
const { chromium } = playwright.default;

const baseUrl = process.argv[2] || "http://127.0.0.1:8769/index.html";
const outputRoot = path.resolve(process.argv[3] || "output/final-hd-audit/matrix");
const viewports = {
  desktop: { width: 1440, height: 1000 },
  mobile: { width: 390, height: 844 }
};
const scenarios = [
  "descent_hd",
  "enemy_roster_hd",
  "corruption_combat_hd",
  "corruption_cursed_hd",
  "corruption_merchant_hd",
  "corruption_forge_hd",
  "corruption_vault_hd",
  "abyss_combat_hd",
  "abyss_pact_hd",
  "abyss_otter_hd",
  "abyss_vault_hd",
  "vfx_showcase_hd",
  "vault_guardian_hd",
  "blacksmith_guardian_hd",
  "warden_phase1_hd",
  "warden_phase2_aegis_hd"
];
const bootViewportRelative = "boot/viewport.png";
const AUDIT_BATCH_SIZE = 8;
const scenarioBatches = [];
for (let batchStart = 0; batchStart < scenarios.length; batchStart += AUDIT_BATCH_SIZE) {
  scenarioBatches.push(scenarios.slice(batchStart, batchStart + AUDIT_BATCH_SIZE));
}
const summary = [];

fs.mkdirSync(outputRoot, { recursive: true });

function attachDiagnostics(page, consoleErrors, forbiddenClassicRequests) {
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type()) && !/AudioContext was not allowed to start/.test(message.text())) {
      consoleErrors.push({ type: message.type(), text: message.text() });
    }
  });
  page.on("pageerror", (error) => consoleErrors.push({ type: "pageerror", text: String(error) }));
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/assets/logo.png" || pathname.startsWith("/assets/sprite/")) {
      forbiddenClassicRequests.push(pathname);
    }
  });
}

function launchAuditBrowser() {
  return chromium.launch({
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--autoplay-policy=no-user-gesture-required"]
  });
}

async function captureBoot(viewportName, viewport) {
  const browser = await launchAuditBrowser();
  try {
    const context = await browser.newContext({ viewport });
    try {
      const bootPage = await context.newPage();
      const bootErrors = [];
      const forbiddenClassicRequests = [];
      attachDiagnostics(bootPage, bootErrors, forbiddenClassicRequests);
      await bootPage.goto(baseUrl, { waitUntil: "domcontentloaded" });
      await bootPage.waitForTimeout(1800);
      const bootMenuVisible = await bootPage.locator("#bootScreen").isVisible();
      const bootGraphics = await bootPage.evaluate(() => {
        const visible = (element) => {
          if (!element) return false;
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0
            && rect.width > 0 && rect.height > 0;
        };
        return {
          gameVersion: window.DUNGEON_GAME_VERSION || window.GAME_VERSION || "",
          versionIsExpected: window.DUNGEON_GAME_VERSION === "v0.8.2",
          hdUi: document.body.classList.contains("graphics-hd-ui"),
          appHidden: document.querySelector("#gameApp")?.classList.contains("app-hidden") || false,
          bootLogoVisible: visible(document.querySelector("#bootScreen .boot-logo")),
          hdBrandVisible: visible(document.querySelector("#bootScreen .boot-hd-brand"))
        };
      });
      const bootTarget = path.join(outputRoot, viewportName, "boot");
      fs.mkdirSync(bootTarget, { recursive: true });
      await bootPage.screenshot({ path: path.join(outputRoot, viewportName, bootViewportRelative) });
      summary.push({ viewport: viewportName, scenario: "boot", bootMenuVisible, bootGraphics, forbiddenClassicRequests, consoleErrors: bootErrors });
      if (
        !bootMenuVisible || !bootGraphics.versionIsExpected || bootGraphics.gameVersion !== "v0.8.2" || !bootGraphics.hdUi || !bootGraphics.appHidden
        || bootGraphics.bootLogoVisible || !bootGraphics.hdBrandVisible || bootErrors.length || forbiddenClassicRequests.length
      ) throw new Error(`boot audit failed for ${viewportName}: ${JSON.stringify({ bootMenuVisible, bootGraphics, forbiddenClassicRequests, bootErrors })}`);
      await bootPage.close();
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

async function captureScenarioBatch(viewportName, viewport, batchScenarios) {
  const browser = await launchAuditBrowser();
  try {
    const context = await browser.newContext({ viewport });
    try {
      for (const scenario of batchScenarios) {
        console.log(`Auditing ${viewportName}/${scenario}`);
      const page = await context.newPage();
        try {
          const consoleErrors = [];
          const forbiddenClassicRequests = [];
          attachDiagnostics(page, consoleErrors, forbiddenClassicRequests);
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
          await page.waitForTimeout(450);
          await page.evaluate(() => window.scrollTo(0, 0));

          const state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
          const metrics = await page.evaluate(() => {
            const visible = (element) => {
              if (!element) return false;
              const style = getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0
                && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
            };
            const canvas = document.querySelector("#game");
            const pixels = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height).data;
            let nonTransparent = 0;
            let magentaKey = 0;
            let luminanceTotal = 0;
            for (let index = 0; index < pixels.length; index += 4) {
              const red = pixels[index];
              const green = pixels[index + 1];
              const blue = pixels[index + 2];
              const alpha = pixels[index + 3];
              if (alpha > 0) nonTransparent += 1;
              if (red > 235 && blue > 235 && green < 30 && alpha > 0) magentaKey += 1;
              luminanceTotal += 0.2126 * red + 0.7152 * green + 0.0722 * blue;
            }
            const pixelCount = pixels.length / 4;
            return {
              gameVersion: window.DUNGEON_GAME_VERSION || window.GAME_VERSION || "",
              graphicsMode: canvas.dataset.graphicsMode,
              canvasWidth: canvas.width,
              canvasHeight: canvas.height,
              scrollY: window.scrollY,
              horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
              skillsBarVisible: visible(document.querySelector("#skillsBar")) && document.querySelector("#skillsBar").childElementCount > 0,
              mobileControlsVisible: visible(document.querySelector("#mobileControls")) && document.querySelectorAll("#mobileControls button").length > 0,
              nonTransparentRatio: nonTransparent / pixelCount,
              magentaKeyRatio: magentaKey / pixelCount,
              meanLuminance: luminanceTotal / pixelCount
            };
          });

          const target = path.join(outputRoot, viewportName, scenario);
          fs.mkdirSync(target, { recursive: true });
          fs.writeFileSync(path.join(target, "state.json"), JSON.stringify(state, null, 2) + "\n");
          await page.screenshot({ path: path.join(target, "viewport.png") });
          await page.locator("#game").screenshot({ path: path.join(target, "canvas.png") });
          const beforeReloadRequests = forbiddenClassicRequests.length;
          await page.reload({ waitUntil: "domcontentloaded" });
          await page.waitForFunction(() => {
            const canvas = document.querySelector("#game");
            return canvas?.dataset.graphicsMode === "hd" && canvas.width === 576 && canvas.height === 576;
          }, null, { timeout: 30000 });
          await page.waitForFunction((expected) => {
            if (typeof window.render_game_to_text !== "function") return false;
            const state = JSON.parse(window.render_game_to_text());
            return state.phase === "playing" && state.scenario === expected;
          }, scenario, { timeout: 30000 });
          const reloadGraphics = await page.evaluate(() => {
            const canvas = document.querySelector("#game");
            return {
              gameVersion: window.DUNGEON_GAME_VERSION || window.GAME_VERSION || "",
              graphicsMode: canvas?.dataset.graphicsMode || "",
              canvasWidth: canvas?.width || 0,
              canvasHeight: canvas?.height || 0,
              hdUi: document.body.classList.contains("graphics-hd-ui")
            };
          });
          const reloadForbiddenClassicRequests = forbiddenClassicRequests.slice(beforeReloadRequests);
          fs.writeFileSync(path.join(target, "diagnostics.json"), JSON.stringify({ consoleErrors, forbiddenClassicRequests, reloadGraphics, reloadForbiddenClassicRequests }, null, 2) + "\n");
          const result = { viewport: viewportName, scenario, ...metrics, reloadGraphics, forbiddenClassicRequests, reloadForbiddenClassicRequests, consoleErrors };
          summary.push(result);

          const mobileChromeMissing = viewportName === "mobile" && (!metrics.skillsBarVisible || !metrics.mobileControlsVisible);
          if (
            metrics.gameVersion !== "v0.8.2" || metrics.graphicsMode !== "hd" || metrics.canvasWidth !== 576 || metrics.canvasHeight !== 576
            || metrics.scrollY !== 0 || metrics.horizontalOverflow || mobileChromeMissing
            || metrics.nonTransparentRatio < 0.98 || metrics.magentaKeyRatio > 0.001
            || metrics.meanLuminance < 15 || metrics.meanLuminance > 190 || reloadGraphics.gameVersion !== "v0.8.2"
            || reloadGraphics.graphicsMode !== "hd" || reloadGraphics.canvasWidth !== 576 || reloadGraphics.canvasHeight !== 576
            || !reloadGraphics.hdUi || forbiddenClassicRequests.length || reloadForbiddenClassicRequests.length || consoleErrors.length
          ) throw new Error(`final HD audit failed: ${JSON.stringify(result)}`);
        } finally {
          await page.close();
        }
      }
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

try {
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    await captureBoot(viewportName, viewport);
    for (const batchScenarios of scenarioBatches) {
      await captureScenarioBatch(viewportName, viewport, batchScenarios);
    }
  }
} finally {
  fs.writeFileSync(path.join(outputRoot, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
}

console.log(`Captured ${summary.length} final HD audit views under ${outputRoot}`);
