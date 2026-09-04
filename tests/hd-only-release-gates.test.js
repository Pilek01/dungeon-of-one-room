const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const game = fs.readFileSync(path.join(root, "game.js"), "utf8");
const config = fs.readFileSync(path.join(root, "config.js"), "utf8");
const rankedHeaded = fs.readFileSync(path.join(root, "scripts", "online-v3-ranked-headed.mjs"), "utf8");

test("the document starts in HD and does not load retired presentation modules", () => {
  assert.match(index, /<body\b[^>]*class="[^"]*\bgraphics-hd-ui\b[^"]*"/u);
  const canvasTag = index.match(/<canvas\b[^>]*\bid="game"[^>]*>/u)?.[0];
  assert.ok(canvasTag, "the game canvas must remain discoverable");
  assert.match(canvasTag, /\bwidth="576"/u);
  assert.match(canvasTag, /\bheight="576"/u);
  assert.match(canvasTag, /\bclass="[^"]*\bgraphics-hd\b[^"]*"/u);
  assert.match(canvasTag, /\bdata-graphics-mode="hd"/u);
  assert.doesNotMatch(index, /assets\/logo\.png|render\/graphics-preference\.js/u);
});

test("startup never invokes Classic sprite preloaders", () => {
  const startupStart = game.lastIndexOf("syncMutatorUnlocks();");
  const startupEnd = game.lastIndexOf("requestAnimationFrame(frame);");
  assert.notEqual(startupStart, -1, "startup marker must remain discoverable");
  assert.notEqual(startupEnd, -1, "frame scheduling marker must remain discoverable");
  assert.ok(startupEnd > startupStart, "startup markers must remain ordered");
  const startup = game.slice(startupStart, startupEnd);
  assert.doesNotMatch(startup, /\bload[A-Z][A-Za-z0-9]*(?:Sprite|Sprites)\s*\(/u);
});

test("live version is v0.8.3", () => {
  assert.match(config, /window\.GAME_VERSION\s*=\s*"v0\.8\.3"/u);
});

test("scenario overrides cannot bypass HD readiness", () => {
  const start = game.indexOf("function bootstrapScenarioOverride()");
  const end = game.indexOf("function buildRoom()", start);
  assert.notEqual(start, -1, "scenario bootstrap must remain discoverable");
  assert.notEqual(end, -1, "scenario bootstrap boundary must remain discoverable");
  const body = game.slice(start, end);
  const readinessGate = body.indexOf("Promise.resolve(initialGraphicsReady)");
  const readyCheck = body.indexOf("outcome.ready !== true");
  const dismiss = body.indexOf("dismissBootScreen()");
  const runStart = body.indexOf("startRun(");
  assert.ok(readinessGate >= 0, "scenario bootstrap must await HD readiness");
  assert.ok(readyCheck > readinessGate, "scenario bootstrap must fail closed");
  assert.ok(dismiss > readyCheck, "boot may dismiss only after HD becomes ready");
  assert.ok(runStart > dismiss, "scenario gameplay may start only after boot dismissal");
});

test("boot input prepares the menu before revealing the HD app", () => {
  const start = game.indexOf("function enterSplash()");
  const end = game.indexOf("function isRunPauseMenuActive()", start);
  assert.notEqual(start, -1, "boot transition must remain discoverable");
  assert.notEqual(end, -1, "boot transition boundary must remain discoverable");
  const body = game.slice(start, end);
  const loading = body.indexOf('bootScreenEl?.classList.add("loading")');
  const readinessGate = body.indexOf("Promise.resolve(initialGraphicsReady)");
  const readyCheck = body.indexOf("outcome.ready !== true");
  const enterMenu = body.indexOf("enterMenu()");
  const dismiss = body.indexOf("dismissBootScreen()");
  assert.ok(loading >= 0, "boot input must start loading immediately");
  assert.ok(readinessGate > loading, "loading feedback must start before HD readiness completes");
  assert.ok(readinessGate >= 0, "boot input must await HD readiness");
  assert.ok(readyCheck > readinessGate, "failed HD readiness must stop the transition");
  assert.ok(enterMenu > readyCheck, "menu state must be prepared only after HD becomes ready");
  assert.ok(dismiss > enterMenu, "the app may be revealed only after the menu is prepared");
});

test("Ranked QA readiness hook uses only the live HD-only contract", () => {
  const start = rankedHeaded.indexOf("window.__DUNGEON_TEST_GRAPHICS_READY = async");
  const end = rankedHeaded.indexOf("window.__DUNGEON_TEST_TRIGGER_FATAL", start);
  assert.notEqual(start, -1, "Ranked QA graphics hook must remain discoverable");
  assert.ok(end > start, "Ranked QA graphics hook boundary must remain discoverable");
  const dismissStart = rankedHeaded.indexOf("async function dismissBoot(");
  const dismissEnd = rankedHeaded.indexOf("async function openNativeMenuOption(", dismissStart);
  assert.notEqual(dismissStart, -1, "Ranked boot dismissal must remain discoverable");
  assert.ok(dismissEnd > dismissStart, "Ranked boot dismissal boundary must remain discoverable");
  const dismissBoot = rankedHeaded.slice(dismissStart, dismissEnd);
  const hook = rankedHeaded.slice(start, end);
  assert.match(hook, /const outcome = await initialGraphicsReady/u);
  assert.match(hook, /requested:\s*"hd"/u);
  assert.match(hook, /mode:\s*getRuntimeGraphicsMode\(\)/u);
  assert.match(hook, /pending:\s*false/u);
  assert.match(hook, /ready:\s*outcome\?\.ready === true/u);
  assert.doesNotMatch(hook, /getGraphicsPreferenceMode|graphicsTransitionPending/u);
  assert.match(dismissBoot, /graphicsReady\?\.ready !== true/u);
});
