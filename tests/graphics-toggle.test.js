const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const MODULE = path.join(ROOT, "render", "graphics-preference.js");
const moduleExists = fs.existsSync(MODULE);
const api = moduleExists ? require(MODULE) : null;

test("graphics preference module ships as a renderer-only dependency", () => {
  assert.equal(moduleExists, true, "render/graphics-preference.js must exist");
  const source = moduleExists ? fs.readFileSync(MODULE, "utf8") : "";
  assert.doesNotMatch(source, /audio|soundtrack|saveRunSnapshot|buildRunSave/i);

  const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const preferencePosition = index.indexOf("render/graphics-preference.js");
  const gamePosition = index.indexOf("game.js");
  assert.ok(preferencePosition >= 0, "preference module must be loaded in index.html");
  assert.ok(preferencePosition < gamePosition, "preference module must load before game.js");
});

test("graphics preference accepts only HD and Classic values", () => {
  assert.ok(api, "graphics preference API must load");
  assert.equal(api.normalizeMode("hd", "classic"), "hd");
  assert.equal(api.normalizeMode("classic", "hd"), "classic");
  assert.equal(api.normalizeMode(" HD ", "classic"), "hd");
  assert.equal(api.normalizeMode("broken", "hd"), "hd");
  assert.equal(api.normalizeMode(null, "classic"), "classic");
  assert.equal(api.defaultMode(true), "hd");
  assert.equal(api.defaultMode(false), "classic");
  assert.equal(api.isHd("hd"), true);
  assert.equal(api.isHd("classic"), false);
});

test("graphics preference reads, writes, and safely falls back", () => {
  assert.ok(api, "graphics preference API must load");
  const values = new Map([[api.STORAGE_KEY, "classic"]]);
  const storage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); }
  };

  assert.equal(api.readPreference(storage, true), "classic");
  assert.equal(api.writePreference(storage, "hd"), "hd");
  assert.equal(values.get(api.STORAGE_KEY), "hd");
  assert.equal(api.readPreference(storage, false), "hd");

  values.set(api.STORAGE_KEY, "invalid");
  assert.equal(api.readPreference(storage, true), "hd");
  assert.equal(api.readPreference(storage, false), "classic");
  assert.equal(api.readPreference({ getItem() { throw new Error("blocked"); } }, true), "hd");
  assert.equal(api.writePreference({ setItem() { throw new Error("blocked"); } }, "classic"), "classic");
});

test("Options exposes a keyboard-complete Graphics submenu", () => {
  const game = fs.readFileSync(path.join(ROOT, "game.js"), "utf8");
  assert.match(game, /menuOptionsView:\s*"root"[^\n]*"graphics"/);
  assert.match(game, /function getGraphicsOptionsItems\(\)/);
  assert.match(game, /id:\s*"hd",\s*key:\s*"1",\s*label:\s*"HD"/);
  assert.match(game, /id:\s*"classic",\s*key:\s*"2",\s*label:\s*"Classic"/);

  const rootItems = game.match(/function getMenuOptionsRootItems\(\) \{([\s\S]*?)\n  \}/);
  assert.ok(rootItems, "Options root items must remain discoverable");
  assert.match(rootItems[1], /id:\s*"graphics"/);
  assert.match(rootItems[1], /key:\s*"3"/);
  assert.match(rootItems[1], /title:\s*"Graphics"/);
  assert.match(rootItems[1], /getGraphicsMenuDescription\(\)/);

  assert.match(game, /state\.menuOptionsView === "graphics"[\s\S]*getGraphicsOptionsItems\(\)/);
  assert.match(game, /function openGraphicsOptions\(\)/);
  assert.match(game, /state\.menuOptionsView = "graphics"/);
  assert.match(game, /if \(state\.menuOptionsView === "graphics"\)[\s\S]*state\.menuOptionsView = "root"/);
  assert.match(game, /item\.id === "graphics"[\s\S]*openGraphicsOptions\(\)/);
  assert.match(game, /state\.menuOptionsView === "graphics"[\s\S]*setGraphicsPreference\(item\.id\)/);
  assert.match(game, /graphicsView[\s\S]*getGraphicsOptionsItems\(\)/);
  assert.match(game, /graphicsView[\s\S]*"Graphics"/);
  assert.match(game, /state\.menuOptionsView === "graphics" && \(key === "arrowleft" \|\| key === "a"\)/);
  assert.match(game, /state\.menuOptionsView === "graphics" && \(key === "arrowright" \|\| key === "d"\)/);
  assert.match(game, /state\.menuOptionsView === "graphics"[\s\S]*getGraphicsOptionsItems\(\)/);
});

test("runtime switching persists preference outside run state and reuses the graphics controller", () => {
  const game = fs.readFileSync(path.join(ROOT, "game.js"), "utf8");
  assert.match(game, /const graphicsPreferenceApi = window\.DungeonGraphicsPreference/);
  assert.match(game, /const shippingHdDefault = readGlobalFlag\("DUNGEON_HD_GRAPHICS_ENABLED", false\)/);
  assert.match(game, /let graphicsPreference = graphicsPreferenceApi\.readPreference\(localStorage, shippingHdDefault\)/);
  assert.match(game, /let graphicsTransitionPending = false/);
  assert.match(game, /function getRuntimeGraphicsMode\(\)/);

  const setter = game.match(/function setGraphicsPreference\(mode\) \{([\s\S]*?)\n  \}/);
  assert.ok(setter, "setGraphicsPreference must exist");
  assert.match(setter[1], /graphicsPreferenceApi\.writePreference\(localStorage, mode\)/);
  assert.match(setter[1], /applyGraphicsPreference\(\)/);

  const apply = game.match(/function applyGraphicsPreference\(\) \{([\s\S]*?)\n  \}/);
  assert.ok(apply, "applyGraphicsPreference must exist");
  assert.match(apply[1], /graphicsController\.initialize\(graphicsPreferenceApi\.isHd\(graphicsPreference\)\)/);
  assert.match(apply[1], /graphicsTransitionPending/);
  assert.match(apply[1], /markUiDirty\(\)/);
  assert.match(game, /function initializeGraphicsMode\(\)[\s\S]*applyGraphicsPreference\(\)/);

  const releaseGate = fs.readFileSync(path.join(ROOT, "tests", "hd-release-gates.test.js"), "utf8");
  assert.match(releaseGate, /run saves remain renderer-agnostic/);
  assert.match(releaseGate, /doesNotMatch\(build, \/DUNGEON_HD\|graphicsMode\|loadedAssets\|assetManifest\|renderer\/i\)/);
});

test("browser QA exercises the real menu flow, persistence, and run preservation", () => {
  const runnerPath = path.join(ROOT, "scripts", "capture-graphics-toggle-qa.mjs");
  assert.equal(fs.existsSync(runnerPath), true, "graphics-toggle browser runner must ship");
  const runner = fs.existsSync(runnerPath) ? fs.readFileSync(runnerPath, "utf8") : "";
  assert.match(runner, /status_emblems_hd/);
  assert.match(runner, /press\("Escape"\)/);
  assert.match(runner, /press\("Digit6"\)/);
  assert.match(runner, /press\("Digit3"\)/);
  assert.match(runner, /press\("Digit2"\)/);
  assert.match(runner, /graphicsMode/);
  assert.match(runner, /hdHud/);
  assert.match(runner, /assertPresentationConsistency/);
  assert.match(runner, /innerText\.toLowerCase\(\)\.includes\(expected\.toLowerCase\(\)\)/);
  assert.match(runner, /canvasWidth/);
  assert.match(runner, /canvasHeight/);
  assert.match(runner, /canvasVisible/);
  assert.match(runner, /mainMenuOnly/);
  assert.match(runner, /active gameplay canvas is not player-visible/);
  assert.match(runner, /dungeonOneRoomGraphicsMode/);
  assert.match(runner, /sameRunState/);
  assert.match(runner, /waitForGraphicsChoice/);
  assert.match(runner, /waitForGraphicsChoice\(page, "Classic"\)/);
  assert.match(runner, /waitForGraphicsChoice\(page, "HD"\)/);
  assert.match(runner, /page\.reload/);
  assert.match(runner, /consoleErrors/);
  assert.match(runner, /summary\.json/);
});

test("HD HUD follows the actual canvas mode during graphics transitions", () => {
  const game = fs.readFileSync(path.join(ROOT, "game.js"), "utf8");
  const sync = game.match(/function syncGraphicsUiMode\(\) \{([\s\S]*?)\n  \}/);
  assert.ok(sync, "syncGraphicsUiMode must exist");
  assert.match(
    sync[1],
    /mode === "hd"/,
    "HD HUD may only activate when the active canvas renderer is HD"
  );
  assert.match(
    sync[1],
    /getRuntimeGraphicsMode\(\)/,
    "settled HUD mode must still come from the active canvas renderer"
  );

  const apply = game.match(/function applyGraphicsPreference\(\) \{([\s\S]*?)\n  \}/);
  assert.ok(apply, "applyGraphicsPreference must exist");
  assert.match(
    apply[1],
    /graphicsTransitionPending = isPending;\s*\n\s*syncGraphicsUiMode\(\);/,
    "the HUD must be reconciled immediately after the renderer transition starts"
  );
  assert.match(
    apply[1],
    /graphicsTransitionPending = false;\s*\n\s*syncGraphicsUiMode\(\);\s*\n\s*markUiDirty\(\);/,
    "the HUD must be reconciled after an HD renderer finishes loading"
  );
  assert.match(
    apply[1],
    /graphicsController\.fallback\(error\);\s*\n\s*syncGraphicsUiMode\(\);/,
    "the fallback path must restore a matching Classic HUD"
  );

  const initialize = game.match(/function initializeGraphicsMode\(\) \{([\s\S]*?)\n  \}/);
  assert.ok(initialize, "initializeGraphicsMode must exist");
  assert.match(
    initialize[1],
    /resetLegacyCanvasMode\(\);\s*\n\s*syncGraphicsUiMode\(\);/,
    "an unavailable or failed HD renderer must leave a matching Classic HUD"
  );
});
test("HD boot UI follows the requested mode while the initial renderer is pending", () => {
  const game = fs.readFileSync(path.join(ROOT, "game.js"), "utf8");
  const sync = game.match(/function syncGraphicsUiMode\(\) \{([\s\S]*?)\n  \}/);
  assert.ok(sync, "syncGraphicsUiMode must exist");
  assert.match(
    sync[1],
    /graphicsTransitionPending\s*&&\s*gameAppEl\?\.classList\.contains\("app-hidden"\)/,
    "the boot screen must be allowed to show the requested renderer while the app is hidden"
  );
  assert.match(
    sync[1],
    /graphicsPreferenceApi\.isHd\(graphicsPreference\)/,
    "the pending boot presentation must follow the selected graphics preference"
  );
  assert.match(
    sync[1],
    /getRuntimeGraphicsMode\(\)/,
    "the settled HUD must continue to follow the actual canvas renderer"
  );
});
